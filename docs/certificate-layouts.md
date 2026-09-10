# Certificate layouts in Settings

Open **Certificate settings** under the **Settings** menu heading, then choose **Madagascar**. **Accounting settings** opens the existing Countries, Tasks and NetSuite settings. Certificate settings has its own page at `/certificate-settings`; there are no General / Certificate layouts tabs. The canvas uses the same section and field components as certificate records. Madagascar starts with the existing visible form: trade parties, invoices, shipment and uploaded documents, including its original column counts.

- The country name is the editor heading and opens a searchable list of saved country layouts. **Add new country layout** stays at the bottom of this list, including when there are no search matches.
- The page menu has **Fields**, **Layout** and **Preview** tabs. Fields lists the country's defined fields and their locations, with search, editing and New field. Layout opens the drag-and-drop canvas. Preview shows the current draft without canvas editing controls. All three tabs share the same draft; switching tabs preserves changes and the field search.
- Drag a field from **Fields** onto a subsection, or drag an existing field to reorder or move it. On mobile, open the collapsed Fields list; clicking a field provides an equivalent destination picker.
- Click a heading or field to rename it. Each subsection has a small column selector. Additional settings, including field width and source instructions, stay inside the item dialog.
- Use **Add section** and the subsection add button to extend the form. New fields can specify a source document without inventing document requirements.
- **Duplicate** copies the current sections, fields and columns into a draft for another country. It does not publish the country or copy document requirements. **Add new country layout** in the country picker starts empty.
- **Publish layout** releases the current draft from any tab. Drafts stay in local browser storage; only published layouts are shared. Country settings includes Reset draft.

Missing / Corrections Needed is a fixed section on every certificate record and is excluded from the editor. Older saved layouts and browser drafts are adapted on read; custom fields are preserved. Old KB layout links redirect to Settings.

Field IDs survive label changes, moves and width changes. Existing certificate values remain attached to their field IDs. Newly added scalar fields can be filled on older requests with the existing correction reason and audit history.

## Uploads and caching

The server loads the complete published layout catalogue before identifying a shipment. The AI receives canonical country names and aliases. Explicit Bill of Lading consignee evidence and unambiguous shipment grouping are still required; unknown countries never default to Madagascar.

Existing published document fields and mappings take precedence over a layout's extraction defaults. New placed fields with a configured source document supplement those mappings, without adding requirements or approval claims. A layout alone does not establish country regulations. Each upload review records the layout snapshot and revision used alongside the knowledge revisions.

Certificate pages cache the entire catalogue in memory and localStorage. Conditional requests use an ETag; the catalogue revalidates on initial load, after a minute while visible and on focus. Publication updates the current tab and other tabs through storage events. A late response cannot overwrite a newer published revision. A request's recorded layout is available as a fallback and takes precedence over an older cached revision.

The Madagascar spreadsheet export remains its existing fixed workbook format. Custom table columns display on the certificate but are not added automatically to that workbook.

## Persistence

Localhost development uses the existing `.okf-development` store and requires no staff login. Older development stores gain the Madagascar layout without replacing their existing data.

For production, apply `supabase-certificate-layouts.sql` **after** `supabase-okf.sql`. It adds layouts, immutable revision history, an atomic publication function, and support for audited corrections to newly configured fields. It validates permissions, references, nesting, widths, aliases and concurrent revisions in PostgreSQL. Seed inserts preserve existing layouts. `scripts/generate-certificate-layout-seed.cjs` regenerates only the marked seed/correction blocks.

The production migration has been tested in temporary PostgreSQL, but has not been applied to the connected Supabase project.
