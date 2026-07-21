# Feature Story: DM Dashboard Map — Dual Mode State + Clear Tokens Button

**Status**: Ready for Architect Notes
**Source**: DM feedback

---

## Goal

Three related issues with the DM dashboard's Adventure | Combat map toggle:

1. **Wrong segment highlighted**: The "Combat" segment is highlighted even when the DM is in Adventure (non-combat) mode. The toggle visual is inverted.

2. **Token clearing on mode switch**: Switching between Adventure and Combat modes currently clears all battle map tokens. The DM should be able to have a different map loaded in each mode — tokens and map selection should be preserved per-mode, not wiped when toggling.

3. **No way to clear tokens manually**: The only way to remove tokens today is to switch modes (which clears them unintentionally). A "Clear Tokens" button should be added to the Battle map mode so the DM can explicitly wipe the token layer when starting a new encounter.

## User stories

1. As a DM, when I open the dashboard in Adventure mode, I want the "Adventure" segment to be visually highlighted so I know which mode I'm in at a glance.

2. As a DM, when I switch between Adventure and Combat modes, I want each mode to remember its own active map and token state so I don't lose my combat setup when I briefly check the overworld map.

3. As a DM, when I'm in Combat mode, I want a "Clear Tokens" button on the battle map panel so I can wipe the token layer at the start of a new fight without having to switch modes.

## Scope

### Bug fix — highlight inversion (Story 43a)
- In `DmDashboardPage.jsx`, `isBattleMode` is derived from `dmActiveMap?.mapMode === "battle"`. Determine whether this value is being set incorrectly on load or whether the NavSegment `value` prop and `options` keys are mismatched. Fix so Adventure mode shows the Adventure segment lit.

### Dual map state (Story 43b)
- The dashboard currently holds one `activeMapId` and one token set (`npcCombat`). Introduce a second map slot — `adventureMapId` and `battleMapId` — stored on the `map-library` sentinel (or as a separate `dnd_dm_map_mode` sessionStorage key per-session as a lightweight first pass).
- When the DM switches modes, persist the outgoing mode's active map and restore the incoming mode's last-used map, rather than clearing.
- Tokens (`npcCombat.npcs`) are combat-specific — do not touch them on mode switch.

### Clear Tokens button (Story 43c)
- Add a "Clear Tokens" button inside the battle map panel (visible in Combat mode only).
- The button should be a two-step confirmation (single tap shows "Confirm clear?" with a Cancel, second tap commits) to prevent accidental wipes.
- On confirm, write an empty `npcs: []` array to the `npc-combat` sentinel via `putNpcCombat`.

## Out of scope
- Multiple saved encounter states per map — just one token layer per mode.
- Adventure map token pinning — Adventure mode has no token layer.
- Backend schema changes beyond what's already there for npc-combat.

---

## Architect Notes

**Applies**: ADR-002 (feature-sliced dashboard), ADR-003 (flat sentinel schema), ADR-004 (one Lambda per op), ADR-011 (adaptive polling + optimistic session writes), ADR-019 (WebSocket nudge on every session write)

All three sub-tasks are frontend-heavy. 43a is a pure frontend fix; 43c is frontend + reuse of an existing endpoint; 43b is the only one that *may* touch the backend, and even then only if you choose the durable option. No new AWS resources for any of these — omit cost notes.

---

### 43a — Highlight inversion: root cause and fix

**The CSS and NavSegment primitive are NOT inverted.** Verified: `NavSegment` (`src/components/TopNav.jsx:41-57`) applies `topnav-seg-btn--active` to whichever option's `key === value`, and `topNav.css:151` styles that active class correctly. So when `value === "battle"`, "Combat" lights; when `value === "adventure"`, "Adventure" lights. That mapping is correct.

**Root cause is a two-source desync, not a literal inversion.** There are two independent derivations of battle mode:

- `DmDashboardPage.jsx:944-945` — `dmActiveMap = mapLibrary.maps.find(m => m.id === activeMapId)`; `isBattleMode = dmActiveMap?.mapMode === "battle"`. This is **server-only** (from the polled `mapLibrary`) and drives the NavSegment `value` (line 983).
- `MapPanel.jsx:58-59` — the same server value BUT overlaid with an **optimistic local override** (`localMapMode`). This is what actually drives the map body, token tray, and the real panel state.

