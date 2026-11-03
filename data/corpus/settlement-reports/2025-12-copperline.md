# Settlement Report: Copperline, 2025-12

Merchant: Copperline | Currency: GBP | Account manager: Tom Reyes

| Metric | Value |
|---|---|
| Settled volume | 0.78M GBP |
| Transactions | 9,930 |
| Auth rate | 89.3% |
| Refund rate | 3.7% |
| Chargeback ratio | 0.48% |
| Payout lag | T+2 |

## Highlights
- A small number of payouts failed with `invalid_iban` and were paid after sellers corrected their details.
- Webhook dispatch to the merchant endpoint stayed under 5 seconds at p95.
- Refunds were processed within the 180-day window with no `insufficient_balance` failures.
