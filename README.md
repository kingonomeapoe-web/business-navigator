# Satphonix Business Builder

Turn website discovery, sales, pricing, payment and onboarding into one personalized self-service experience for non-technical business owners.

**Company:** Satphonix Business Development
**Product:** Satphonix Business Builder — V1
**Stack:** TanStack Start · React 19 · TypeScript · Tailwind CSS v4 · Lovable Cloud (Supabase) · Lovable AI Gateway

Full product specification: [docs/satphonix-business-builder-product-doc.md](docs/satphonix-business-builder-product-doc.md)

---

## 1. Investor brief

### The problem

Small and medium business owners know they need a better website, more visibility and simpler operations — but buying those services today means agency sales calls, vague proposals, opaque pricing and long timelines. Most never buy; the ones who do often overpay for the wrong things.

### The product

Satphonix Business Builder replaces the agency sales funnel with a guided, self-service diagnostic. A business owner answers a short adaptive interview about their business; AI classifies the business profile; a deterministic rules engine assembles a personalised system of digital capabilities across four pillars — **LOOK, ATTRACT, CONVERT, RUN** — with transparent, market-specific pricing. The owner can accept the quote and pay a deposit or in full within minutes, entirely self-service.

### Why it wins

- **Zero-sales-person revenue motion** — discovery → diagnosis → quote → payment in one sitting.
- **"AI interprets, rules decide"** — AI classifies and personalises, but scope and pricing come from a deterministic catalogue. Quotes are auditable, margin-safe and never hallucinated.
- **Immutable commercial records** — accepted quotes are frozen into hashed versions; payments reconcile against those versions, not editable state.
- **Global by design** — multi-currency pricing (USD, GBP, NGN, EUR) with automatic currency selection from the visitor's location, and a payment-provider abstraction that supports Stripe and regional providers such as Paystack.
- **Provider-agnostic infrastructure** — email and payment vendors are runtime-configured adapters; no vendor lock-in in business logic.

### Traction levers

- Every diagnostic session is a consented lead (email + marketing opt-in captured before the plan is revealed).
- The quote is a durable, shareable private link — the sale can resume from any device, and quote emails drive return visits.
- Recurring monthly components (hosting, maintenance, growth retainers) build MRR from day one.

---

## 2. Admin brief

### What an operator controls today

| Area | Where | Notes |
| --- | --- | --- |
| Component catalogue | `components` table | Capabilities grouped into LOOK / ATTRACT / CONVERT / RUN |
| Pricing | `component_prices` table | Per-market pricing: USD, GBP, NGN, EUR |
| Recommendation rules | `src/lib/recommend.ts` | Deterministic mapping from business profile → components |
| AI classification | `src/lib/builder.functions.ts` | Gemini via Lovable AI Gateway; no key management required |
| Payment provider | `STRIPE_SECRET_KEY` env | Absent → built-in mock checkout for testing |
| Email provider | `RESEND_API_KEY` env | Absent → log provider that records without sending |

### What an operator can observe

- **Quotes** — full lifecycle: `draft → sent → accepted → partially_paid → paid` (plus `expired`, `cancelled`), with immutable hashed snapshots in `quote_versions`.
- **Payments** — `payments`, `payment_events` (idempotent webhook dedupe), `orders`, `order_items`, `subscriptions`.
- **Leads** — `diagnostic_sessions` with email, consent and marketing opt-in.
- **Email** — `email_deliveries` tracks every transactional send with idempotency keys and provider status.
- **Internal alerts** — `internal_notifications` fires on quote generated, quote accepted, payment succeeded and project created.
- **Abuse control** — Postgres-backed rate limiting (`rate_limits`) guards email capture, quote reads, acceptance, payment initiation and AI classification.

### Security posture

- Public quote access is a 24-byte random hex token with exact-match lookup; there is no quote listing or enumeration endpoint.
- Service-role-only tables (quotes, sessions, payment events, deliveries, notifications, rate limits) have RLS enabled with **no** browser policies — intentional deny-all; all access flows through validated server functions.
- Customer-owned tables are scoped to the owning authenticated user.
- Webhook signatures are verified before any event is processed.
- The mock checkout and `completeMockPayment` are automatically disabled when `STRIPE_SECRET_KEY` is configured.

---

## 3. User brief (the business owner's journey)

1. **Discover** — the homepage explains the four-pillar system in plain language.
2. **Diagnose** — a short, mobile-first adaptive interview ("the Porsche Experience") asks about the business, goals and customers.
3. **Confirm contact** — email and consent are captured so the plan is never lost.
4. **Receive the plan** — a personalised "Your Satphonix Business System" page shows recommended and optional components across LOOK, ATTRACT, CONVERT and RUN, with transparent pricing in the owner's currency. Excluded components are shown too, with reasons.
5. **Accept & pay** — accepting locks scope and price into an immutable quote version. The owner pays a 50% deposit or in full via secure checkout.
6. **Confirmation** — the private quote link becomes the order record: amount received, remaining balance, when monthly billing starts, and project status.

The private quote link is resumable — the owner can leave and return from the email at any time before expiry.

---

## 4. Launch blockers (must close before taking real money)