When the DM clicks the toggle: `MapPanel.handleToggleBattleMode` (line 205) flips `localMapMode` immediately (optimistic), calls `patchMapTokens` with the new `mapMode`, and the panel visually enters/leaves battle mode at once. But the NavSegment reads DmDashboardPage's server-only `isBattleMode`, which does **not** update until the write round-trips and the next `getSessionState` poll lands (up to ~1s, or one WS nudge per ADR-019). During that window the segment highlight lags/contradicts the actual panel state — read by the DM as "Combat is lit but I'm not in combat." The `onChange` at line 984 compounds the confusion: it **ignores the clicked segment key** and blindly calls `battleToggleFnRef.current?.()` (a toggle), so clicking the already-active segment still flips mode.

**Fix (pick the tighter of these two, they compose):**

1. **Lift the optimistic `mapMode` so the NavSegment and MapPanel share one source of truth.** The cleanest option: MapPanel already computes the authoritative optimistic `isBattleMode`. Have MapPanel report its current mode up to `DmDashboardPage` (extend the existing `onRegisterBattleToggle` registration into an `onBattleModeChange(isBattle)` callback, or pass the optimistic mode up alongside it), and drive the NavSegment `value` off that lifted value instead of the raw polled `dmActiveMap.mapMode`. This removes the lag entirely.
2. **Make `onChange` key-aware and idempotent.** Change line 984 from a blind toggle to `onChange={(key) => { if ((key === "battle") !== isBattleMode) battleToggleFnRef.current?.(); }}` so clicking the segment you're already on is a no-op and clicking the other segment moves you *to* that mode rather than "toggling from wherever the server thinks you are." This alone kills the class of bug where a lagging `value` + blind toggle send you the wrong direction.

Do **both**: (1) fixes the visual lag, (2) hardens the interaction against double-clicks and mid-flight poll races. Note that once 43b changes `handleToggleBattleMode` to stop wiping tokens (below), keep this lifted-mode wiring consistent with the new switch behavior.

---

### 43b — Dual map state (Adventure map vs. Combat map)

**Current model:** `map-library` sentinel holds a single top-level `activeMapId` (+ `activeMapView`). `mapMode` is a **per-map field** (`"adventure"` | `"battle"`) on each map entry (`normalizeMapLibraryRecord`, `specialRecords.js:146`). Switching "mode" today (`MapPanel.handleToggleBattleMode`, line 205-214) does NOT switch maps — it flips the *current* map's `mapMode` and **wipes its tokens** (`writeTokens([], newMode)` at line 213). That token wipe is exactly the destructive behavior issue #2 wants gone.

**Two viable approaches — recommend the lightweight one first:**

**Option A (recommended, no backend change): remember each mode's last-used map on the client.** Add two `sessionStorage` keys, `dnd_dm_adventure_map` and `dnd_dm_battle_map` (no slug — DM dashboard has no character context, matching the existing `dnd_dm_map_height` / `dnd_wheels_open` convention). On mode switch: (1) record the current `activeMapId` under the *outgoing* mode's key; (2) look up the *incoming* mode's stored map id, and if present call the existing `putMapActive(mapId, dmPassword)` to restore it; (3) if no stored map for the incoming mode, keep the current map (just flip its `mapMode`). This is a pure-client first pass, survives refresh within a session, and needs zero schema/handler work. Downside: not shared across devices and clears on tab close — acceptable at current scale per ADR-006.

