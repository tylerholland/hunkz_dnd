# Feature Story: DM Dashboard Nav Links & Quick Actions

**Status**: Ready for implementation  
**Source**: Product (no gameplay mechanics — pure nav/UX)  
**Prototype**: `design/prototypes/dm-dashboard.html` (updated design with quick actions)

---

## Goal

Three small improvements that reduce friction for the DM during a session: navigation shortcuts between the homescreen and dashboard, and direct HP controls on character cards without opening a popover.

---

## Functional requirements

### 1. DM Dashboard link on the homescreen top nav

The characters list page (`/`) has a top nav bar. Add a "DM Dashboard" link (or button) to it, visible only when the DM is authenticated (`sessionStorage.dnd_dm_password` is set). Clicking it navigates to `/dm`.

### 2. Back to homescreen link on the DM Dashboard top nav

The DM dashboard (`/dm`) has a top nav bar. Add a link back to the characters list (`/`), so the DM doesn't have to use the browser back button.

### 3. Deal Damage & Heal quick actions on character cards

The updated `dm-dashboard.html` prototype shows three improvements to the character card quick actions. Implement all three as designed:

**a) Inline ±1 HP stepper on each card**
Each character card has a `−` and `+` button directly below the HP bar. Tapping adjusts `hpCurrent` by 1 immediately via `patchSession` — no popover required. Hold-to-repeat: after 500ms hold, repeat every 80ms. A brief delta indicator (`+1` / `−1`) animates up from the HP bar to confirm the tap registered. Does not handle temp HP (temp HP remains in the `⋯` menu).

**b) Inline Damage and Heal buttons on each card**
Each card shows two action buttons below the HP stepper row: **⚔ Damage** and **✦ Heal**. Tapping either opens a focused modal with:
- A large number display
- `−` / `+` stepper flanking it (hold-to-repeat, same timing as above)
- Six preset jump buttons: **3 · 5 · 8 · 10 · 15 · 20** (common 5e damage values)
- Direct text input as an alternative (typing still works)
- Confirm button applies the change via `patchSession`; Escape / backdrop tap closes

The Damage modal uses a red accent tone; Heal uses a green accent tone.

**c) ⋯ overflow menu for less-common actions**
Replace the existing circular `+` action button with a `⋯` button. This menu contains: Add Condition, Set Temp HP, Drop Concentration (when active), Short Rest, Long Rest. The Damage and Heal actions move out of this menu and onto the card directly (per point b above).

---

## Data model changes

None. All changes use `patchSession` with existing fields (`hpCurrent`, `tempHP`, `conditions`, `concentration`).

---

## Out of scope

- Temp HP inline stepper (stays in ⋯ menu)
- Applying dice roller damage via the "Apply to..." shortcut (that wiring is already implemented in story 08)
- Preset customisation
- Party-wide damage (e.g. AoE hitting all characters at once)

---

## Open questions

- **Delta indicator style**: the prototype shows a floating `+1` animating upward. Should this use the character's palette accent colour, or a universal green/red (green for heal, red for damage)? Use the character's accent color. Just be sure the indicator is large enough font to see (stop making things 9px or 10px, this button and any new ones should be 12px minimum)
- **Hold-to-repeat on mobile**: 500ms delay before repeat begins — does this feel right, or should it be shorter given the DM is often acting quickly? That feels fine. Can we update the display when we initiate the promise and revert if it fails rather than waiting for round-trip to indicate the change?

---

## Architect Notes

### Nav links (requirements 1 & 2)

Trivial React Router `<Link>` additions. Both pages already have a top nav bar rendered in the page component.

- **CharactersListPage**: Read `sessionStorage.dnd_dm_password` at render time. If truthy, render a "DM Dashboard" link styled as a nav button. Use `useNavigate` or a plain `<Link to="/dm">`.
- **DmDashboardPage**: Add a "← Characters" link to the existing top nav. No auth check needed — the page already requires DM auth to load.

No new state, no API calls.

---

### Inline ±1 HP stepper with optimistic updates (requirement 3a)

Use **delta accumulation + debounced flush** to avoid race conditions during hold-to-repeat and eliminate round-trip lag:

```js
const pendingDelta = useRef(0);        // accumulates taps not yet sent
const [optimisticHp, setOptimisticHp] = useState(serverHp);  // display value

function applyDelta(delta) {
  pendingDelta.current += delta;
  setOptimisticHp(serverHp + pendingDelta.current);  // instant UI update
  debouncedFlush();  // ~300ms debounce
}

const debouncedFlush = useMemo(() => debounce(async () => {
  const delta = pendingDelta.current;
  pendingDelta.current = 0;
  try {
    await patchSession(slug, { hpCurrent: serverHp + delta }, dmPassword);
    // on success, serverHp will update from the next party poll — no extra work needed
  } catch {
    // revert: undo the pending delta from the displayed value
    setOptimisticHp(hp => hp - delta);
  }
}, 300), [slug, serverHp, dmPassword]);
```

Key points:
- `optimisticHp` drives the display; `serverHp` (from the party poll) drives the reference base.
- `pendingDelta` is a `useRef` (not state) so accumulation never triggers re-renders.
- On hold-to-repeat at 80ms intervals, the entire hold gesture fires **one** `patchSession` call after finger release — not one per tick.
- On error, a single `setOptimisticHp` revert is enough; no complex undo stack needed.
- Clamp `optimisticHp` to `[0, hpMax]` before displaying and before sending.

Hold-to-repeat timing: 500ms initial delay, 80ms repeat interval (as specified). Use `setTimeout`/`setInterval` on `pointerdown`, clear on `pointerup`/`pointercancel`.

**Delta indicator**: animate a floating `+N` / `−N` label (use the accumulated delta value, not always ±1) upward from the HP bar using a CSS keyframe injected via `<style>` tag. Use the character's palette accent color (`pal.gem`). Minimum font size 12px.

---

### Damage / Heal modal (requirement 3b)

The modal owns its own local numeric state (the amount to apply). On Confirm:

```js
const newHp = Math.max(0, Math.min(hpMax, serverHp + (isHeal ? +amount : -amount)));
setOptimisticHp(newHp);  // instant UI update on the card behind the modal
patchSession(slug, { hpCurrent: newHp }, dmPassword).catch(() => {
  setOptimisticHp(serverHp);  // revert on failure
});
closeModal();
```

Simple optimistic flip — no debounce needed since the modal only submits once per open.

Modal stepper (`−` / `+`) also supports hold-to-repeat with the same 500ms/80ms timing. No debounce needed inside the modal — amount is local state and the submit is a single call on Confirm.

---

### ⋯ overflow menu (requirement 3c)

Replace the existing `+` circular button with a `⋯` button that opens the existing `QuickActionPopover`. Remove Damage and Heal from the popover menu — they now live as card-level buttons. Retain: Add Condition, Set Temp HP, Drop Concentration (conditional), Short Rest, Long Rest.

No data model changes. The popover already handles all these actions via `patchSession`.

---

### AWS cost note

The debounce pattern reduces DynamoDB writes during hold-to-repeat from O(ticks) to O(gestures) — strictly cheaper than a naive per-tick implementation. No polling is introduced; all updates are event-driven.

