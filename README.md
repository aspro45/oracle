# Oracle

Source-backed price and policy oracle running on GenLayer Studionet.

Oracle is built for cases where a number is not useful unless the source trail is visible. A feed poster can publish a value, attach obligations and evidence, then send the record through GenLayer review, challenge and appeal paths. The frontend is a read surface for that lifecycle, not a mock dashboard.

## Links

| Surface | URL |
| --- | --- |
| Live app | https://oracle-github.vercel.app |
| Repository | https://github.com/aspro45/oracle |
| Explorer | https://explorer-studio.genlayer.com/contracts/0x215585A266e5a9249057dd5E1096692957D4F319 |

## Contract

| Field | Value |
| --- | --- |
| Network | GenLayer Studionet |
| Chain ID | 61999 |
| Contract | `0x215585A266e5a9249057dd5E1096692957D4F319` |
| Deploy transaction | `0x9d7ec4f0fed6d52e59fc73b6658b22a3d3b84ea0ac982aa99311227939d8af2d` |
| Deployed | 2026-06-24T02:43:09.735Z |
| Source | `contracts/oracle_v2.py` |
| Contract size | 74,325 bytes |
| Smoke writes | 17 finalized transactions |

The contract uses GenLayer web rendering, prompt-based review and comparative validator agreement to keep the final oracle state tied to public evidence rather than a single submitter's claim.

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
| `set_claim_standard` | [0x02457e50...f1d1b7](https://explorer-studio.genlayer.com/tx/0x02457e50bb49e5f5bbb134af1795729ecd9548a3a7b0d0690bd48f63cdf1d1b7) |
| `post_price` | [0x7fd60035...350623](https://explorer-studio.genlayer.com/tx/0x7fd60035b1432e5fedf59c6826128ab67f7e7045e9e69704c8b8d4ee6f350623) |
| `add_obligation` | [0x73fcf9c9...64dc9d](https://explorer-studio.genlayer.com/tx/0x73fcf9c925717f1e41ed3f0c48bd59267e89f63068bd61bf1e2bd2ec7f64dc9d) |
| `add_evidence_price` | [0xeef558f6...4ba856](https://explorer-studio.genlayer.com/tx/0xeef558f667a06e3237e98cdff480b8aa82764c4f5e3b79ef98b02c2ba74ba856) |
| `add_evidence_docs` | [0x33271ff1...bea33f](https://explorer-studio.genlayer.com/tx/0x33271ff1fad4b0c46d934dccd2587a336188f04c2b162618601a552a9abea33f) |
| `review` | [0x773a30f0...292c09](https://explorer-studio.genlayer.com/tx/0x773a30f0a00918eed93877a2dc2a23358c20b46851ad6db23cebb7ff8d292c09) |

## Local Run

This is a static app. Serve the repository folder and open the printed localhost URL.

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Repository Safety

The repository is meant to be public. It should contain contract source, frontend code and deployment metadata only. Wallet private keys, vault files, `.env` files, `.vercel/` state and local dashboard data must stay outside the repo.
