// genlayer-lite.js - small browser client for GenLayer Bradbury frontends.
import { createClient, createAccount, testnetBradbury } from "./vendor/genlayer-browser.js";

export const RPC = "https://rpc-bradbury.genlayer.com";
export const BRADBURY_HEX = "0x107d"; // 4221

const READ_RPC = typeof window === "undefined"
  ? RPC
  : `${window.location.origin}/api/genlayer`;
const reader = createClient({
  chain: testnetBradbury,
  account: createAccount(),
  endpoint: READ_RPC,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function rpcErrorText(value) {
  return Array.isArray(value)
    ? value.map((item) => item?.message || item?.shortMessage || item?.details || String(item)).join(" ")
    : (value?.message || value?.shortMessage || value?.details || String(value || ""));
}

function isTransientRpcError(value) {
  return /rate limit|LimitExceededRpcError|Request exceeds defined limit|429|503|timeout|failed to fetch|network/i.test(rpcErrorText(value));
}

async function quietTransientRpcConsole(task) {
  const original = console.error;
  console.error = (...args) => {
    const text = rpcErrorText(args);
    if (/GenLayer RPC error/i.test(text) || isTransientRpcError(text)) return;
    original(...args);
  };
  try {
    return await task();
  } finally {
    console.error = original;
  }
}

export async function withRetry(fn, tries = 1, timeoutMs = 5500) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await Promise.race([
        fn(),
        new Promise((_, reject) => setTimeout(
          () => reject(new Error("Studionet read timed out.")),
          timeoutMs,
        )),
      ]);
    } catch (e) {
      last = e;
      const msg = (e?.message || e || "").toString();
      if (!/failed to fetch|network|timeout|timed out|429|503/i.test(msg)) throw e;
      if (i < tries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
      }
    }
  }
  throw last;
}

export function normalizeReadResult(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    return value;
  }
}
export function makeReader(address) {
  return {
    read: (functionName, args = []) =>
      withRetry(() => quietTransientRpcConsole(() => reader.readContract({ address, functionName, args }))).then(normalizeReadResult),
  };
}

export async function rpc(method, params) {
  const r = await fetch(READ_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || method + " failed");
  return j.result;
}

export async function balanceOf(address) {
  return BigInt(await rpc("eth_getBalance", [address, "latest"]));
}

async function ensureBradbury(provider) {
  if (!provider?.request) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BRADBURY_HEX }] });
  } catch (err) {
    if (err && (err.code === 4902 || /Unrecognized chain/i.test(err.message || ""))) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: BRADBURY_HEX,
          chainName: "GenLayer Bradbury",
          nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
          rpcUrls: [RPC],
          blockExplorers: [{ name: "Bradbury Explorer", url: "https://explorer-bradbury.genlayer.com" }],
        }],
      });
    } else { throw err; }
  }
}

function wrapProvider(provider) {
  if (!provider || provider.__glBradburyPatched) return provider;
  const orig = provider.request.bind(provider);
  provider.request = async (req) => {
    if (req?.method === "eth_sendTransaction" && Array.isArray(req.params) && req.params[0]) {
      const tx = { ...req.params[0] };
      if (!tx.gas) tx.gas = "0x200000";
      return orig({ method: "eth_sendTransaction", params: [tx] });
    }
    return orig(req);
  };
  provider.__glBradburyPatched = true;
  return provider;
}

export async function connectWallet() {
  const eth = window.ethereum;
  if (!eth) throw new Error("No EVM wallet found. Install MetaMask.");
  const accts = await eth.request({ method: "eth_requestAccounts" });
  await ensureBradbury(eth);
  return accts[0];
}

export async function activeAccount() {
  const eth = window.ethereum;
  if (!eth) return null;
  try {
    const accs = await eth.request({ method: "eth_accounts" });
    return Array.isArray(accs) && accs[0] ? accs[0] : null;
  } catch (_) { return null; }
}

export async function write(address, functionName, args = [], value = 0n, waitStatus = "ACCEPTED") {
  const eth = window.ethereum;
  if (!eth) throw new Error("No EVM wallet found. Install MetaMask.");
  await ensureBradbury(eth);
  let signer = await activeAccount();
  if (!signer) signer = (await eth.request({ method: "eth_requestAccounts" }))[0];
  const wrapped = wrapProvider(eth);
  const client = createClient({ chain: testnetBradbury, account: signer, provider: wrapped });
  const hash = await client.writeContract({ address, functionName, args, value });
  await client.waitForTransactionReceipt({ hash, status: waitStatus, retries: 200 });
  return hash;
}

export const short = (a) => (a ? a.slice(0, 6) + "\u2026" + a.slice(-4) : "");
export const toGen = (wei) => (Number(BigInt(wei)) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 3 });
export const GEN = (n) => BigInt(Math.round(n * 1e6)) * 10n ** 12n;

export function fmtErr(e) {
  if (!e) return "unknown error";
  if (typeof e === "string") return e;
  const parts = [];
  const add = (v) => { if (v && typeof v === "string" && !parts.includes(v)) parts.push(v); };
  add(e.shortMessage); add(e.details); add(e.message);
  add(e?.data?.message); add(e?.cause?.shortMessage); add(e?.cause?.message);
  add(e?.cause?.data?.message); add(e?.info?.error?.message);
  return parts.length ? parts.join(" | ") : String(e);
}
