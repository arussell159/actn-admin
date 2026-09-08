# Mobile stability audit and layout contract

## Findings before the refactor

- Next.js 16.2.6 App Router routes each mount their own SidebarProvider, sidebar, SiteHeader, pull refresh and mobile dock. Loading and error screens use different shells. `components/app-shell.tsx` is an unused legacy hash router importing every major view.
- Mobile CSS sizes html, body, sidebar wrapper and sidebar inset to **100dvh plus top and bottom safe areas**. Safe areas are already inside that viewport. This creates an oversized, clipped scrollport; individual pages compensate with 6/8/10rem padding and still cannot reliably reach their last element.
- The sidebar inset is both the route scroll owner and a transformed (`translateY`, `will-change: transform`) containing block. Pull refresh moves it, including its sticky header and any non-portaled fixed UI. The notebook's full-screen prompt/search bar inherit this containing block. Header stickiness is also bounded by each short route's main element.
- RouteScrollReset sets history restoration to manual and schedules resets one animation frame later, affecting document and every inset. Next Link also performs its own scrolling. Back/forward positions are discarded. Month-end separately measures/restores multiple scroll owners.
- The notebook installs its own VisualViewport listeners, changes its outer viewport after paint and resets scroll on every viewport event. Month-end calculates card heights from window.innerHeight after paint.
- MobileTabBar only renders after mount and ignores the bottom safe area. Skeleton routes recreate it. Dock customization fetches repeat on navigation.
- Global mobile font-size rules affect every descendant. The Inter CSS variable has a competing root definition and uses font-display:swap; notebook CSS also globally changes scrollbar behavior when its route chunk arrives.
- MobileAppGuard locks orientation and cancels all horizontal and multi-touch gestures, including legitimate table scrolling and zoom. It scans every DOM element for the top-tap action.
- The worker immediately skipWaits and claims clients; registration reloads on controllerchange and deletes caches based on the page bundle's version. An older tab can delete a newer worker's cache. Offline installation is allowed to succeed without the offline page. Offline requests still go through authentication middleware. Automatic recovery can run concurrently and misclassifies unrelated link failures as stale chunks.
- Browser testing reproduced dashboard hydration errors: the server initially chose a 24-hour chart and mobile chose 6 hours. Settings also initialized rendered content from local storage and drag-and-drop generated different server/client accessibility IDs. These now have deterministic first renders.
- The old 650ms navigation lock dropped rapid taps. Chromium's App Router can commit a history traversal before the popstate listener runs; reading the entry during the layout commit is necessary to restore its position before paint. Hydration also has to preserve scrolling that starts before JavaScript finishes downloading.
- At 768px, the country dashboard filter toolbar forced approximately 900px of controls into the space remaining beside the sidebar. It now wraps to available width. Global search centered against the layout viewport instead of the keyboard's visual viewport. The full-screen notebook dialog also inherited centered-dialog translation variables; these must be reset along with its animation.
- The keyboard interaction test exposed another timing problem: expanding the shell immediately on input blur moved a dialog's Cancel button between pointer-down and pointer-up. Keyboard geometry now remains until the visual viewport actually expands; resume explicitly discards stale keyboard state.

## Intended contract

The workspace route-group layout owns one persistent AppShell. It renders the sidebar, header, main scroll region, mobile dock and global overlay layer. Routes provide content and header slots only. The document does not scroll inside the shell; a single `data-app-scroll` element does. This deliberate delegation is limited to the workspace, so login and fatal recovery screens retain document scrolling.

CSS owns the viewport (`100vh` fallback, `100dvh` enhancement), safe-area tokens, chrome dimensions and content clearance. Safe-area insets are padding **inside** the viewport, never added to its height. No transforms, containment or filters are applied to chrome ancestors. Tables and editor panes may scroll locally where the interaction requires it; normal routes have no viewport calculations.

Normal route changes reset before paint. History entries retain independent scroll positions, with deferred restoration for asynchronous content. AppLink disables Next's competing scroll behavior. Month-end's explicit return workflow shares this scroll owner.

The root preloads one local Inter variable font with a metric-adjusted fallback and optional display, avoiding a late mid-session font swap. Controls, icons and chrome reserve dimensions in CSS.

The worker caches only its offline page and public shell assets; HTML/RSC/API responses stay network-only, and immutable Next chunks retain Next's browser HTTP-cache policy. New workers wait for old clients to close. No unsolicited controller-change reloads or page-owned version cleanup. Stale-chunk recovery is online-only, single-flight and reload-budgeted, with manual repair available.

## Important implementation files

