# Settlement Report: Mossgate Books, 2026-07

Merchant: Mossgate Books | Currency: SEK | Account manager: Sara Lind

| Metric | Value |
|---|---|
| Settled volume | 29.07M SEK |
| Transactions | 47,427 |
| Auth rate | 94.6% |
| Refund rate | 1.4% |
| Chargeback ratio | 0.21% |
| Payout lag | T+2 |

## Highlights
- Refunds were processed within the 180-day window with no `insufficient_balance` failures.
- Soft declines with `do_not_honor` were concentrated on two issuers and recovered on retry.
- 3-D Secure challenge rate was stable; most challenges completed within 40 seconds.
- Chargeback ratio stayed below the 0.9% scheme monitoring threshold.
- Card testing attempts were blocked by `risk-scorer` before reaching the issuer.
