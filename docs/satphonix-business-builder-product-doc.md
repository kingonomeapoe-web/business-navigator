# Satphonix Business Builder — V1 Product Document

**Company:** Satphonix Business Development
**Product:** Satphonix Business Builder
**Version:** V1 (public funnel + commerce shipped; delivery/onboarding pending)
**Date:** 29 August 2026

---

## 1. Product summary

Satphonix Business Builder turns website discovery, sales, pricing, payment and onboarding into one personalised self-service experience for non-technical business owners.

A visitor describes their business in plain language. The product classifies it, asks an adaptive set of questions, and returns a specific, priced digital system — explained in business outcomes, never in technical jargon. The visitor can adjust the system, see the price move, and buy.

**Core promise to the user:** "Tell us about your business. We'll show you exactly what it needs online, what it costs, and why."

**Core principle:** AI interprets, rules decide. The model reads free text and produces a classification and warm summary. It never chooses what is sold or what anything costs — a deterministic rules engine does that, so pricing and eligibility are auditable and repeatable.

---

## 2. Target users

| Segment | Description | What they need |
|---|---|---|
| Primary | Owner-operators of small service businesses (trades, legal, clinics, property, salons, consultancies) | Clarity on what they need and what it costs, without a sales call |
| Secondary | Small e-commerce and multi-location operators | A configurable system with add-ons priced transparently |
| Internal | Satphonix sales and delivery team | Qualified leads with an attached, structured, priced scope |

Assumed traits: non-technical, price-sensitive, sceptical of agencies, mobile-first, often in Nigeria, UK, EU or US markets.

---

## 3. Product structure — the four pillars

Every capability in the catalogue belongs to one pillar. The pillars are the language of the whole product.

- **LOOK** — the foundation: website, domain, hosting, security, premium design, analytics.
- **ATTRACT** — being found: SEO foundation, local search, service pages, location pages, search growth engine, content engine, social content, programmatic pages.
- **CONVERT** — turning visitors into customers: WhatsApp, lead capture, booking, e-commerce, payments, AI assistant, lead qualification.
- **RUN** — running the business afterwards: CRM, notifications, follow-up automation, analytics dashboard, customer database, admin dashboard.

---

## 4. Current state (what is built)

### Shipped
- **Design system** — editorial premium theme in `oklch` tokens (forest green, signal orange, warm off-white), custom typography, mobile-first.
- **Homepage** (`/`) — positioning, four-pillar overview, single funnel CTA.
- **Diagnostic funnel** (`/build`) — client-side state machine: name → business description → location → goals → adaptive questions, with progress tracking and session persistence via a token.
- **AI classification** — Gemini 3.7 Flash via the Lovable AI gateway; returns industry, specialisation, business model, market, likely conversion, lead value, services, plain-language summary and an "Imagine…" scenario. Falls back gracefully with no key or on error.
- **Recommendation engine** (`src/lib/recommend.ts`) — deterministic verdicts (recommended / optional / excluded) per component, with human-readable reasons that quote the user's own answers back to them, plus dependency resolution (e-commerce implies payments; follow-up automation implies CRM).
- **Plan and quote screen** (`/plan/$token`) — the personalised system, per-item explanations, live selection, one-time and recurring totals, 50% deposit calculation, quote number, quote persistence.
- **Multi-currency** — USD, GBP, NGN, EUR; currency auto-derived from the visitor's stated country.
- **Backend** — `components`, `component_prices`, `diagnostic_sessions`, `quotes` with RLS and seeded catalogue.

### Shipped in Phase 1 — commerce and lead capture
- **Email capture with consent** — a required step at the end of the diagnostic, before the plan is revealed; consent and capture timestamp stored on the session.
- **Quote lifecycle** — `draft → sent → accepted → partially_paid → paid`, plus `expired` and `cancelled`. Accepting locks the scope and price; re-running the plan on a locked quote can no longer change it.
- **Immutable quote versions** — every distinct scope/price snapshot is hashed and written to `quote_versions`; orders reference the exact version bought.
- **Secure quote link** — `/q/:accessToken` guarded by a 24-byte random token, with expiry. No enumeration, no listing endpoints.
- **Quote email** — transactional send through a provider abstraction (Resend when `RESEND_API_KEY` is set, logged delivery otherwise), tracked in `email_deliveries` with an idempotency key.
- **Acceptance** — name and email captured against the quote, version recorded.
- **Payments** — provider abstraction with a Stripe adapter and a mock checkout for environments without a live provider. 50% deposit or pay-in-full, multi-currency, recurring items tracked in `subscriptions`.
- **Commerce records** — `customers`, `orders`, `order_items`, `payments`, `payment_events`, `subscriptions`, `projects`, created server-side on payment success.
- **Idempotent webhook** — `/api/public/payments/webhook` verifies the provider signature and de-duplicates on `payment_events.event_id`; replaying an event does not double-count a payment.
- **Post-payment confirmation** — the quote link becomes the order record: amount received, order number, project created, remaining balance, and when the monthly cost starts.
- **Internal notifications** — a row in `internal_notifications` on quote generated, quote accepted, payment succeeded and project created.
- **Rate limiting** — fixed-window limits in Postgres on classification, email capture, quote reads, acceptance and payment starts.

