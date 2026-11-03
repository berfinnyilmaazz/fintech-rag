# Transaction Monitoring

Every payment is scored by `risk-scorer` before authorisation. Scores range from 0 to 100.

## Decisions
- **0–64 allow**: payment proceeds.
- **65–84 review**: payment proceeds but is queued for an analyst within 24 hours.
- **85–100 block**: payment is declined with `decline_code: risk_blocked`.

## Signals
Velocity per card and per device, mismatched billing and IP country, card testing patterns (many small amounts), and prior disputes on the same card.

## Payout monitoring
Payouts above 50,000 EUR, or a seller's first payout above 5,000 EUR, are held for manual review. A seller who changes bank account within 48 hours before a payout has that payout held as well.

## Reporting
Suspicious activity is reported to the financial intelligence unit by Risk & Compliance. Merchants are never told that a report was filed.
