# Vantor Company Overview

Vantor is a payments infrastructure company for online marketplaces in Europe. Founded in 2021, it lets marketplaces accept card payments from buyers and pay out to their sellers through a single API.

## Products
- **Payments API**: card acceptance through payment intents (`/v2/payment_intents`).
- **Payouts**: scheduled and instant transfers to seller bank accounts (`/v2/payouts`).
- **Disputes**: evidence submission and chargeback tracking.
- **Risk scoring**: every payment is scored by `risk-scorer` before authorisation.

## Core services
- `ledgerd`: the double-entry ledger; every balance movement is a ledger entry.
- `payoutd`: builds payout batches and submits them to partner banks.
- `risk-scorer`: returns a score from 0 to 100 and an allow, review or block decision.

## Teams
Platform, Payments, Risk & Compliance, Merchant Success and Finance Operations. Each merchant has a named account manager in Merchant Success.

Vantor serves eight marketplace merchants, settles in EUR, GBP and SEK, and publishes a monthly settlement report per merchant.
