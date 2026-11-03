# Error Codes

Errors return a JSON body `{ "error": { "code", "message", "decline_code" } }`.

| Code | HTTP | Meaning |
|---|---|---|
| `E4003` | 400 | Required header missing, such as `Idempotency-Key` on payouts |
| `E4010` | 401 | Missing or invalid API key |
| `E4030` | 403 | Key lacks the required scope |
| `E4040` | 404 | Object not found |
| `E4091` | 409 | Idempotency key reused with a different body |
| `E4092` | 409 | Idempotent request still in progress |
| `E4220` | 422 | Card declined; see `decline_code` |
| `E4290` | 429 | Rate limit exceeded |
| `E5000` | 500 | Internal error; safe to retry with the same idempotency key |

## Decline codes on E4220
- `card_declined_insufficient_funds`: soft decline, retry after the buyer tops up.
- `do_not_honor`: soft decline, generic issuer refusal.
- `expired_card`: hard decline, ask for a new card.
- `stolen_card`: hard decline, never retry; flagged to `risk-scorer`.
