# UI component audit — 10 September 2026

The app already uses a shared shadcn foundation. Its `components.json` selects the `base-nova` style, and `components/ui` contains 36 installed component modules. Application code uses these shared modules for buttons, forms, cards, menus, tables, navigation and overlays. Custom components should compose this foundation; they do not need to be replaced just because they contain application-specific behaviour. This follows [shadcn's composition model](https://ui.shadcn.com/docs).

## Source inventory

Run `node scripts/audit-ui-components.mjs` to repeat the inventory. It parses TSX rather than counting text matches and lists remaining native controls by file and line.

| Measure | Before this pass | After this pass |
| --- | ---: | ---: |
| Application TSX files scanned | 85 | 86 |
| Direct shared UI component usages | 2,046 | 2,081 |
| Shared control occurrences | 420 | 429 |
| Native control occurrences | 58 | 47 |
| Shared portion of counted controls | 87.9% | 90.1% |

The comparison covers button, input, select, textarea, table, dialog, checkbox, radio group and toggle controls. It excludes the primitive implementations in `components/ui`, Tiptap's separate editor directories and ordinary layout HTML. It includes retained components that may not currently be mounted by a route. These are source occurrences, not runtime screen counts or a claim that 90% of all components are shadcn. Moving duplicated fields into one implementation reduces repeated occurrences without reducing reuse.

The scan found no direct Base UI or Radix imports in application views outside the shared UI and editor directories.

## Small changes completed

| Area | Change |
| --- | --- |
| Customer and agent record components | Replaced duplicate summary text/select field implementations with `record-summary-fields.tsx`, built from shared Field, Input and Select. Labels now identify their controls. Each record retains its own field values, edit state and save/cancel behaviour. |
| OKF | Reused Select for editable choices, Table for field mappings and Input for evidence attachments. Retained the shared Notebook layout and existing document structure. |
| Quote tool | Reused Table, TableHeader, TableBody, TableRow, TableHead and TableCell. Retained row refs, keyboard handlers, quantities and mobile presentation. |
| Country table filters | Reused Button for clearing search and selecting filters. Counts are plain text. The same component serves month-end countries and certificate reconciliation. |
| Dashboard | Reused Button for country selection and both load-more actions. |
| Page error recovery | Reused Button for retry and repair. |

No dependencies, global theme changes, data models or storage behaviour were changed in this pass. Existing uncommitted OKF work was retained.

## Approved consolidation

The user subsequently approved all three consolidation areas. The implementation now includes:

- **PageFrame:** one SidebarProvider/AppSidebar/SidebarInset implementation with header and content slots. Dashboard, month-end (including loading/error states), reconciliation, quote tool, pricing upload, previous months, new month-end, Settings and certificates use it. NotebookLayout composes PageFrame and retains its document panes, mobile viewport attributes and scrolling. Route state stays in each view.
- **SectionNavigation:** shared shadcn line tabs for month-end and Accounting settings. Arrow keys move focus; Enter/Space activate a section. Header tabs identify their corresponding content panels. Accounting settings retains its original header tabs. Separate Accounting settings and Certificate settings menu links share one definition across the sidebar, mobile navigation and command search. Certificate layout drafts persist across navigation and browser history.
- **SearchPicker:** shared shadcn Command/Popover implementation for the quote country selector and Settings parent/combined-country selectors. It supports filtering, no-result feedback, keyboard selection, Escape, indentation and multiple choices without pills. Quote selection retains its existing focus transfer to the first quotation row.
- **Editor controls:** Tiptap's Button wrapper now composes shared Button and Tooltip, preserving editor-specific styling, refs, commands and toolbar navigation. Settings uses shared Button for drag handles and shared DropdownMenuItem for reset/cancel menus. Inline editing panels use labelled regions rather than claiming to be dialogs. Tiptap's Radix menu/popover wrappers remain because their command and focus contracts differ from Base UI; Escape returns menu focus to its trigger, while formatting commands retain editor focus. Ctrl+B in an input/editor no longer opens the sidebar.
- **Certificate layout location:** Certificate settings under the Settings menu heading supplies its own page and full editor area. Missing / Corrections Needed is a fixed shared certificate section, removed from the palette, preview and editable saved layout. Older drafts/layouts adapt on read. Draft restoration and reset retain their intended cache behaviour.

The follow-up source inventory scans 98 application files: 2,117 shared UI usages, 465 counted shared controls and 37 native controls (92.6% of counted controls). The same exclusions above apply, including Tiptap directories; these figures are not a percentage of all components.

## Deliberate exceptions

- Hidden native file inputs already delegate their visible affordance to shared controls; replacing them gives little consistency benefit.
- `app/global-error.tsx` keeps a minimal native fallback so root-layout failure can still display recovery actions.
- Rich text content, charts, drag targets, document layouts and semantic HTML are not replacements for shadcn controls. Existing libraries and domain components remain appropriate.
- Shared primitives may legitimately have different variants and sizes. Standardisation should remove duplicate implementations while preserving useful differences in the interface.

## Guidance for further work

Use `@/components/ui/*` first for visible controls. Check for an existing composed component before creating another one; share repeated behaviour when its props and lifecycle actually match. Keep form presentation and business rules in domain components. Keep status information as plain text where appropriate, in line with the preference against pills. The app-wide layout and editor consolidation above has user approval; ask before introducing further substantial behaviour changes.

## Verification

- TypeScript, lint, production build and all 35 unit tests pass. The build required clearing one stale generated cache folder and retains the existing Tiptap Sass import deprecation warnings.
- All 10 existing desktop/mobile OKF checks pass.
- Mobile page-control and country-navigation checks pass.
- Focused browser checks at 1440px and 390px pass for shared filter selection, clearing search, OKF selection/autosave and keyboard focus return. Desktop quote quantities still respond to the left/right arrow keys. These checks used mocked data and did not publish or change live records.
- The broad 12-route mobile geometry run found an existing assertion mismatch: it expects every header icon to be 18px, while `MobileProfileMenu` explicitly renders a 24px profile icon. Header positioning, dock placement, content reachability and horizontal-overflow assertions passed. Neither that icon nor its test was changed in this pass.

## Consolidation verification

The combined browser suite is `npx playwright test --config=playwright.shared-ui.config.ts`. It covers the eleven affected route variants on desktop/mobile, geometry and mobile dock clearance, navigation and country-return selection, keyboard/manual tabs, search and multi-selection, Settings drafts, visual layout dragging, keyboard row reordering, fixed corrections, Notebook selection/formatting/undo/redo and menu focus. Fixtures isolate external data and writes. The existing Sass import deprecation warnings remain.

Final results: 43 unit tests pass; the combined desktop/mobile suite has 27 passes and one intentionally skipped mobile keyboard-reordering duplicate. TypeScript, lint and the production build pass. The build needed removal of one stale generated, read-only build-cache directory; existing Sass import warnings remain. PostgreSQL migration and publication/correction checks pass in temporary PGlite.
