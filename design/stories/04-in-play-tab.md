# Feature Story: Combat Tab — Live-Session Resource Tracking

**Status**: Needs architect review  
**Depends on**: Stories 01 (HP), 02 (Spell Slots), 03 (Conditions) — can be designed in parallel but requires their data to be fully functional  
**Source**: RPG Consultant Review, Priority 4; RPG Consultant Addendum (2026-04-28)

---

## Relationship to the existing "In Play" tab

The app already has an "In Play" tab containing **character behaviors and roleplay guidance** — traits or principles the player commits to embodying during play. This maps to the D&D 5e concepts of personality traits, ideals, bonds, and flaws: the roleplay identity layer of a character. That tab is intentional content and its purpose does not change.

**This story creates a separate, new tab called "Combat"** for live-session resource tracking (HP, spell slots, conditions, concentration, inspiration, death saves). The distinction is:

- **Persona** (formerly "In Play") — who your character *is* during the session (roleplay commitments, behavior principles)
- **Combat** — what your character's *resources look like* during the session (HP, slots, conditions, saves)

The "In Play" tab is renamed to **"Persona"**. This rename is part of this story.

**Page vs. tab — open design question for the ux-designer**: decision made to go with the tab solution, adding the combat features to a tab within the existing character page, rather than its own page

---

## Goal

Add a "Combat" tab that serves as the live-session surface during play. It should contain everything a player needs during active combat — and nothing they don't — with no password required to update any value on this tab. The existing "Loadout" and "In Play" tabs remain unchanged.

---

## User stories

- As a **player in active combat**, I want one tab that shows all my session-critical controls (HP, spell slots, conditions, concentration, inspiration) so I don't have to navigate around a full character sheet mid-turn.
- As a **player**, I want to update my combat state without entering a password, since session state is not the same as permanent character data.
- As a **player**, I want the Loadout tab to remain available as my reference for weapons, equipment, and spell descriptions.
- As a **player**, I want the Persona tab to remain available for my roleplay principles and behavior notes.
- As a **new player opening the sheet**, I want to immediately understand which tab is for during-game resource tracking vs. reference vs. roleplay.

---

## Functional requirements

### Tab structure (revised)

The character sheet now has three tabs:

- **Loadout** (existing, unchanged): weapons list, equipment list, spells list. Between-session reference. Edit mode (password) required to modify.
- **Persona** (renamed from "In Play"): character behaviors and roleplay guidance. Edit mode (password) required to modify.
- **Combat** (this story): live session resource surface. **No password required** to modify any value here. May be implemented as a tab or a dedicated page — see open questions.

### Combat tab content (top to bottom)

**1. Concentration banner** (only shown when concentration is active)  
Spans the full width at the top of the tab. Prominent, accent-colored.  
Shows: "Concentrating: [Spell Name]" with a one-tap button to drop concentration.  
When not concentrating: this entire section is hidden (no empty space).

**2. HP tracker** (always shown)  
Full-width: current HP / max HP, visual bar, temp HP (when present), +/- stepper controls, direct-entry tap.  
Death save bubbles appear here when HP reaches 0.

**3. Inspiration** (always shown)  
A single prominent toggle — large enough to tap easily. When active, visually distinct (glowing or highlighted state). Label: "Inspiration". No auth required to toggle.

**4. Active conditions** (shown when any condition is active; collapsed to a "No conditions" ghost state when clear)  
Active conditions as dismissible chips. A "+" button to add a condition from the full list.  
Exhaustion level counter if exhaustion > 0.  
Full condition grid (all 14 conditions as toggleable pills) revealed on demand — not always visible, to reduce noise.

**5. Spell slots** (shown only if `spellSlots` is configured)  
Per-level bubble rows. Long rest / short rest buttons.

**6. Weapons quick-reference** (condensed read-only view of loadout weapons)  
Name, attack bonus, damage — no descriptions, no editing. This is for looking up a number during your turn, not for managing gear.  
Tapping a weapon name expands inline to show description (same expand behavior as Loadout tab).

### Auth model for Combat tab

No password required to update: `hpCurrent`, `tempHP`, `spellSlots[].used`, `conditions`, `exhaustionLevel`, `concentration`, `inspiration`.

