# Frontend release verification

Date: 12 November 2026. Review branch: `codex/frontend-completion`.

This is a frontend change set prepared from `origin/main` (`ca08848a`) in an isolated worktree. It does not include the original workspace's unrelated backend changes, local database folders, environment files, or deployment configuration. No production deployment is requested or performed.

## Implementation coverage

- Shared shell/sidebar: task groups, permissions, active routes, collapse preference, keyboard labels, RTL, skip link, and mobile drawer focus/background isolation.
- Patient and appointment directories, dashboard, patient file, doctors and treatment plans: page-specific hierarchy, responsive controls, empty/error/retry states and preservation of rejected edits.
- Patient intake/edit and appointment creation: required fields, named inputs, load retry, duplicate-write guards, review summary, stale availability protection and native quick-patient dialog.
- Remaining clinic families: consistent page/filters/tables/actions/focus/reduced-motion foundations. Ledger failure recovery is explicit. Prescription, follow-up, branch and medication layouts were corrected at small widths.
- Public registration/booking/confirmation: responsive shell, visible callback labels, keyboard doctor/service selection, availability request ordering, lookup recovery and duplicate-booking guard.
- Standalone clinical/implant pages: input, focus and small-screen layout polish. Procedure logic and financial calculations are preserved.
- Razor platform administration: shared layout skip link and input, focus, table and mobile action styles. Runtime verification is limited as described below.

## Automated checks

Run inside each Angular app:

```powershell
npm run build
npm test -- --watch=false
```

- Clinic application: 37 test files, **267 tests**. Includes permissions, clinical workflows, medical-history atomic saves, rejected-edit recovery, availability races, quick-patient pending behavior, and the three financial ledger recovery paths.
- Public application: 5 test files, **12 tests**, including stale availability, duplicate submission, doctor/service lookup recovery and private confirmation behavior.
- Production Angular builds pass. Clinic initial bundle: approximately **411.31 kB**; public initial bundle: approximately **280.87 kB**. The pre-existing `dental.scss` component-style budget warning remains (110.71 kB against an 80 kB warning threshold). It was not suppressed.
- Language storage is reset between unit tests so a language change in one test cannot change another test's defaults. The real patient-input integration tests allow 15 seconds for asynchronous phone-input initialization under concurrent test load; assertions remain unchanged.

## Browser evidence

The runners in `scripts/frontend-qa` serve built assets with synthetic API fixtures, launch headless Chrome through CDP, exercise controls and write screenshots and JSON results under `tmp/frontend-*-qa`. They require Windows Chrome at the configured path and Node with native WebSocket support. Run from the repository root **after building**; they never use live patients or live application APIs.

```powershell
node scripts/frontend-qa/shell.mjs
node scripts/frontend-qa/care.mjs
node scripts/frontend-qa/records.mjs
node scripts/frontend-qa/intake.mjs
node scripts/frontend-qa/workspace.mjs
node scripts/frontend-qa/public.mjs
node scripts/frontend-qa/clinical.mjs
```

| Runner | Verified scope |
| --- | --- |
| Shell | Patient/appointment directory, expanded/collapsed/mobile sidebar, LTR/RTL |
| Care | Dashboard, patient sections, restricted role, load retry, retained clinical notes |
| Records | Doctor list/create/edit/profile/schedule/compensation and plan list/create/edit/details, version conflict and keyboard selection |
| Intake | Patient create/edit, initial failure/retry, rejected saves, booking review/conflict/retry, modal focus/Escape/restore |
| Workspace | 38 additional routes, English and Arabic, 1440/768/390/320; no root horizontal overflow, unexpected API requests or JavaScript exceptions |
| Public | All five public route patterns, four viewport widths, keyboard booking choices, retained failed booking, confirmation privacy |
| Clinical | Scaling, bleaching and implant planning layouts; login, recovery, reset and invitation routes; no clinical writes |

The core runners additionally use 1024px where recorded. Stored JSON summaries in `docs/frontend-evidence` identify their exact scenarios. The workspace runner uses empty-list/summary fixtures; it is not evidence that every write action, detail variant, export, or permission combination has been exercised end to end.

## Limits and follow-up validation

- No live server or production database integration was exercised. Existing API contracts, scheduling rules, medical history permission checks, procedure completion rules, and money calculations remain owned by the backend.
- Razor platform pages were not compiled or launched: this repository requests .NET SDK **10.0.302**, and no usable compatible SDK is available on this host. Docker's Linux engine is also unavailable. Shared Razor/Bootstrap style changes are therefore source-reviewed, not claimed as a live visual test.
- Clinic themes retain user-selected colors; not every arbitrary custom palette has been contrast-audited. Public booking content retains its existing English language, with an explicit English/LTR host; registration remains Arabic. This release is not a complete translation rewrite.
- Browser evidence is local Chrome evidence. Safari/Firefox and real touchscreen behavior require a separate device run.
- Automated checks and fixture screenshots are sufficient to review these UI changes, not a substitute for real role-based acceptance testing before a production rollout.

## Review and rollback

Review the GitHub branch against `main`. Revert its UI commit to roll back the published changes. Local pre-edit checkpoints remain in the original workspace under `tmp/frontend-checkpoints`; generated screenshots and checkpoints are intentionally excluded from the GitHub commit. Design conventions are in `frontend-design-system.md`; historical batches and route inventory are in `frontend-implementation-progress.md`.
