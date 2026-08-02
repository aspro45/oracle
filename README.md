# Oracle

Source-backed price and policy oracle running on GenLayer Bradbury.

Oracle is built for cases where a number is not useful unless the source trail is visible. A feed poster can publish a value, attach obligations and evidence, then send the record through GenLayer review, challenge and appeal paths. The frontend is a read surface for that lifecycle, not a mock dashboard.

## Links

| Surface | URL |
| --- | --- |
| Live app | https://source-oracle-feeds.vercel.app |
| Repository | https://github.com/aspro45/oracle |
| Explorer | https://explorer-bradbury.genlayer.com/address/0xd798b993adD0C74008f43Ea34Fb8Db5ae48e9302 |

## Contract

| Field | Value |
| --- | --- |
| Network | GenLayer Bradbury |
| Chain ID | 4221 |
| Contract | `0xd798b993adD0C74008f43Ea34Fb8Db5ae48e9302` |
| Deploy transaction | `0x6b41759cfac8b67c41cea7edbbb236f22bf8b70b36920dba92750ab97196a983` |
| Deployer | `0x9A62e5Aa759e806a0965D4c7A5D10a1dae21AaEc` |
| Deployed | 2026-08-02T21:07:15.934Z |
| Source | `contracts/oracle_v2.py` |
| Contract size | 50,199 bytes |
| Source SHA-256 | `482077edacd51c6d4a9e4fce0c6fcf5f9c12c95182e8ed9b4d1fcf75a61b3cb2` |

`contract.config.json` is the machine-readable source map. It binds the frontend address, canonical source path, source hash, deployment record and deploy transaction so the submitted byte source is unambiguous.

The contract uses GenLayer web rendering, prompt-based review and exact comparative validator agreement to keep the final oracle state tied to public evidence rather than a single submitter's claim.

Production reads pass through the same-origin `/api/genlayer` relay. The relay validates JSON-RPC requests, applies bounded retries for temporary upstream failures and keeps browser clients away from cross-origin RPC instability. Wallet transactions still target the canonical Bradbury network.

## What The Protocol Does

1. Posts a bonded price claim and preserves its public source.
2. Routes every new feed through `review_claim_with_genlayer`.
3. Requires exact validator agreement on price extraction, validity and confidence.
4. Tracks each challenger and bond independently, then permits challenge and appeal rulings.
5. Holds settlement until all filings close and the deadline passes.
6. Refunds unclear outcomes and marks a stake claimed only after a successful transfer.

Useful read methods include `get_feed_count`, `get_feed`, `get_claim_record`, `get_stake`, `get_challenges`, `get_appeals` and `get_audit_log`.

## Verification

`tests/test_oracle.py` checks the canonical source map, posted-feed review path, challenge and appeal effects, independent multi-challenger stakes, and non-swallowed payouts. The direct GenVM suite passes 4/4.

## Local Run

This is a static app. Serve the repository folder and open the printed localhost URL.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Repository Safety

The repository is meant to be public. It should contain contract source, frontend code and deployment metadata only. Wallet private keys, vault files, `.env` files, `.vercel/` state and local dashboard data must stay outside the repo.
