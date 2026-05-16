# Story 20 — Party Intelligence Panel

**Status**: Awaiting design

---

## Consultant analysis

The DM dashboard shows HP, conditions, concentration, and AC for each party member. That covers active combat state well. But during exploration, roleplay, and tactical decision-making, the DM constantly needs a second tier of numbers that are currently invisible: passive skills, saving throw bonuses, and movement speed. Getting any of these requires leaving the dashboard and opening individual character sheets — a significant friction point during live play.

### Passive skills (Perception, Investigation, Insight)

Passive Perception is the most-consulted number in non-combat play. It runs silently in the background of every scene: hidden doors, stealthy creatures, environmental details. The formula is `10 + WIS modifier + proficiency bonus (if proficient)`, plus any item modifiers. Passive Investigation and Passive Insight follow the same formula with INT and WIS respectively. None of these are surfaced anywhere on the dashboard. A DM who cannot see them at a glance is either guessing or breaking the session's flow to tab away.

### Skill proficiency summary

During roleplay scenes, the DM calls for skill checks constantly: Persuasion, Deception, History, Arcana, Stealth. Knowing which characters have proficiency in a skill helps the DM call on the right players and set appropriate DCs. Currently this requires opening each character sheet individually. A compact "who is proficient in X?" view on the dashboard would cover the most common non-combat DM need.

### Saving throw bonuses

When a spell or environmental effect requires a saving throw, the DM needs each character's relevant save bonus immediately. DEX saves for Fireball. WIS saves for Hold Person. CON saves for concentration checks. The formula is `modifier + proficiency bonus (if save-proficient for the class)`. Routing this through the character sheet mid-combat is too slow.

### Movement speed

In tactical play, the DM needs to know whether a character can reach a position, close a gap, or flee before the portcullis drops. Speed is stored in the character's item mods (`MOD_ATTRIBUTES` includes Speed) but is never displayed on the dashboard. Conditions like Restrained (speed 0) and Slow (halved) interact with base speed. The DM currently has no quick reference.

---

## Goal

Surface the key non-combat and tactical stats — passive skills, saving throw bonuses, and movement speed — on the DM dashboard so the DM never needs to leave the page to answer "can she make the Perception check?", "what's his DEX save?", or "can she reach him this turn?"

---

## User stories

1. **As the DM**, I want to see each party member's Passive Perception, Passive Investigation, and Passive Insight scores on the dashboard, so I can adjudicate hidden objects, stealthy enemies, and social deception without opening a character sheet.

2. **As the DM**, I want to see each party member's saving throw bonuses (STR, DEX, CON, INT, WIS, CHA) either at a glance or via a quick expand on their party card, so I can resolve spell effects and environmental hazards without tabbing away mid-combat.

3. **As the DM**, I want to see each party member's movement speed on their party card, so I can answer tactical movement questions instantly without consulting a separate sheet.

4. **As the DM**, I want to see a compact skill proficiency summary per character — which skills they are proficient or expert in — so I know who to call on for which checks and can set appropriate DCs.

5. **As the DM**, I want these stats to update if an equipped item modifies them (e.g., a magic item that grants +5 Passive Perception or increases speed), so the dashboard always reflects actual current stats.
