# Payout Schedule

## Standard payouts
Funds become available T+2 business days after capture. `payoutd` builds one batch per currency and submits it to the partner bank daily at 02:00 UTC. Until March 2026 the batch window was 18:00 UTC.

## Instant payouts
Available for EUR to SEPA Instant reachable accounts, up to 10,000 EUR per payout, for a 1 percent fee. Instant payouts arrive within 10 seconds or fail with `instant_unavailable`.

## Minimums and holds
- Minimum payout: 10 EUR, 10 GBP or 100 SEK.
- New merchants have a 7-day hold on their first payout.
- Rolling reserves from the disputes policy are deducted before payout.

## Failures
A failed payout fires `payout.failed` with a `failure_code` such as `account_closed` or `invalid_iban`. The amount returns to the balance and the next scheduled payout includes it once the bank account is fixed.
