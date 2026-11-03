# ADR-005: Risk Scoring Before Authorisation

**Status:** accepted, 2025-01

## Context
Fraud checks ran after authorisation, so blocked payments still cost an authorisation fee and showed up as pending charges on cardholders' statements.

## Decision
`risk-scorer` is called synchronously before the authorisation request, with a 150 ms budget. If it times out, the payment proceeds and is scored asynchronously.

## Consequences
- Blocked payments never reach the issuer.
- Authorisation latency rose by a median of 40 ms.
- A `risk-scorer` outage cannot stop payments, by design.
