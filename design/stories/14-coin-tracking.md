# Story 14 — Coin Tracking

## Goal

Let players record and update their coin during sessions — quickly, without friction — and let the DM distribute loot or deduct costs from the dashboard. Support both full five-denomination tracking and simplified GP-only tracking so the app matches how different tables actually play.

---

## Background & design rationale

**Do groups actually track all five coin types?** No. Most 5e groups simplify. Copper and Electrum are rarely used in practice — copper because the amounts are trivial at even mid levels, electrum because it barely appears in published adventures. Silver sees more use at low levels. Platinum appears occasionally in high-value treasure. Many groups just track GP and convert everything else mentally. The app should accommodate both camps without forcing complexity on groups that don't want it.

**Is coin shared or per-character?** It varies. Some groups maintain a shared party fund (especially for group expenses like inn stays and supplies); others track coin per character. A party fund is a fundamentally different data model (not attached to any single character). For MVP, per-character tracking is correct — it maps cleanly to the existing data model. A shared party fund is a future feature.

**How often does coin change?** Frequently during sessions — loot after combat, purchases in town, bribes, gambling, selling equipment. It needs to be fast to update: ideally ±N without opening a full edit form.

**Session-scoped vs. persistent?** Coin is explicitly persistent — it must survive session boundaries. Unlike HP or conditions, coin accumulated during a session should not reset. This means coin writes must go through the standard character update path (not `patchSession`), or `patchSession` must explicitly persist coin fields to DynamoDB (same as it does today for `hpCurrent`). The latter is simpler and fits the existing architecture.

---

## User stories

**As a player**, I want to see my coin balance on my character sheet so that I don't need a separate note.

**As a player**, I want to quickly add or subtract coin after a purchase or loot drop so that I can do it mid-session without breaking the flow.

**As a DM**, I want to distribute coin to one or all party members from the dashboard so that I don't have to tell each player a number they then have to manually enter.

**As a player or DM running a simple game**, I want to just track GP and ignore the other denominations so that coin doesn't clutter the sheet.

**As a player at a table that uses all five denominations**, I want to see and update CP, SP, EP, GP, and PP separately so that my sheet stays accurate.

---

## Functional requirements

### Character sheet — view mode (Inventory tab)

1. A **Coin section** appears in the Inventory tab (below or alongside the equipment grid).
2. **Simplified mode** (`coinMode === "gp"`): displays a single GP value with `−` / `+` stepper buttons and a direct-input field. Updating writes via `patchSession`.
3. **Full denomination mode** (`coinMode === "full"`): displays five rows — CP, SP, EP, GP, PP — each with a value, `−` / `+` stepper, and direct-input field. Individual denomination updates write via `patchSession`.
4. Stepper buttons adjust by 1 per tap; hold-to-repeat behavior is desirable (same pattern as HP stepper on DM dashboard) but may be deferred to a follow-up.
5. No auth required to update coin — session writable, same ADR-005 rationale as HP and inspiration. (Coin is too frequent an update to require a password prompt.)
6. **GP equivalent** (optional informational line, deferred): show total value in GP (1 PP = 10 GP, 1 EP = ½ GP, 10 SP = 1 GP, 100 CP = 1 GP). Deferred to a follow-up story.

### DM dashboard (party card)

7. Each party card shows the character's GP (or total GP equivalent in full mode) as a compact read-only badge — sufficient for the DM to know who has what at a glance.
8. A **Distribute Coin** action (in the `⋯` QuickActionPopover or a dedicated button): DM enters an amount and denomination, selects target character(s), and confirms. Writes via `patchSession` to add to the current balance. "Distribute to whole party" option fans out to all characters simultaneously.
9. Deducting coin (for party-level expenses paid from the DM side) follows the same flow but subtracts.

### Edit mode (per character)

10. **Coin mode selector**: `"gp"` | `"full"` toggle in edit mode (stored per character). Default: `"gp"`.
11. When `coinMode === "full"`: five numeric inputs for CP, SP, EP, GP, PP.
12. When `coinMode === "gp"`: single numeric GP input.
13. DM or owner can set any coin value directly in edit mode (useful for initial character setup or corrections).

