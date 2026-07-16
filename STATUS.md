# Project Status — last updated 2026-06-15

## What just landed on `main`

| Commit | What |
|---|---|
| `0a9ba07` | Merge Story 24 — NPC Library (name + abilities) |
| `104733d` | Design stories 29b, 30, 31 + briefs; Story 30 open questions resolved |
| `ad0713a` | Story 24 implementation (NPC library, LibraryPicker, ⋯ menu, AbilitiesListEditor) |
| `765440f` | Story 29 — Battle Map Tokens |
| `45f1969` | Story 27 — Player Sheet Session Mode |

**Story 24 (NPC Library, name + abilities) is live in the codebase but the backend hasn't been deployed yet.** Run `sam build && sam deploy` from `/backend` to activate the new `GET /npc-library` and `PUT /npc-library` endpoints and the `npc-library` DynamoDB sentinel.

---

## Pipeline — what's ready to advance

Run `/advance-pipeline` to move these forward. All user questions are resolved; the only gates left are **design review** (after ux-designer) and **build approval** (after code-architect).

### → Needs `ux-designer`
- **Story 30 — Counter Wheels** (`design/stories/30-counter-wheels.md`)
  - Brief: `design/briefs/counter-wheels-brief.md`
  - All open questions resolved (fill = clockwise fill-to-here, `filledCount: number`, min 1 segment, no remove confirm, optimistic sync)

- **Story 31 — NPC Library with HP and Portraits** (`design/stories/31-npc-library-portraits-hp.md`)
  - Brief: `design/briefs/npc-library-portraits-brief.md`
  - Enemies Gallery (top-bar label resolved)
  - Remaining open questions are architect-level (presign endpoint, provenance) — don't block ux-designer

### → Needs `design-strategist` (brief + UX Design section)
- **Story 29b — Battle Map Token Polish** (`design/stories/29b-battle-map-token-polish.md`)
  - No brief yet; open questions are UX decisions for the strategist to resolve

---

## Key decisions made this session

| Topic | Decision |
|---|---|
| Counter Wheels fill model | Fill-to-here clockwise (Blades-classic). `filledCount: number`, not `boolean[]` |
| Counter Wheels segment floor | Minimum 1 (binary clock = notched ring) |
| Counter Wheels remove confirm | No confirm — hover → menu → click is sufficient gating |
| Counter Wheels data sentinel | `slug: "counter-wheels"`, NOT wiped by End Combat |
| NPC Library advance editor label | **Enemies Gallery** (`⚙ Enemies Gallery` in DM dashboard top bar) |
| Story 24 vs Story 31 | Story 24 merged as foundation; Story 31 builds on it with HP + portraits |
| Story 24 scope | Name + abilities only (no HP, no portraits — those are Story 31) |
| NPC Library token badge | Number parsed from trailing integer in name (`/\s(\d+)$/`), zero new token data |
| NPC Library fill semantics | Auto-number on Count > 1 (opt-out toggle), unique villains (Count = 1) never numbered |

---

## Active worktrees (can be cleaned up)

The Story 24 worktree has been merged. These worktrees exist but are no longer needed:
```
.claude/worktrees/agent-ac30ad7414fde60ab   ← Story 24 (merged ✓)
```
All other `worktree-agent-*` branches are from prior sessions and are safe to prune.

---

## Things that need attention (not urgent)

- **Backend deploy**: Story 24 backend is undeployed. `sam build && sam deploy` from `/backend`.
- **Story 24 status field**: Still says "Design complete — Ready for Architect Notes" (stale). Could update to "Implemented" but low priority since it's superseded.
- **Old story statuses**: Stories 01–22 have stale status fields (e.g. "Needs architect review") from before consistent status tracking. Don't block anything; cosmetic cleanup only.
- **Story 23**: Status says "Design updated — needs re-implementation (abilities field changed from string to string[])". This was the NPC ability reference story. Story 23 may have been re-implemented already (commit `0d7fb52`). Worth verifying before advancing.
- **`/advance-pipeline` skill**: Lives at `~/.claude/skills/advance-pipeline/SKILL.md`. Works well. Next run will show the three actionable stories above.