**Option B (durable, small backend change): store `adventureMapId` + `battleMapId` on the sentinel.** Add both fields to `saveMapLibraryState`/`normalizeMapLibraryRecord` (additive, backwards-compatible per ADR-017's "widen a sentinel shape → update the normalizer in the same change" rule; older records normalize the new fields to `null`). Extend `putMapActive.js` to accept an optional `mode` and write the id into the matching slot as well as `activeMapId`. More correct and cross-device, but more surface. Only do this if the DM explicitly wants mode-map memory to persist across sessions/devices.

**Critical for BOTH options — stop wiping tokens on switch.** The core of issue #2: `handleToggleBattleMode` must no longer call `writeTokens([], newMode)`. Tokens live per-map in `map.tokens` (map-library) and encounter NPCs live in the `npc-combat` sentinel — **neither should be touched by a mode switch.** Switching modes should only change which map is active and/or that map's `mapMode`; each map already carries its own `tokens[]`, so restoring the battle map naturally restores its tokens. Remove the `window.confirm` token-clear prompt at lines 208-210 entirely — clearing tokens is now the explicit 43c button's job, not a side effect of toggling.

**Watch out:** the `useEffect` at `MapPanel.jsx:72-79` resets all optimistic local state when `activeMapId` changes. With Option A/B, a mode switch will now change `activeMapId`, so that reset will fire — which is fine (you *want* fresh optimistic state for the newly-active map), but make sure the mode flip write and the active-map write don't race. Prefer: set active map first (via `putMapActive`), let the poll bring in the restored map with its own persisted `mapMode`, rather than writing `mapMode` optimistically onto the *previous* map mid-switch.

---

### 43c — "Clear Tokens" button

**Where it lives:** the `TokenTray` component (`src/features/dmDashboard/battleMode/TokenTray.jsx`), which only renders in Combat mode (`MapPanel.jsx:420-431`) and already owns an "end menu" popover with **"End Combat"** and **"Reset Tray"** actions (lines 189-196). Add "Clear Tokens" as a third item in that same menu, or as a distinct button in the tray — the existing end-menu is the most consistent home. MapPanel passes a new `onClearTokens` prop down (sibling to `onEndCombat`/`onResetTray`), wired to a handler in `MapPanel` that calls `putNpcCombat(dmPassword, { npcs: [] })`.

**Important semantic distinction — do not conflate with the existing "Reset Tray":** `onResetTray` returns *map tokens* (the `map.tokens[]` chips on the map-library entry) back to the tray. 43c's "Clear Tokens" clears the *NPC combatants* — the `npc-combat` sentinel — via `putNpcCombat`. These are two different data stores. Confirm with the user whether "Clear Tokens" should ALSO clear the placed map tokens (`map.tokens[]` → `patchMapTokens(mapId, { tokens: [] })`), or only the npc-combat roster. The story text (issue #3, scope 43c) says only `npcs: []`, so implement that unless the user says otherwise — but flag it, because a DM saying "clear tokens" while looking at chips on the map may expect the visible chips to disappear too.

**Two-step confirm:** reuse the established inline two-step pattern (single tap → "Confirm clear?" + Cancel, second tap commits), same as the item-drop confirm on the character sheet and the ⋯ popover shortcuts. Do NOT use `window.confirm` (the 43b work is *removing* the last `window.confirm` from this panel — don't add a new one). A small local `useState` for the confirm-armed state is sufficient; reset it on Cancel and after commit.

`putNpcCombat` already exists in `api.js:141` and its handler already calls `notifySessionChanged()` (ADR-019), so clearing propagates to all connected views on the next nudge/poll with no extra work.

---

**Performance notes**: None material. All three are single writes to existing endpoints, each already covered by the ADR-011 optimistic + ADR-019 nudge path. No new polling, no new re-render hot paths.

**Dependencies**: None — all backend endpoints (`putMapActive`, `patchMapTokens`, `putNpcCombat`) and the `mapMode` per-map field already exist. Option B (43b durable) is the only path that adds two sentinel fields; skip it unless cross-session persistence is required.

**Risks / decisions needed**:
1. **43b storage choice** — Option A (sessionStorage, no backend) vs. Option B (sentinel fields, cross-device). Recommend A unless the user wants mode-map memory to persist across sessions/devices. **User decision needed before implementation.**
2. **43c scope of "clear"** — npc-combat roster only (as written), or also the placed map tokens (`map.tokens[]`)? **Confirm with user** — the label is ambiguous relative to the two token stores.
3. **43a interaction with 43b** — once `handleToggleBattleMode` stops wiping tokens and starts switching maps, re-verify the lifted-mode wiring drives the NavSegment correctly through a full switch (including the `activeMapId`-change optimistic-state reset at `MapPanel.jsx:72`). Low risk but worth an explicit manual check.

**No new ADR required.** These are extensions within ADR-002/003/004/011/019; the per-map `mapMode` field and the sentinel pattern already cover the data model. If Option B is chosen, note the additive-normalizer rule from ADR-017 applies but does not warrant its own ADR.