| Files | Responsibility |
| --- | --- |
| `app/(workspace)/layout.tsx`, `components/app-shell.tsx`, `components/app-shell-context.tsx` | One persistent workspace shell and header portal target; existing route URLs are unchanged. |
| `app/app-shell.css`, `app/globals.css` | Viewport, safe areas, chrome, scroll clearance, panels and keyboard-aware overlay geometry. |
| `components/site-header.tsx`, `components/mobile-tab-bar.tsx`, `components/page-skeletons.tsx` | Stable chrome, server-rendered dock and content-only loading states. |
| `components/route-scroll-reset.tsx`, `lib/app-scroll.ts`, `components/app-link.tsx` | One scroll owner, history-entry restoration, synchronous route resets and rapid navigation. |
| `hooks/use-app-keyboard-viewport.ts`, `hooks/use-mobile-pull-refresh.ts`, `components/mobile-app-guard.tsx` | Keyboard-only VisualViewport correction and scoped gestures without moving the shell. |
| `components/*-view.tsx`, `components/country-table-filters.tsx`, notebook editor styles | Remove repeated shells and page viewport calculations; make narrow toolbars wrap. |
| `app/layout.tsx`, `styles/_variables.scss`, `lib/public-client.ts` | Stable root font/viewport setup, no late global font rules, one public-data Supabase client with its own storage key. |
| `public/sw.js`, `public/offline.html`, `components/pwa-register.tsx`, `lib/pwa-recovery.ts`, `instrumentation-client.ts` | Safe update lifecycle, dedicated offline fallback, bounded stale-asset recovery. |
| `app/(workspace)/error.tsx`, `components/app-error-recovery.tsx`, `app/global-error.tsx` | Route retry retains the shell; fatal recovery remains accessible outside it. |
| `next.config.ts`, `proxy.ts`, `app/manifest.ts` | Deployment identity, document/worker cache policy, public offline page and edge-to-edge standalone metadata. |

Deleted `hooks/use-mobile-scroll-lock.ts` and `lib/mobile-nav-active-state.ts`. Replaced the unused legacy hash-router shell. Removed per-page sidebar providers, inset scroll owners, viewport-height calculations, bottom-padding compensations, transformed pull-refresh containers, delayed scroll resets, global gesture blocking and forced worker activation/reloads.

## Adding a route

Place normal application routes inside `app/(workspace)`. Render the content in `main.app-page` and use `SiteHeader` to supply the shared header's title/actions. Do not create another shell or assign a viewport height. The route outlet automatically reserves the dock and safe-area clearance. An editor that intentionally owns local scrolling can use `data-app-panel="true"`; it must use flex children with `min-height: 0` and a clear local scroll owner. Wide data tables may scroll horizontally inside a bounded table wrapper.

The mobile header is 40px plus the top safe area. The dock is 66px high, 16px above the bottom safe area. Route bottom clearance is the safe area + dock + 16px gap + 16px content clearance. CSS owns ordinary resizing. VisualViewport changes shell geometry only when a focused editable control and a substantial visual-only height reduction indicate a keyboard. It retains that geometry while the keyboard visibly closes, then returns to CSS sizing; resume discards stale keyboard state. Root portals use the same tokens. The existing 768px responsive breakpoint uses the desktop sidebar, including landscape viewports above that width.

## Reproduction and regression coverage

