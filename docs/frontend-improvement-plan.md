# Frontend improvement plan

Kind: dental clinic management software, with a public service website and a separate platform administration interface.

Date: 11 November 2026. Scope: planning only; no application code changes.

## Goal and audience

Make everyday work faster for receptionists, dentists, clinic administrators, and finance staff. Make booking and clinic registration clear for public visitors. Give all pages a consistent visual language while preserving the specialized information needed for clinical work.

Use the existing Angular/SCSS applications and Razor platform admin. Preserve permissions, clinic switching, translations, validation, clinical data, financial calculations, and unsaved-change protection.

## Evidence and limits

This plan is based on the current route definitions, application shell, global styles, representative dashboard/patient templates, feature styles, public home component, and platform admin layout/page inventory. It is a source review, not a rendered accessibility or visual audit. Confirm proposed fixes against live pages during phase 1.

Observed foundations and issues:

- The clinic app already has eight navigation groups, permission-aware links, desktop collapse, mobile overlay, and English/Arabic support. Improve these rather than replace them wholesale.
- The sidebar is implemented directly in `src/app/app.html`; shell state and interactions live in `app.ts`. Separate navigation configuration and presentation so labels, permissions, route matching, and active states have one owner.
- The current shell combines a navy gradient sidebar with green global brand tokens. Define explicit navigation, brand, surface, and status roles so their relationship is intentional.
- Both `src/styles.scss` and `src/app/styles.scss` contain design tokens; `angular.json` loads `src/styles.scss`. Trace imports and usage before consolidating the second file.
- Global and feature SCSS define repeated page, control, panel, and metric patterns. Consolidate shared patterns after checking where feature-specific behavior is required.
- The patient search input relies on placeholder text in its template. Give it a persistent visible label and audit other search/filter controls for the same issue.
- Sidebar collapse controls have accessible labels, but the inspected template does not expose `aria-expanded`, `aria-controls`, or `aria-current`. Include these in the navigation pass and verify mobile focus behavior.
- Public home embeds `/planora/index.html` in an iframe. Review its scrolling, navigation, accessibility, loading, and metadata before deciding whether to keep or replace that integration.
- Pharmacy components exist but no pharmacy route was found in the clinic route file. Establish whether they are embedded, retired, or intended to be reachable before changing navigation.
- The workspace already contains extensive unfinished changes. Implementation must preserve them and keep each phase independently reviewable.

## Shared design direction

- **Visual lane:** calm clinical workspace. Light neutral canvas, white working surfaces, dark readable text, existing green as the primary action color, and a restrained navy navigation surface. Keep clinic theme customization through `ClinicThemeService`.
- **Hierarchy:** page title, short context, primary action, filters or summary, then the working content. Clinical alerts and urgent queues may precede this when clinically appropriate.
- **Typography:** retain Plus Jakarta Sans for English and Cairo for Arabic if font loading and legibility pass inspection. Start with 16px body, 14px dense table text, 24–32px page titles; tune Arabic line heights independently. Avoid tiny uppercase metadata as the only explanation of a value.
- **Spacing:** use a 4/8px spacing scale, consistent page gutters, 8–12px control/panel radii, subtle borders, and limited shadows. Align page headings, filters, and content edges.
- **Status:** consistent semantic tokens for success, warning, error, informational, and neutral states. Every status has text or an icon plus text; color alone is insufficient.
- **Assets:** reuse the existing Planora logo and clinical diagrams after checking legibility and relevance. No stock photography or new image generation is needed inside operational pages. Public pages need owned or licensed service imagery only where useful.
- **Motion:** brief 120–180ms feedback for controls and drawer transitions. Respect reduced motion. Keep clinical diagrams, queues, and financial figures stable while reading or editing.
- **Copy:** short bilingual labels that describe the action, such as “Add patient,” “Record payment,” and “Save examination.” Review Arabic terminology with the actual workflow.

Do not apply marketing page conventions such as full-screen heroes, decorative scenes, or scroll choreography to clinical and administrative workflows. Apply the design-taste skill selectively to public-facing presentation and shared visual consistency.

## Phase 1 — Establish the baseline and page checklist

