import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAccount, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE_PATH = resolve(ROOT, "contracts", "oracle_v2.py");
const CONFIG_PATH = resolve(ROOT, "contract.config.json");
const DEPLOYMENT_PATHS = [
  resolve(ROOT, "deployment.json"),
  resolve(ROOT, "deployment.testnetBradbury.json"),
];
const FRONTEND_PATH = resolve(ROOT, "app.js");
const INDEX_PATH = resolve(ROOT, "index.html");
const README_PATH = resolve(ROOT, "README.md");
const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function loadEnv(path) {
  if (!existsSync(path)) throw new Error(`Missing ignored Bradbury environment file: ${path}`);
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function contractAddress(receipt) {
  const candidates = [
    receipt?.data?.contract_address,
    receipt?.data?.contractAddress,
    receipt?.txDataDecoded?.contractAddress,
    receipt?.contractAddress,
    receipt?.contract_address,
    receipt?.recipient,
  ];
  return candidates.find((value) => ADDRESS_RE.test(value || ""));
}

function replaceRequired(text, pattern, replacement, label) {
  const updated = text.replace(pattern, replacement);
  if (updated === text) throw new Error(`Could not update ${label}.`);
  return updated;
}

async function withPipelineRetry(label, task, attempts = 12) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      const message = String(error?.details || error?.message || error);
      const transient = /backpressure|not currently accepting transactions|429|503|timeout/i.test(message);
      if (!transient || attempt === attempts) throw error;
      const delayMs = Math.min(30_000, 4_000 * attempt);
      console.log(`${label} delayed by Bradbury backpressure; retry ${attempt}/${attempts} in ${delayMs / 1000}s.`);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));
    }
  }
  throw lastError;
}

const envPath = resolve(process.env.BRADBURY_ENV_FILE || resolve(ROOT, ".env.bradbury.local"));
loadEnv(envPath);

const privateKey = (process.env.BRADBURY_PRIVATE_KEY || "").trim();
if (!PRIVATE_KEY_RE.test(privateKey)) {
  throw new Error("BRADBURY_PRIVATE_KEY is missing from the ignored environment file.");
}

const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const account = createAccount(privateKey);
if (
  config.deployer &&
  String(config.deployer).toLowerCase() !== account.address.toLowerCase()
) {
  throw new Error(`Deployment wallet mismatch: expected public address ${config.deployer}.`);
}

const source = readFileSync(SOURCE_PATH);
const sourceSha256 = createHash("sha256").update(source).digest("hex");
const client = createClient({ chain: testnetBradbury, account });

console.log(`Deploying canonical Oracle V2 to Bradbury from ${account.address}`);
const hash = await withPipelineRetry(
  "Deployment",
  () => client.deployContract({ code: new Uint8Array(source), args: [] }),
);
console.log(`Deployment transaction: ${hash}`);
const receipt = await client.waitForTransactionReceipt({
  hash,
  status: TransactionStatus.ACCEPTED,
  interval: 5000,
  retries: 240,
});
const address = contractAddress(receipt);
if (!address) throw new Error("Deployment was accepted but no contract address was decoded.");

let readValue = null;
for (let attempt = 0; attempt < 20; attempt += 1) {
  try {
    readValue = Number(await client.readContract({
      address,
      functionName: "get_feed_count",
      args: [],
    }));
    break;
  } catch (error) {
    if (attempt === 19) throw error;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 3000));
  }
}
if (readValue !== 0) throw new Error(`Unexpected initial feed count: ${readValue}`);

const deployedAt = new Date().toISOString();
const deployment = {
  project: "06-oracle",
  name: "Oracle",
  network: "testnetBradbury",
  chainId: 4221,
  rpc: "https://rpc-bradbury.genlayer.com",
  explorer: "https://explorer-bradbury.genlayer.com",
  contractAddress: address,
  deployTxHash: hash,
  contractExplorer: `https://explorer-bradbury.genlayer.com/address/${address}`,
  deployer: account.address,
  deployedAt,
  statusName: "ACCEPTED",
  smoke: {
    readMethod: "get_feed_count",
    readValue,
    verifiedAt: new Date().toISOString(),
  },
};
for (const path of DEPLOYMENT_PATHS) {
  writeFileSync(path, `${JSON.stringify(deployment, null, 2)}\n`);
}

const nextConfig = {
  ...config,
  sourceSha256,
  sourceBytes: source.length,
  contractAddress: address,
  deployTxHash: hash,
  deployer: account.address,
};
writeFileSync(CONFIG_PATH, `${JSON.stringify(nextConfig, null, 2)}\n`);

const frontend = replaceRequired(
  readFileSync(FRONTEND_PATH, "utf8"),
  /const CONTRACT = "0x[0-9a-fA-F]{40}";/,
  `const CONTRACT = "${address}";`,
  "frontend contract address",
);
writeFileSync(FRONTEND_PATH, frontend);

const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
const index = readFileSync(INDEX_PATH, "utf8")
  .replace(
    /https:\/\/explorer-bradbury\.genlayer\.com\/address\/0x[0-9a-fA-F]{40}/g,
    deployment.contractExplorer,
  )
  .replace(/Contract 0x[0-9a-fA-F]{4}\.\.\.[0-9a-fA-F]{4} -&gt;|Contract 0x[0-9a-fA-F]{4}\.\.\.[0-9a-fA-F]{4} ->/g, `Contract ${shortAddress} ->`);
writeFileSync(INDEX_PATH, index);

let readme = readFileSync(README_PATH, "utf8");
readme = readme
  .replace(/https:\/\/explorer-bradbury\.genlayer\.com\/address\/0x[0-9a-fA-F]{40}/g, deployment.contractExplorer)
  .replace(/\| Contract \| `0x[0-9a-fA-F]{40}` \|/, `| Contract | \`${address}\` |`)
  .replace(/\| Deploy transaction \| `0x[0-9a-fA-F]{64}` \|/, `| Deploy transaction | \`${hash}\` |`)
  .replace(/\| Deployer \| `0x[0-9a-fA-F]{40}` \|/, `| Deployer | \`${account.address}\` |`)
  .replace(/\| Deployed \| [^\n]+ \|/, `| Deployed | ${deployedAt} |`)
  .replace(/\| Contract size \| [\d,]+ bytes \|/, `| Contract size | ${source.length.toLocaleString("en-US")} bytes |`)
  .replace(/\| Source SHA-256 \| `[0-9a-f]{64}` \|/, `| Source SHA-256 | \`${sourceSha256}\` |`);
writeFileSync(README_PATH, readme);

console.log(`Oracle V2 contract: ${address}`);
console.log(deployment.contractExplorer);
console.log("Canonical mapping, deployment records, frontend, footer, and README updated.");
