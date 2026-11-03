# Runbook: Settlement File Mismatch

**Alert:** `settlement_reconcile_delta` above 0 for more than 2 hours after the acquirer file arrives.

## Steps
1. Open the reconciliation view for the file date and note the delta per currency.
2. Check whether the acquirer file is complete: the trailer record count must match the line count. A truncated file is the most common cause; request a resend.
3. If the file is complete, list unmatched rows with `ledgerd recon --date=<date> --unmatched`.
4. Captures missing from the file are usually late captures after 23:30 UTC; they appear in the next day's file. Mark them `expected_next_day`.
5. Rows in the file but not in the ledger indicate a capture written to the acquirer but not to `ledgerd`. Escalate as SEV2 to Payments.

## Resolution
The alert clears when the delta returns to 0. Never post manual ledger adjustments without a second approver from Finance Operations.
