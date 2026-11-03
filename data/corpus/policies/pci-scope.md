# PCI Scope

Vantor is a PCI DSS Level 1 service provider. Merchants integrating through Vantor Checkout stay in the smallest PCI scope (SAQ A), because raw card numbers never touch their servers.

## Keeping scope small
- Load the Checkout form only from Vantor's domain; do not self-host or proxy the script.
- Never log full card numbers, even in error reports. Logs may contain only the last four digits and the `pm_` token.
- Server-side code handles tokens only.

## Raising scope
Merchants who send raw card numbers to `POST /v2/payment_methods` directly need SAQ D and an annual attestation, and must be approved by Risk & Compliance first.

## Vault
The tokenisation vault runs in an isolated network segment. Only `risk-scorer` and the authorisation service may detokenise, and every detokenisation is audit logged.