### Verified in Phase 1
End-to-end live run: Brighton dental practice → GBP plan (£2,192 one-off, £24/month) → email capture → quote email logged → acceptance → £1,096 deposit paid through mock checkout → order `SPXO-…` with `partially_paid` status, project created, four internal notifications, and a replayed payment event correctly ignored.

### Verified
End-to-end run: a Kent law firm produced a £2,936 GBP personalised plan.

---

## 5. Launch blockers

Nothing below is optional for taking money from a stranger without a phone call.

| # | Blocker | Why it blocks launch |
|---|---|---|
| ~~B1~~ | ~~**Payment capture** (Paddle or Stripe, multi-currency, 50% deposit + recurring subscription for monthly items)~~ — **shipped** (Stripe adapter; needs live keys and provider account) | The product's entire premise is self-service purchase. |
| ~~B2~~ | **Quote delivery by email** — **shipped**; still needs a verified sending domain and `RESEND_API_KEY` | Users will not decide in one sitting. A quote that can't be re-opened or forwarded to a partner dies. Needs a verified sending domain and a resumable plan link. |
| ~~B3~~ | **Email capture with consent** — **shipped** as a required step before the plan | Currently a completed diagnostic can leave no contactable record. This is the single largest revenue leak. |
| B4 | **Session security review of `diagnostic_sessions`** | Plan URLs are token-guessable-adjacent and sessions hold personal data. Confirm RLS, admin-only writes, token entropy, and expiry before public traffic. |
| B5 | **Legal pages** — terms of service, privacy policy, refund/cancellation terms, cookie notice | Required by payment providers and by UK/EU law given the markets targeted. |
| ~~B6~~ | **Post-purchase confirmation and next-step page** — **shipped** | A payment that ends on a blank screen generates instant chargebacks and support load. |
| ~~B7~~ | **Internal notification on quote and on purchase** — **shipped** (database queue; email/Slack fan-out still to do) | Satphonix must know a sale happened without polling the database. |
| B8 | **Pricing sign-off** for all four currencies | Seeded prices are provisional. Launching with wrong NGN or EUR pricing is unrecoverable in public. |
| B9 | **Mobile QA pass across the full funnel** on real devices | The majority of the audience is mobile-first; the funnel is long. |
| B10 | **Analytics and funnel instrumentation** (step-level drop-off) | Launching blind means no ability to diagnose a failing funnel. |
| ~~B11~~ | **AI failure and abuse handling** — rate limiting **shipped**; prompt-injection hardening still open — rate limiting on classification, prompt-injection resistance on free-text description | A public LLM endpoint with no limits is a cost and safety incident waiting to happen. |
| B12 | **SEO and social metadata per route** + sitemap and robots | The funnel is the marketing asset; it must be shareable and indexable. |

---

## 6. Must haves (V1, at or shortly after launch)

**Commerce**
- Order record linked to quote, session and customer.
- Invoice or receipt document the buyer can download.
- Split billing model made explicit: one-time build fee vs monthly running cost, with the first month's recurring charge clearly stated.

**Onboarding after purchase**
- Structured intake: logo, brand colours, business hours, service descriptions, photos, existing domain, social accounts.
- Progress tracker showing where the buyer's project stands.
- Asset upload with size and type validation.

**Client account**
- Authentication (email + Google), so a buyer can return to their plan, order, and onboarding.
- Ability to add components to a live system later — the natural expansion revenue path.

**Internal admin**
- Catalogue and price management without a migration.
- Session and quote browsing, with the ability to see the diagnostic answers behind a quote.
- Manual quote override for cases the rules engine gets wrong.
- Role-based access, roles stored in a dedicated table.

