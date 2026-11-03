# Refund Policy

Merchants issue refunds with `POST /v2/refunds`, referencing a succeeded payment intent.

## Rules
- Refunds are allowed up to 180 days after capture.
- Partial refunds are allowed; the total refunded cannot exceed the captured amount.
- Refunds are funded from the merchant balance. If the balance is insufficient, the refund stays `pending` for up to 5 days, then fails with `insufficient_balance`.
- Vantor's processing fee on the original payment is not returned.

## Timing
Refunds reach the buyer's card in 5 to 10 business days, depending on the issuer. The refund object moves to `succeeded` when the acquirer accepts it, not when the buyer sees it.

## Refunds and disputes
A payment that is already fully refunded cannot be refunded again. If a buyer opens a dispute on a refunded payment, see the disputes policy: the merchant should submit the refund as evidence rather than issuing a second refund.
