# ADR-006: Mandatory Idempotency Keys on Payouts

**Status:** accepted, 2026-04

## Context
In the April 2026 duplicate payout incident, merchant retries after a timeout created second payouts, because idempotency keys were optional on `POST /v2/payouts`. Money paid out twice is hard to recover from sellers.

## Decision
`POST /v2/payouts` requires an `Idempotency-Key` header and returns `400` with `E4003` without one. `payoutd` additionally deduplicates batch entries on `(seller, amount, idempotency key)` before submission to the bank.

## Consequences
- Shipped in API 2.4.
- Merchants without keys had a 30-day grace period with warnings in the response before enforcement.
