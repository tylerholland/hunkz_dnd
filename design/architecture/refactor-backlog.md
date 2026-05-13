# Refactor Backlog

> Prioritized cleanup and maintainability work for the DnD app.
> This is not a commitment list. It is a ranked backlog of refactors worth considering as the codebase grows.
> Keep this separate from `decisions.md`: ADRs record what has been decided; this file records what should be revisited next.

---

## Priority 1 · Split Oversized Feature Files By Feature Slice

**Why now**: This was the highest-value cleanup because two core files had already crossed the threshold called out in ADR-002. That first pass is now complete, but the backlog item stays here as a record of the work and as guidance for the next split if the extracted mode files grow too large.

**Recommended direction**:

- Split by feature slice, not by tiny component type.
- For `CharacterSheet`, likely slices are:
  - combat
  - live sync / optimistic session state
  - collections / sections editing
  - loadout
  - unlock / delete / save flows
- For `DmDashboardPage`, likely slices are:
  - initiative tracker
  - NPC combat
  - party cards
  - dashboard auth / shell
  - dice roller integration

**Status note**:

- This first-pass split is now complete.
- `DmDashboardPage.jsx` has already been split into:
  - `src/features/dmDashboard/CharacterCard.jsx`
  - `src/features/dmDashboard/NpcCombatSection.jsx`
  - `src/features/dmDashboard/InitiativeTracker.jsx`
  - `src/features/dmDashboard/DmLoginPrompt.jsx`
  - `src/features/dmDashboard/ConfirmDialog.jsx`
  - `src/features/dmDashboard/dashboardShared.js`
- `CharacterSheet.jsx` has already shed:
  - `src/features/characterSheet/theme.jsx`
  - `src/features/characterSheet/constants.js`
  - `src/features/characterSheet/ItemEditorModal.jsx`
  - `src/features/characterSheet/ChangePasswordForm.jsx`
  - `src/features/characterSheet/CharacterSheetPrimitives.jsx`
  - `src/features/characterSheet/CharacterSheetEditMode.jsx`
  - `src/features/characterSheet/CharacterSheetViewMode.jsx`
- `CharacterSheet.jsx` is now acting as a container for state, sync behavior, and mutation handlers rather than also owning the full render tree.
- Current post-split file sizes are much healthier:
  - `src/components/CharacterSheet.jsx` is about 800 lines
  - `src/pages/DmDashboardPage.jsx` is about 400 lines
  - the next watch-items are `src/features/characterSheet/CharacterSheetViewMode.jsx` and `src/features/characterSheet/CharacterSheetEditMode.jsx`, which are now the largest remaining screen-slice files
- A later optional pass could still split the extracted mode components further if they start growing again, especially around:
  - combat rendering / controls
  - collections / section editing
  - loadout rendering / item actions

**Impact**:

- Largest maintainability improvement available right now.
- Largest token-efficiency win for LLM-assisted development.
- Reduces the risk of accidental breakage from editing huge mixed-responsibility files.

**Follow-up merge candidates**:

- Some newly extracted pieces are intentionally still page-local, but they look like good future shared-component candidates:
  - confirmation modal shell / confirm dialog button row
  - auth prompt / unlock modal shell
  - theme helpers and palette access
  - small action-button factories for bordered uppercase controls
  - hold-to-repeat stepper buttons and numeric steppers
- Do not force-sharing too early. The goal should be to merge only the pieces that stay visually and behaviorally aligned across pages after another round of iteration.

---

## Priority 2 · Centralize Live Sync / Polling / Optimistic Write Utilities

**Why now**: The adaptive polling and optimistic session-sync model is now one of the most important architectural behaviors in the app, but it is implemented in multiple places.

**Current spread**:

- `src/pages/CharacterPage.jsx`
- `src/components/CharacterSheet.jsx`
- `src/pages/DmDashboardPage.jsx`

**Recommended direction**:

- Extract shared primitives such as:
  - `useAdaptivePolling`
  - `useDebouncedFlush`
  - `useOptimisticServerField`
  - `queueImmediateResync`
- Keep the ADR-011 contract intact:
  - server remains authoritative
  - optimistic local values are preserved until polled server state matches expected state
  - background polls should not overlap unnecessarily

**Status note**:

- This pass is now complete.
- Shared realtime helpers now live in:
  - `src/lib/liveSync.js`
- The following behavior has been centralized there:
  - adaptive `1s` / `5s` polling loop
  - queued immediate background refreshes after successful live writes
  - shared debounce utility
  - optimistic live-field merge helpers
  - generic debounced optimistic numeric flush logic
- The main adopters are now:
  - `src/pages/CharacterPage.jsx`
  - `src/pages/DmDashboardPage.jsx`
  - `src/components/CharacterSheet.jsx`
  - `src/features/dmDashboard/CharacterCard.jsx`
  - `src/features/dmDashboard/NpcCombatSection.jsx`

**Follow-up note**:

- Initiative optimistic sync on the DM campaign page is still a feature-specific flow and remains local to `DmDashboardPage.jsx`.
- That is intentional: its serialized whole-record write pattern is similar to other live-sync code, but not identical enough to force into the shared utility layer yet.

**Impact**:

- Reduces race-condition risk.
- Makes future live fields cheaper to implement.
- Makes the most complex behavior in the app more legible to future contributors and future LLMs.

---

## Priority 3 · Centralize Special-Record Backend Logic

**Why now**: Internal DynamoDB sentinel rows such as `initiative` and `npc-combat` have already caused user-visible bugs when they leaked through public character endpoints.

**Recommended direction**:

- Keep reserved slug definitions in one place.
- Move initiative and NPC-combat record access behind shared helpers.
- Avoid duplicating sentinel-key knowledge across handlers.

**Status note**:

- This pass is now complete.
- Reserved slug and public-filter logic remains in:
  - `backend/src/lib/specialItems.js`
- Shared initiative / NPC combat record access now lives in:
  - `backend/src/lib/specialRecords.js`
- The following handlers now consume the shared facade instead of hardcoding sentinel-record load/save logic:
  - `backend/src/handlers/get.js`
  - `backend/src/handlers/initiative.js`
  - `backend/src/handlers/getNpcCombat.js`
  - `backend/src/handlers/putNpcCombat.js`
  - `backend/src/handlers/list.js`
  - `backend/src/handlers/dmParty.js`

**Follow-up note**:

- DM-password verification for DM-only handlers is still repeated and could eventually move behind a tiny `requireDmAuth` helper, but that is a separate concern from the sentinel-record refactor.

**Targets**:

- `backend/src/lib/specialItems.js`
- `backend/src/handlers/get.js`
- `backend/src/handlers/list.js`
- `backend/src/handlers/dmParty.js`
- `backend/src/handlers/initiative.js`
- `backend/src/handlers/getNpcCombat.js`
- `backend/src/handlers/putNpcCombat.js`

**Impact**:

- Prevents another class of “phantom character” regression.
- Lowers backend maintenance cost.
- Reduces subtle coupling around the flat DynamoDB schema.

---

## Priority 4 · Introduce A Shared Page Shell / Navigation Layer

**Why now**: Navigation and top-bar work is becoming iterative and expensive because the same concerns are now implemented independently on multiple pages.

**Recommended direction**:

- Add a small shared shell layer for:
  - page top nav
  - breadcrumb row
  - DM session badge
  - common session actions
  - page title handling
- Keep it lightweight and inline-style friendly.

**Candidate components / helpers**:

- `TopNav`
- `BreadcrumbLink`
- `SessionBadge`
- `DangerActionButton`
- `PageHeader`

**Impact**:

- Makes ongoing mobile/navigation polish much cheaper.
- Reduces duplicated style churn.
- Good token-efficiency win because nav work currently requires reading too much page-specific code.

---

## Priority 5 · Remove Dead / Backup Source Files From `src/`

