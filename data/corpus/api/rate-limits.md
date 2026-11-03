# Rate Limits

Limits apply per API key, per second, using a token bucket.

| Endpoint group | Live mode | Sandbox |
|---|---|---|
| Payment intents | 100 req/s | 25 req/s |
| Payouts | 20 req/s | 5 req/s |
| Read endpoints (`GET`) | 200 req/s | 50 req/s |
| Reporting exports | 2 req/s | 2 req/s |

Exceeding a limit returns `429` with `E4290` and a `Retry-After` header in seconds.

Responses carry `X-RateLimit-Remaining` and `X-RateLimit-Reset`. Clients should back off when remaining drops below 10 percent rather than waiting for a 429.

Merchants running sales events can request a temporary limit increase through their account manager at least five working days in advance.
