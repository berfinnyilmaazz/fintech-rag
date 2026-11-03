# Pagination

List endpoints such as `GET /v2/payment_intents`, `GET /v2/payouts` and `GET /v2/disputes` use cursor pagination.

## Parameters
- `limit`: 1 to 100, default 20.
- `starting_after`: an object ID; returns objects created after it.
- `ending_before`: an object ID; returns objects created before it.

## Response
```
{ "data": [...], "has_more": true, "next_cursor": "pi_9QeT..." }
```

Pass `next_cursor` as `starting_after` to fetch the next page. Stop when `has_more` is false.

Results are ordered by creation time, newest first. Offset pagination is not supported, because objects created during a scan would shift page boundaries.

For full monthly exports, use the reporting export endpoint instead of paging through millions of objects.
