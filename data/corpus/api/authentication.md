# Authentication

All API requests are authenticated with a secret key sent as a bearer token:

```
Authorization: Bearer sk_live_...
```

## Key types
- `sk_live_` keys move real money and are shown only once, when created in the dashboard.
- `sk_test_` keys work against the sandbox and never touch card networks.
- `pk_` publishable keys are safe in browsers and can only create payment method tokens.

## Restricted keys
A restricted key (`rk_live_`) carries an explicit scope list, such as `payouts:read`. Use restricted keys for reporting tools and anything outside your core backend.

## Rotation
Keys can be rolled in the dashboard. The old key keeps working for a grace period you choose, up to 72 hours, so deployments can switch over without downtime.

## Errors
A missing or malformed key returns `401` with error code `E4010`. A valid key without the required scope returns `403` with `E4030`.
