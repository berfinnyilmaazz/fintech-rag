# Runbook: Webhook Backlog

**Alert:** `webhook_queue_age_seconds` above 1800 (SEV2).

## Steps
1. Check the dispatch dashboard for the endpoints with the most pending events. A single merchant endpoint timing out can hold worker slots.
2. If one endpoint dominates, enable endpoint isolation: `webhookctl isolate --endpoint=<id>`. Its events move to a separate slow lane.
3. If the backlog is global, scale dispatch workers: `webhookctl scale --workers=+8`.
4. Confirm the signing service is healthy; signature generation failures stop all dispatch.

## After recovery
Events are delivered in the order they leave the queue, not creation order. Remind affected merchants that handlers must use the event's `created` timestamp.

Do not purge the queue. Webhooks are retried for 3 days and merchants rely on eventually receiving every event.
