# Feature Story: DM Dashboard Ability Modifiers (Wis/Con/Dex)

**Status**: Needs UX design
**Source**: User request
**Prototype**: (leave blank — ux-designer fills this in)

## Goal

Each party card on the DM dashboard already has a "saves strip" (Story 20) showing Passive Perception and Wis/Con/Dex save modifiers. Today every character shows the same defaulted values (Perc 10, all three mods at +0) regardless of their actual ability scores, because the DM party card's data source doesn't include ability scores at all — see Root cause below. The DM asked for this to either be wired up to real per-character data, or, failing that, made into something they can fill in by hand.

## Root cause (confirmed in source)

`CharacterCard.jsx` computes the saves strip from `char.stats?.find((s) => s.stat === "Wisdom")?.score ?? 10` (and similarly for Constitution/Dexterity) — see `src/features/dmDashboard/CharacterCard.jsx:237-259`. That logic is correct *if* `char.stats` is present. It never is: the DM party payload is built by `projectDmPartyItem()` in `backend/src/lib/partyProjection.js`, whose `DM_PARTY_FIELDS` whitelist (line ~17) does not include `stats` at all. So `char.stats` is always `undefined`, every score falls back to the `?? 10` default, and every modifier computes to `Math.floor((10-10)/2) = 0` — matching exactly what was reported ("currently they all are defaulting to 0").

## User stories

- As a DM, I want the Wis/Con/Dex modifiers (and Passive Perception) on each party card to reflect that character's actual ability scores, so I can trust the numbers at a glance instead of them always reading the same regardless of who it is.
- As a DM, if pulling live ability scores isn't the right fix for some reason, I want an alternative way to see this information per character — even a manually-entered value — so the saves strip isn't just permanently wrong/disabled.

## Functional requirements

- Add `stats` to `DM_PARTY_FIELDS` in `backend/src/lib/partyProjection.js` so `projectDmPartyItem()` passes each character's ability scores through to the DM dashboard, the same way it already does for `skills`, `specialAbilities`, etc.
- Once `stats` flows through, confirm the existing computation in `CharacterCard.jsx` (`conScore`/`wisScore`/`dexScore`, `conSaveMod`/`wisSaveMod`/`dexSaveMod`, `passivePerception`) produces correct values with no further changes needed — this is a data-plumbing fix, not a new calculation.
- Resolve the open question below on whether the DM should also be able to override/hand-enter these values, since the user raised it as a real alternative, not just a fallback.

## Data model changes

None for the primary fix — `stats[]` already exists on the character record (it's how the character's own sheet computes its own ability modifiers); this is purely a projection whitelist fix. If the "editable by DM" path is chosen instead of, or in addition to, wiring up real data (see Open Questions), that would need a new DM-writable field (e.g., a per-character override value) — scope TBD by design.

## Out of scope

- Changing how ability scores/modifiers are computed or displayed on the character's own sheet — that logic is already correct and unaffected.
- Any other fields currently missing from `DM_PARTY_FIELDS` that aren't part of this report.

## Open questions

- Given the root cause is a one-line whitelist omission, is there still a reason to also build a manual-entry/override path, or was that suggested by the user only as a workaround in case the "real" fix wasn't feasible? If the DM still wants manual overrides as a separate capability (e.g., for homebrew stat tweaks visible only on the dashboard), that needs its own scoping — it's a materially different feature (a DM-writable field that can diverge from the character sheet) than "fix the data pipe."
- If both are wanted, does a manual override take precedence over the real score when both exist, or is it strictly a fallback for characters with missing/incomplete `stats[]`?