**Trust and conversion**
- Case studies or worked examples per pillar.
- Explicit "what you get / what you don't" per component.
- Clear statement of delivery timelines and what Satphonix needs from the client.

**Content quality**
- Human review of every `recommendation_reason` and `client_explanation` in the catalogue. These are the sales copy; they carry the whole product.

---

## 7. Good to haves (V1.1 and beyond)

- **PDF quote export** with Satphonix branding.
- **Quote comparison** — a "lean start" vs "recommended" vs "complete" preset, side by side.
- **Save and resume by email link** with a reminder sequence for abandoned diagnostics.
- **Live preview mockup** — a generated homepage impression of the buyer's site inside the plan screen. High impact, high effort.
- **Voice or chat diagnostic** as an alternative to the structured funnel.
- **Referral and partner links** with attribution on the session.
- **Regional pricing beyond the four currencies**, with tax and VAT handling.
- **Client-facing dashboard** showing enquiries, sources and performance once the system is live — the RUN pillar delivered as product rather than service.
- **Automated component provisioning** for the parts that can be automated (domain, hosting, analytics, WhatsApp link).
- **A/B testing of funnel length** — the adaptive question set is the biggest lever on completion rate.
- **Multi-language** (starting with a Nigerian-English tone variant and a European Portuguese/French pass).

---

## 8. Key metrics

| Stage | Metric | Why |
|---|---|---|
| Homepage | CTA click rate | Positioning quality |
| Diagnostic | Step-level completion, median time to plan | Funnel friction |
| Plan | Plan views, component toggle rate, median quote value | Pricing and packaging fit |
| Commerce | Quote → paid conversion, deposit value, recurring MRR added | Business viability |
| Delivery | Onboarding completion within 7 days | Operational load |
| Quality | Manual override rate on quotes | Accuracy of the rules engine |

North star: **paid deposits per 100 diagnostics started.**

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Diagnostic is too long; users abandon mid-funnel | Instrument step drop-off; make later questions optional; allow "skip to plan" |
| Rules engine recommends something inappropriate and the buyer notices | Every verdict carries a plain reason; "excluded" items are shown with why, which builds trust rather than hiding logic |
| AI produces an inaccurate or embarrassing business summary | Summary is descriptive only, never used for pricing; add a "that's not quite right" correction step |
| Prices anchored too low for the delivery cost | Track margin per sold system from the first ten sales; the price table is data, not code |
| Self-service sales cannibalise higher-value consulting | Position the Builder as the entry tier with an explicit "talk to us" path above a value threshold |
| Concentration on a single AI gateway | Classification has a deterministic fallback; the product degrades rather than fails |

---

## 10. Technical notes

- TanStack Start (React 19, Vite) with server functions; Lovable Cloud (Postgres) for data.
- Business logic lives in `src/lib/recommend.ts` and is pure and testable — it should gain a unit test suite before the rules grow further.
- Pricing lives in `component_prices`, never in code.
- Server functions handle all privileged reads/writes; the public catalogue read is scoped to safe columns.
- Before commerce lands: add RLS review, rate limiting, and structured error reporting on the AI path.

---

## 11. Recommended sequence

1. ~~**Close the loop** — email capture, quote email, resumable link, internal notification. (B2, B3, B7)~~ — done
2. ~~**Take money** — payment provider, order records, confirmation page, receipts. (B1, B6)~~ — done in code; still needs live Stripe keys, a verified email domain and price sign-off (B8)
3. **Make it lawful and safe** — legal pages, RLS/session review, rate limiting. (B4, B5, B11)
4. **Make it measurable** — funnel analytics, SEO metadata. (B10, B12)
5. **Deliver what was sold** — accounts, onboarding intake, progress tracker.
6. **Run it** — admin catalogue and pricing management, quote overrides.
7. **Grow it** — presets, PDF quotes, previews, expansion purchases.


---

## 12. What Phase 1 still needs before real money moves

