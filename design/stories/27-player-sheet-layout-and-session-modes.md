# Feature Story: Player Sheet Layout — Profile Mode vs. Session Mode

**Status**: Implemented (`45f1969`) — `CharacterSheetSessionMode.jsx`
**Source**: RPG Consultant
**Prototype**: (leave blank — ux-designer fills this in)

---

## Expert analysis: the five questions

### 1. Party visibility during combat — should players see party HP?

**Recommendation: Yes, with a lightweight opt-in.**

At the physical table, party HP is effectively public information. Players can see when the paladin is bleeding and hear when the cleric shouts "I'm down to 4!" Shared survival decisions — "should I use Healing Word on Eoghan or save the slot?" — require knowing your allies are in trouble. Hiding HP between players is a convention of secrecy that almost no casual or narrative-focused group enforces; it is a simulation choice, not a rules requirement.

In VTT practice, Foundry VTT exposes party HP on tokens by default and offers an optional "Hide Party HP" module for groups that want restriction. D&D Beyond's DM-side encounter tracker shows all party HP; the player side does not, but only because it has no party view at all. The practical norm in the majority of groups is that party HP is visible to everyone.

For this app, party HP on the player sheet serves a real in-session function: a player glancing at their phone during someone else's turn can see that two allies are at less than 20% health and plan accordingly. That is good tactical play, not metagaming.

The "party visibility" feature should show each party member's name, portrait initial, HP bar (current / max), and active conditions. It should be a DM-configurable toggle if desired (the DM may prefer the "ask the DM" convention), but the default should be visible.

### 2. Turn order — full initiative list vs. just "your turn"

**Recommendation: Show the full initiative order, but highlight active turn prominently.**

Knowing the full turn order is standard practice at any table. Players use it constantly: to decide whether to hold an action, to time a spell before a high-initiative enemy acts, to know they have two turns before the dragon goes again. The information is not secret — in 5e, initiative is declared openly and usually written on a whiteboard or tracked with tent cards. Players already know the order; showing it digitally is just convenience.

What the player-facing initiative tracker should not show: enemy HP bars (see question 3), enemy stat blocks, or initiative roll values that the DM might want kept ambiguous. Names of enemies are fine — "Goblin A, Goblin B" is not a spoiler.

The display should clearly distinguish: whose turn it is now (prominent highlight), what comes next, and where the player's own turn falls in the order. The round counter already exists on the DM dashboard (Story 19) and should surface here too — knowing you're in Round 3 of a fight is useful context.

### 3. Enemy visibility — HP bars and conditions on the player view

**Recommendation: No enemy HP bars or numeric HP; conditions visible at DM discretion; names always visible.**

This is the clearest D&D etiquette distinction. Enemy HP is the DM's domain. In 5e, the DM describes a creature as "looking wounded," "barely standing," or "bloodied" — precise HP totals are never meant to be player-accessible information. Showing enemy HP bars on the player sheet would constitute a fundamental break with how D&D adjudicates information.

The existing DM dashboard correctly separates NPC cards from the player-facing party view. That separation must be preserved.

However, conditions on visible enemies can be shown — "the goblin is Prone" is something every player at the table can see. The DM may choose to share this or not. A reasonable rule: show enemy names in initiative order (so the player knows turn order), show conditions on enemies only if the DM explicitly marks them visible, and never show enemy HP on the player-facing view.

This is consistent with how Foundry handles it: the GM controls token HP bar visibility per-actor.

### 4. Mode switching — does "profile mode" vs. "session mode" make sense?

**Recommendation: Yes, strongly. This is the right frame, and the app is ready for it.**

The existing four-tab structure (Persona, Inventory, Combat, Map) already implicitly encodes two contexts:
- **Profile context** (character-building, between-session): Persona tab, the backstory collections below the stats block, edit mode
- **Session context** (live play): Combat tab, Map tab, HP/conditions, dice roller

