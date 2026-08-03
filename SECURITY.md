# Security

This repository is a public frontend and contract proof package for a GenLayer Bradbury project.

## Secrets

Do not commit wallet private keys, vault files, faucet credentials, Vercel tokens, `.env` files, or local dashboard state.

The deployment wallet, if any, lives only in the private local workspace. Public repositories should contain public addresses, contract code, tests, deployment metadata, and UI code only.

## Contract authorization

The feed poster is the only account allowed to extend the original evidence and obligation dossier, and only before validator review begins. Starting review freezes that dossier. Other accounts submit counter-evidence through immutable challenge or appeal filings instead of mutating the original claim. Review, filing resolution, and mature settlement remain permissionless; archiving the resolved record is reserved for its original author.

## Reporting

Open a GitHub issue for non-sensitive bugs. For sensitive findings, contact the repository owner privately before publishing details.
