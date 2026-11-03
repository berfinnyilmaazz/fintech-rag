# Incident Review: Webhook Dispatch Delay

**Date:** 2026-06-19 · **Severity:** SEV2 · **Duration:** 2 hours 25 minutes

## Summary
Webhook queue age reached 95 minutes. Merchants saw orders stuck as unpaid because `payment_intent.succeeded` arrived late.

## Root cause
One merchant endpoint started responding in 9.8 seconds, just under the 10-second timeout. Every dispatch worker spent most of its time waiting on that endpoint.

## Action items
- Endpoint isolation: slow endpoints move to a separate lane automatically after 3 slow responses (shipped in API 2.6).
- Webhook backlog runbook updated with `webhookctl isolate`.
- Recommend that merchants also poll `GET /v2/payment_intents/{id}` for orders pending more than 10 minutes.
