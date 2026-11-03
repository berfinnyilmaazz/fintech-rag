# Settlement Report: Halden Goods, 2026-09

Merchant: Halden Goods | Currency: SEK | Account manager: Sara Lind

| Metric | Value |
|---|---|
| Settled volume | 10.43M SEK |
| Transactions | 20,742 |
| Auth rate | 88.5% |
| Refund rate | 1.4% |
| Chargeback ratio | 0.49% |
| Payout lag | T+2 |

## Highlights
- Payout lag held at T+2 after the `ledgerd` batch window moved to 02:00 UTC.
- 3-D Secure challenge rate was stable; most challenges completed within 40 seconds.
- No payouts were returned by the partner bank this month.
- Webhook dispatch to the merchant endpoint stayed under 5 seconds at p95.
- Soft declines with `do_not_honor` were concentrated on two issuers and recovered on retry.
