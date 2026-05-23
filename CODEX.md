# CODEX.md

This file provides Codex-specific working guidance for this repository.

## Story Implementation Alignment

When implementing an approved story, do not treat the story, design brief, prototype, or Architect Notes as vague inspiration. They are approved design direction unless they materially conflict with already-landed code patterns or an explicit user decision.

Before making behavior or UI changes:

1. Read the relevant story in `design/stories/`, any linked brief in `design/briefs/`, the prototype in `design/prototypes/`, and the Architect Notes.
2. Compare those assets against the local code you are editing and the surrounding implementation patterns already present in the repo.
3. Identify material mismatches before coding instead of silently inventing a third approach.
4. If the mismatch is small, prefer the option that preserves local code consistency, unless the story/prototype explicitly requires otherwise.
5. If the mismatch is material, call it out to the user and explain the tradeoff before proceeding.

Default priority for implementation decisions:

- Existing repo conventions and nearby implementation patterns
- Approved story + prototype + design brief
- Architect Notes for build-level details and scope boundaries

These sources should be reconciled together. Do not rewrite established repo patterns unnecessarily, and do not improvise a new UX or behavior when detailed design assets already exist.
