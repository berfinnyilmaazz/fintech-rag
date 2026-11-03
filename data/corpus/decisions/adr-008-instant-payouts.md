# ADR-008: Instant Payouts over SEPA Instant

**Status:** accepted, 2026-07

## Context
Sellers on marketplaces asked for same-day access to funds. Standard payouts arrive T+2.

## Decision
Offer instant payouts in EUR over SEPA Instant, up to 10,000 EUR per payout, for a 1 percent fee. Instant payouts bypass the daily batch and are submitted individually by `payoutd`, still requiring an `Idempotency-Key`.

## Consequences
- Shipped in API 2.7.
- Instant payouts are excluded for sellers in their first 30 days, to limit fraud exposure.