The problem is that both contexts share the same narrow-column layout, and switching contexts requires the player to scroll through the full portrait, backstory lede, and stats block every time. On desktop, this is especially wasteful — a 1440px-wide browser window showing a 600px-wide column of text is a poor use of the medium.

A **Profile / Session mode switch** directly mirrors what players actually do:
- Before a session: they open the sheet to review character details, update backstory, look at their spell list, plan leveling
- During a session: they need HP, conditions, spell slots, initiative position, dice roller — immediately visible, no scrolling

Physical table convention maps perfectly to this split. Your character card (what you'd hand a new player at the table) is a compact combat reference. Your full character sheet (the booklet) is your between-session document. The app should have both.

### 5. Desktop vs. mobile — is there a better layout than narrow single-column?

**Recommendation: Yes. The narrow single-column on desktop is a known user frustration even for industry leaders.**

D&D Beyond is the most-used digital character sheet in 5e, and its single-column narrow layout on desktop is among the most-complained-about features in its feedback forums. Users have built browser extensions and filed repeated requests for a multi-column widescreen layout. D&D Beyond staff acknowledged the issue but it remains unresolved as of 2025.

Foundry VTT uses a windowed/panel approach on desktop — the character sheet floats as a resizable panel. Roll20 uses a tab-heavy single-column layout. Neither is ideal.

The convention in other domain-adjacent apps (habit trackers, health dashboards, project management tools) on desktop is a two-column or three-column layout where the left column is navigation/identity and the right panel(s) are the active working area. Applied to D&D: left column is the character identity panel (portrait, name, stats summary); right panel is the active session working area (combat resources, initiative, dice).

This matches the DM dashboard's existing convention: the DM dashboard already uses a multi-column layout because the team recognized that session management requires more than one concurrent view. The player sheet deserves the same treatment.

---

## Goal

Introduce a **Session Mode** for the player character sheet — a layout variant that activates on wider screens and/or via an explicit mode toggle — giving players immediate access to their session-critical tools (HP, conditions, initiative position, spell slots, dice roller) without scrolling through profile content, while preserving the full Profile view for character-building and between-session use. On desktop, this becomes a multi-column layout; on mobile, it becomes a mode toggle.

---

## User stories

- As a **player on desktop during a live session**, I want my session-critical tools (current HP, conditions, spell slots, initiative position, dice roller) visible without scrolling so I can act immediately when my turn arrives.
- As a **player on mobile during a live session**, I want a Session mode that collapses the backstory, portrait, and character-building content and surfaces only my in-session resources.
- As a **player between sessions**, I want my full Profile view available — portrait, backstory, stats, persona, inventory — for character-building and reading.
- As a **player in session**, I want to see my party members' current HP and active conditions so I can make informed tactical decisions (who needs healing, who has cover, who is Prone).
- As a **player in session**, I want to see the full initiative order — whose turn it is, who's next, where I fall — so I can plan ahead without asking the DM.
- As a **player in session**, I want to know whose turn it is at a glance, with my own turn highlighted distinctly, so I do not slow down the table by missing my turn.
- As a **DM**, I want control over whether players can see party HP in Session mode, because some groups prefer the "ask the DM" convention.

---

## Functional requirements

### Mode definition

The sheet has two modes: **Profile** (current behavior, unchanged) and **Session**.

Profile mode is the full current sheet: portrait, header, stats block, tab strip, all four tabs, backstory collections. No changes to Profile mode.

Session mode collapses or hides:
- The full portrait image (replace with a compact identity strip: portrait circle, name, class/level)
- The backstory collections section below the stats block
- The Persona tab content (roleplay traits, backstory sections)
- The detailed ability scores flyout grid (replace with a compact stat strip showing just the six modifier values)

Session mode surfaces (always visible, no scrolling required):
- HP bar (current / max / temp HP), with inline stepper
- Conditions (active only, not the full picker grid)
- Concentration banner (when active)
- Inspiration indicator
- Spell slots (when configured)
- Weapons quick-reference
- Dice roller (expanded by default in session mode, not collapsed)
- **Initiative strip** (new in this story — see below)
- **Party status strip** (new in this story — see below)

### Desktop multi-column layout

On screens wider than approximately 900px, Session mode uses a two-column layout:
- **Left column** (narrower): compact character identity (portrait circle, name, class/level, AC, speed), ability score modifiers as a compact grid, party status strip, initiative strip
- **Right column** (wider): HP bar, conditions, concentration, inspiration, spell slots, weapons quick-reference, dice roller

This mirrors the DM dashboard convention already in the app. The split point and column widths are UX-designer decisions.

Profile mode on desktop remains the current narrow single-column layout — this is appropriate because profile content (backstory, collections) is reading/writing content that benefits from a contained line width.

### Mobile behavior

On screens narrower than the breakpoint, Session mode is a single-column layout with the profile-heavy content (portrait, backstory collections, stat block flyouts) collapsed. A persistent compact identity strip at the top (portrait circle, name, HP) remains visible. All session content is immediately below it without scrolling past profile content.

### Mode persistence

The active mode (Profile / Session) is persisted per character in `sessionStorage` so that a player who switches to Session mode before a session does not have to re-switch on every page load during the session.

### Initiative strip (player-facing)

The initiative strip shows the current combat order as it is tracked by the DM's initiative system. It reads from the same `GET /initiative` endpoint used by the DM dashboard. It polls at the same adaptive rate as the rest of the session data.

What is shown:
- All initiative entries in order, with the active turn highlighted
- Player character entries show character name and portrait initial, tinted to that character's palette
- Enemy entries show the name only (no HP, no AC, no conditions unless the DM adds them)
- The current round number
- Which entry is the active turn (clear visual distinction)
- The player's own turn entry gets an additional "Your Turn" highlight

What is not shown:
- Enemy HP or AC
- Initiative roll values (unless the DM decides this is fine — flagged as an open question)
- Hidden enemies (entries the DM marks as hidden)

The initiative strip is read-only for players. Players do not add or remove entries. Rolling initiative is done verbally and the DM enters it on the dashboard.

### Party status strip (player-facing)

The party status strip shows each other party member's current combat state. It reads from `GET /dm/party` (the same endpoint the DM dashboard uses).

What is shown per party member:
- Portrait circle (or initial), name, character palette accent
- HP bar (current / max), with percentage fill
- Active conditions as color-coded chips
- Concentration dot when concentrating
- Inspiration indicator when active

What is not shown:
- Detailed stats, spell slots, inventory
- DM notes
- Death save details (presence at 0 HP is visible implicitly via the HP bar)

The party status strip is read-only for players. Players cannot adjust other characters' HP or conditions from their own sheet.

DM configurability: the DM should be able to disable the party status strip for all players if they prefer the "ask the DM" convention. This is a DM dashboard setting, not a per-player setting.

### Mode toggle placement

A clear, persistent mode toggle is available on the character sheet — accessible without scrolling — that switches between Profile and Session. On desktop in Session mode, this toggle can also simply be a persistent element in the left column. The exact affordance is a UX-designer decision.

---

## Data model changes

No new fields are required on the character record itself.

The initiative strip reads from the existing `slug: "initiative"` sentinel item (already includes `entries`, `activeTurnIndex`, `round`). No changes needed.

The party status strip reads from the existing `GET /dm/party` endpoint and uses the fields already projected: `hpCurrent`, `hpMax`, `tempHP`, `conditions`, `concentration`, `inspiration`, `name`, `palette`, `portraitUrl`. No changes needed.

A new DM-level setting is needed to control whether party HP/status is visible to players:
- New field on the `slug: "party-roster"` sentinel item: `partyVisibilityEnabled: boolean` (default `true`)
- Exposed in the DM dashboard (a "Allow players to see party status" toggle in session settings)
- The `GET /dm/party` endpoint currently requires DM auth — a separate unauthenticated party-status read endpoint may be needed, or the player sheet can call a new `GET /party/status` endpoint that returns only the session-visible fields. This is an architect decision.

---

## Out of scope

- Players modifying other party members' HP or conditions from their own sheet
- Enemy HP, AC, or stat information visible to players
- Showing which enemy a character is engaged with
- Player-facing initiative rolling (players tell the DM; DM enters it)
- A full party view page (separate URL for a "party dashboard" for players) — this story is about the character sheet layout only
- Edit mode changes — Session mode is view-only; edit mode remains unchanged
- Changes to the DM dashboard layout

---

## Intersections with existing stories

- **Story 19** (Death Saves and Round Counter): the initiative strip shows the round counter from the same data; death save state is visible implicitly via the 0 HP display on the party status strip
- **Story 20** (Party Intelligence Panel): that story adds passive skills, saves, and speed to the DM dashboard party cards; this story adds HP/conditions to the player-facing party strip — these are complementary, not overlapping
- **Story 12** (Maps): the Map tab still exists in Profile mode; in Session mode on desktop, a map thumbnail or the full MapViewer could be a third column — flagged as an open question rather than a requirement here
- **Story 07** (Dice Roller): the dice roller is surfaced in Session mode without requiring the player to scroll; no functional changes to the roller itself
- **Stories 01–03** (HP, Spell Slots, Conditions): Session mode is the ideal surface for these — they were always designed to be the player's in-session tools; this story gives them the screen real estate they deserve

---

## Open questions

1. **Auth for party status**: the `GET /dm/party` endpoint requires DM auth. Should a new unauthenticated (or character-password-authenticated) endpoint be created for player-facing party status? Or should the existing `patchSession`-style no-auth convention extend to a party read? The architect must resolve this before implementation.

2. **Initiative roll values**: should the player-facing initiative strip show the initiative roll number next to each entry (e.g., "Fighter — 18") or just the order? Physical table convention is that roll values are public; hiding them would be unusual. But some DMs prefer ambiguity (especially for enemy entries). Recommend showing values for PC entries, hiding for NPC entries by default.

3. **Map in Session mode desktop**: on a wide desktop, a third column showing the active map would let players pan/zoom the map while tracking their own combat state. This would require a three-column layout on very wide screens. Worth exploring in prototype but should not block the two-column implementation.

4. **DM party-visibility toggle**: where in the DM dashboard should the "allow players to see party status" setting live? Suggest: the `Manage Party` modal, since it is already the place where the DM controls party composition.

5. **Session mode as the default for returning users**: should the app detect that a session is in progress (initiative entries exist and round > 0) and automatically suggest or switch to Session mode? This would be a useful quality-of-life behavior but adds complexity around the definition of "session in progress."

6. **Profile mode on wide desktop**: the owner noted the current narrow single-column feels too constrained even in profile/character-building use. This story leaves Profile mode unchanged — but the design-strategist should consider whether a modest layout improvement to Profile mode (wider content column, two-column backstory sections) is worth including in the same design pass.

---

## Design Direction (player feedback — refined after rpg-consultant review)

The following notes supersede the original UX Design brief and should be used by the design-strategist to revise it.

1. **Map placement**: The map is NOT a tab. It gets its own collapsible section at the top of the right column, always present and independent of the Combat / Loadout / Notes tabs below it. When expanded it is large enough to be useful during combat (tokens visible); the player can collapse it to free vertical space. The tabs for Combat, Loadout, Notes, etc. live below the map section and are unaffected by whether the map is open or closed.

2. **HP display — compact, left column, always visible**: Replace the 56px "HP hero" with a compact representation in the left column, below name/class details and above the ability scores. Keeping HP in the left column means it stays visible regardless of which right-column tab is active — critical when the DM calls out damage while you're looking at the map.  The HP display should have quick ± controls for minor adjustments directly on it.

3. **Recovery & Damage — a dedicated section, not part of the HP bar**: Take Damage, Receive Healing, and Spend Hit Die belong in their own clearly named section (suggested: "Recovery & Damage"). This section lives either in the left column below HP/above ability scores, or in the right column above the tabs — somewhere that makes it feel like an action zone rather than part of the passive HP display. Rationale:
   - **Take Damage**: player always records their own damage. Core self-service action.
   - **Receive Healing**: player records healing called out by the DM or another player (spell heal, etc.). Lightweight number input.
   - **Spend Hit Die**: short rest self-healing — player rolls their hit die + CON mod to regain HP. Show remaining hit dice count. This is the primary player-controlled healing mechanic.
   - **Concentration nudge**: when Take Damage is used while a concentration spell is active, surface a contextual reminder of the concentration check DC (max(10, damage/2)) — not a standalone button, just a smart inline prompt.
   - Potion healing stays in the inventory "Use" button — not duplicated here.
   - Death saves, inspiration, conditions remain where they are.

---

## UX Design

Brief written at `design/briefs/player-sheet-session-mode-brief.md`. Pass 3 — supersedes all prior brief iterations.

Key decisions:
- **PROFILE / SESSION segmented pill toggle** — IM Fell English 12px, sticky on mobile, top-left on desktop. Stored in `sessionStorage.dnd_mode_${slug}`. Auto-switches to Session on page load when `initiative.entries.length > 0 AND round > 0` and no stored preference.
- **Desktop two-column (≥900px)** — 340px left column (sticky: identity → compact HP block → Recovery & Damage zone → ability mod chips → initiative strip → party strip); right column flexes to ~760px max (map panel → concentration banner → conditions → slots → inspiration → sub-tabs → dice roller pinned bottom, expanded by default).
- **Map panel** — collapsible panel at the **top of the right column**, above the sub-tab strip and independent of it. Header: `▾ MAP · {name} ●`. Height `min(46vh, 460px)` when open. `sessionStorage.dnd_map_open_${slug}`. Default open when active map + combat; collapsed otherwise. No active map → quiet inert line. MAP is **no longer a sub-tab**.
- **Compact HP block (left column)** — replaces the 56px HP hero. `HP  32/45` in Cinzel 28px, 4px bar, inline ±1 steppers. Always visible in left column below identity, above ability chips. Color-coded (healthy/wounded/critical thresholds). Not a card — lives on the tinted left-column surface.
- **Recovery & Damage zone (left column)** — dedicated action section below compact HP block. Contains: `[⚔ Take Damage]` (inline stepper + presets + confirm), `[✦ Heal]` (inline stepper), `[◈ Spend Hit Die · N left]` (rolls + applies), and a contextual concentration-check nudge after damage while concentrating. Potion healing stays in Loadout `Use` — not duplicated here.
- **Sub-tabs** — COMBAT · LOADOUT · NOTES (three tabs; MAP removed). COMBAT default.
- **Party status strip** — each row: 44px palette-colored portrait circle + name in character's `pal.accent` + exact HP numerals + proportional HP bar (6px) + up to 2 condition chips. Bloodied/critical border brightens; `deathGlow` at 0. Self-card omitted. Read-only.
- **Initiative strip** — full order always visible on desktop; collapsed to one-line + ▼ expand on mobile. Active turn: avatar grow 44→56px + ring glow pulse 1.8s. Own turn: 56→72px + `· YOUR TURN`. Roll values not shown; hidden entries omitted.
- **Persona tab** — unreachable in Session mode by design.
- **Backend blocker**: resolved. `GET /party/status` and `GET /initiative/public` both exist as unauthenticated endpoints.

---

## RPG Consultant Review

_Evaluating the three Design Direction notes from the player against D&D table conventions and live-play reality._

---

### 1. Map placement

**Player's position**: The map feels too small in the left sidebar. It should be at the top of the right column — large enough to be actually useful for spatial awareness.

**Table reality verdict: The player is right, with one important qualification.**

At a physical table, the battle map is the single most-referenced shared object during combat. It is the center of the table. Every tactical decision — movement, spell placement, cover, flanking — flows from it. A player who cannot see the map clearly is playing half a game: they are rolling dice without knowing the spatial context those dice operate in.

The brief's original placement (map as a sub-tab buried in the right column's tab strip, equally weighted with COMBAT, LOADOUT, and NOTES) already represents an improvement over the current single-tab system, but the player has identified a real hierarchy problem: during active combat, the map is not one-of-four options — it is the dominant reference surface. The left sidebar placement of the brief is even worse: a 340px-wide column that also contains identity, ability mods, initiative strip, and party strip will compress the map to something unusable.

