# Sandbox Testing

The sandbox mirrors the live API at `https://sandbox.api.vantor.example` and accepts `sk_test_` keys only.

## Test cards
| Card number | Result |
|---|---|
| `4000 0000 0000 0002` | Succeeds |
| `4000 0000 0000 9995` | Declines with `card_declined_insufficient_funds` |
| `4000 0000 0000 0119` | Declines with `do_not_honor` |
| `4000 0027 6000 3184` | Requires 3-D Secure |
| `4000 0000 0000 0259` | Succeeds, then opens a dispute after 1 minute |

## Payouts
Payouts to the test IBAN ending `3000` succeed; payouts to the test IBAN ending `5555` fail with `account_closed` and fire `payout.failed`.

## Webhooks
Trigger any event from the dashboard's event simulator. Sandbox webhooks are signed with a separate signing secret.
