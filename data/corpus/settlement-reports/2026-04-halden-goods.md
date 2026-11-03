# Settlement Report: Halden Goods, 2026-04

Merchant: Halden Goods | Currency: SEK | Account manager: Sara Lind

| Metric | Value |
|---|---|
| Settled volume | 10.89M SEK |
| Transactions | 14,339 |
| Auth rate | 94.0% |
| Refund rate | 1.9% |
| Chargeback ratio | 0.56% |
| Payout lag | T+2 |

## Highlights
- 3-D Secure challenge rate was stable; most challenges completed within 40 seconds.
- A small number of payouts failed with `invalid_iban` and were paid after sellers corrected their details.
- Webhook dispatch to the merchant endpoint stayed under 5 seconds at p95.
- Refunds were processed within the 180-day window with no `insufficient_balance` failures.
