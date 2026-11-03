# Runbook: Elevated Decline Rate

**Alert:** auth rate for a merchant drops more than 5 points below its 7-day average for 30 minutes.

## Steps
1. Split declines by `decline_code`. A spike in `do_not_honor` concentrated on one issuer usually means an issuer outage; check the acquirer status page.
2. A spike in `risk_blocked` means `risk-scorer` is blocking more payments. Check for a recent rule or model deploy and roll it back if the timing matches.
3. A spike in `card_declined_insufficient_funds` with many small amounts suggests card testing. Enable the card testing rule for the merchant and inform Risk & Compliance.
4. If declines are spread across issuers and codes, check authorisation latency; timeouts at the acquirer surface as generic declines.

## Retries
Never auto-retry hard declines. Soft declines may be retried once after 24 hours.
