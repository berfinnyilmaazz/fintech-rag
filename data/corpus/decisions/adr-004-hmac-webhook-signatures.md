# ADR-004: HMAC-SHA256 Webhook Signatures

**Status:** accepted, 2024-05

## Context
Webhooks were originally authenticated only by a secret path segment in the endpoint URL, which leaked through proxy logs.

## Decision
Every webhook carries `X-Vantor-Signature` with a timestamp and an HMAC-SHA256 over `{timestamp}.{raw body}`. Receivers reject timestamps older than 5 minutes to block replays. During secret rotation, events carry one signature per active secret.

## Consequences
- Receivers must verify against the raw body, before JSON parsing reformats it.
- Rotation requires an overlap window, documented in the signing secret rotation runbook.
