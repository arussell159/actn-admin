# Site health repair — September 11, 2026

Production: https://actn-admin.vercel.app

## Repairs

- Repaired the shared Supabase schema additively: report dates/status/secondary amounts, reconciliation snapshots, and the notebook-style knowledge base. Existing rows were preserved. SQL is in `supabase-site-health-migration.sql`.
- Fixed legacy tables whose policies allowed anonymous clients but rejected signed-in staff. Browser database calls now reuse the staff session. Server Zoho caches also use the request's staff session.
- Unified certificate upload, layout, draft, and knowledge requests around the current staff session. Bearer tokens no longer get replaced by stale cookies. Sign-in service outages return an availability error instead of a misleading signed-out error.
- Restarted the local development server with working external network access. The earlier restricted process could not validate Supabase sessions.
- Removed localhost-only success fallbacks for month ends, reports, and reconciliations. Failed database writes now fail visibly. Shared database reads no longer restore deleted records from stale browser caches.
- Added pagination for report rows, notes and pricing. Large reports are no longer silently cut off at the API row limit. Uploads write successfully before deleting replaced rows.
- Serialized overlapping notebook/template/navigation saves and retained failed drafts for retry. Added a visible sync error notice. Approved knowledge updates wait for database confirmation. Notebook saves preserve unrelated notes created on other devices and detect stale changes before replacing them.
- Moved notebook trash and legacy approved country knowledge to shared database settings. Existing local knowledge is migrated into an uninitialized collection. Local caches and backups are retained for recovery rather than blindly overwriting newer shared records.
- Aligned Supabase environment name handling, removed a duplicate local environment entry, and extended fresh-document cache headers to certificate and knowledge routes.
- Fixed certificate dropdowns switching between uncontrolled and controlled state. Extracted choices now appear during streaming without needing a reload.

## Validation

- 61 unit tests pass, including report pagination, failed saves, stale browser data, overlapping writes, pricing upload failure and approval retry.
- TypeScript checks pass. Production build passes. Existing Sass deprecation and unrelated ESLint warnings remain; no lint errors.
- 23 distinct desktop/mobile browser checks pass for month-end routes, settings, notebook controls, ECTN streaming, certificate draft persistence and unauthenticated API rejection. One existing mobile keyboard-only drag test is skipped by design.
- A synthetic bill of lading completed real AI classification/extraction locally and produced a database-backed certificate with reference `HEALTHCHECK20260911`. Its request ID is `mgbsc-1789140379753-s37dzeh`.
- Local and deployed browser configurations point to the same Supabase URL and public key. Vercel has the required production OpenAI and Zoho configuration.
- Real production AI extraction also passed and saved request `mgbsc-1789140925217-wymc7yp`. The two synthetic certificates remain identifiable by `HEALTHCHECK20260911`; neither represents a business shipment.
- A temporary note was created locally, read and changed on production, and the production change verified after reloading localhost. The note was then moved to shared Trash; its active database row is gone.
- SQL confirms 47 knowledge-base notes saved, the layout draft table/save/publish functions present, and zero anonymous table grants. Signed-in production Zoho dashboard and layout draft APIs return successful results after the permission change. All 20 production login JavaScript assets load successfully.

## Deployment and ongoing checks

The main repairs were deployed from `273dd88` to production and Vercel reported Ready. Both SQL files have been applied successfully. The final dropdown display correction was validated on desktop and mobile and is included in the follow-up production commit containing this report.

Run the read-only configuration/schema audit with:

```sh
node scripts/check-site-health.mjs --live=https://actn-admin.vercel.app
```

An authenticated-only table returning permission denied to this public-key probe is expected. SQL schema inspection and signed-in application checks verify those tables. The script never prints secret values or business records.

Local sessions and production sessions are separate. Development needs network access to Supabase and the AI providers. Automatic development account provisioning additionally requires an existing server-only Supabase secret in the local environment; ordinary staff sign-in works without that optional key. Do not put server secrets in `NEXT_PUBLIC_*` variables or commit environment files.

The older broad OKF browser suite contains assertions for removed editor tabs and the previous knowledge UI. The focused checks use the current interface. Multi-request spreadsheet replacements are still not database transactions; a failed batch is reported and should be retried. Browser data from other devices cannot be inspected or reconciled from this workstation.
