# Runbook: Ledger Reconciliation

`ledgerd` is reconciled daily against the safeguarding bank account at 06:00 UTC.

## Invariant
Sum of all merchant and seller balances in `ledgerd` plus pending payouts must equal the safeguarding account balance, to the cent.

## When the invariant breaks
1. Run `ledgerd recon --safeguarding --date=<date>` to list the breaking currency and amount.
2. Compare against yesterday's payout batches; a batch submitted twice to the bank, or submitted without ledger entries, shows up here first.
3. Freeze the next payout batch for the affected currency with `payoutctl freeze --currency=<ccy>`.
4. Open a SEV1 if the difference exceeds 10,000 EUR or cannot be explained within 2 hours.

Safeguarding breaks are reportable to the regulator within 1 business day, so Risk & Compliance is informed at step 3, not after resolution.