| # | Blocker | Status |
| --- | --- | --- |
| B1 | Payment capture | ✅ Shipped — provider abstraction, deposit/full, idempotent webhooks. **Pending:** live Stripe/Paystack keys + webhook registration |
| B2 | Quote delivery by email | ✅ Shipped — tracked, idempotent sends. **Pending:** `RESEND_API_KEY` + verified Satphonix sending domain |
| B3 | Email capture + consent | ✅ Shipped |
| B4 | Legal pages (Terms, Privacy, Refunds) | ⬜ Not built |
| B5 | Recurring billing go-live | ⬜ Subscriptions recorded; recurring charge collection not validated with a live provider |
| B6 | Post-payment confirmation | ✅ Shipped |
| B7 | Internal notifications | ✅ Shipped |
| B8 | Downloadable receipts / invoices | ⬜ Not built |
| B9 | Pricing sign-off per market | ⬜ Seed prices need commercial review |
| B10 | AI failure + abuse handling | ◐ Rate limiting shipped; prompt-injection hardening and classification fallback review open |
| B11 | Multi-provider payment routing | ⬜ Abstraction ready; Paystack adapter not implemented (see §6) |

---

## 5. Must haves (V1, post-launch)

- Post-purchase onboarding flow (kickoff form, asset collection, timeline expectations).
- Client accounts — owners sign in to see their project, invoices and balance without relying on the email link.
- Internal admin UI for catalogue and pricing management (today: direct DB edits).
- Receipts/invoices as downloadable PDFs.
- Content quality review pass on diagnostic copy and plan language.

## 6. Good to haves

- PDF export of the plan/quote.
- Quote comparison view (deposit vs full, optional components).
- Save/resume reminder emails for abandoned sessions.
- Automated provisioning hooks (project scaffolding on payment).
- Analytics dashboard for funnel conversion.

---

## 7. Payments across diverse countries — recommendations

The codebase is already provider-agnostic: business logic asks for a checkout for an amount/currency and later receives a normalised webhook event (`src/lib/payments.server.ts`). Adding a provider is an adapter, not a refactor.

### Recommended strategy

| Region | Currency | Provider | Rationale |
| --- | --- | --- | --- |
| Nigeria | NGN | **Paystack** | Best local card + bank-transfer + USSD acceptance, NGN settlement, strong Nigerian success rates. Stripe does not settle NGN for Nigerian customers. |
| UK / EU / US & default | GBP / EUR / USD | **Stripe** | Broad card coverage, Apple/Google Pay, mature subscriptions for the monthly components. |
| Rest of world | USD | **Stripe** | Default fallback for any country not explicitly routed. |

### Routing rule

Route at checkout time using the quote's currency (already derived from the visitor's country via `currencyForCountry` in `src/lib/currency.ts`):

```text
currency == NGN → Paystack
otherwise       → Stripe
STRIPE_SECRET_KEY unset → mock provider (test only, auto-disabled in production)
```

### Implementation guidance

1. **Paystack adapter** — add a `paystackProvider()` beside `stripeProvider()`: `POST /transaction/initialize` for checkout (use the payment ID as `reference` and in `metadata`), and verify webhooks with HMAC-SHA512 against the `x-paystack-signature` header.
2. **Provider selection** — extend `getPaymentProvider()` to accept the currency and pick Paystack for NGN; keep the mock provider gated on the absence of live keys.
3. **Secrets** — store `PAYSTACK_SECRET_KEY` as a project secret; never in code. Keep `completeMockPayment` disabled when **either** live key is present.
4. **Recurring components** — Paystack subscriptions use plans + subscriptions APIs with different semantics from Stripe Billing; keep the internal `subscriptions` table as the source of truth and treat provider objects as implementations.
5. **Currency integrity** — never convert currencies yourself. Quote in the market currency from `component_prices`; charge exactly the quoted amount in that currency.
6. **Webhooks** — register one endpoint per provider against `/api/public/payments/webhook`, or split per provider (`/webhook/stripe`, `/webhook/paystack`) sharing the same idempotent event handler.
7. **KYC / settlement** — Stripe and Paystack settle to different bank entities; plan accounting reconciliation per provider from day one.
8. **Local payment methods** — after V1, consider Paystack bank transfer/USSD for Nigeria (large share of SMB payments) and Stripe Link/Apple Pay for UK/EU conversion.

### Data & compliance notes for a global user base

- **Consent** — email capture already records explicit consent and marketing opt-in; keep marketing sends region-aware (UK/EU GDPR, Nigeria NDPR).
- **Data residency** — all commerce data lives in one backend; publish a clear privacy policy covering international processing before launch (blocker B4).
- **Timezones/locales** — store timestamps in UTC (already the case); format money with market symbols, which `src/lib/currency.ts` handles.
- **Support windows** — publish support hours in WAT (Lagos) and GMT to set expectations for UK and Nigerian customers.

---

## 8. Development

```sh
npm i
npm run dev
```

- TanStack Start file routes live in `src/routes/`.
- Server logic uses `createServerFn` (`src/lib/*.functions.ts`); webhooks live under `src/routes/api/public/`.
- With no live keys configured, payments use the mock checkout at `/pay/mock/:paymentId` and email uses the log provider — the full funnel is testable locally.

## Documentation

- [Satphonix Business Builder — Product Document](docs/satphonix-business-builder-product-doc.md): current state, launch blockers, must haves, and good-to-haves.
