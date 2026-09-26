# Feature Story: Party Member Detail — Abilities + HP (Not Inventory)

**Status**: Needs UX design
**Source**: User request
**Prototype**: (leave blank — ux-designer fills this in)

## Goal

Players want to check on their teammates mid-session — deciding whether to spend a heal, deciding whether a party member's build can handle a mechanic that keys off a specific ability score, or just general table awareness of who's hurt and who's healthy — without having to stop the scene and verbally ask "what's your HP" or "what's your Wisdom." Some of this already exists today: HP for other party members is already visible somewhere in the app (the session-mode party status strip already shows HP bars and names for other party members, and the map's token detail card already surfaces conditions), gated by the DM's existing `partyVisibilityEnabled` toggle. This story is about extending that existing HP/condition visibility to also cover a genuinely new category — a teammate's "abilities" — while being explicit that inventory contents stay private between players, by design, not by oversight.

## User stories

- As a player, I want to check a teammate's current HP and abilities at a glance so that I can decide whether to spend a healing resource on them or plan my turn around what they can do, without asking out loud every time.
- As a player, I want to see a teammate's abilities (exact meaning TBD — see Open Questions) so that I can reason about party mechanics (e.g., "can Aesop even attempt this Wisdom save," "does anyone have a ranged attack") without breaking the flow of the scene to ask.
- As a DM, I want the existing party-visibility control to still govern how much of this information other players can see, consistent with how HP/condition visibility already works today.

## Functional requirements

- A player can view another party member's current HP (this already exists in some form today — this story's job is to make sure it's also reachable from wherever this new "abilities" view lands, not to build HP visibility from scratch).
- A player can view another party member's "abilities" (see Open Questions for exactly what this means — this is the genuinely new capability this story adds).
- Whatever HP/abilities visibility already applies to conditions and HP today (gated behind the DM's `partyVisibilityEnabled` toggle, with the exception that a player always sees their own token's full information regardless of the toggle) should be considered the default starting point for this new view too — see Open Questions on whether that gating should carry over unchanged.
- This is explicitly framed as extending an existing capability (HP/conditions already visible via existing surfaces), not introducing player-to-player visibility as a brand-new concept.

## Data model changes

None expected for HP (already modeled and already flows into player-facing surfaces). Whatever "abilities" ends up meaning (see Open Questions) will likely be data that already exists on the character record in some form (ability scores in `stats[]`, `skills[]`, `specialAbilities[]`, or `spells[]`) — the open question is which of these, not whether new fields are needed. No new fields are anticipated for inventory, because inventory is explicitly out of scope.

## Out of scope

- **Inventory / equipment contents of another player's character** (`weapons[]`, `equipment[]`). The user was explicit and deliberate about this: "they asked to see inventory, but I don't think they should see each other's inventory; they can ask each other." This is a considered choice about player agency and in-fiction privacy between characters, not a gap to be filled later — do not extend visibility to another player's loadout as part of this story or any near-term follow-on without a separate, explicit decision to reverse this.
- The exact UI/entry point (see Open Questions) — not resolved here.

## Open questions

- **What does "abilities" mean?** The user used the word loosely and it needs a direct answer before design-strategist can scope the UI. Plausible candidates, not mutually exclusive:
  - Ability scores (STR/DEX/CON/WIS/INT/CHA) and their computed modifiers — the literal "ability scores" block already on every character's own sheet.
  - Skills (the `skills[]` badge list — e.g., Athletics, Stealth).
  - Class features / special abilities (the `specialAbilities[]` badge list — e.g., Backstab, Ritual, Wild).
  - Known/prepared spells (the `spells[]` list, possibly just names, possibly with the attack/heal role glyphs already modeled in Story 56).
  - Some combination of the above (e.g., "ability scores + skills" but not spells or special abilities).
  This needs to be answered directly with the user before UI scoping begins — the story intentionally does not guess.
- **Should the existing `partyVisibilityEnabled` gate apply to this new information the same way it applies to HP and conditions today, or should abilities be treated differently** (e.g., always visible regardless of the toggle, since ability scores are arguably less sensitive/spoiler-y than exact HP)? The user didn't address this distinction — needs a decision.
- **What's the entry point?** The user raised this themselves and didn't resolve it: "by clicking on them, maybe that should be the map token, but I think that expands already." The existing map token detail card (hover/tap, already shows conditions, already exists today, already the lowest-friction option since it's already wired to per-token party data) is the most likely candidate given it's already built and already surfaces some of this same category of information — but a party roster list or some other surface is equally plausible and should be design-strategist's call, not resolved here.
- Does this apply to NPC/ally tokens at all, or strictly to other player characters? The user's phrasing ("other human characters") suggests PC-only; flagging in case design-strategist needs it confirmed before touching the token detail card, which is currently shared infrastructure between PC and NPC tokens.
