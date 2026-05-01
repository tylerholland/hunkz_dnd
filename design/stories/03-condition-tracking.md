# Feature Story: Condition Tracking + Concentration Flag

**Status**: Needs architect review  
**Source**: RPG Consultant Review, Priority 3  
**Feeds into**: In Play tab (story 04), DM Dashboard (story 05)

---

## Goal

Give players a one-tap way to mark active conditions on their character, and a persistent visual flag for concentration. Both must be visible without entering edit mode and must surface clearly in the DM dashboard. Concentration tracking specifically targets the most common rule error at 5e tables.

---

## User stories

- As a **player**, I want to mark myself as Poisoned (or any condition) when it's applied, so I and my DM can see it clearly on my sheet.
- As a **player**, I want to clear a condition when it ends, without entering edit mode.
- As a **player who cast a concentration spell**, I want a persistent, prominent indicator showing I'm concentrating and on which spell, so neither I nor the DM forgets.
- As a **DM**, I want to apply or remove conditions on any character from the dashboard without navigating to their individual sheet.
- As a **DM**, I want to see all active conditions and concentration states across the party at a glance.

---

## Functional requirements

### Conditions (no auth required to set/clear)

**The 14 standard 5e conditions:**
Blinded, Charmed, Deafened, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious

- Displayed as a pill/chip grid in the In Play tab; inactive conditions shown as ghost pills (visible but dim), active conditions shown filled/highlighted
- Tapping an inactive condition activates it; tapping an active condition deactivates it
- Active conditions are also shown as compact colored chips in the sheet header area for at-a-glance status
- A "Clear all conditions" button for when a rest or ability clears all conditions simultaneously

**Exhaustion** (special case):
- Not a binary toggle — has 6 levels with cumulative mechanical penalties
- Displayed as a counter (0–6) with `+` / `-` controls, separate from the condition grid
- Level 0 = not shown (or shown as inactive); levels 1–6 show with a brief label of the penalty at that level as a tooltip or inline note

### Concentration flag (no auth required)

- A dedicated "Concentrating" toggle with a text input for the spell name
- When active: prominently displayed — suggested placement at the top of the In Play tab, above other controls, with a visually distinct style (e.g., pulsing border, accent color highlight)
- The concentration indicator should be impossible to overlook mid-session — this is the whole point
- When the player takes damage, there is no automatic Constitution save prompt (that's out of scope for now), but the visible indicator serves as the reminder to the DM and player

### Condition tooltips (optional, stretch)
- On hover/long-press, each condition shows a one-line summary of its mechanical effect
- E.g., "Poisoned: Disadvantage on attack rolls and ability checks"
- These can be hardcoded strings — no external lookup needed

---

## Data model changes

New fields:
```
conditions: string[]         // active condition names, e.g. ["Poisoned", "Prone"]
exhaustionLevel: number      // 0–6, default 0
concentration: {
  active: boolean,
  spell: string              // name of the concentration spell, empty string if not active
}
```

---

## Out of scope
- Automatic Constitution saving throw prompts when taking damage while concentrating
- Custom/homebrew conditions
- Condition sources or durations (tracking which effect caused a condition)
- Exhaustion effects automation (e.g., auto-applying disadvantage)

---

## Open questions
- **Condition display in view mode vs In Play tab only**: should active conditions be visible in the standard view mode (for players checking their sheet between turns) or only in the In Play tab? Recommend: compact chip summary visible in both, full condition grid only in In Play.
- **Unconscious vs. 0 HP**: the Unconscious condition and reaching 0 HP are related but distinct (you can be unconscious without being at 0 HP, e.g., from a spell). Should reaching 0 HP automatically apply the Unconscious condition? Probably yes — confirm.
- **Concentration cleared on new concentration spell**: if a player marks a new concentration spell, should the UI warn them that their existing concentration will drop? Out of scope for now, but worth noting.

---

## Architect Notes

**Applies**: ADR-002, ADR-003, ADR-004

**Tech approach**: All writes (`conditions`, `exhaustionLevel`, `concentration`) route through `PATCH /session` (story 01). No new Lambda or endpoint needed. Add these three fields to `BLANK_CHARACTER` with defaults `conditions: [], exhaustionLevel: 0, concentration: { active: false, spell: "" }`. No migration logic needed in `get.js` / `list.js` — absent fields default safely in the UI.

Condition tooltip strings (the 14 one-liners) are a hardcoded constant in `CharacterSheet.jsx` — no backend involvement.

The "compact chips in sheet header" requirement means the header section of `CharacterSheet.jsx` needs to read `conditions` and render a small chip strip. This is additive — existing header layout is not restructured, just gets a new conditional block below the existing stats row.

**Scope boundary**: In — 14 standard conditions as toggles; exhaustion counter (0–6); concentration toggle + spell name input; compact chip summary in header. Out — custom/homebrew conditions; condition source/duration tracking; auto-apply Unconscious at 0 HP (open question, deferred); automatic Con save prompts.

**Dependencies**: Story 01 (`PATCH /session`). Story 04 (Combat tab) hosts the full condition grid UI, but the data model and header chip display can land before story 04.

**Risks / decisions needed**: The "0 HP → auto-apply Unconscious condition" question (open question in this story) has a UI interaction consequence: if 0 HP auto-writes `"Unconscious"` into the `conditions` array via the session endpoint, that behavior belongs in the HP stepper logic (story 01 code), which creates a coupling. Decide before implementing story 01 so the stepper can include or exclude this side effect in its initial build.
