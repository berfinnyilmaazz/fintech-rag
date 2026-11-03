# Settlement Report: Copperline, 2026-05

Merchant: Copperline | Currency: GBP | Account manager: Tom Reyes

| Metric | Value |
|---|---|
| Settled volume | 0.75M GBP |
| Transactions | 12,594 |
| Auth rate | 92.8% |
| Refund rate | 4.1% |
| Chargeback ratio | 0.36% |
| Payout lag | T+2 |

## Highlights
- Migration from Payments API v1 to v2 completed; amounts are now sent in minor units.
- Soft declines with `do_not_honor` were concentrated on two issuers and recovered on retry.
- Two disputes were won by submitting the refund ID as evidence.
- The `risk-scorer` review queue was cleared within 24 hours on every day of the month.
