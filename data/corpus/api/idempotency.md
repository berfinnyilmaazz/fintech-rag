# Idempotency

Network failures make it impossible to know whether a write reached Vantor. Idempotency keys make retries safe.

Send an `Idempotency-Key` header with every `POST` request. Use a UUID v4 generated once per logical operation, not once per attempt.

## Behaviour
- The first request with a key is executed and its response stored for 24 hours.
- A repeat with the same key and the same body returns the stored response without executing again.
- A repeat with the same key and a different body returns `409` with error code `E4091` (`idempotency_key_reused`).
- A repeat while the first request is still running returns `409` with `E4092` (`idempotency_request_in_progress`); retry after a short delay.

## Payouts
Since API 2.4, `POST /v2/payouts` rejects requests without an `Idempotency-Key` with `400` and `E4003`. This was introduced after the April 2026 duplicate payout incident.

Keys are scoped to the API key that sent them.