| Item | Action |
|---|---|
| Stripe account and keys | Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`; the mock checkout self-disables the moment a live key exists. Point the Stripe webhook at `/api/public/payments/webhook`. |
| Sending domain | Add `RESEND_API_KEY` and verify the Satphonix sending domain; until then quote emails are recorded but not delivered. |
| Recurring billing | Monthly items are recorded in `subscriptions` as pending; the provider-side subscription is created on first live charge and needs testing against a real account. |
| Receipts | Payment succeeds and confirms on screen; a downloadable receipt/invoice document is not yet generated. |
| Legal pages | Still open (B5) — required by the payment provider before going live. |
| Pricing sign-off | Still open (B8). |

---

## 13. Phase 2 — Client Account + Onboarding Portal

### What was implemented

- **Client accounts** — Supabase Auth email/password, magic link and password reset at `/auth`. No account is required before payment; the paid quote page now links straight to account setup. On first sign-in the account is matched to the customer record created by payment (case-insensitive email, only unclaimed customers), and a profile row is created.
- **Client dashboard** (`/portal`) — business name, project name, production readiness, next required action, project timeline across eight stages, purchased system summary, payment summary (paid, balance, monthly) and a link back to the order record.
- **Onboarding engine** (`/portal/onboarding`) — requirements generated from the *purchased* components only, pre-filled from the diagnostic, grouped into six readiness categories: business identity, brand, content, media, digital access and feature setup. Conditional requirement sets exist for booking, SEO/search growth, AI assistant, e-commerce, CRM/lead handling, WhatsApp and social content.
- **Progress model** — readiness is calculated from required *applicable* items, not raw field count, with an explicit outstanding-items checklist ("You're 58% ready for production. 3 items still needed.").
- **Autosave** — edits are debounced and flushed on blur to the server; nothing is lost on refresh or navigation.
- **Assets** — private uploads to the `project-assets` bucket under `projectId/category/…`, server-side registration with MIME, size (25MB), filename and path validation, per-asset delete, and short-lived signed URLs for viewing.
- **Completion** — when every required item is complete, the client submits, the project moves to `ready_for_build`, timestamps are recorded, a client notification and an internal notification are raised, and the "You're ready" confirmation checklist is shown.
- **Internal project brief** — generated deterministically from diagnostic session, classification, purchased components, accepted quote, onboarding responses and asset metadata; never cached stale.
- **Admin project view** — `/admin/projects` and `/admin/projects/:projectId` (role-gated via `user_roles`) show the client, order, payment, status, readiness, selected system, every response, uploaded assets with signed links, and the generated brief.
- **Client notifications** — onboarding started, onboarding complete and project status changed, written on payment provisioning and lifecycle transitions.

### Database changes

New tables: `profiles`, `user_roles` (with `app_role` enum), `onboarding_responses`, `project_assets`, `project_status_history`, `client_notifications`. New columns on `projects`: `readiness`, `ready_for_build_at`. New security-definer helpers: `has_role(uuid, app_role)` and `owns_project(uuid)`, used by RLS; execution revoked from anonymous users. RLS: every client-owned table is readable only by its owner (`owns_project` / `auth.uid()`), with admin read policies via `has_role`. All writes go through server functions using the service role after an explicit ownership check — defence in depth alongside RLS.

### Storage

Private bucket `project-assets` (25MB limit). Policies allow project owners to manage files under their own project prefix and admins to read all. Downloads always use signed URLs (5 minutes).

### New routes

`/auth`, `/portal`, `/portal/onboarding`, `/admin/projects`, `/admin/projects/:projectId`. The protected subtree is gated by `src/routes/_authenticated/route.tsx`.

### New server functions (`src/lib/portal.functions.ts`)

`activateAccountFn`, `getPortal`, `saveOnboarding`, `registerProjectAsset`, `removeProjectAsset`, `getAssetUrl`, `finishOnboarding`, `markNotificationRead`, `adminListProjects`, `adminGetProject`, `amIAdmin`. All are authenticated through `requireSupabaseAuth` and validated with Zod.

### Environment variables

None new.

### Tested

Account creation and sign-in, account-to-customer linking, dashboard rendering for the Brighton dental order (`SPXO-6A92CE9E`, £1,096 paid, £1,096 balance, £24/month), component-driven requirement generation, autosave persistence across reload, readiness recalculation (0% → 6% → 13%), private asset upload and registration, and a non-admin being refused the admin views. Phase 1 commerce behaviour is unchanged.

### What remains for Phase 3

- Email confirmation currently depends on Supabase's default mail; once the Satphonix sending domain is verified, confirmation and magic-link delivery should be moved onto it. Google OAuth is not yet enabled.
- Admin write tools (status transitions, catalogue and price management, quote overrides) — this phase is read-only for admins.
- Client notification email fan-out, expansion purchases, receipts/invoices, and the delivery-side project management surface.

---

## 14. Phase 3A + 3B — Admin Foundation, Component & Pricing Manager

### What was implemented

- **Admin control centre** — a role-gated `/admin` application with its own shell: persistent desktop sidebar, collapsible mobile navigation, breadcrumbs, signed-in identity and role, and sign-out. Navigation covers Dashboard, Components, Pricing, Projects (existing read-only views), plus Clients, Quotes, Content, Questions, Rules, Industries and Settings as explicit "coming next phase" states.
- **Roles** — the `app_role` enum now includes `super_admin` alongside `admin`, `staff` and `client`. Roles live only in `user_roles`. Authorization is enforced in three places: a client-side route gate, `requireAdmin` inside every privileged server function, and RLS policies using the `is_catalogue_admin` security-definer helper. `staff` and `client` cannot read or write catalogue, pricing or audit data.
- **Admin dashboard** (`/admin`) — real counts for active/draft/archived components, markets and currencies, active quotes, paid orders, active projects, and the most recent diagnostic leads.
- **Component catalogue manager** (`/admin/components`) — searchable, filterable by pillar and status, showing one-time and recurring availability and last update.
- **Component editor** (`/admin/components/new`, `/admin/components/:id`) — identity (name, slug, pillar, short description, client explanation, detailed explanation, internal notes), presentation (icon, image, display order, featured, core), recommendation (reason, upsell message, priority), commercial flags (has one-time, has recurring, pricing model), relationships (requires / conflicts / related) and industry relevance, with a live client-facing preview panel showing exactly what a buyer would see.
- **Lifecycle** — draft, active, archived. A component that already appears in `order_items` can never be hard-deleted; it is archived instead. `status` and the legacy `is_active` flag stay in sync via a trigger so the public funnel is unaffected.
- **Pricing manager** (`/admin/pricing`) — a component × currency matrix for USD, GBP, NGN and EUR, editing one-time, recurring monthly and setup fee plus an active flag, with an optional note per change.
- **Pricing audit trail** — every changed field is written to `pricing_change_log` with component, currency, previous value, new value, who changed it and when; the log is shown beneath the matrix.
- **Dependencies** — relational `component_dependencies` with `requires`, `conflicts` and `related`. Circular `requires` chains are rejected on save. Legacy `depends_on`, `conflicts_with` and `industry_tags` arrays are mirrored on write so `src/lib/recommend.ts` continues to work unchanged.
- **Historical integrity** — accepted quotes, quote versions, order items and project scope are JSON snapshots and are never re-read from the catalogue. Editing copy or price affects only new plans and unaccepted quotes.

### Database changes

Extended, not duplicated: `components` gained `status`, `detailed_explanation`, `internal_notes`, `image_url`, `featured`, `upsell_message`, `pricing_model`, `has_one_time`, `has_recurring`. `component_prices` gained `market_id`, `active`, `setup_fee` validation and `updated_at`, with a partial unique index on active `(component_id, currency)`. New tables: `markets` (seeded US/USD, UK/GBP, Nigeria/NGN, Eurozone/EUR), `industries`, `component_industries`, `component_dependencies`, `pricing_change_log`. New helper `is_catalogue_admin(uuid)`; execution revoked from PUBLIC and anonymous users. Indexes added for slug, pillar, status, component+market, dependencies, audit lookups and role membership.

### New code

`src/lib/admin-schemas.ts` (Zod validation: pillars, statuses, pricing models, component input, price input, audit queries — negative prices, malformed slugs and invalid enums are rejected server-side), `src/lib/admin.server.ts` (role resolution, dashboard stats, component CRUD with cycle detection and archive-on-history, market/industry reads, pricing matrix, audited price upserts), `src/lib/admin.functions.ts` (authenticated server functions), `src/components/admin-shell.tsx`, and the routes under `src/routes/_authenticated/admin/`.

### Tested

Admin sign-in as `super_admin`; dashboard rendering with live counts (27 active components, 4 markets, 2 active quotes, 2 paid orders); component list search and filters; the pricing matrix across all four currencies; a live GBP price change on SEO Foundation (£320 → £333) which wrote a `pricing_change_log` entry with author and note while all three historical quotes containing that component kept their agreed £320; the change was then reverted through an audited entry. Typecheck and production build pass; the public funnel, portal and commerce flows are unchanged.

### Remaining

- Clients, Quotes, Content, Questions, Rules, Industries and Settings admin modules are placeholders.
- Bulk inline editing in the matrix is per-cell (modal) rather than free inline typing, to keep validation and auditing intact.
- The security linter still reports the seven intentional deny-all tables and three signed-in security-definer helper warnings inherited from earlier phases.
