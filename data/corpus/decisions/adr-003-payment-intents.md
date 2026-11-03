# ADR-003: Payment Intents Instead of Charges

**Status:** accepted, 2024-03

## Context
The v1 charge object assumed a payment completes in one request. Strong customer authentication requires a 3-D Secure step for most European cards, which does not fit a single synchronous call.

## Decision
v2 introduces the payment intent, a state machine: `requires_confirmation` → `processing` → `requires_action` | `succeeded` | `payment_failed`. Clients create, then confirm, then react to webhooks.

## Consequences
- 3-D Secure is handled natively.
- v1 charges cannot be migrated in place; v1 is kept for existing integrations until its sunset date, 2026-12-31.
