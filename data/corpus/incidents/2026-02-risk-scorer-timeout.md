# Incident Review: risk-scorer Timeouts

**Date:** 2026-02-11 · **Severity:** SEV2 · **Duration:** 47 minutes

## Summary
A model deploy to `risk-scorer` raised p99 latency from 90 ms to 600 ms. Calls exceeded the 150 ms budget, so payments proceeded unscored and were scored afterwards, as designed. Risk exposure rose but no payments failed.

## Root cause
The new model loaded a feature table per request instead of at startup.

## Action items
- Load test every model deploy at 2x peak traffic before release.
- Alert when the asynchronous scoring share exceeds 5 percent.
- Add a deploy-time latency check to the risk deploy pipeline.
