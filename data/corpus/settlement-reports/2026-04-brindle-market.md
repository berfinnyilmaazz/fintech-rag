# Settlement Report: Brindle Market, 2026-04

Merchant: Brindle Market | Currency: EUR | Account manager: Ines Kohl

| Metric | Value |
|---|---|
| Settled volume | 0.79M EUR |
| Transactions | 10,345 |
| Auth rate | 91.9% |
| Refund rate | 1.5% |
| Chargeback ratio | 0.25% |
| Payout lag | T+2 |

## Highlights
- Affected by the duplicate payouts incident on 2026-04-08; duplicated amounts were recovered from sellers by 2026-04-30.
- Refunds were processed within the 180-day window with no `insufficient_balance` failures.
- Webhook dispatch to the merchant endpoint stayed under 5 seconds at p95.
- 3-D Secure challenge rate was stable; most challenges completed within 40 seconds.
- Chargeback ratio stayed below the 0.9% scheme monitoring threshold.
- Soft declines with `do_not_honor` were concentrated on two issuers and recovered on retry.
