# Story 13 — XP Tracking

## Goal

Let the DM award Experience Points after encounters and let players see their current XP and how far they are from the next level. Support both XP-based and milestone leveling so the app is useful regardless of how the table levels up.

---

## Background & design rationale

XP is the DM's domain, not the player's — awarding XP is a DM action that happens between encounters or at session end, not something players self-manage. Players do want to see the number and watch it tick up, but they should not be able to edit it themselves.

Milestone leveling (the DM simply says "you level up" at a dramatic moment) is at least as common as XP leveling among 5e groups, and many online groups use a hybrid — DM tracks XP internally and announces level-ups at natural narrative breaks. The app should not force one model.

Level-up itself is a significant out-of-session activity (choosing spells, feats, updating HP, hit dice, potentially skills and abilities). That is edit-mode work and should not be automated in the MVP; the app should prompt awareness, not orchestrate the process.

---

## User stories

**As a DM**, I want to award XP to one or all party members after an encounter so that characters' progress is tracked without a separate spreadsheet.

**As a player**, I want to see my current XP and the XP required for my next level so that I know how close I am to leveling up.

**As a player or DM**, I want to know when a character has accumulated enough XP to level up so that we don't miss the milestone.

**As a DM running milestone leveling**, I want to be able to ignore XP entirely — no counter should clutter the sheet — and just manage level via the standard edit flow.

---

## Functional requirements

### Character sheet (player view — Combat tab or Stats block)

1. When `levelingMode === "xp"`: show a compact XP progress display — current XP, XP needed for next level, and a simple text or numeric progress indicator (e.g., "1 800 / 2 700 XP"). No auth required to read.
2. When `xpCurrent` meets or exceeds the threshold for the next level above `level`: show a "Ready to level up" indicator (a banner or badge). It is informational only — the player must go to edit mode to apply the level.
3. XP is read-only on the player-facing sheet. Players cannot type a new value.
4. When `levelingMode === "milestone"` (or unset): XP display is hidden entirely. No empty row, no placeholder.

### DM dashboard (party card)

5. When `levelingMode === "xp"`: show a compact XP row on each party card — current XP / threshold (e.g., "1 800 / 2 700"). A "+" button opens an Award XP modal.
6. **Award XP modal**: text input for amount + "Award" button. Writes via `patchSession` (session-scoped, no owner auth required — DM auth is sufficient). Supports awarding to one character or to all party members simultaneously ("Award to whole party" checkbox or separate "Award All" action on the dashboard).
7. When a character's XP crosses a level threshold after an award: the party card highlights the "Ready to level up" state (same indicator as player view).
8. When `levelingMode === "milestone"`: XP controls are hidden on party cards.

### Edit mode (per character)

9. **Leveling mode selector**: `"xp"` | `"milestone"` toggle in edit mode (stored per character). Default: `"milestone"` (safe, no-op for groups not using XP).
10. When `levelingMode === "xp"`: show a numeric XP input for `xpCurrent`. DM or owner can set this directly (useful for importing existing character progress).
11. XP thresholds per level (PHB table, levels 1–20) are constants in the frontend — no backend storage needed.

---

## Data model changes

New fields on the character DynamoDB item:

| Field | Type | Default | Notes |
|---|---|---|---|
| `levelingMode` | `"xp"` \| `"milestone"` | `"milestone"` | Per character; edit-mode only |
| `xpCurrent` | number | `0` | Current XP earned; session-writable (no auth required) |

`patchSession` must accept `xpCurrent` as an allowed session field (same pattern as `hpCurrent`, `inspiration`, etc.). No auth required.

XP thresholds (levels 1–20) are a frontend constant array — identical across all characters, no DB storage required.

---

## Out of scope

- Automated level-up flow (choosing new spells, feats, hit die rolls, etc.)
- XP splitting logic (calculating award per encounter based on CR)
- Proficiency bonus auto-calculation from level
- Multi-class XP handling (exotic edge case)
- Fractional or modified XP (e.g., half XP for some encounter types)

---

## Open questions

