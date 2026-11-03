# Payments API v1

> **DEPRECATED** — superseded by Payments API v2. v1 stops accepting requests on 2026-12-31. New integrations must use v2.

The Payments API lets a marketplace charge a buyer's card and move the funds into its Vantor balance.

## Creating a charge
Send `POST /v1/charges` with:
- `amount`: decimal amount in major units, for example `12.50`.
- `currency`: `EUR`, `GBP` or `SEK`.
- `source`: a card token from the Vantor Checkout form.
- `capture`: `true` to capture immediately, `false` to authorise only.

A successful call returns a charge object with an ID starting with `ch_` and `status: succeeded`.

## Capturing later
Call `POST /v1/charges/{id}/capture` within 7 days.

## Retries
v1 has no idempotency support. A timed-out request may have created a charge; check `GET /v1/charges?source=` before retrying.

## Events
v1 sends `charge.succeeded` and `charge.failed` webhooks.
