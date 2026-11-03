# Runbook: Webhook Signing Secret Rotation

Rotate signing secrets every 12 months, or immediately if a secret may have leaked.

## Zero-downtime rotation
1. In the dashboard, choose **Roll secret** on the endpoint and pick an overlap window (default 24 hours, maximum 7 days).
2. During the overlap Vantor signs every event with both secrets, so `X-Vantor-Signature` carries two `v1` values.
3. Deploy the new secret to the receiving service, keeping the old one. Accept an event if either `v1` value verifies.
4. Confirm in the dispatch log that events verify with the new secret.
5. Remove the old secret from your service before the overlap ends.

## Leaked secret
Choose an overlap of 0. Events signed only with the new secret will fail verification until you deploy it, but they are retried for 3 days, so no event is lost.

Secrets are per endpoint; rotating one endpoint does not affect others.
