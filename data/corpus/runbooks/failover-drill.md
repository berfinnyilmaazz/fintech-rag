# Runbook: Regional Failover Drill

The Payments API runs active-passive across two regions. A failover drill runs every quarter.

## Before the drill
- Announce the window to merchants 7 days ahead.
- Confirm replication lag on the payments database is below 5 seconds.

## Drill
1. Set the primary region read-only: `regionctl drain --region=primary`.
2. Wait for replication lag to reach 0.
3. Promote the secondary: `regionctl promote --region=secondary`.
4. Run the synthetic payment suite in live mode with the internal test merchant.
5. Fail back after 30 minutes using the same steps in reverse.

## Success criteria
Failover completes within 5 minutes, no idempotency keys are lost, and no payout batch is submitted during the window. `payoutd` is paused for the full drill.
