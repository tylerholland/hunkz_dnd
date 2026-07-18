# Feature Story: Fix Ability Score Display in Dice Roller

**Status**: Ready for Architect Notes
**Source**: Player feedback

---

## Goal

The ability check circles in the Dice Roller show 10 / +0 for every stat regardless of the character's actual scores. The character's real scores (e.g. STR 11, DEX 18, CON 12, WIS 15, INT 13, CHA 8) are visible in the Ability Scores profile view but not reflected in the dice roller circles. This means ability check rolls use the wrong values.

The bonus formula the DM uses is floor((score−10)/2), which matches the existing `getAbilityMod` implementation — no formula change needed.

## Root cause

Character stat records in the database use `s.stat` as the field name for the ability name (e.g. `{ stat: "Strength", score: 11 }`). `DiceRoller.jsx` looks up stats via `stats.find(s => s.name === name)`, which never matches, so every circle falls back to the default `{ score: 10, mods: [] }`.

## User stories

1. As a player, I want the ability check circles in the Dice Roller to show my character's actual scores and correct modifiers so that my 2d6 rolls use the right numbers.

2. As a player, I want the session mode ability chips (left column) to show my real modifiers so that I can see them at a glance during play.

## Scope

- In `DiceRoller.jsx`, update the stat lookup to handle both field names: `stats.find(s => (s.name ?? s.stat) === name)`. Apply the same fix to `getAbilityMod` if it reads `s.name` directly.
- In `CharacterSheetSessionMode.jsx`, check the `abilityMods` mapping (line ~471) — if it reads `s.name`, apply the same `s.name ?? s.stat` fix so the session mode chips also show correct values.
- No backend changes. No formula changes. No design changes.
- Verify with Eoghan's character data (stats use `s.stat`) that all six circles show the correct score and modifier after the fix.