Use a production build for layout and worker checks:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium webkit
npm.cmd run test:browser
```

The browser configuration starts a production server on port 3100. To use an existing production server instead, set `PLAYWRIGHT_BASE_URL` to its localhost URL. The localhost auth bypass is existing repository behavior. Fixture interception supplies all Supabase/Zoho responses, including writes; these tests do not exercise or modify live business records. The worker lifecycle test uses an isolated local server and browser context.

Seven viewport sizes run in Chromium and WebKit: 320×568, 375×667, 390×844, 393×852, 430×932, 768×1024, 1280×900. Core tests cover 13 route variants, top/bottom scroll reachability, menu opening at top/middle/bottom, 30 transitions per browser/size, DOM identity and frame-by-frame chrome coordinates, history restoration, resizing/rotation and injected safe areas. Focused 390px tests cover delayed fonts/scripts/API/images, interaction before hydration, saved preferences, render-error retry, bounded stale-chunk reload, login/offline pages, menu customization, visual-only keyboards, resume events and root portal dialogs.

Worker tests verify required offline HTML, optional asset failure, safe cache cleanup, no HTML/chunk/API cache interception, one recovery attempt, storage failure and cache eviction. A real Chromium two-tab test installs an old cache version, introduces a new worker, verifies it remains waiting while either old client is open, preserves an unsaved draft, closes the clients, then verifies activation, offline deep-link fallback and reconnection. It simulates worker versions; it is not a production hosting rollout test.

Artifacts are local and ignored by Git: `outputs/mobile-stability/report/index.html`, `results.json`, screenshots, and failure traces. Chromium supports Layout Instability API measurements; WebKit coverage uses per-frame bounding-box invariants because that API is unavailable there.

## Verification

Final production acceptance run: 2026-09-08, Windows, Next.js 16.2.6, Playwright 1.63.0. Browser run started at 17:35:40 UTC and finished in 281 seconds.

| Check | Actual result |
| --- | --- |
| `npm.cmd run typecheck` | Passed. |
| `npm.cmd run lint` | Passed: 0 errors, 14 existing warnings. Latest keyboard hook and overlay tests also passed focused lint. |
| `npm.cmd test` | 22 passed, 0 failed. |
| `npm.cmd run build` | Passed: optimized production compilation, TypeScript and prerendering. |
| `npm.cmd run test:browser` against production | 76 passed, 6 intentionally skipped, 0 failed, 0 flaky; 82 total cases. |
| Core layout coverage | 182 direct route entries and 420 client transitions across Chromium/WebKit and all seven sizes passed their geometry, overflow and scroll-endpoint assertions. Header and dock DOM identity persisted during each 30-transition sequence. |
| Delayed cold startup | 1 font, 25 scripts, 2 images and 1 API request were delayed per engine. 256 Chromium frames and 180 WebKit frames retained header bounds `(0,0,390,40)` and dock bounds `(0,762,390,66)`. One font preload. Chromium measured shell CLS **0**. WebKit's Layout Instability API is unavailable, so its evidence is the frame geometry measurement. |
| Recovery/update | Both engines passed route retry and one-reload stale-chunk recovery. Chromium passed the two-client waiting-worker, activation, cache cleanup, offline deep-link, reconnection and cache-eviction test. |
| Visual inspection | Reviewed production screenshots at 320px, 375px, 390px, 768px and 1280px, including safe areas, country dashboard, quote tool, keyboard-sized search panels and compact menu customization. |
| Diff hygiene | `git diff --check` passed. Temporary source/debug scripts removed. |

The six skips are the mobile-only resize scenario at two desktop/tablet widths in each engine (4), plus the two Chromium-specific worker/cache tests in WebKit (2). They are not suppressed failures. All layout scenarios remain enabled in both engines. Mobile WebKit does not support Playwright wheel input, so its overlay-unlock test checks overflow/inert state and programmatic scrolling; Chromium additionally exercises native wheel input.

The report and machine-readable results are `outputs/mobile-stability/report/index.html` and `outputs/mobile-stability/results.json`. Screenshots are in `outputs/mobile-stability/test-results`. These generated artifacts are intentionally ignored by Git; the tests and this report are repository files.

## Deployment and physical-device verification

Set a unique `DEPLOYMENT_VERSION` for each release when the host does not provide `VERCEL_GIT_COMMIT_SHA` or `GITHUB_SHA`. Next.js limits `deploymentId` to 32 characters. The config preserves shorter values and derives a stable 32-character SHA-256 prefix from longer values, including Vercel's full commit SHA. All instances serving the same release must use the same source value. Preserve previous immutable hashed assets for active clients and use atomic/compatible deployments; application-side recovery cannot guarantee an arbitrary CDN or rolling server configuration serves compatible versions. Confirm the host preserves the worker's no-store headers and revalidates navigation responses.

Automatic recovery permits one reload per tab/session and preserves the current URL with a recovery marker. If it fails again, route error UI offers retry/manual repair. Manual repair only unregisters this application's worker and deletes its public fallback caches; it preserves user data in local storage. Normal updates wait for existing clients to close, so an editing session is not reloaded just because an update arrives.

Physical iOS Safari, installed iOS PWA, Android Chrome and installed Android PWA were not available in this Windows environment. Desktop WebKit mobile emulation is useful coverage, not proof of installed iOS behavior. Before release, verify on actual devices: notch/home-indicator and landscape safe areas; address-bar expansion/collapse and elastic overscroll; keyboard show/hide in notes, search and dialogs; lock/background/resume after several minutes and hours; deep-link launch/reload offline and after reconnecting; and a real deployment while two clients remain open. Also exercise real reconciliation uploads, quote creation and note persistence against a staging backend. Long-session memory behavior, OS storage eviction, process termination and host/CDN release behavior remain physical/staging acceptance items.