1. Expand the two Angular route files and Razor page inventory into a checklist of every reachable page, including create/edit/detail variants and standalone clinical screens.
2. Trace embedded sheets, dialogs, patient dossier, visit history, medical alerts, confirmation dialogs, and pharmacy components; include them in their owning page's checklist.
3. Capture representative current desktop/mobile screens using synthetic patient data. Record role, language, clinic theme, viewport, and loading/data state.
4. Verify navigation visibility against existing permission guards for each actual role. Record existing failures separately from redesign regressions.
5. Trace the CSS cascade and theme overrides. Identify the active source of each shared token before moving styles.

Deliverable: a route/state matrix and baseline captures. Exit condition: every reachable page has an owner, primary task, and verification scenario.

## Phase 2 — Sidebar and application shell (highest priority)

### Proposed navigation structure

Keep Dashboard immediately available; organize remaining destinations around staff tasks:

| Group | Destinations |
| --- | --- |
| Daily work | Appointments, Patients, Doctors |
| Clinical | Treatment plans, Treatments, Prescriptions, Treatment catalog, Medication catalog |
| Finance | Overview, Revenue, Payments, Expenses, Categories, My dues |
| Relationships | CRM overview, Follow-ups |
| Operations | Lab, Insurance, Inventory, Online booking, Notifications |
| Insights | Reports and its report destinations |
| Administration | Users, Branches, Settings, Backup |
| Help | Guide |

All destinations remain subject to their existing permission rules. These are proposed group names, not changes to business roles or API authorization. Report detail links can stay inside the reports workspace instead of expanding the sidebar indefinitely.

### Layout and behavior

- Keep the existing 260px expanded / 72px collapsed sizes as starting points; validate Arabic labels before finalizing widths. Use one width contract for sidebar and content offset.
- Keep branding and collapse control at the top, independently scrollable navigation in the middle, and account/clinic context in a stable location. Hide groups with no permitted destinations.
- Add expandable groups where needed to reduce scanning. Open the group containing the current route; remember desktop collapse preference for that user/device and keep mobile drawer state separate.
- Provide one clearly selected destination, including on nested edit/detail pages. Define parent matching explicitly so CRM overview and follow-ups do not appear selected together. Expose the current destination semantically.
- In collapsed mode, retain accessible names and show labels on keyboard focus as well as hover. Keep every permitted destination reachable.
- Expose toggle state and controlled element IDs. On mobile: move focus into the drawer, contain focus while open, make the background inert, close on Escape/backdrop/navigation, restore trigger focus, and prevent background scrolling.
- Keep language and clinic switching clear in the topbar; display switching/error states without losing the user's current context silently.
- Add a skip-to-content link, route-aware page context, visible keyboard focus, and responsive topbar actions. Keep standalone clinical screens' exit and patient context obvious.

Exit condition: every permitted destination works in expanded, collapsed, mobile, LTR, and RTL states; no hidden keyboard focus or overlap; role restrictions remain enforced.

## Phase 3 — Shared page patterns

Build small Angular presentation components or SCSS patterns before migrating every feature. Use composition so feature logic and clinical meaning stay local.

| Pattern | Required content and behavior |
| --- | --- |
| Page header | One title, optional breadcrumb/context, primary action, secondary actions; wrap cleanly on mobile |
| Filter toolbar | Visible labels, search, relevant filters, apply/reset, active filter summary and result count |
| Data table | Semantic headings, consistent row density, aligned numeric values, clear actions, sort state where sorting exists, pagination |
| Form section | Visible labels, required/optional guidance, help text, inline errors, invalid submission summary, save/cancel and pending states |
| Summary strip | A few task-relevant figures with explicit units, time range, and drill-through only when available |
| Status and feedback | Consistent badges, inline alerts, pending/success/error messages, retry and empty-state actions |
| Dialog or sheet | Name, close control, correct focus lifecycle, background isolation, responsive scrolling, unsaved-change handling |

Use mobile cards only when they preserve meaningful column relationships; otherwise use a contained horizontally scrolling table with essential identity/actions visible. Do not make the whole page scroll horizontally. Retain specialized date, phone, patient, doctor, and tooth inputs and audit their integration with these patterns.

