# Oracle V2

Oracle V2 is a GenLayer bonded source oracle for public price feeds. A poster submits an asset, a public source URL, a claimed price, and a GEN bond. Challengers can counter-bond bad feeds. GenLayer validators read the public source, extract the price, compare evidence, and settle the feed through an auditable on-chain lifecycle.

This repository contains the standalone public frontend, the deployed GenLayer contract source, deployment metadata, and local test scaffolding for the Oracle project.

## Live Contract

| Item | Value |
| --- | --- |
| Network | GenLayer Studionet |
| Chain ID | `61999` |
| Contract | `0x215585A266e5a9249057dd5E1096692957D4F319` |
| Explorer | https://explorer-studio.genlayer.com/contracts/0x215585A266e5a9249057dd5E1096692957D4F319 |
| RPC | `https://studio.genlayer.com/api` |
| Deployed | `2026-06-24T02:43:09.735Z` |

## What It Does

- Posts bonded price claims for any asset with a public source URL.
- Lets anyone challenge a feed with an equal counter-bond.
- Uses GenLayer web access and LLM consensus to read the source and extract the price.
- Supports review, challenge, appeal, final verification, reputation, and audit history in the V2 contract.
- Preserves the original frontend-compatible methods: `post_price`, `challenge`, `verify`, `get_feed`, and `get_feed_count`.

## Repository Layout

```text
.
|-- index.html                 # Static product frontend
|-- styles.css                 # Visual system and responsive layout
|-- app.js                     # Browser client for reads, wallet writes, charts, and UI state
|-- shared/genlayer-lite.js    # Minimal GenLayer Studionet browser client
|-- contracts/oracle_v2.py     # Current deployed GenLayer contract
|-- contracts/oracle.py        # Original compact MVP contract
|-- deployment.json            # Public deploy and smoke-test metadata
|-- gltest.studionet.yaml      # Optional deploy config, reads DEV_PRIVATE_KEY from local env only
|-- tests/test_oracle.py       # Local contract tests
|-- vercel.json                # Static deploy config and security headers
|-- SECURITY.md                # Public security notes
```

## Local Preview

Run a static server from the repository root. Do not open `index.html` directly, because browser modules need an HTTP origin.

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

Alternative:

```powershell
python -m http.server 3000
```

## Vercel Deploy

This is a static site. It does not need private environment variables.

Recommended Vercel settings:

| Setting | Value |
| --- | --- |
| Framework Preset | Other |
| Build Command | Leave empty |
| Output Directory | `.` |
| Install Command | Leave default or empty |
| Environment Variables | None |

CLI deploy:

```powershell
vercel --prod
```

The included `vercel.json` applies production security headers, including CSP, frame blocking, MIME sniff protection, referrer policy, and HSTS.

## Security Model

- No private keys, wallet vaults, mnemonics, or `.env` files belong in this repository.
- The frontend only requests wallet access through the user's injected EVM wallet.
- Writes are sent to GenLayer Studionet with zero gas price handling for the zero-fee network.
- The contract uses public URLs only; prompt-injection instructions inside source pages are explicitly ignored by contract prompts.
- Source links displayed in the frontend are filtered to `http` and `https` protocols.
- Dynamic chain errors are rendered as text, not HTML.
- Vercel deploys require no secrets.

Run the repository safety check before pushing or deploying:

```powershell
npm run security:scan
```

## GenLayer References

- Docs: https://docs.genlayer.com/
- Studio: https://studio.genlayer.com/contracts
- Explorer: https://explorer-studio.genlayer.com/
- Website: https://www.genlayer.com/

## Status

Oracle V2 is deployed and smoke-tested on Studionet. The frontend reads live contract state and supports wallet-driven feed posting, challenges, and verification.
