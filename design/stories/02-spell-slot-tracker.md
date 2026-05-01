# Feature Story: Spell Slot Tracker

**Status**: Needs architect review  
**Source**: RPG Consultant Review, Priority 2  
**Feeds into**: In Play tab (story 04), DM Dashboard (story 05)

---

## Goal

Give spellcasters a visual, one-tap interface for tracking spell slot usage during a session. Slots should be configurable in edit mode and resettable on rest without requiring a full character edit. Non-spellcasters see nothing — the feature is invisible until slots are configured.

---

## User stories

- As a **spellcaster**, I want to mark a spell slot as used when I cast a spell, without entering edit mode.
- As a **spellcaster**, I want to see at a glance how many slots I have remaining at each spell level.
- As a **player**, I want to reset all spell slots on a long rest with one tap.
- As a **Warlock**, I want to reset my Pact Magic slots on a short rest independently of other classes' slots.
- As a player **setting up my character**, I want to configure how many slots I have at each spell level in edit mode.
- As a **DM**, I want to trigger a long rest or short rest for the party from the DM dashboard, resetting everyone's slots.

---

## Functional requirements

### Configuration (edit mode, password required)
- A "Spell Slots" section in edit mode, visible only if the character has a spellcasting class
- Per slot level (1st–9th), set `max` slots available — zero means that level doesn't exist for this character
- Slot levels with max = 0 are hidden entirely in play mode
- Optional: a "Pact Magic" toggle on any slot group — Pact Magic slots recover on short rest instead of long rest
- Optionally support auto-population from class + level (lookup table) as a convenience; player can override

### Display (view mode / In Play tab, no auth required)
- Show each configured slot level as a row: level label (e.g., "2nd") + a row of bubble icons
- Filled bubble = used slot, empty bubble = available slot
- Tap a filled bubble to recover it (restore); tap an empty bubble to use it (fill)
- Levels with all slots used shown in a muted/dimmed state
- Levels not configured (max = 0) are not rendered

### Rest controls (no auth required)
- **Long rest button**: resets all slot groups to `used = 0`
- **Short rest button**: resets only slot groups marked as Pact Magic (Warlock); standard slots unaffected
- Rest buttons can live in the In Play tab footer or as a contextual control near the slot display
- Tapping a rest button shows a brief confirmation ("Long rest — reset all slots?") before applying

### Interaction detail
- Bubble tap should have a satisfying response (slight scale animation or fill transition) — this UI will be tapped hundreds of times per session
- On mobile, bubbles must be at least 28px tap target even if displayed smaller

---

## Data model changes

Current: `spells: string[]` (free-text spell names — unrelated to slots)

New field:
```
spellSlots: [
  { level: 1, max: 4, used: 1, isPactMagic: false },
  { level: 2, max: 3, used: 0, isPactMagic: false },
  ...
]
```

`spells` remains unchanged — it's the spell list, not slot tracking.

---

## Out of scope
- Automatic slot deduction when a spell is cast (requires spell database)
- Spell point variant (optional 5e rule)
- Sorcery points
- Ki points, Superiority dice, and other class-specific resource pools (future story)
- Cantrips (unlimited, no tracking needed)

---

## Open questions
- **Auto-populate slots from class/level**: worth building the lookup table for standard 5e classes now, or manual-only first? Manual is simpler and covers edge cases (multiclassing, homebrew). Recommend manual-first.
- **Multiclassing**: a Fighter/Wizard has a combined spell slot table that doesn't match either class alone. Out of scope unless the group has a multiclassed character.
- **Spell slot levels 6–9**: most characters in a typical campaign never reach these. Should they be hidden until max is set to >0, or collapsed under a "High-level slots" expander? Recommend hidden until configured.

---

## Architect Notes

**Applies**: ADR-002, ADR-003, ADR-004

**Tech approach**: Session writes (`spellSlots[].used`) route through the `PATCH /session` endpoint introduced in story 01 — no new Lambda needed. The payload will be the full `spellSlots` array (replace-in-place is simpler than per-index patch given the small array size). Configuration writes (`spellSlots[].max`, `isPactMagic`) go through the existing `PUT /characters/{slug}` update handler in edit mode — no changes needed there.

The `spellSlots` field is new and absent from existing characters. `get.js` and `list.js` do not need migration logic — absence of the field means "not configured," and the UI should treat a missing or empty `spellSlots` array as the no-spellcaster state (render nothing). Add `spellSlots: []` to `BLANK_CHARACTER`.

Bubble tap animation (scale/fill transition) is CSS transition via inline style — consistent with ADR-001. The 28px minimum tap target applies to the bubble container, not the visible bubble size; use padding to satisfy it.

**Scope boundary**: In — `spellSlots` configuration in edit mode; bubble UI in Combat tab; long/short rest reset; Pact Magic flag. Out — auto-populate from class/level lookup table (manual-first); multiclass combined slot tables; Ki points, Sorcery points, Superiority dice.

**Dependencies**: Story 01 (`PATCH /session` endpoint must exist before spell slot session writes can land). Story 04 (Combat tab) is where the bubble UI is surfaced, but the data layer and the bubble component itself can be built independently.

**Risks / decisions needed**: None blocking. Manual-only slot configuration is the right call for first implementation given the multiclass complexity. Auto-populate can be layered on later as a lookup table in `CharacterSheet.jsx` constants (no backend change needed).