Exit condition: Patients, Appointments, and one create/edit form demonstrate the shared patterns in English and Arabic before broad rollout.

## Phase 4 — Improve every clinic page family

The order below prioritizes common workflows. Every family includes its routed create/edit/detail variants and related embedded views.

| Priority | Pages | Improvement blueprint |
| --- | --- | --- |
| P1 | Dashboard, doctor visit queue, billing queue | Compact date/context header; urgent work and today's schedule first; clear next actions; fewer decorative metrics; consistent queue statuses and loading states |
| P1 | Appointments, booking form, visit and examination | Clear date/view controls; legible time/status; patient/doctor context; explicit scheduling errors; predictable action hierarchy and completion feedback |
| P1 | Patients, create/edit/details, dossier and visit history | Strong patient identity and medical alerts; consistent summary/tabs; searchable registry; distinct clinical and finance sections; clear save/return behavior |
| P1 | Dental chart, patient dental view, treatment clinical workspace, implant workflow | Stable patient/tooth/procedure context; legible chart legend; text alternatives to color; grouped clinical fields; explicit save state; preserve can-leave guards and specialized procedure logic |
| P1 | Treatment plans, plan form/details, treatments/details | Separate proposed and completed work; readable tooth/procedure/status/cost relationships; clear approval and next-step actions; mobile-friendly summaries |
| P2 | Doctors and create/edit/details | Consistent profile/availability/branch sections, readable schedules and status, predictable form validation |
| P2 | Prescriptions and create/edit/details; medication and treatment catalogs | Clear medication/dose/frequency fields and existing validation; searchable catalogs; consistent prices/units; readable preview/print layouts where supported |
| P2 | Finance overview, revenue, payments/create, expenses/create, categories, my dues | Visible date/branch scope; aligned amounts and currencies; totals tied to the current filters; distinguish pending, outstanding, and settled states; protect against duplicate submissions |
| P2 | CRM dashboard, follow-ups/create/details | Due/overdue/upcoming grouping; patient and assignee context; clear next action; readable history and completion state |
| P2 | Reports hub; financial, revenue, expense, profit, patient, appointment, doctor, treatment, prescription, CRM reports | Shared filter/header/export layout where export exists; explicit date/branch scope; chart labels and table alternatives; consistent totals and empty-data messages |
| P3 | Lab, insurance, inventory; pharmacy if active | Task-specific status and stock/work queues; concise filters; useful empty states; clear detail/edit hierarchy; no new workflow or stock rules introduced by styling |
| P3 | Notifications, online-booking management | Prioritize actionable notifications; clear read states; distinguish booking configuration from incoming requests; visible save and validation feedback |
| P3 | Users and user details, branches | Clear role/permission and branch membership presentation; separate destructive controls; recognizable invitation, active, and disabled states |
| P3 | Settings, backup, guide | Group settings by user task; consistent save scope and feedback; explicit backup/restore state and existing safeguards; searchable or well-indexed help with contextual links |
| P2 | Login, forgot/reset password, accept invitation, access denied | Consistent compact auth layout; accessible errors and pending state; password guidance; clear recovery or safe return action |

For each family: agree content order, migrate to shared styles, check responsive behavior, verify supported interactions, and compare with the baseline before proceeding.

## Phase 5 — Public pages and platform administration

| Surface | Content and layout plan | Verification focus |
| --- | --- | --- |
| Public home | Clear service/product statement and main action, actual capabilities, service details, registration/booking path, footer; purposeful owned visuals; retain factual claims only | Iframe integration decision, mobile scrolling, keyboard access, links, metadata and loading |
| Clinic registration and email confirmation | Short grouped form, visible requirements, validation, submission state, confirmation with next step | Existing registration and confirmation lifecycle; no misleading success before the server confirms |
| Public booking and booking confirmation | Clinic identity, service/doctor/date choices, patient details, review and confirmation using existing flow; retain entered data after recoverable failures | Availability changes, API errors, mobile input, reference readability and safe handling of patient information |
| Platform home, clinics list/create/edit/details | Shared admin header and navigation, scoped metrics, readable clinic tables and grouped forms | Existing admin authorization, clinic actions and validation |
| Platform registrations, operations, email/SMTP | Clear queue/status hierarchy, readable operational details, focused settings forms and feedback | Long content, failure states, save scope and existing actions |
| Platform login/logout, privacy, error | Consistent readable page framing, explicit state and recovery links | Auth transitions, keyboard access and small-screen layout |

