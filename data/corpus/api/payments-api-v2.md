# Payments API v2

The Payments API lets a marketplace charge a buyer's card and move the funds into its Vantor balance. v2 is the current version.

## Creating a payment intent
Send `POST /v2/payment_intents` with:
- `amount`: integer amount in minor units, for example `1250` for 12.50.
- `currency`: `EUR`, `GBP` or `SEK`.
- `payment_method`: a token from the Vantor Checkout form.
- `capture_method`: `automatic` or `manual`.

The response is a payment intent with an ID starting with `pi_` and `status: requires_confirmation`.

## Confirming
Call `POST /v2/payment_intents/{id}/confirm`. The intent moves to `processing`, then `succeeded`, or `requires_action` when the issuer asks for 3-D Secure.

## Capturing later
With `capture_method: manual`, call `POST /v2/payment_intents/{id}/capture` within 7 days.

## Retries
Every write accepts an `Idempotency-Key` header; see the idempotency guide.

## Events
v2 sends `payment_intent.succeeded`, `payment_intent.payment_failed` and `payment_intent.requires_action`.
