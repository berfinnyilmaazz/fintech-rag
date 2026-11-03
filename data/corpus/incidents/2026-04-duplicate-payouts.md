# Incident Review: Duplicate Payouts

**Date:** 2026-04-08 · **Severity:** SEV1 · **Duration:** 3 hours 10 minutes

## Summary
412 seller payouts across three merchants were paid twice, totalling 186,300 EUR.

## Timeline
- 02:00 UTC: `payoutd` batch submission slowed because the partner bank's API was degraded.
- 02:04: merchant integrations calling `POST /v2/payouts` timed out and retried. None sent an `Idempotency-Key`, so each retry created a new payout.
- 05:10: the safeguarding reconciliation broke and paged on-call.

## Root cause
Idempotency keys were optional on payouts, and `payoutd` did not deduplicate batch entries.

## Action items
- Require `Idempotency-Key` on `POST /v2/payouts` (ADR-006, shipped in API 2.4).
- Deduplicate batch entries in `payoutd`.
- 97 percent of the duplicated amount was recovered by 2026-04-30.
