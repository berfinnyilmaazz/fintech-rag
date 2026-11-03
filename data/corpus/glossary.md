# Glossary

- **Payment intent**: the v2 object that tracks one payment from creation to capture. IDs start with `pi_`.
- **Authorisation**: the issuer's approval to hold funds. Auth rate is approved authorisations over attempts.
- **Capture**: moving authorised funds into the merchant balance. Uncaptured authorisations expire after 7 days.
- **Settlement**: the daily file in which the acquiring bank confirms captured funds to Vantor.
- **Payout**: a transfer from a merchant or seller balance to a bank account. IDs start with `po_`.
- **Payout lag**: days between capture and payout arrival, written T+n.
- **Chargeback**: a forced reversal initiated by the cardholder's bank, represented as a `dispute` object (`dp_`).
- **Chargeback ratio**: disputes in a month over settled transactions in the same month.
- **Soft decline**: a decline that may succeed on retry, such as `do_not_honor`.
- **Hard decline**: a decline that must not be retried, such as `stolen_card`.
- **MCC**: merchant category code assigned during onboarding.
- **KYB**: know your business, the verification run on every merchant and seller.
- **Idempotency key**: a client-supplied key that makes a write request safe to retry.
