# Bug: Eoghan's Persona Tab Crashes to Black Screen

**Status**: Ready for implementation (bug fix — no design needed)
**Source**: User bug report

## Symptom

Opening the Persona tab on Eoghan's character sheet produces a black/blank screen. Reported as specific to this one character — the same tab works normally for every other character.

## Investigation notes

- There is no React error boundary anywhere in the app (`rg -l "ErrorBoundary|componentDidCatch" src/` returns nothing). Any uncaught render exception anywhere in the tree will blank the whole page with no visible error — this is the mechanism behind "black screen," whatever the underlying trigger turns out to be for this character.
- The Persona tab's most likely fragile spot is `CharacterSheetViewMode.jsx:1418-1426`, which renders `char.inPlay.map((item, index) => ... {item} ...)`, printing each `inPlay` entry directly as a JSX child. If Eoghan's `inPlay` array contains a non-string entry (e.g. an object, from an older data shape or a bad edit), React throws "Objects are not valid as a React child" during render — a crash exactly localized to whichever character has that malformed entry, matching the reported symptom.
- This is a hypothesis based on reading the render path, not a confirmed root cause — the actual fix needs Eoghan's live `inPlay` (and other persona-tab-rendered fields, e.g. talent/skill data feeding `talentGroups` just above) inspected directly to confirm what's actually malformed.

## Fix

- Inspect Eoghan's character record (persona-tab-relevant fields: `inPlay`, and whatever feeds `talentGroups`/`hasPersonaBadgeContent` just above it in `CharacterSheetViewMode.jsx`) to find the actual malformed value.
- Fix the malformed data (likely a one-off correction to Eoghan's record) and harden the render path so a bad entry degrades gracefully (e.g., coerce/guard non-string `inPlay` entries) instead of crashing the whole tab for anyone.
- Separately worth flagging: adding a top-level React error boundary would turn this entire class of bug (any single bad field taking down the whole page) into a contained, recoverable error instead of a silent black screen — worth considering as a small follow-up, not required to close this specific bug.

## Regression coverage

Add a test rendering the Persona tab with a deliberately malformed `inPlay` entry (or whatever field is confirmed as the actual cause) to confirm it no longer crashes.
