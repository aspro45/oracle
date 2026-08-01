# Oracle

Source-backed price and policy oracle running on GenLayer Bradbury.

Oracle is built for cases where a number is not useful unless the source trail is visible. A feed poster can publish a value, attach obligations and evidence, then send the record through GenLayer review, challenge and appeal paths. The frontend is a read surface for that lifecycle, not a mock dashboard.

## Links

| Surface | URL |
| --- | --- |
| Live app | https://tanawo3-oracle.vercel.app |
| Repository | https://github.com/aspro45/oracle |
| Explorer | https://explorer-bradbury.genlayer.com/address/0x5462cfed3c5a40775e2Fe3169D13cF23Ec483802 |

## Contract

| Field | Value |
| --- | --- |
| Network | GenLayer Bradbury |
| Chain ID | 4221 |
| Contract | `0x5462cfed3c5a40775e2Fe3169D13cF23Ec483802` |
| Deploy transaction | `0x4c7f0d82794aca134c73dfea06b21e343eb8a25ec9417a0ed8554832a55ca3d7` |
| Deployed | 2026-07-01T17:58:09.029Z |
| Source | `contracts/oracle_v2.py` |
| Contract size | 74,325 bytes |
| Smoke writes | 17 finalized transactions |

The contract uses GenLayer web rendering, prompt-based review and comparative validator agreement to keep the final oracle state tied to public evidence rather than a single submitter's claim.

Production reads pass through the same-origin `/api/genlayer` relay. The relay validates JSON-RPC requests, applies bounded retries for temporary upstream failures and keeps browser clients away from cross-origin RPC instability. Wallet transactions still target the canonical Bradbury network.

## What The Protocol Does

1. Defines the claim standard for a feed.
2. Accepts a posted price or status value.
3. Records source obligations, documentation links and price evidence.
4. Opens a review window for GenLayer reasoning.
5. Allows challenge and appeal records before final verification.
6. Maintains reputation and legacy compatibility methods for the original UI path.

Useful read methods include `get_feed_count`, `get_claim_count`, `get_dispute_count`, `get_contest_count`, `get_entry_count`, `get_claim`, `get_dispute` and `get_contest`.

## Verified Smoke Trail

| Action | Transaction |
| --- | --- |
| `set_claim_standard` | [0x861dec0d...5ec766](https://explorer-bradbury.genlayer.com/tx/0x861dec0d0e873ba4176ce03a4ff857806ba7bfab37ff4ab784d70d53175ec766) |
| `post_price` | [0xd28962a6...e0bc18](https://explorer-bradbury.genlayer.com/tx/0xd28962a6b04fc02a2fd99273aac92b1e00b867c9745b5ba637a78ae96ce0bc18) |
| `add_obligation` | [0x8975873e...79bc15](https://explorer-bradbury.genlayer.com/tx/0x8975873e1c89fed3329ebea918791d8834d9422e1bf6851ea2a831c09f79bc15) |
| `add_evidence_price` | [0x65df7d89...9fbd3c](https://explorer-bradbury.genlayer.com/tx/0x65df7d891a07f1d4896f37e37dedd21012429eb120f6b4e629ad6acfb99fbd3c) |
| `add_evidence_docs` | [0xc978ae8d...516cc0](https://explorer-bradbury.genlayer.com/tx/0xc978ae8da5873e3ccd3ecaa675a6b335d930da564cc2141f3e45315379516cc0) |
| `review` | [0xc4f6c312...3f6a26](https://explorer-bradbury.genlayer.com/tx/0xc4f6c312e01f7a3d0ef370311e51b47e56982e73db95fced0fca9435d63f6a26) |

## Local Run

This is a static app. Serve the repository folder and open the printed localhost URL.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Repository Safety

The repository is meant to be public. It should contain contract source, frontend code and deployment metadata only. Wallet private keys, vault files, `.env` files, `.vercel/` state and local dashboard data must stay outside the repo.