However, the important qualification is this: the map is only dominant during the DM's descriptive phases and other players' turns. When it is *your* turn, your attention shifts immediately to your own resources — HP, spell slots, weapons. The map and the combat stats are co-primary, not sequential.

**Recommendation**: Move the map to the top of the right column as the player requests, but implement it as a collapsible panel rather than a fixed block. When the MAP sub-tab is active, the map takes the top of the right column at a meaningful height (roughly 40–50% of viewport height, not the tiny thumbnail the left column would permit). The COMBAT/LOADOUT/NOTES sub-tabs remain below it or replace the map area when active. On desktop at full width, a third column for the map becomes viable (the original story's open question 3) — but if two-column is the implementation target, the right column top is the correct placement, not the left.

The left column should remain what the brief intended it to be: the stable identity anchor (portrait, ability mods, initiative strip, party strip). Squeezing a map viewer into that column alongside all of that content would make every element unusable.

---

### 2. HP meter size and placement

**Player's position**: 56px Cinzel HP is too visually dominant. Prefer compact HP in the left column, below name/class details, above ability scores.

**Table reality verdict: The player is right that 56px is too large, but the left column placement needs scrutiny.**

Consider the actual frequency of HP glances during a session. A player checks their HP in three distinct scenarios:

1. **After taking damage**: immediate — they need to know if they are bloodied, critically low, or fine. This is the most urgent HP check.
2. **When deciding whether to use a healing resource**: a deliberate, slightly slower check — "do I need to use this potion now or can I hold it?"
3. **When the DM asks "what's your HP?"**: rare at a table with good combat flow; more common in looser groups.

None of these scenarios requires a 56px number. The DM dashboard uses large HP numerals because the DM is reading *across* multiple character cards from a distance and needs to pattern-match at a glance. The player is reading *their own single number*, which they already roughly know. A compact display — something in the 28–32px range — is entirely sufficient for all three scenarios. The 56px treatment was designed to give HP visual primacy in the layout hierarchy, which is a defensible design goal, but it overshoots what the mechanic actually needs.

On the left column placement: this is more nuanced. Placing HP below name/class but above ability scores in the left column means HP sits in the identity strip rather than in the session-resource area. That is a conceptually awkward split — the left column is the "who am I" column, and HP is "how am I doing right now." They are different information types. However, the player's instinct is correct in one respect: a compact HP readout in the left column keeps it *always visible* regardless of which sub-tab is active on the right. If the player is on the MAP sub-tab looking at the battle map, they still need to glance at their HP when they take a hit.

**Recommendation**: Keep HP in the left column below the identity strip (name/class/level/AC row), but do not give it hero-size treatment. A compact row showing `HP  32 / 45` in a 28px Cinzel number, with a thin proportional bar beneath it, is immediately scannable and never gets in the way. The ±1 stepper can live here too. The Damage/Heal modal buttons (discussed below) can be small secondary affordances on this row — they do not need to be the dominant element. This placement means HP is always visible regardless of sub-tab, which is the actual need.

---

### 3. Damage and Heal buttons

**Player's position**: Both buttons may not be needed. Potion healing should have a "Use" button in inventory. "Take Damage" seems more plausible as a self-service action. The player is questioning who actually initiates HP changes at a real table.

**Table reality verdict: The player has identified the correct frame. This is the most important of the three points.**

Let me break down every HP change event in 5e play and who initiates it:

**Damage events:**
- The DM calls out how much damage a monster's attack dealt. The player subtracts it from their HP. This is entirely player-recorded — the player is the bookkeeper of their own damage. A "Take Damage" entry field is legitimate here.
- Area-of-effect spells targeting multiple characters: the DM calls the damage; each affected player records it. Same model.
- Environmental damage (falling, traps): DM calls it; player records it.

In every damage scenario, the player is the one physically writing the number down (or tapping it in). The DM does not typically reach across the table to mark damage on someone else's sheet. A "Take Damage" workflow is therefore the most grounded self-service HP interaction in the game.

**Healing events:**
- **Potion (player-initiated)**: The player declares "I drink a healing potion" on their turn, rolls the healing die, adds it to HP. This is fully player-initiated. An inventory "Use" button that decrements quantity and prompts for the roll result — or better, that auto-applies the potion's configured modifier — is the right model. The existing potion "Use" button that decrements qty is already partially there; it just needs to actually apply HP. This is the clearest case for a player self-service healing action.
- **Healing Word / Cure Wounds from another PC**: The casting player rolls the dice and calls out the total. The receiving player records the gain. The receiving player types in the number — a "Receive Healing" or "Heal" entry is reasonable, but it is less urgent than potion healing because it happens on someone else's turn and the player has time.
- **Healing from the DM (NPC healer, magic item)**: Same as above — DM calls it, player records it. The DM's dashboard already has a Heal button on each character card, so the DM can apply it directly if they choose. If the DM applies it via the dashboard, the player sheet will update via polling without the player needing to do anything.
- **Short rest hit dice**: Player rolls their hit dice and adds the result. Self-initiated. A "Spend Hit Die" flow would handle this — not a generic Heal button, but a specific short-rest workflow.
- **Long rest**: Full restoration. Currently handled by the DM via the party-wide Long Rest button on the dashboard. The player sheet does not need an independent control for this.

**The specific problem with "Damage" and "Heal" as parallel buttons**: They imply a symmetry that does not exist at the table. Damage is always player-recorded (no one else does it for you, and the DM dashboard can also apply it as an override). Healing has multiple sources with different initiation models — potion (player), spell from ally (player records result called by ally), DM via dashboard (automatic). Presenting them as equivalent modal buttons misrepresents the actual flow.

**Recommendation**: Replace the symmetric Damage/Heal button pair with a more accurate set of self-service HP controls:

1. **Take Damage**: number entry + confirm. Clear, accurate, player-initiated. Applies a negative delta to `hpCurrent`. This maps directly to the most common HP bookkeeping action in the game.

2. **Potion "Use" button in Inventory**: Already exists for qty decrement. Extend it to also apply the potion's healing value to `hpCurrent` via `patchSession` in the same write. If the potion has a configured Damage mod (e.g., `2d4+2`), the player sheet can roll it and apply it. This is the correct place for player-initiated healing — not a generic "Heal" button on the combat surface.

3. **Receive Healing**: A lightweight secondary affordance (not a prominent button — perhaps a small "+ Heal" link near the HP display) for recording healing received from spells or DM-applied effects when the DM does not apply it via the dashboard. This should not be as prominent as Take Damage because it is less frequently the player's responsibility to initiate.

The DM dashboard's Heal button on each character card covers the "DM applies healing" case. There is no need for the player sheet to duplicate that with equal visual weight. Removing the symmetric Heal button from the player sheet combat surface and redirecting healing to inventory (potion Use) and a lightweight receive-heal affordance better models what actually happens at the table.

**One nuance for this app specifically**: Because `patchSession` allows unauthenticated writes, any player can adjust any character's HP if they know the URL. This means the "correct" initiator model is not strictly enforced — a player helping their friend could technically apply damage or healing to another character's sheet. This is fine for a small trusted group. The design should optimize for the most common honest case (player self-service), not try to enforce turn-order accuracy via UI restriction.