Reuse design tokens conceptually across Angular and Razor while retaining each stack's native components. Do not migrate frameworks as part of this work.

## Phase 6 — Verification and completion criteria

Maintain one shared route/state matrix, rather than repeating unrelated whole-site audits for each skill.

- Check every reachable route with an authorized role and realistic synthetic data. Cover populated, loading, empty, failed, denied, and saving states where applicable; include long names, Arabic text, and large datasets.
- Inspect all pages at desktop and mobile sizes; use 1440, 1024, 768, and 390px as the main matrix. Check 320px and 200% zoom on shared shell, forms, and dense clinical/table layouts.
- Test English LTR and Arabic RTL, sidebar variants, actual clinic theme variations, keyboard-only navigation, visible focus, accessible names, contrast, touch targets, and reduced motion. Aim for WCAG 2.2 AA; record evidence rather than claiming certification from source review.
- Verify patient → appointment → examination → treatment → prescription/payment navigation with existing supported workflows. Confirm edits, cancellations, unsaved-change prompts, validation, and print/export actions where supported.
- Keep clinical meaning, financial totals, role permissions, tenant boundaries, and API contracts unchanged. Compare before/after behavior for high-risk interactions.
- Run `npm run build` and `npm test -- --watch=false` in each affected Angular app using its installed toolchain. Confirm test-runner flags before execution. Run applicable platform tests and `dotnet build src/DentalClinic.PlatformAdmin/DentalClinic.PlatformAdmin.csproj` when Razor files change.
- Preserve the current Angular build budgets; record initial bundle/style sizes and check for regressions. Check fonts, icons, layout shifts, large-table performance, console errors and failed requests.
- Use repository-local browser tooling when available. Record browser and emulation limitations; emulation does not establish real-device Safari compatibility.

Completion means all inventory items have verification evidence, no unresolved blocking navigation/form/layout regressions, and remaining limitations are listed explicitly. A successful build alone does not establish visual quality.

## Skills mapped to implementation

Already used for this plan:

- `design-taste-frontend`: visual consistency and deliberate presentation, scoped to this clinical product.
- `website-blueprint-first`: page map, task hierarchy, sequence, and acceptance criteria.

Use these specialists when their phase starts; read their instructions then:

| Work | Relevant Codex skills |
| --- | --- |
| Baseline and browser evidence | `browser-inspection-workflow`, `visual-regression-lab` |
| Navigation structure | `content-structure-information-architecture` |
| Typography, colors and surfaces | `editorial-typography-systems`, `color-material-lighting-direction`, `surface-shadow-material-systems` |
| Labels and form journeys | `brand-voice-to-ui-copy`, `cta-language-systems`, `conversion-forms-checkout-polish` |
| Accessibility and responsive checks | `accessibility-audit-websites`, `mobile-responsive-qa`, `responsive-visual-polish-qa` |
| Motion and final performance | `reduced-motion-design`, `performance-audit-websites`, `visual-polish-qa` |
| Public page metadata | `seo-technical-qa` |
| Final evidence review | `verification-before-completion` |

React, Next.js, shadcn, and Tailwind specialist skills are unnecessary for the current Angular/SCSS stack.

## Delivery sequence and boundaries

Ship in reviewable batches: baseline → tokens and sidebar → Patients/Appointments pilot → remaining daily/clinical pages → finance/reports/operations/admin → public and platform pages → final verification. Each batch includes screenshots, affected files, behavioral checks, and remaining issues.

Start implementation with the shared shell and Patients/Appointments pilot because they establish the patterns used across the app. Estimate delivery only after the route/state baseline establishes the actual amount of feature-specific work.

This plan does not authorize deployment, business-rule changes, new APIs, framework migration, invented metrics, or removal of existing user changes. No application tests or rendered browser checks were run for this planning-only deliverable.
