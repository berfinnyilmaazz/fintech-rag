# ADR-002: Amounts in Minor Units

**Status:** accepted, 2024-02

## Context
The original API accepted decimal amounts such as `12.50`. Floating-point parsing in some client libraries produced values like `12.499999`, and SEK and GBP rounding rules caused off-by-one-cent reconciliation differences.

## Decision
Payments API v2 represents every amount as an integer in the currency's minor unit (`1250` means 12.50 EUR). Decimal amounts are rejected with `400`.

## Consequences
- No rounding inside Vantor.
- Integrators migrating from v1 must multiply amounts by 100; this is the most common migration bug.
