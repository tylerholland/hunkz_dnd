# RPG Consultant Review
## Feature Gap Analysis & Prioritized Backlog

**Reviewer**: RPG Consultant Agent (15+ years D&D, Roll20 / Foundry VTT / D&D Beyond)
**Date**: 2026-04-28
**App version reviewed**: per `design/app-overview.md` as of this date

---

## Framing: Two Completely Different Use Cases

Before getting into specifics, the single most important observation is this: **the app is currently built for between-session use and is essentially unusable as a live-session tool.**

That is not a criticism — it reflects where the build is. But it means the design gap is large and intentional choices need to be made. A between-session sheet needs accuracy and completeness. A live-session sheet needs speed, one-tap controls, and tolerance for interruption. These pull in opposite directions on UI complexity. The good news: with a focused "In Play" tab (currently a placeholder), you have an existing seam to split these modes cleanly without a full redesign.

---

## What the App Already Does Well

Call these out explicitly because they should not be accidentally broken as features are added:

- **Modifier flyout on ability scores** — computing modifiers on-the-fly from base + item mods and showing a breakdown on hover is genuinely better than D&D Beyond, which buries this. Keep it.
- **Palette theming per character** — small detail that matters for quick visual identification during play, especially on a shared screen.
- **`parseModInt` rejecting dice notation** — silent data corruption from `parseInt("1d8") === 1` is a real bug that has bitten many homebrew tools. Good defensive choice.
- **DM password as a single shared secret** — operationally correct for a small group; avoids per-character DM credential management.
- **Portrait on character list** — fast visual scanning; Roll20's text-heavy character list is inferior for this.

---

## Section 1: In-Session Usability

### What needs to change mid-combat and why it's painful today

Combat in D&D 5e is a constant stream of small state mutations. In a typical combat round a player may need to:

1. Reduce current HP (take damage)
2. Mark a spell slot as used
3. Toggle a concentration flag
4. Track a condition (poisoned, restrained, etc.)
5. Mark a Hit Die as used on a short rest
6. Check or update death saves if downed

**None of these are possible today without entering full edit mode**, which requires typing a password and reloading the whole sheet. That is a blocking problem for live play.

### HP tracking

The current model stores HP as a static string. There is no concept of **current HP vs. max HP**. During a session, current HP is the single most-updated field in the game. It changes multiple times per combat and players track it mentally or on paper because the app cannot help.

What's needed: a dedicated HP track showing `current / max`, with +/- buttons for damage and healing that do not require edit mode. Temporary HP (a separate pool, per RAW) should be a distinct field — it is not simply added to max HP, it sits alongside current HP and absorbs damage first. This is frequently implemented incorrectly.

### Spell slot tracking

Spell slots are the second-most-updated in-session resource. A 5th-level Wizard might have 4 × 1st, 3 × 2nd, 2 × 3rd slots. Tracking these as bubbles (fill/unfill) is the standard pattern — D&D Beyond does this well, Roll20 does it poorly (text field that requires manual editing). The current app has no tracking at all; the `spells` field is free text.

Per RAW: spell slots recover on a long rest. Warlocks recover on a short rest. Pact Magic slots are tracked separately. For a small group this level of nuance probably doesn't matter yet, but the data model needs to support multiple named slot groups.

### Concentration

Concentration is the most error-prone mechanic in 5e at the table. When a player casts a concentration spell, they must:
- Remember they are concentrating
- Remember which spell
- Know to make a Constitution saving throw when they take damage (DC 10 or half damage, whichever is higher)
- Drop concentration if they cast another concentration spell

In practice, players forget they're concentrating roughly 30% of the time in my experience. A visual "CONCENTRATING: [spell name]" flag that persists visibly on the sheet during combat is one of the highest-value additions possible relative to its implementation cost.

### Conditions

The 14 standard conditions (blinded, charmed, deafened, exhaustion, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious) each affect different mechanics. In Roll20 you can attach condition tokens to tokens on the map; in D&D Beyond you can mark conditions on the sheet. Neither is great at surfacing *what the condition actually does* in the moment.

For this app, the minimum viable version is a multi-select of active conditions displayed prominently in the In Play tab. The stretch version explains mechanical effects inline.

**Exhaustion** is special: it has 6 levels with cumulative mechanical effects (disadvantage on ability checks at level 1, speed halved at level 2, up to death at level 6). It needs a dedicated counter, not just a checkbox.

### Death saves

When a character drops to 0 HP, they begin rolling death saving throws each turn: three successes = stabilized, three failures = dead, natural 20 = regain 1 HP and stand up, natural 1 = counts as two failures. The current app has no death save tracking. During a tense "player is downed" moment, this is the field everyone is looking at. It needs three success bubbles and three failure bubbles, visible and one-tap.

