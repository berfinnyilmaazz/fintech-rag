# Data Retention

| Data | Retention | Reason |
|---|---|---|
| Payment and payout records | 10 years | Accounting law |
| KYB documents | 5 years after the relationship ends | Anti-money-laundering rules |
| Card data (tokenised) | Until the token is deleted or 13 months unused | PCI scope minimisation |
| API request logs | 90 days | Debugging and abuse detection |
| Webhook dispatch logs | 30 days | Debugging |
| Idempotency responses | 24 hours | Retry safety |

## Deletion requests
Buyers may request erasure of personal data. Vantor deletes or pseudonymises data not covered by a legal retention duty within 30 days. Payment records are pseudonymised rather than deleted.

Raw card numbers are never stored outside the tokenisation vault.
