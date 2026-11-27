# Amir AI Store — mobile & payments workspace
Baseline: production V10.4.3. No database writes, no live payments, no checkout unlock.
## Phase 1
Build PWA using node app-build.cjs /path/to/public. Network-only navigation with offline fallback; no cached account, API, price or payment records. Android browser install and iOS add-to-home-screen; native store packaging later.
## Payments
Preferred provider: PayTabs Jordan / MEPS subject to merchant agreement and JOD settlement verification. Hosted payment page only; never collect PAN/CVV. Payment adapter is an isolated sandbox prototype, not a deployed payment endpoint. Actual credentials only in protected Vercel environment; no secrets in GitHub. Before live: trusted approved inventory and price source, server-generated orders, durable idempotency, verified callbacks + provider query, settlement reconciliation, test purchase/refund, approval. COD and CliQ remain pending operational/bank integration.
Docs: https://support.paytabs.com/en/support/solutions/articles/60000709777-3-2-hosted-payment-page-apis-initiating-the-payment
