import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const blockedNames = new Set([
  ".env",
  ".env.local",
  ".vault-password",
  "vault.enc.json",
  "wallets.json",
  "projects.json",
  "private-keys.json",
]);
const skippedDirectories = new Set([
  ".git",
  ".vercel",
  "node_modules",
  "__pycache__",
  ".pytest_cache",
  "artifacts",
  "vendor",
]);
const safeTextFiles = new Set([
  "README.md",
  "SECURITY.md",
  "scripts/security-check.mjs",
]);
const secretPatterns = [
  {
    name: "private key assignment",
    re: /\b(?:private[_ -]?key|wallet[_ -]?key|PRIVATE_KEY)\s*[:=]\s*["']?(?:0x)?[a-fA-F0-9]{64}\b/,
  },
  {
    name: "mnemonic assignment",
    re: /\b(?:mnemonic|seed[_ -]?phrase)\s*[:=]\s*["'][a-z]+(?:\s+[a-z]+){10,23}["']/i,
  },
  {
    name: "vault password assignment",
    re: /\b(?:vault[_ -]?password|VAULT_PASSWORD)\s*[:=]\s*["'][^"']{8,}["']/,
  },
  {
    name: "PEM private key",
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  },
  {
    name: "raw 32-byte secret",
    re: /\b0x[a-fA-F0-9]{64}\b/,
  },
];

const findings = [];

function isPublicDeploymentMetadata(relativePath) {
  return /^deployment(?:\.[A-Za-z0-9_-]+)?\.json$/.test(relativePath);
}

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    const relativePath = relative(root, absolutePath).replaceAll("\\", "/");

    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) walk(absolutePath);
      continue;
    }

    if (blockedNames.has(entry.name)) {
      findings.push(`${relativePath}: forbidden local-secret filename`);
      continue;
    }

    const info = statSync(absolutePath);
    if (info.size > 1_500_000 || /\.(?:png|jpe?g|webp|gif|ico|woff2?)$/i.test(entry.name)) {
      continue;
    }

    const text = readFileSync(absolutePath, "utf8");
    for (const pattern of secretPatterns) {
      if (!pattern.re.test(text)) continue;
      const allowed =
        safeTextFiles.has(relativePath) ||
        (pattern.name === "raw 32-byte secret" && isPublicDeploymentMetadata(relativePath));
      if (!allowed) findings.push(`${relativePath}: possible ${pattern.name}`);
    }
  }
}

walk(root);

if (findings.length) {
  console.error("Security scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Security scan passed: no wallet secrets, vault files, mnemonics, or env credentials found.");