---

## Data model changes

New fields on the character DynamoDB item:

| Field | Type | Default | Notes |
|---|---|---|---|
| `coinMode` | `"gp"` \| `"full"` | `"gp"` | Per character; edit-mode only |
| `coin` | object | `{ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }` | All five denominations stored regardless of `coinMode`; simplified mode ignores cp/sp/ep/pp |

`patchSession` must accept `coin` (partial object) as an allowed session field. Partial updates should merge at the field level — e.g., `{ coin: { gp: 150 } }` should update only GP without zeroing out other denominations.

`GET /dm/party` should include `coin` in its projected fields so the DM dashboard can show the GP badge without a separate fetch.

---

## Out of scope

- Shared party fund / party treasury (different data model — not per-character)
- GP equivalent display / denomination auto-conversion
- Coin transaction history / audit log
- Weight tracking (coins have weight in the PHB; almost no groups track this)
- Selling equipment and auto-crediting coin
- Shop / marketplace interface

---

## Open questions

1. Should coin writes use the existing `patchSession` endpoint (fast, consistent with HP/conditions) or a new `/coin` endpoint? The `patchSession` path is simpler but expands the set of no-auth-writable fields — is that still acceptable for coin? (HP can't be stolen; coin arguably can, if someone knows the URL pattern.)
2. The `−` stepper on coin should probably not go below 0 — confirm this as a validation rule, or should it be allowed (representing a debt)?
3. Is EP (Electrum) worth including even in "full" mode? It is a 5e denomination but almost universally disliked and ignored. Could drop it to four denominations (CP, SP, GP, PP) with no real loss.
4. Should the DM's "Distribute Coin" action on the dashboard support multiple denominations in a single modal (e.g., "400 CP, 50 SP, 6 GP") to match a treasure parcel, or just one denomination at a time?

---

## UX Design

### Prototype
`design/prototypes/coin-tracking.html` — covers four scenarios: Inventory tab in GP mode, Inventory tab in full denomination mode, DM party cards with GP badge, and the Distribute Coin modal.

---

### Character sheet — Inventory tab, coin section

**Placement**: at the bottom of the Inventory tab, below the weapons/equipment loadout grid, separated by a top border (`1px solid pal.border`, `padding-top: 22px`). Coin is wealth, not a combat stat — the Inventory tab is the right home. No separate panel or surface block is needed; the coin section inherits the tab's background.

Section heading: "Coin" (IM Fell English, 11px uppercase, `pal.textMuted`, `margin-bottom: 16px`).

#### GP mode (default)

A single horizontal row:
- **Denomination mark**: 34px circle, `background: rgba(gold, 0.1)`, `border: 2px solid rgba(gold, 0.5)`, "GP" in Cinzel 13px `var(--coin-gp)` color.
- **Stepper + input group** (inline, single border wrapping all three): `−` button | number input (Cinzel 26px, `pal.gem`, 90px wide, center-aligned) | `+` button. The `−`/`+` buttons are 36×44px touch targets — large enough for in-session use without look. Direct number entry is always available.
- **Label**: "Gold Pieces" in IM Fell English 14px uppercase, `pal.textMuted`.

Stepper adjusts by 1 per tap. No hold-to-repeat in MVP (deferred per story). Value floored at 0 (no debt). Writes via `patchSession({ coin: { gp: newValue } })` on each change (debounced 400ms — same debounce pattern as HP stepper).

#### Full denomination mode

Five denomination blocks arranged in a horizontal `grid-template-columns: repeat(5, auto)` grid (collapses to 2-column at ≤ 560px). Each block is a centered column:

1. **Denomination mark**: same 26px circle, denomination-specific color (CP = copper `#a07050`, SP = silver `#9aabb8`, EP = slate `#8f8b80`, GP = gold `#c8a040`, PP = platinum `#c8d0e0`).
2. **Vertical stepper + input**: ▲ tap button (22px tall) → number input (Cinzel 20px, denomination color for GP and PP, `pal.text` for others) → ▼ tap button (22px tall). Wrapped in a `border: 1px solid pal.border` box.
3. **Denomination label**: full name (Copper / Silver / Electrum / Gold / Platinum), IM Fell English 11px uppercase, denomination color.

GP gets the most visual weight (larger color circle, gem-colored input) because it is the most-used denomination. CP and EP are visually quieter (muted-tone circles).

Writes via `patchSession({ coin: { [denom]: newValue } })` — partial merge, so changing CP does not zero out GP.

---

### DM dashboard — party card GP badge

**Placement**: one row below the HP bar, using the same `label | content | action` flex pattern.

- `GP` label (IM Fell English, 11px uppercase, `pal.textMuted`, fixed 28px).
- **GP badge**: inline pill — `background: rgba(gold, 0.1)`, `border: 1px solid rgba(gold, 0.3)`, Cinzel 13px gold-colored value + small "gp" suffix label. For characters in full coin mode, the badge shows the GP value only (DM doesn't need to see full breakdown at a glance).
- **"Give Coin" button** at the far right: ghost button, gold-tinted border and text (`rgba(gold, 0.3)` border, `rgba(gold, 0.7)` text color) — visually distinct from the HP stepper and condition controls; opens the Distribute Coin modal pre-targeted at that character.

---

### Distribute Coin modal

Triggered from: (a) "Give Coin" button on a party card, or (b) "Distribute Coin to Party" in the Party-Wide Actions section.

**Layout** (`pal.surfaceSolid` panel, `max-width: 400px`):

1. Title: "Distribute Coin" (Cinzel, 15px). Subtitle: character name or "Whole Party".
2. **Give / Deduct toggle**: two-button strip spanning full width — `Give` (default active) and `Deduct`. Segmented pill style with `pal.accentDim` active background.
3. **Denomination selector**: five pill buttons labeled `● CP · ● SP · ● EP · ● GP · ● PP`. Each pill has a small denomination-colored dot. Default selection: GP. Active pill adopts the denomination's color for border and text. Only one denomination can be selected at a time (MVP — single denomination per action, per story open question 4).
4. **Amount input**: same large stepper-wrap pattern as the XP modal (−10 | Cinzel 28px input | +10). Amount input color matches the selected denomination. Quick presets: `10 · 25 · 50 · 100 · 200 · 500`.
5. **Target selector**: one pill per party member + "All Party" pill. Multiple selections allowed (click to toggle). Opening from a single card pre-selects that character; opening from Party-Wide Actions pre-selects all. "All Party" pill toggles all individual characters.
6. Footer: `Cancel` (ghost) + `Confirm` (primary accent).

**Behavior on confirm**: fans out `patchSession({ coin: { [denom]: current + amount } })` (or `current - amount` for deduct) per selected character, in parallel — same approach as Short Rest. Each call is a partial coin merge so other denominations are unaffected. Modal closes immediately on confirm (optimistic); errors shown as inline text.

---

### Edit mode — coin mode selector

Near the end of the edit form (after equipment, before Change Password), in a "Coin" section:

- **Mode toggle**: `GP Only` | `Full Denominations` — default `GP Only`.
- When `GP Only`: single GP number input.
- When `Full Denominations`: five numeric inputs in a row — CP, SP, EP, GP, PP — each labeled with full name and denomination color.

DM or owner can set any denomination directly in edit mode (useful for character creation or corrections).

---

### Denomination color system

Universal constants (not palette-derived — the same across all palettes, including vellum):

| Denomination | Color | Usage |
|---|---|---|
| CP | `#a07050` (copper) | Circle border/fill, label, input (full mode) |
| SP | `#9aabb8` (silver) | Same |
| EP | `#8f8b80` (muted slate) | Same — visually understated since EP is rare |
| GP | `#c8a040` (gold) | Same — most prominent treatment |
| PP | `#c8d0e0` (platinum) | Same |

These colors are light enough to read on dark backgrounds and dark enough on the vellum palette.

---

### Responsive / mobile behaviour

GP mode: the stepper group is a fixed-width inline element (≈ 165px). On narrow screens the "Gold Pieces" label wraps below — that's fine. The touch targets (36×44px buttons) are well above the 44px minimum for comfortable tapping.

Full denomination grid: collapses from 5-column to 2-column at ≤ 560px. EP moves to second row alongside GP, PP. The vertical stepper layout (▲/value/▼) is intentionally narrow (60px) so it fits the 2-column grid on phones.

---

### What was not designed (deferred)

- GP equivalent total line (open question / deferred in story)
- Hold-to-repeat on coin steppers (story notes "desirable, may be deferred")
- Multi-denomination single modal action (open question 4 — MVP does one denomination per action)
- Negative coin / debt (story leaves this as open question 2 — MVP floors at 0)

---

## Architect Notes

**Applies**: ADR-003, ADR-005, ADR-011

**Tech approach**: Two new top-level fields on the character DynamoDB item: `coin` (object, all five denominations, default `{ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }`) and `coinMode` (`"gp" | "full"`, edit-mode only, default `"gp"`). Both are added to `BLANK_CHARACTER`. `coin` is added to `SESSION_FIELDS` in `backend/src/handlers/session.js`. The handler's existing update logic writes the `coin` field as a whole object — it does not perform a nested per-denomination merge natively. **Important**: the frontend must always send the complete current `coin` object when patching a single denomination (`patchSession({ coin: { ...currentCoin, gp: newGp } })`), not a partial `{ coin: { gp: newGp } }` sub-object. DynamoDB `UpdateExpression` `SET #coin = :coin` replaces the entire attribute — it does not deep-merge nested keys. The UX design's description of "partial coin merge" is correct in intent but must be implemented as a full-object write on the frontend side. The `LIVE_SESSION_FIELDS` frontend constant must include `"coin"`. `coin` (at minimum `coin.gp`) and `coinMode` are added to `dmParty.js` ProjectionExpression so the DM card GP badge can render. Since the entire `coin` object is small (five numbers), projecting the full object is simpler than projecting individual denomination attributes. `coinMode` is also projected so the DM card knows whether to show GP-only or a full denomination breakdown. Denomination color constants (`COIN_COLORS`) belong in `constants.js` alongside `BLANK_CHARACTER`, since they are palette-independent by design.

**Scope boundary**: In scope — `coin` session field, `coinMode` edit field, Coin section in Inventory tab (GP mode + full denomination mode), DM party card GP badge, Distribute Coin modal. Out of scope — party fund/treasury, GP equivalent total, transaction log, coin weight, sell-to-coin automation.

**Open questions resolved**:
1. Use `patchSession` — not a new endpoint. The no-auth-writable concern is accepted for MVP (same reasoning as HP: coin values are game data, not security-sensitive; the auth gate on level-up and edit mode protects anything that matters).
2. Floor at 0 confirmed — no negative coin in MVP. The `−` stepper and direct input clamp at `Math.max(0, value)`.
3. EP (Electrum) is included in full mode as specified — the denomination color and grid entry are in scope. If the table later drops EP support they can remove the row with no data model change (the stored value just goes unread).
4. Single denomination per modal action confirmed for MVP. Multi-denomination treasure parcel is deferred.

**Performance notes**: `coin` as a nested DynamoDB attribute adds negligible storage per character. The Scan in `dmParty.js` already retrieves full items; adding `coin` to the ProjectionExpression reduces bandwidth slightly compared to fetching everything.

**Dependencies**: None beyond the session.js and dmParty.js additions. Denomination color constants should be defined in `constants.js` before the component is built so they are importable from a single source.

**Risks / decisions needed**: The full-object-write requirement for coin patches (see Tech approach above) is the one non-obvious implementation constraint — the feature-builder must not send a partial nested object to `patchSession`. This should be called out explicitly in the implementation. No other open decisions remain.
