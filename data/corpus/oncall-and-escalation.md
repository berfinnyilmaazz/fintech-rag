# On-call and Escalation

Platform and Payments each run a weekly on-call rotation, handing over on Mondays at 10:00 CET.

## Severity levels
- **SEV1**: money moved incorrectly or the Payments API is unavailable. Page the incident commander immediately and open a status page entry within 15 minutes.
- **SEV2**: degraded authorisation, delayed payouts or webhook dispatch lag above 30 minutes. Page the owning team.
- **SEV3**: a single merchant affected, no money at risk. Handle in business hours.

## Escalation path
1. Primary on-call acknowledges within 5 minutes.
2. Secondary on-call is paged after 15 minutes without acknowledgement.
3. Head of Engineering is paged for every SEV1.
4. Risk & Compliance must be informed of any incident touching payouts, because payout errors can trigger regulatory reporting.

Every SEV1 and SEV2 gets a written incident review within five working days, stored under `incidents/`. Action items are tracked until closed and referenced from the relevant runbook.