These are session state fields. They do not require the character password because they change constantly during play and requiring a password creates friction that defeats the purpose. The worst-case abuse scenario (another player changing your HP) is low-stakes in a trusted group.

The Loadout and In Play tabs retain their existing read-only (no auth) / edit (auth required) split.

### Empty state

If a player opens Combat before configuring HP, slots, or spells (a new character), the tab shows a helpful prompt: "Set up your character stats in edit mode to use in-session tracking." Link to edit mode.

---

## Data model changes

New field:
```
inspiration: boolean   // default false
```

All other data comes from stories 01–03. No additional fields needed.

---

## Out of scope
- Dice rolling (story 07)
- Party-level shared state visible in this tab (that's the DM dashboard)
- Hit Dice tracker (a natural addition but not in this story — extend later)
- Action / bonus action / reaction tracking ("I've used my action this turn") — valuable but complex; defer
- Renaming the "In Play" tab (separate decision for the product owner; does not block this story)

---

## Open questions
- **Session PIN vs. no auth**: fully unauthenticated session state is recommended. An alternative is a simple 4-digit PIN (no bcrypt, just a short code the player sets) that's stored in sessionStorage. This is lighter than the full password while preventing casual interference. Worth deciding before prototyping.
- **Tab persistence**: should the app remember which tab (Loadout / Persona / Combat) the player was on when they return to the sheet? Suggest: yes, via sessionStorage. Moot if Combat becomes a separate page.
- **Hit Dice as a Tier 1 control**: the consultant lists Hit Dice tracking (short rest healing) as a frequent in-session operation. Omitted from this story for scope — add as an extension once HP tracking is stable.
- **Combat as a separate page**: the ux-designer should prototype both (a) Combat as a third tab within the existing sheet layout, and (b) Combat as a dedicated full-screen page at `/characters/:slug/combat`, bookmarkable and phone-optimized. Product owner decides after reviewing both proposals.

---

## Architect Notes

**Applies**: ADR-001, ADR-002, ADR-004, ADR-006

**Tech approach**: This story is almost entirely frontend — no new backend endpoints or data fields beyond what stories 01–03 introduce. The `inspiration` boolean is a new character field; add it to `BLANK_CHARACTER` and route writes through `PATCH /session`. The tab rename ("In Play" → "Persona") and the new "Combat" tab are changes to `CharacterSheet.jsx`.

**Tab vs. page decision has routing implications.** If Combat becomes a tab: purely additive changes inside `CharacterSheet.jsx`, stays under ADR-002. If Combat becomes a dedicated page at `/characters/:slug/combat`: a new route and a new page component in `src/pages/` are needed, and the Combat content should be extracted from `CharacterSheet.jsx` into its own file — this would be the first justified split per ADR-002's revisit criteria ("distinct sub-features large enough to be genuinely independent"). Either approach is implementable; the tab approach is faster to ship. Recommend the architect does not pre-build the page route until the product owner decides.

Tab state persistence via `sessionStorage` (key: `dnd_tab_${slug}`) is consistent with ADR-006. If Combat becomes a separate route, persistence is moot — the URL is the bookmark.

The "weapons quick-reference" section in the Combat tab is read-only and purely derived from the existing `weapons` array — no new data, just a different render. Reuse the existing weapon expand/collapse pattern from the Loadout tab.

**Scope boundary**: In — three-tab structure (Loadout, Persona, Combat); Combat tab assembling components from stories 01–03; inspiration toggle; weapons quick-reference (read-only); tab rename. Out — hit dice tracker; action/bonus action/reaction tracking; real-time sync (story 05 / ADR-011).

**Dependencies**: Stories 01, 02, 03 must be functionally complete before the Combat tab can be fully assembled, though the tab shell and static layout can be built in parallel. The tab-vs-page decision must be made before implementation begins — it determines the file structure.

**Risks / decisions needed**: Tab vs. page is the only blocking design decision. All other open questions (session PIN, tab persistence) are low-stakes and can be resolved by the product owner in a single conversation. Recommend resolving tab vs. page first since it determines whether `CharacterSheet.jsx` stays monolithic (ADR-002) or gets its first split.
