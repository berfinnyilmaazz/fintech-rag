# Runbook: Returned Payout

A partner bank can return a payout days after `payout.paid` was sent, for example when the account was closed.

## Steps
1. `payoutd` receives the return file and fires `payout.failed` with `failure_code` and the original `po_` ID.
2. Confirm the amount was credited back to the seller balance in `ledgerd`. If not, escalate to Finance Operations.
3. Disable payouts for the seller's bank account so the next batch does not repeat the failure.
4. Merchant Success notifies the merchant, who asks the seller for new bank details.
5. New bank details trigger a fresh verification deposit before payouts resume.

## Repeated returns
Three returns for one seller in 30 days raise a `risk-scorer` review, because rotating bank accounts is a known fraud pattern.
