# Security

## Secret Handling

This repository is public-deploy safe by design. It must not contain private keys, wallet vaults, seed phrases, deployment passwords, `.env` files, or local dashboard data.

The deployed contract address, deployer address, transaction hashes, and explorer links are public blockchain metadata and are safe to include.

## Frontend Boundary

The frontend is a static browser app. It reads public GenLayer contract state through `https://studio.genlayer.com/api` and sends writes only after the user approves transactions in an injected EVM wallet.

No backend server is included in this repository. No Vercel environment variables are required.

## Browser Hardening

`vercel.json` sets:

- Content Security Policy
- HSTS
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- Referrer policy
- Permissions policy

The app also filters displayed external URLs and renders untrusted error text as text nodes.

## Reporting

For security issues, open a private GitHub security advisory on the repository instead of posting exploit details in a public issue.
