# Settlement Report: Pellucid Beauty, 2026-10

Merchant: Pellucid Beauty | Currency: EUR | Account manager: Marc Dubois

| Metric | Value |
|---|---|
| Settled volume | 3.21M EUR |
| Transactions | 48,324 |
| Auth rate | 93.0% |
| Refund rate | 2.6% |
| Chargeback ratio | 0.49% |
| Payout lag | T+2 |

## Highlights
- Soft declines with `do_not_honor` were concentrated on two issuers and recovered on retry.
- The `risk-scorer` review queue was cleared within 24 hours on every day of the month.
- Webhook dispatch to the merchant endpoint stayed under 5 seconds at p95.
- Refunds were processed within the 180-day window with no `insufficient_balance` failures.