1. Should XP award appear in the existing `patchSession` endpoint, or does it warrant a separate `/xp` endpoint so it can log a history of awards? (History is useful for DM accountability but may be over-engineering for MVP.)
2. Should the "Award to whole party" action be a separate API call, or fan out from the frontend via parallel `patchSession` calls (same approach as Short Rest)?
3. Is there value in showing XP history (last N awards with amounts and timestamps) on the DM card? Probably deferred.
4. Should `xpCurrent` be writable without any auth (like `hpCurrent`) or require DM auth? Given that XP is purely a DM action, DM auth requirement seems correct — but this is a policy decision.

---

## UX Design

### Prototype
`design/prototypes/xp-tracking.html` — covers three scenarios: character sheet in XP mode (mid-progress + level-up state), character sheet in milestone mode (no XP visible), DM party cards with XP rows, and the Award XP modal.

---

### Character sheet — XP strip

**Placement**: inside the existing stats surface panel, directly below the ability score circles. The heading row already reads "Ability Scores · Level N" — the XP strip is the natural continuation of that identity block. No new section or panel is added.

**Visual structure** (XP mode):
- A single compact row: `XP` label (IM Fell English, 11px uppercase tracked, `pal.textMuted`) → thin progress bar (4px tall, `pal.accent` fill on `pal.surface` track, `border-radius: 2px`) → `2,450 / 6,500 XP` text (IM Fell English, 12px; current XP in `pal.gem`, threshold in `pal.textMuted`).
- The whole strip sits inside a surface panel sub-row: `background: pal.surface`, `border: 1px solid pal.border`, `border-radius: 4px`, `padding: 10px 14px`, `margin-top: 14px`.
- XP is read-only on the player sheet — no input, no edit affordance.

**Level-up indicator** (when `xpCurrent >= threshold`):
- A pulsing badge appears inline with the level number in the heading: `●  Ready to level up` — uses `pal.gem` color with a subtle periodic box-shadow glow (`0 0 8px 2px rgba(gem, 0.28)` at 50% of a 2.4s loop). Same `pal.gem` color scheme as the stat circle fills so it reads as "positive achievement" without triggering alarm.
- The progress bar fill simultaneously shifts to `pal.gem` and fills to 100%.
- The badge is informational only — tapping it does nothing. A short italic note below (or as tooltip): "Apply level-up in edit mode."

**Milestone mode**: XP strip is absent entirely — no empty row, no placeholder, no separator. The stats panel looks exactly as it does today.

---

### DM dashboard — party card XP row

**Placement**: one compact row directly below the HP bar, using the same structural pattern (label | progress bar | numeric value).

- `XP` label (same IM Fell English uppercase style as `HP` label, `pal.textMuted`, fixed 28px width).
- Progress bar: 4px height, character's `pal.accent` fill.
- Numeric value: `2,450 / 6,500` in IM Fell English 12px; current value in `pal.text`, threshold in `pal.textMuted`.
- `+` icon button at the far right: 24×24px, ghost border style (`pal.border`, `border-radius: 3px`), `pal.accent` color — opens the Award XP modal for that character.

**Level-up state**: the character's name line gains an inline badge (same pulsing gem-colored style as the player sheet). The XP bar fill shifts to `pal.gem`.

**Milestone mode characters**: no XP row rendered on the card.

---

### Award XP modal

Triggered from: (a) the `+` button on a party card's XP row, or (b) "Award XP to Party" in the Party-Wide Actions section.

**Layout** (standard DM dashboard modal style — `pal.surfaceSolid` panel, `max-width: 380px`):
1. Title: "Award XP" (Cinzel, 15px).
2. Subtitle: character name or "Whole Party" (IM Fell English, 12px uppercase, `pal.textMuted`).
3. **Amount input**: large centered number field (Cinzel, 28px, `pal.text`); no spinners — direct keyboard entry. Below it: quick-preset row — `50 · 100 · 200 · 300 · 500 · 750` — ghost pill buttons; tapping fills the input.
4. **Award to whole party toggle**: pill toggle switch + label "Award to whole party". Pre-checked when opened from the Party-Wide Actions button; unchecked when opened from a single card.
5. Footer: `Cancel` (ghost) + `Award XP` (primary accent).

**Behavior**: on confirm, fires `patchSession({ xpCurrent: xpCurrent + amount })` for each selected character. DM auth is passed via the standard `x-character-password` header — no per-character owner auth required. Modal closes immediately (optimistic); any error surfaces as a brief inline error text above the footer.

