# Settlement Report: Oakhurst Outdoor, 2026-08

Merchant: Oakhurst Outdoor | Currency: GBP | Account manager: Tom Reyes

| Metric | Value |
|---|---|
| Settled volume | 3.09M GBP |
| Transactions | 67,403 |
| Auth rate | 93.2% |
| Refund rate | 2.2% |
| Chargeback ratio | 0.49% |
| Payout lag | T+2 |

## Highlights
- Soft declines with `do_not_honor` were concentrated on two issuers and recovered on retry.
- No payouts were returned by the partner bank this month.
- Refunds were processed within the 180-day window with no `insufficient_balance` failures.
- Payout lag held at T+2 after the `ledgerd` batch window moved to 02:00 UTC.
- A small number of payouts failed with `invalid_iban` and were paid after sellers corrected their details.
