# ADR-001: Double-entry Ledger for All Balances

**Status:** accepted, 2021-09

## Context
Early balances were stored as a single number per merchant and updated in place. Investigating a wrong balance meant replaying API logs.

## Decision
All balance movements are written to `ledgerd` as double-entry journal entries. Balances are derived by summing entries, never stored directly. Entries are immutable; corrections are new reversing entries.

## Consequences
- Every balance can be explained line by line.
- Daily reconciliation against the safeguarding account becomes possible.
- Writes are more expensive; balance reads use a materialised view refreshed on each entry.