---

### Edit mode — leveling mode selector

Inside the existing edit form, near the Level field in the Identity section:

- A two-option toggle: `Milestone` | `XP` — same pill-toggle style as existing edit mode toggles.
- Default: `Milestone` (safe, no-op for groups not tracking XP).
- When `XP` is selected: a numeric input for `xpCurrent` appears below the toggle (label: "Current XP", standard edit-mode input style). DM or owner can set this directly for initial character setup.
- XP thresholds (PHB levels 1–20) are frontend constants — no backend storage.

---

### Responsive / mobile behaviour

The XP strip is a single flex row. On narrow screens (≤ 560px) the numeric value wraps below the bar — the label and bar fill the width, the `N / M XP` text appears on a second line. The `+` award button on DM cards remains in the same row as the XP label (no wrap needed — it's narrow enough).

---

### What was not designed (deferred)

- XP history / award log (open question 3 in the story)
- XP splitting by encounter CR
- Animated XP counter increment (nice-to-have; bar transition covers it sufficiently)

---

## Architect Notes

**Applies**: ADR-003, ADR-005, ADR-011

**Tech approach**: Two new fields added to the character DynamoDB item: `xpCurrent` (session-writable, default `0`) and `levelingMode` (`"xp" | "milestone"`, edit-mode only, default `"milestone"`). Both are added to `BLANK_CHARACTER` in `src/features/characterSheet/constants.js`. `xpCurrent` is added to `SESSION_FIELDS` in `backend/src/handlers/session.js` alongside `hpCurrent` and `inspiration` — no new endpoint needed. The XP-to-level threshold table (PHB levels 1–20) is a frontend constant array in `constants.js` named `XP_THRESHOLDS`. Level-up detection is a derived comparison (`xpCurrent >= XP_THRESHOLDS[level]`) computed wherever the XP strip is rendered — no stored flag, no backend field. `xpCurrent` is added to the `ProjectionExpression` in `dmParty.js` so the DM card XP row has data without a separate fetch. Award XP from the dashboard uses a frontend-computed absolute value (`newXp = current + delta`) sent via `patchSession` — same fan-out pattern as Short Rest. `levelingMode` is added to the projection as well, so the DM card can conditionally render the XP row. The `LIVE_SESSION_FIELDS` constant in `constants.js` (which mirrors `SESSION_FIELDS` on the frontend for optimistic merge logic) must also be updated to include `xpCurrent`.

**Scope boundary**: In scope — `xpCurrent` session field, `levelingMode` edit field, XP strip on character sheet (XP mode only), DM party card XP row, Award XP modal, level-up badge. Out of scope — XP history/log, XP splitting, automated level-up flow, multi-class XP, fractional XP.

**Open questions resolved**:
1. No `/xp` endpoint — `patchSession` is sufficient for MVP. History is deferred.
2. Award to whole party fans out from the frontend via parallel `patchSession` calls — identical to the Short Rest pattern in `doShortRest()` in `DmDashboardPage.jsx`. No race condition concern for XP: no other actor writes `xpCurrent` concurrently (only the DM awards XP, and the DM UI is single-user). The absolute-value write (not delta) eliminates stale-base races.
3. XP history deferred.
4. `xpCurrent` is no-auth-writable — same tier as `hpCurrent`, `conditions`, `inspiration`. Level-up itself requires edit-mode auth, so a player cannot meaningfully exploit free XP writes. Add `xpCurrent` to `SESSION_FIELDS` in `session.js` with no special auth gate.

**Game-rule constants pattern**: Storing the PHB XP threshold table as a frontend constant (`XP_THRESHOLDS` in `constants.js`) establishes a pattern for other 5e rule tables that are immutable by definition. Future similar constants (e.g., proficiency bonus by level) belong in the same file. No backend storage is appropriate for any official 5e table — they never change per character and never change at runtime.

**Dependencies**: None. This story is self-contained. `dmParty.js` and `session.js` changes are additive one-liners. The Award XP modal is a new component in `src/features/dmDashboard/`.

**Risks / decisions needed**: The per-field DM-auth question (open question 4 above) needs a product call before the builder starts. The recommended resolution is option (a) — no-auth-writable — to keep the implementation simple and consistent with existing session-field behavior.