**Why now**: Search results are polluted by historical backup files that are no longer part of the product.

**Known offenders**:

- `_oldApp.jsx`
- `_backup_of_eoghan_sundayApp.jsx`
- `Eoghan_app_edited.jsx`
- `_eoghan3.jsx`

**Recommended direction**:

- Remove them from `src/`.
- Rely on git history rather than in-repo backups.

**Impact**:

- Very low risk.
- High value for LLM-assisted development because it cuts search noise and token waste.

---

## Priority 6 · Extract Reusable Style Factories For Repeated UI Patterns

**Why now**: ADR-001 still makes sense, but inline styles are now being duplicated heavily across buttons, pills, cards, modals, and themed control surfaces.

**Recommended direction**:

- Keep inline styles, but extract repeated style factories / helpers for:
  - nav buttons
  - action buttons
  - chips / badges
  - modal shells
  - card containers
  - Vellum surface transforms
  - active-turn highlight surfaces

**Constraint**:

- Do not jump to a CSS framework.
- Do not replace palette-driven JS theming with class-heavy styling unless ADR-001 is explicitly revised.

**Impact**:

- Lowers UI refactor cost.
- Makes visual adjustments less error-prone.
- Helps another model make narrow UI changes without touching unrelated style blocks.

---

## Priority 7 · Harden Frontend Deploy / Runtime Assumptions

**Why now**: Production routing and asset behavior depend on deployment details that are easy to miss.

**Observed pressure points**:

- SPA deep-link handling on S3 website hosting
- required static assets such as `favicon.svg`
- frontend deploy behavior encoded in `deploy.sh`

**Recommended direction**:

- Make the S3 website fallback behavior explicit and durable.
- Standardize static asset placement.
- Consider a dedicated `public/` convention for static frontend assets.
- Keep deploy assumptions discoverable for future maintainers and LLM agents.

**Impact**:

- Prevents “looks like app bug, actually deploy config” regressions.
- Reduces operational surprise.

---

## Priority 8 · Add A Minimal Regression Test Layer Around Brittle Contracts

**Why now**: The app does not need broad test coverage, but there are now a few behaviors that are disproportionately expensive to re-debug.

**Best candidates**:

- backend:
  - public list/get endpoints never expose reserved sentinel rows
- frontend:
  - optimistic HP updates do not revert incorrectly after debounce flush
  - adaptive polling does not overwrite fresh state with stale responses
  - direct `/dm` route remains valid under production SPA hosting assumptions

**Recommended direction**:

- Keep tests narrow and contract-focused.
- Prefer a few high-value tests over a large test surface.

**Impact**:

- Saves future debugging time.
- Reduces token spend on recurring regression analysis.

---

## Priority 9 · Normalize Palette / Theme Transformation Helpers

**Why now**: Theme adaptation logic is getting richer, especially around Vellum and active-turn states, but it still lives directly inside feature pages.

**Recommended direction**:

- Extract shared theme utilities for:
  - Vellum light-mode transforms
  - active-turn surface treatments
  - paper / ink / line color mixing helpers

**Impact**:

- Makes future theme work cheaper.
- Reduces visual drift between similar UI surfaces.

---

## Things Not To Refactor Yet

These may be attractive, but they are not the right cleanup work right now:

- Do not replace polling with WebSockets unless there is an explicit architectural decision to do so.
- Do not introduce a global client-state library just because live sync exists.
- Do not abandon inline styling unless ADR-001 is intentionally revisited.
- Do not explode the app into dozens of tiny components with shallow responsibilities.

---

## Suggested Execution Order

If only a few refactors are undertaken in the near term, do them in this order:

1. Remove dead backup files from `src/`.
2. Introduce a shared page shell / nav layer.
3. Extract reusable style factories for repeated UI patterns.
4. Normalize palette / theme transformation helpers.
5. Harden frontend deploy / runtime assumptions.

Refactors 1 and 2 in the original queue are already complete, so this order reflects the next highest-value cleanup work.
