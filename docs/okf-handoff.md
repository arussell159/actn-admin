# AfricaCTN Open Knowledge Format bundle

Open /knowledge-base. The OKF uses the same shared Notebook layout, pane dimensions, breadcrumb header, typography and mobile folder navigation. Metadata uses plain text; there are no OKF pill badges.

## Content and editing

The Knowledge Base is the readable view of the canonical OKF state. It renders an OKF v0.2 Markdown bundle with a root index, progressive directory indexes, concept files, and a newest-first log. Concept frontmatter records type, title, description, tags, status, generation, verification, sources, and AfricaCTN revision metadata. Document pages always use the required seven headings in their fixed order.

Angola, Djibouti, Kenya, Madagascar, Somalia, Sudan, and Yemen have linked Required Documents and Documents concepts. Bill of Lading, Commercial Invoice, and Freight Invoice are required for each configured country. Angola also requires DU (Documento Único) and ARCCLA Form. Madagascar also requires Packing List and Export Declaration. Madagascar's Bill of Lading must be a final, dated MBL, and its Commercial Invoice must state country of origin. These staff-supplied requirements remain unpublished until reviewed; they are not presented as independently verified regulations.

Choose Edit page to edit concise knowledge text. The UI does not expose IDs, applicability, mappings, sources, field structure, or form layout as routine controls. The server rejects a routine edit that changes those protected properties. Use AI Update with evidence when a rule, source, mapping, exception, or structure needs to change. It classifies the request before writing, retrieves only relevant concepts, makes no draft for duplicates, contradictions, structural changes, or insufficient evidence, and never publishes automatically. Ask published OKF uses approved entries only.

Preview changes shows the proposed content, affected pages, field mappings and version impact. Include linked fields and sources when first publishing dependent pages. Approve and publish releases the exact previewed change set atomically. Concurrent changes require a refreshed comparison; duplicates do not create versions. Country Updates holds proposals and publication history. Propose undo creates a new reviewed revision.

## Local development

Localhost uses the same Supabase database tables, Realtime subscriptions and private storage buckets as the deployed application. There is no localStorage, IndexedDB, filesystem or localhost-only data fallback. In development only, localhost obtains a short-lived local development user session from `/api/auth/local-session`; the route is unavailable on non-local hosts and in production builds, and its privileged Supabase key remains server-only. Staff, publisher and admin roles can approve; editor can propose; viewer can read. Trusted app_metadata supplies roles. SQL independently enforces permissions and preview concurrency.

## Production backend

The production migrations were applied to Supabase project `qxqyfhldfjvtjfjhafnl` on 2026-09-11 in this order:

1. `supabase-okf.sql`
2. `supabase-certificate-layouts.sql`

The first migration creates the shared certificate request/review and Madagascar rule tables, keeps the private document bucket restricted to authenticated staff, and adds `madagascar_bsc_requests` to Supabase Realtime. The second creates the shared, revisioned Certificate Settings catalogue and shared layout drafts. Both are additive and preserve existing rows. Production contains layouts for Angola, Djibouti, Kenya, Madagascar, Somalia, Sudan and Yemen. Deleted layouts retain their audit history; recreating one continues with the next historical revision instead of reusing revision 1. A post-migration production query confirmed `okf_state`, `madagascar_bsc_requests`, `madagascar_bsc_rules`, `okf_certificate_layouts`, and `okf_certificate_layout_drafts`, with one OKF seed row and seven rules. Deploy the application with
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
`OPENAI_API_KEY` configured in the hosting environment.

## Uploads and certificate records

Uploads classify documents, group shipments and identify the country from explicit Bill of Lading consignee evidence using the existing AI connection. Ambiguous or unsupported destinations remain unresolved. Published country layouts supply the form and additional configured extraction fields; published document knowledge supplies requirements and established mappings. Reviews store document evidence, literal/normalized values, results and exact knowledge/layout revisions. Explicit checks run deterministically.

The initial Madagascar layout reproduces the original visible form. Published layouts managed in Settings now control certificate sections, ordering, labels, dropdowns and columns. Missing / Corrections Needed is supplied once on every certificate record, outside the editable layout. Legacy layouts and cached drafts are adapted without losing custom fields. The Knowledge review section has been removed. Editing a field opens a correction-reason dialog; the original value, reason, actor and timestamp remain recorded. Review data and recheck APIs remain available in the backend without adding a review panel to the certificate.

Legacy client-supplied knowledge/chat and rule-classification endpoints return a migration message. Old local knowledge is preserved but does not drive extraction.

## Verification

- npm test: 68 passing tests, including OKF v0.2 bundle generation, linked indexes, retrieval, draft/publication separation, evidence gaps, destination ambiguity, deterministic comparisons, mapping validation, stable form identifiers, published-only extraction, durable reviews, and required-country documents.
- npm run typecheck, focused ESLint, and npm run build pass. The build retains the existing Notebook Sass import deprecation warnings.
- Playwright: 16 desktop/mobile OKF checks cover visual field placement, drag and drop, layout duplication, preview/publication, rendered certificate values, Settings navigation/history and draft reset, autosave, approval, sparse page headings, shared Notebook geometry, localhost access and audited corrections. Workflow fixtures are mocked; localhost access, ETag/304 responses and malformed-write checks use the actual API.
- scripts/verify-okf-db.mjs executes the migration on temporary PGlite PostgreSQL with Supabase auth/storage stubs and checks atomic publication, stale/replayed approvals, roles, versions and correction audit preservation.
- Historical AI smoke checks used synthetic documents only. The current classifier follows explicit Bill of Lading consignee evidence and the published country-layout catalogue; `scripts/verify-okf-ai.cjs` exercises those cases when run with configured AI credentials.

Live production publication and shipment review require a valid staff session and approved knowledge.
