# Frontend workspace conventions

The clinic application is an operational workspace for reception, clinicians, finance staff, and administrators. Retain the existing Planora identity, clinic theme customization, permissions, English/Arabic translations, clinical diagrams, and financial rules.

## Foundations

- Existing green brand tokens identify primary actions. Navy is the navigation surface; white working surfaces sit on the neutral application canvas. Use the existing `ClinicThemeService` rather than hard-coded replacement themes.
- Typography remains the installed Plus Jakarta Sans/Cairo system. Page headings scale from 24 to 32px; Arabic uses natural spacing and readable line heights. Numeric tables use tabular figures.
- Use 8px-based spacing, 12px working surface radii, restrained borders, and equal content edges. Do not decorate operational pages with marketing heroes or additional motion.
- Header order is title/context, primary action, filters, then working content. Remove redundant eyebrow labels. Keep clinical warnings visible where the task requires them.
- Use logical inline/block properties. At narrow widths, wrap actions and filter controls; preserve complete tables inside their own scrolling region. Fix intrinsic grid widths rather than hiding root overflow.

## Interaction and recovery

- Native buttons own actions and selection. Links own navigation. Never nest a button within another interactive control.
- Inputs have visible labels; shared date, phone, patient, doctor and medical tag controls also expose accessible names.
- Aim for 44px controls and clear keyboard focus. Preserve specialized tooth diagrams and dense clinical geometry.
- Keep loading, request failure and genuinely empty data distinct. Retry the failed request without clearing unsaved user input.
- Block duplicate writes while pending. Ignore stale availability responses and clear an old slot as soon as scheduling parameters change.
- Native dialogs own modal focus and background isolation. Restore focus and scroll on close; keep failed form data visible.
- Respect reduced motion, preserve permission gates, and keep status text alongside status color.

## Ownership

`src/styles.scss` loads `_workspace-foundations.scss` for common routed workspaces. `_workspace-intake.scss`, `_workspace-calendar.scss`, and `_workspace-records.scss` are explicitly included by their owning features. Clinical workflow and implant styles remain local. The public Angular application and Razor admin retain their own layouts and receive equivalent input/focus/responsive foundations.

See `frontend-release-verification.md` for verification commands and the distinction between shared style coverage and tested business flows.
