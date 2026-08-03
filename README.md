# Oracle

Source-backed price and policy oracle running on GenLayer Bradbury.

Oracle is built for cases where a number is not useful unless the source trail is visible. A feed poster can publish a value, attach obligations and evidence, then send the record through GenLayer review, challenge and appeal paths. The frontend is a read surface for that lifecycle, not a mock dashboard.

## Links

| Surface | URL |
| --- | --- |
| Live app | https://source-oracle-feeds.vercel.app |
| Repository | https://github.com/aspro45/oracle |
| Explorer | https://explorer-bradbury.genlayer.com/address/0x0e6de7862BB9c3aA6A467a268178D18bb0266d06 |

## Contract

| Field | Value |
| --- | --- |
| Network | GenLayer Bradbury |
| Chain ID | 4221 |
| Contract | `0x0e6de7862BB9c3aA6A467a268178D18bb0266d06` |
| Deploy transaction | `0x4bb64bd264272972fec4d227ffc535edad04327dea006044f52385d4e356452a` |
| Deployer | `0x9A62e5Aa759e806a0965D4c7A5D10a1dae21AaEc` |
| Deployed | 2026-08-03T09:45:34.171Z |
| Source | `contracts/oracle_v2.py` |
| Contract size | 50,566 bytes |
| Source SHA-256 | `6ad1c881b38f3c44d2c04dc4c8c0beadcbbee616d28f1f9fb74fcf35066297f0` |

`contract.config.json` is the machine-readable source map. It binds the frontend address, canonical source path, source hash, deployment record and deploy transaction so the submitted byte source is unambiguous.

The contract uses GenLayer web rendering, prompt-based review and exact comparative validator agreement to keep the final oracle state tied to public evidence rather than a single submitter's claim.

Production reads pass through the same-origin `/api/genlayer` relay. The relay validates JSON-RPC requests, applies bounded retries for temporary upstream failures and keeps browser clients away from cross-origin RPC instability. Wallet transactions still target the canonical Bradbury network.

## What The Protocol Does

1. Posts a bonded price claim and preserves its public source.
2. Lets only the feed poster extend the original evidence or obligation dossier before review.
3. Freezes that dossier when independent validator review begins.
4. Routes counter-evidence through separately attributed challenge and appeal records.
5. Requires exact validator agreement on price extraction, validity and confidence.
6. Tracks each challenger and bond independently, then permits challenge and appeal rulings.
7. Holds settlement until all filings close and the deadline passes.
8. Refunds unclear outcomes and marks a stake claimed only after a successful transfer.

Useful read methods include `get_feed_count`, `get_feed`, `get_claim_record`, `get_stake`, `get_challenges`, `get_appeals` and `get_audit_log`.

## Verification

`tests/test_oracle.py` checks the canonical source map, author-only dossier writes, post-review immutability, separately attributed counter-evidence, posted-feed review, challenge and appeal effects, independent multi-challenger stakes, and non-swallowed payouts. The direct GenVM suite passes 5/5.

## Access Model

The original feed dossier is controlled by its poster until review starts. Calls to `add_evidence` and `add_obligation` from any other address revert with `claim_author_only`. Once review begins, those methods revert with `claim_locked` even for the poster.

Independent parties do not mutate the original claim. They attach evidence to immutable challenge or appeal filings. GenLayer review, filing resolution and mature settlement remain permissionless, while archiving a resolved record is reserved for its original author.

## Reproducible Bradbury Deployment

`scripts/deploy-bradbury.mjs` deploys only `contracts/oracle_v2.py`, verifies `get_feed_count` on the resulting address, then updates both deployment records, `contract.config.json`, the frontend address and this README.

```bash
BRADBURY_ENV_FILE=/path/to/ignored.env npm run deploy:bradbury
```

## Local Run

This is a static app. Serve the repository folder and open the printed localhost URL.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Repository Safety

The repository is meant to be public. It should contain contract source, frontend code and deployment metadata only. Wallet private keys, vault files, `.env` files, `.vercel/` state and local dashboard data must stay outside the repo.
