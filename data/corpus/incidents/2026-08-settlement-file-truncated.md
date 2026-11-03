# Incident Review: Truncated Settlement File

**Date:** 2026-08-03 · **Severity:** SEV3 · **Duration:** 6 hours

## Summary
The acquirer's GBP settlement file arrived with 61 percent of its rows. Reconciliation showed a large delta, and GBP payouts for the day were held.

## Root cause
The acquirer's file transfer was interrupted and the partial file was not detected because Vantor only checked the file size, not the trailer record count.

## Action items
- Validate the trailer record count before ingesting any settlement file.
- Settlement file mismatch runbook now starts with the completeness check.
