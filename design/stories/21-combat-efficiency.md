# Story 21 — Combat Efficiency: AoE Damage, Condition Tooltips & NPC Concentration

**Status**: Awaiting design

---

## Consultant analysis

Three smaller but high-frequency improvements that would reduce DM cognitive load and friction during combat. They don't require new data or structural changes — they extend existing features to work better in the moments that matter most.

### Multi-target (AoE) damage application

The current "Apply to…" pill row in the DM dice roller requires the DM to apply damage one target at a time. For a Fireball hitting 3 PCs and 5 goblins, the DM must: roll once, tap a PC pill, confirm the damage modal, go back, tap the next PC pill, confirm again, and repeat. In practice, most DMs abandon this flow for AoE spells and do the arithmetic manually. The mechanic is half-useful without multi-select.

The fix is multi-select on the "Apply to…" pill row: the DM selects multiple targets (party members and/or NPC cards from story 10), then applies the rolled amount to all of them in one action. This covers the most common combat spell patterns — Fireball, Lightning Bolt, Shatter, Thunderwave, Hypnotic Pattern — with a single interaction.

### Condition tooltips with mechanical text

The 14 condition chips are present and correct, but conditions in 5e have specific mechanical effects that even experienced DMs cannot always recall under pressure. Prone imposes disadvantage on attack rolls and grants advantage to attackers within 5 feet but disadvantage to ranged attackers. Restrained imposes disadvantage on DEX saves and attack rolls, and grants advantage to attackers. Incapacitated prevents actions and reactions. Paralyzed means auto-critical hits within 5 feet.

The app already renders condition chips with hover/tap interactions (implied by the existing UX patterns). Filling those interactions with the actual mechanical text — one or two sentences, drawn from the 5e SRD — transforms the condition chips from a mnemonic aid into a genuine rules reference. This is a high-value, low-implementation-cost improvement particularly valuable for newer DMs.

### NPC concentration tracking

Story 10 explicitly deferred concentration tracking for NPC spellcasters. This is the right call for the generic NPC MVP, but it creates a meaningful gap for boss encounters. An enemy wizard maintaining Hold Person on the fighter, a vampire maintaining Charm Person, or a hag sustaining Bestow Curse — all require the DM to remember which NPC is concentrating on what spell and to prompt a CON save when that NPC takes damage.

Currently, the NPC tracker (story 10) has no concentration indicator. Adding a toggleable concentration marker to NPC cards — the same pulsing dot pattern used on PC cards, with a field for the spell name — closes this gap without requiring spell slot tracking or a monster compendium. The DM sets it manually when the NPC casts a concentration spell, and clears it when concentration breaks or the spell ends.

---

## Goal

Make three targeted improvements to existing combat features: allow the DM to apply a single damage roll to multiple targets at once; surface the mechanical rules text for conditions directly in the UI; and add a concentration marker to NPC cards for boss spellcasters.

---

## User stories

1. **As the DM**, after rolling damage in the dice roller, I want to select multiple "Apply to…" targets at once — both party members and NPCs — and apply the rolled amount to all of them in a single action, so I can resolve AoE spells like Fireball without tapping through a confirmation modal for each target individually.

2. **As the DM**, I want to see the mechanical effects of a condition (Prone, Restrained, Charmed, etc.) in a tooltip or expanded view when I tap a condition chip on a party member or NPC card, so I don't have to recall the exact rules from memory under time pressure.

3. **As the DM**, I want the condition tooltip to cover the effect on the afflicted creature and on creatures interacting with it (e.g., "attackers have advantage"), so I have the full relevant rules in one place without opening a rulebook.

4. **As the DM**, I want to mark an NPC as concentrating on a specific spell — with a visual indicator on their card matching the concentration dot used for PCs — so I remember to prompt a CON save when that NPC takes damage and know which effect to end if concentration breaks.

5. **As the DM**, I want to clear an NPC's concentration marker with a single tap, so I can resolve concentration breaks quickly without navigating through menus.
