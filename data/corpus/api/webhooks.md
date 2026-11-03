# Webhooks

Vantor sends events to an HTTPS endpoint you register in the dashboard.

## Dispatch
Events are sent as `POST` with a JSON body containing `id` (`evt_`), `type`, `created` and `data`. Respond with any `2xx` within 10 seconds. Failed deliveries are retried with exponential backoff for up to 3 days.

Dispatch order is not guaranteed. Use `created` and the object's own `status` rather than arrival order.

## Signature verification
Every request carries an `X-Vantor-Signature` header:

```
X-Vantor-Signature: t=1767225600,v1=5f2b...
```

Compute HMAC-SHA256 over `{t}.{raw body}` with your endpoint's signing secret and compare it to `v1` in constant time. Reject requests where `t` is older than 5 minutes.

## Secret rotation
During a rotation the header carries two `v1` values, one per active secret. Accept the request if either matches. See the signing secret rotation runbook.

## Common events
`payment_intent.succeeded`, `payout.paid`, `payout.failed`, `dispute.created`, `dispute.closed`.
