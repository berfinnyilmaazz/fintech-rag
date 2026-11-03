# ADR-007: Move the Payout Batch Window to 02:00 UTC

**Status:** accepted, 2026-03

## Context
The 18:00 UTC batch ran while late-day captures and refunds were still being written, so `payoutd` sometimes paid out funds that a refund minutes later needed. Merchants also saw payout lag drift to T+3.

## Decision
`payoutd` builds batches at 02:00 UTC, after the daily ledger close at 01:00 UTC.

## Consequences
- Payout lag returned to T+2 for all merchants.
- Refunds failing with `insufficient_balance` dropped sharply.
