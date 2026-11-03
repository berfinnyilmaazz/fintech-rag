# Settlement Report: Quayside Electronics, 2026-08

Merchant: Quayside Electronics | Currency: EUR | Account manager: Marc Dubois

| Metric | Value |
|---|---|
| Settled volume | 1.45M EUR |
| Transactions | 35,808 |
| Auth rate | 90.1% |
| Refund rate | 3.0% |
| Chargeback ratio | 0.22% |
| Payout lag | T+2 |

## Highlights
- Webhook dispatch to the merchant endpoint stayed under 5 seconds at p95.
- 3-D Secure challenge rate was stable; most challenges completed within 40 seconds.
- No payouts were returned by the partner bank this month.
- Payout lag held at T+2 after the `ledgerd` batch window moved to 02:00 UTC.
- Two disputes were won by submitting the refund ID as evidence.
