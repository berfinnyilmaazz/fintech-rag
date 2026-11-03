# Disputes and Chargebacks

When a cardholder's bank opens a chargeback, Vantor creates a `dispute` (`dp_`) and fires `dispute.created`. The disputed amount plus a 15 EUR dispute fee is debited from the merchant balance immediately.

## Responding
Merchants have 7 calendar days to submit evidence with `POST /v2/disputes/{id}/evidence`. Missing the deadline loses the dispute automatically.

## Disputes on refunded payments
If the payment was already refunded, do not refund again. Submit the refund ID and its `succeeded` timestamp as evidence; the dispute is usually won, and the debited amount is returned. The 15 EUR fee is returned only if the dispute is won.

## Chargeback ratio thresholds
- Above **0.9%** in a month: the merchant enters monitoring and must submit a remediation plan.
- Above **1.5%** for two consecutive months: payouts move to a rolling reserve of 10 percent for 90 days.

Ratios are reported monthly in each merchant's settlement report.