### Inspiration

Inspiration is a simple binary flag (you have it or you don't), but it is forgotten constantly because it's invisible. In D&D Beyond it's a small checkbox near the top. It needs to be prominently displayed — ideally a glowing or highlighted state — and toggleable without edit mode.

---

## Section 2: Quick-Adjust Controls

### Tier 1: Changes multiple times per session (need one-tap, no edit mode)

| Stat | Frequency | Notes |
|---|---|---|
| Current HP | Every combat | +/- stepper or direct input; also needs temp HP |
| Spell slots | Every spell cast | Bubble fill/unfill per slot level |
| Hit Dice | Short rest healing | Bubble fill/unfill; recover half on long rest (rounded up) |
| Concentration flag | Each concentration spell | Toggle + spell name text |
| Conditions | Situational | Multi-select with clear-all button |
| Death saves | When downed | 3x success + 3x failure bubbles |
| Inspiration | Situational | Binary toggle |

### Tier 2: Changes occasionally (can require edit mode, but should be fast)

| Stat | Notes |
|---|---|
| Max HP | Level up, temporary effects |
| Ability scores | Level up, ability score improvements at levels 4/8/12/16/19 |
| Proficiency bonus | Level up (every 4 levels in 5e) |
| Equipment / weapons | Between sessions mostly |
| Spell list | Between sessions mostly |

### Tier 3: Almost never changes (full edit mode is fine)

Everything else: name, race, class, portrait, palette, password.

### Key design principle

**Do not make Tier 1 controls go through the password-locked edit mode.** The password lock is appropriate for permanent character data. Ephemeral session state (current HP, conditions, spell slots used) is different data with different access needs. Consider a separate "session unlock" that is either passwordless or uses a lighter mechanism (e.g., single-tap confirm).

This is the architectural decision that unlocks the entire In Play tab.

---

## Section 3: Multi-Player Remote Experience

### The specific context: video call play

This group plays over video call. That changes priorities compared to a tabletop group or a full VTT session:

- Players can **see and hear each other** — initiative call-outs, HP announcements, and condition declarations can happen verbally
- Players **cannot see each other's screens** — shared state needs to exist in the app, not on a physical table
- There is **no battle map** — the spatial layer (token movement, area-of-effect templates) is out of scope
- The DM is managing **more cognitive load** than in-person because all info tracking is mental or in separate tools

Given this, the highest-value shared state for a remote video group is:

**1. Party HP overview** — a lightweight panel (accessible to DM, optionally visible to players) showing all characters' current/max HP at a glance. Not a full character sheet — just name, portrait thumbnail, and HP bar. This is the thing Roll20 does well with its token HP display that this app lacks entirely.

**2. Initiative order** — a simple ordered list that the DM sets at the start of combat and players can see. Does not need to be a full combat tracker. Even a DM-editable ordered list of names with a "current turn" highlight would be transformative. Foundry VTT's combat tracker is the gold standard here; D&D Beyond's is bolted-on and clunky.

**3. Shared notes** — the current `notes` field is per-character. A party-level notes field visible to all (and editable by DM or players) would serve as a shared session log: NPCs met, quest hooks, location names. In practice, Discord pins or a shared Google Doc fills this gap for most groups, but having it in the app creates one fewer context switch.

**4. Visible rolls** — if dice rolling is added (see Section 5), a shared roll log visible to all party members adds accountability and excitement. This is the feature players most consistently praise about Roll20: the shared roll feed creates a social moment even over video.

---

## Section 4: DM Dashboard

### What a DM needs to see across all characters

The current DM experience is: log in with the DM password, navigate to each character individually, use the same player UI. This is significantly worse than what a DM needs during play.

A DM managing a 3-player combat needs simultaneous access to:

- All three characters' current HP (and temp HP)
- All three characters' AC (for adjudicating attacks against them)
- Active conditions on each character
- Who is concentrating and on what
- Initiative order (DM-maintained)
- Death save state for any downed character

None of this requires seeing the full character sheet. In fact, a full character sheet per character is too much — it creates a wall of information that slows the DM down.

### Recommended DM dashboard layout

A dedicated `/dm` view (authenticated with DM password, already architecturally possible) showing a **party card strip**: one card per character with:

- Portrait thumbnail + name
- HP bar (current / max) — editable by DM directly
- AC badge
- Active conditions as colored pills
- Concentration indicator
- Death save bubbles (if applicable)

Below the card strip: an initiative tracker that the DM manages (add/remove entries, advance turn).

### DM actions that must be possible from the dashboard

1. **Damage / heal any character's HP** — DM applies area-of-effect damage to the whole party, or adjudicates healing
2. **Add/remove conditions** on any character
3. **Set initiative order** and advance turns
4. **Clear concentration** when a character takes damage or casts a new spell
5. **Reset spell slots / hit dice** on rest (trigger long rest or short rest for the party)

### What DMs do NOT need from the dashboard

Full stat editing (that's what the individual character sheet edit mode is for), spell lists, equipment management. The dashboard is for moment-to-moment combat state, not character management.

---

## Section 5: Dice Rolling

### Where dice integration adds real value

1. **Attack rolls** — roll to hit (1d20 + attack bonus) is the most frequent roll in the game. One-tap "roll attack" per weapon, with the modifier already applied, eliminates mental math and speeds up combat significantly. The weapon data (with `mods[]`) is already in the data model — this is close to buildable.

2. **Damage rolls** — immediately after a successful hit. The weapon already has damage dice in its description. If damage type is structured (not free text), this becomes one-tap "roll damage."

3. **Ability checks and saving throws** — rolling 1d20 + ability modifier for skill checks and saves. The modifiers are already computed. This is a natural extension of the existing modifier display.

4. **Death saving throws** — 1d20, DC 10, results auto-fill the success/failure bubbles. Low complexity, high drama. Players love when the UI reacts to a death save result.

### Where dice integration adds noise

1. **Initiative rolls** — players can roll verbally and the DM records the order. Auto-rolling initiative for all players simultaneously is a feature that sounds good but in practice creates arguments about whose roll "counts" and delays the start of combat.

2. **Spell attack / spell damage** — spell mechanics are so varied (half damage on save, no roll for damage, area vs. single target) that a generic roller doesn't help much without a structured spell database. With free-text spells, this is not yet buildable cleanly.

3. **Skill checks during roleplay** — these are DM-called, situational, and often not from the character sheet in the flow of conversation. The verbal call-and-response ritual matters socially. Auto-rolling from the sheet can feel sterile.

### Implementation approach

The standard pattern: inline roll buttons on weapon rows, ability score tiles, and saving throw rows. A shared roll log visible to all authenticated users (via polling or WebSocket). Roll results shown with the formula (`1d20+5 = 17`) not just the total. Advantage/disadvantage toggle (roll 2d20, take higher/lower) is essential — it comes up in roughly 30% of rolls at a typical table.

---

## Section 6: Gaps and Priorities — Ranked Feature Backlog

Ranked by **impact during actual play** × **implementation feasibility** given current architecture.

---

### Priority 1: Current HP Tracking (In-session state, no edit mode required)

**Impact**: Critical. This is the most-updated field in the game. Every hit, every healing spell, every temporary HP application touches it.

**What's needed**:
- Split `hp` into `hpMax` (permanent, edit-mode) and `hpCurrent` (session state, no auth required or lightweight auth)
- Temp HP as a third field (separate pool, not additive to max)
- +/- stepper buttons with direct-entry fallback
- Visual HP bar showing current/max proportion

**Why now**: Without this, the app cannot function as a live-session tool. Everything else in this list is secondary.

**Architecture note**: Session state (current HP, spell slots used, conditions) is fundamentally different from character data. Consider whether it lives in DynamoDB alongside the character or in a separate ephemeral store. For a small group, DynamoDB with optimistic UI updates is probably fine — the write frequency is low (a few hits per combat encounter).

---

### Priority 2: Spell Slot Tracker

**Impact**: High. Every spellcaster (which is likely all or most of this party) tracks these constantly. Getting this wrong — forgetting a used slot, double-counting — creates mid-session arguments and rule disputes.

**What's needed**:
- Per-slot-level bubble arrays (fill = used, unfill = recovered)
- Slot counts configurable in edit mode (or auto-populated from class/level lookup table)
- Long rest button resets all slots
- Short rest button for Warlock Pact Magic (if applicable)

**Data model change**: `spellSlots: [{ level: 1, max: 4, used: 2 }, ...]` — straightforward extension.

---

### Priority 3: Condition Tracking + Concentration Flag

**Impact**: High. Conditions alter mechanics in ways that are invisible if not tracked. Concentration failures are the most common rule error at 5e tables — players routinely forget they're concentrating when they take damage, skipping the Constitution save entirely.

**What's needed**:
- Multi-select condition picker (the 14 standard conditions as a pill grid)
- Exhaustion level counter (0–6) separate from the condition list
- Dedicated concentration toggle: binary on/off with a text field for the spell name
- Visual prominence: concentration and active conditions should be visible in the In Play tab header, not buried

**This unlocks the DM dashboard** — condition state displayed in the DM view comes from this same data.

---

### Priority 4: In Play Tab — Differentiated Session View

**Impact**: High. The tab already exists as a named placeholder. Making it the live-session surface (HP, conditions, spell slots, death saves, inspiration, concentration) without full character sheet noise is what separates this app from a static PDF.

**What's needed**:
- The In Play tab becomes the session-state surface: shows Tier 1 quick-adjust controls from Section 2
- The Loadout tab remains the between-session reference surface
- No password required to update In Play state (or a separate lightweight session PIN)

This is a UX restructuring task more than a data task — most of the data model additions from priorities 1–3 feed directly into this view.

---

### Priority 5: DM Dashboard View

**Impact**: High for the DM, moderate for players. The DM currently has no way to see party state at a glance. This is the biggest quality-of-life gap for the person running the game.

**What's needed**:
- `/dm` route (authenticated with existing DM password flow)
- Party card strip: portrait thumbnail, name, HP bar, AC, active conditions, concentration indicator
- DM can edit HP, conditions, concentration directly from this view
- Initiative order list (DM-managed, simple drag-reorder or up/down arrows)

**This is the feature that makes the app feel like a VTT rather than a character sheet viewer.**

---

### Priority 6: Death Saves + Inspiration

**Impact**: Medium-high during specific moments (player is downed, DM awards inspiration). Both are simple to implement but high-visibility during play.

**Death saves**:
- 3 success bubbles + 3 failure bubbles, displayed when HP = 0
- Natural 20 = auto-fill one success + set HP to 1
- Natural 1 = auto-fill two failures

**Inspiration**:
- Binary flag, stored per character
- Displayed prominently in In Play tab (large glowing indicator works well)
- Toggleable by player or DM without edit mode

These are low-complexity implementations that punch above their weight in table feel.

---

### Priority 7: Attack Roll Dice Integration

**Impact**: Medium. Speeds up combat, reduces mental math errors, creates shared social moment if rolls are visible. But players can function without it — the above priorities are about data they literally cannot track otherwise.

**What's needed**:
- Roll button per weapon row: `1d20 + [attack bonus]`, result displayed inline
- Damage roll button (requires structuring damage as `{ dice: "1d8", bonus: 3 }` rather than free text)
- Advantage/disadvantage toggle
- Optional shared roll log (all party members see recent rolls)

**Why last in the top 7**: The mechanical prerequisites (structured weapon damage data) require a schema migration. The other priorities work with the data model largely as-is.

---

## Summary Table

| Priority | Feature | Sessions Until Painful | Complexity |
|---|---|---|---|
| 1 | Current HP tracking (current vs max, temp HP, steppers) | 0 — already painful | Low-Medium |
| 2 | Spell slot tracker (bubbles, long/short rest reset) | 0 — already painful | Medium |
| 3 | Condition tracking + concentration flag | 0 — already painful | Low-Medium |
| 4 | In Play tab differentiated from Loadout | 1 — becomes obvious immediately | Medium (UX) |
| 5 | DM dashboard (party cards, initiative, HP edit) | 1 — DM feels it immediately | Medium-High |
| 6 | Death saves + inspiration | Situational — first time someone drops | Low |
| 7 | Dice rolling (attack + damage, advantage/disadvantage) | Several — players manage verbally | Medium |

---

## What to NOT Build Yet

- **Full combat automation** (auto-apply damage, spell save DCs against monsters) — requires monster data, is VTT scope, and is overkill for 3 players on a video call
- **Initiative auto-roll** — adds friction, breaks social ritual
- **Spell database integration** — free-text spells are fine until the spell slot tracker exists; structured spells are a much larger project
- **Real-time WebSockets** — polling every 10–15 seconds on In Play state updates is sufficient for a 3-player group; the complexity cost of WebSockets is not justified yet
- **Mobile-first combat view** — the group is on video call, likely on laptops; mobile optimization is a lower priority than getting the features right

---

## Closing Observation

The app has a solid foundation: clean data model, working auth split between player and DM, good ability score display, and an intentional separation between view and edit modes. The path to a genuinely useful live-session tool is shorter than it might appear — priorities 1 through 4 are all data model extensions plus UI additions to the existing In Play tab. None of them require architectural changes. Priority 5 (DM dashboard) is the biggest single lift but also the biggest single unlock for the person who runs the game every session.

The core insight from 15 years of play: **players will tolerate a lot of UI roughness if the numbers are right and accessible fast.** They will abandon a tool entirely if it makes combat slower or requires leaving the sheet to track a spell slot. Get priorities 1–3 right, and the rest follows naturally.
