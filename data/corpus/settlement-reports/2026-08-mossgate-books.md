# Settlement Report: Mossgate Books, 2026-08

Merchant: Mossgate Books | Currency: SEK | Account manager: Sara Lind

| Metric | Value |
|---|---|
| Settled volume | 33.46M SEK |
| Transactions | 36,309 |
| Auth rate | 90.1% |
| Refund rate | 4.4% |
| Chargeback ratio | 0.42% |
| Payout lag | T+2 |

## Highlights
- Chargeback ratio stayed below the 0.9% scheme monitoring threshold.
- 3-D Secure challenge rate was stable; most challenges completed within 40 seconds.
- Webhook dispatch to the merchant endpoint stayed under 5 seconds at p95.
- Soft declines with `do_not_honor` were concentrated on two issuers and recovered on retry.
- Payout lag held at T+2 after the `ledgerd` batch window moved to 02:00 UTC.
