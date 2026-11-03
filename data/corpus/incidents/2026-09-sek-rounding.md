# Incident Review: SEK Fee Rounding

**Date:** 2026-09-15 · **Severity:** SEV3 · **Duration:** 9 days until detected

## Summary
Processing fees on SEK payments were rounded half-up instead of half-even, overcharging Mossgate Books and Halden Goods by a total of 412 SEK.

## Root cause
A fee calculation refactor in API 2.8 replaced the shared money library with inline arithmetic.

## Action items
- Refund the overcharge in the October settlement.
- Lint rule banning arithmetic on amounts outside the money library.
- Fixed in API 2.9.
