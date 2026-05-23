# NPC Spell and Ability Reference — Design Brief

> Story 23. A persistent, free-text ability reference field on each NPC card so the DM can see, at a glance during combat, what an enemy creature can do on its turn — without consulting an external source.
>
> Produced by design-strategist. Implementation spec for ux-designer.
>
> Visually, structurally, and behaviourally distinct from the existing session-scoped notes strip (Story 10).

---

## 1. Design intent

The DM is mid-combat and an enemy spellcaster's turn comes up. They should find — without breaking eye contact with the table for more than half a second — the two or three things they need to run this creature's turn: a spell list, a special attack, a recharge ability.

**Mental model**: this field is the back of the index card you wrote when you statted this monster. Not a stat block, not a rulebook, not a search interface. The DM's own shorthand in their own format, sitting on the card where they need it.

**Functional goal**: inline, in-place, no-context-loss editing. Tapping into the ability text never leaves the dashboard.

---

## 2. Information hierarchy

Within an NPC card, this priority order must not be disturbed:

1. HP numbers + bar — Tier 1, combat-critical, always-on
2. Conditions row — Tier 1 when present
3. Name + bloodied/dead status
4. **Ability reference — NEW.** Sits here: below conditions, above action buttons
5. Dmg / Heal / +Cond action row
6. Session notes strip — existing bottom drawer, unchanged

The DM reads top-down on an NPC's turn: who is this → how hurt → what can they do → what am I doing to them → what did I scribble last round. Ability reference earns its slot between conditions and actions.

---

## 3. Annotated wireframes

### 3a. Empty state

```
┌──────────────────────────────────────────────────────────┐
│  Goblin Sneak                                   [−] [×]  │
│  [−]  14 / 22   ████████░░░░░░░░░░░░  [+]               │
│  ① + Ability reference                                   │
│  ─────────────────────────────────────────────────────  │
│  [⚔ Dmg]   [✦ Heal]   [+ Cond]                           │
│  ─────────────────────────────────────────────────────  │
│  ▣ + Note                                              ▼ │
└──────────────────────────────────────────────────────────┘
```

① **Empty-state affordance** — `+ Ability reference`. IM Fell English, 10px, uppercase, `letter-spacing: 0.16em`, `pal.textMuted`. Flush left, indented 10px. Padding `4px 0 2px`, touch target padded to 32px height. On hover: color shifts to `npcPal.bright`, no underline. No border, no background, no icon. The quietest possible affordance — bandit cards must not look under-furnished.

### 3b. Populated, collapsed (default)

```
┌──────────────────────────────────────────────────────────┐
│  Drow Priestess                                 [−] [×]  │
│  [−]  31 / 44   ███████████░░░░░░░░░  [+]               │
│  [Charmed]  [Frightened]                                 │
│  ─────────────────────────────────────────────────────  │
│  ② ◆ Spells: Sacred Flame (1d8 rad, DEX DC 13),          │
│      Suggestion (WIS DC 13), Spiritual Weapon 1d8…       │
│      ③ Show more                                         │
│  ─────────────────────────────────────────────────────  │
│  [⚔ Dmg]   [✦ Heal]   [+ Cond]                           │
│  ▣ Notes · 2                                           ▼ │
└──────────────────────────────────────────────────────────┘
```

② **Collapsed text** — leading `◆` glyph (Cinzel, 11px, `npcPal.accent`, 6px right-margin). Text: Crimson Text, 13px, `pal.textBody`, `line-height: 1.55`. Two-line truncate via `-webkit-line-clamp: 2`. Padding `8px 10px 6px`. No inset panel, no border-box — sits on the card surface.

③ **"Show more"** — IM Fell English, 10px, uppercase, `npcPal.accent`. Shown only when text actually overflows the two-line clamp. Toggles to "Show less" when expanded.

### 3c. Populated, expanded

```
┌──────────────────────────────────────────────────────────┐
│  Drow Priestess                                 [−] [×]  │
│  [−]  31 / 44   ███████████░░░░░░░░░  [+]               │
│  [Charmed]  [Frightened]                                 │
│  ─────────────────────────────────────────────────────  │
│  ◆ Spells (DC 13):                                       │
│    • Sacred Flame — 1d8 radiant, DEX save                │
│    • Suggestion — WIS save, charm                        │
│    • Spiritual Weapon — 1d8+3 force, bonus action        │
│    • Hold Person — WIS save, paralyzed                   │
│  ◆ Spider Climb (always active)                          │
│  ◆ Innate: Darkness 1/day                                │
│  ④ Show less                                   ⑤ ✎       │
│  ─────────────────────────────────────────────────────  │
│  [⚔ Dmg]   [✦ Heal]   [+ Cond]                           │
│  ▣ Notes · 2                                           ▼ │
└──────────────────────────────────────────────────────────┘
```

Expanded text preserves source line breaks (`white-space: pre-wrap`). Max height: `min(60vh, 480px)` with internal `overflow-y: auto` scroll. The DM's own bullet characters (•, –, etc.) pass through unmodified.

④ **"Show less"** — same styling as "Show more," left-aligned.

⑤ **✎ Edit pencil** — right-aligned in the same row as "Show less." 12×12px pencil glyph, `npcPal.accent`, padded to 32px touch target. Only appears in expanded mode — from collapsed, "Show more" is the primary intent; "✎" appears only after the DM has already committed to reading.

### 3d. Edit state

```
┌──────────────────────────────────────────────────────────┐
│  Drow Priestess                                 [−] [×]  │
│  [−]  31 / 44   ███████████░░░░░░░░░  [+]               │
│  [Charmed]  [Frightened]                                 │
│  ─────────────────────────────────────────────────────  │
│  ⑥ ┌──────────────────────────────────────────────────┐ │
│    │ ◆ Spells (DC 13):                                │ │
│    │   • Sacred Flame — 1d8 radiant, DEX save         │ │
│    │   • Suggestion — WIS save, charm                 │ │
│    │                                                  │ │
│    └──────────────────────────────────────────────────┘ │
│  ⑦ [Cancel]  [Clear field]               ⑧ [Save]       │
│  ─────────────────────────────────────────────────────  │
│  [⚔ Dmg]   [✦ Heal]   [+ Cond]                           │
└──────────────────────────────────────────────────────────┘
```

⑥ **Inline textarea** — `.input-base` styled. `background: npcPal.track`, `border: 1px solid npcPal.accent`, `borderRadius: 3`, Crimson Text 13px, `padding: 8px 10px`, `min-height: 110px`, `resize: vertical`, `max-height: 360px`. Autofocus on enter; cursor at end. No markdown rendering — plain text, sacred DM formatting.

⑦ **Cancel + Clear field** — `Cancel`: ghost button, `pal.textMuted`, discards edits. `Clear field`: destructive-ghost, `#c06060`, empties the textarea content only (DM must still Save to commit the clear — two-step for safety).

⑧ **Save** — `.btn-primary` style, `npcPal.bright` text, `npcPal.accent` border. On save: returns to expanded read mode. After 4s idle with no interaction (and card is not the active turn), auto-collapses to two-line preview.

**No modal** — inline edit keeps every other card visible and live. The DM never loses spatial awareness of the encounter.

---

## 4. Motion spec

Reuse existing dashboard motion vocabulary. No new keyframes.

| Event | Animation |
|---|---|
| Empty → first text saved | `+ Ability reference` fades out (120ms); populated row fades in (200ms, `max-height 0 → auto`, `opacity 0 → 1`) |
| Show more (expand) | `max-height: 2.6em → scrollHeight`, 220ms ease-out cubic. Label cross-fades to "Show less" (90ms) |
| Show less (collapse) | `max-height → 2.6em`, 180ms ease-in (asymmetric — dismissal is faster) |
| Enter edit mode | Read text fades out (90ms); textarea fades in at same dimensions (90ms); border animates `transparent → npcPal.accent` (120ms) |
| Save success | Textarea → read-mode cross-fade (90ms reverse); single 220ms border-color flash: `npcPal.accent` alpha 0.4 → transparent |
| Save failure | Textarea stays open; border flashes `#c06060` once (220ms); inline error below textarea: "Couldn't save — try again" in `#c06060`, 12px Crimson Text italic |
| Cancel | Textarea → read-mode cross-fade (90ms). No flash. Nothing committed. |
| **Auto-expand on active turn** | When this NPC becomes active in initiative: ability reference auto-expands (220ms ease-out). On turn handoff: auto-collapses (180ms ease-in). **The killer feature — the DM never taps to see abilities on the creature's own turn.** |
| Auto-collapse after edit | Identical to manual "Show less" (180ms ease-in). Fires 4s after save with no interaction, only if card is not the active turn. |

**Zero animation on:** empty-state hover (instant color shift), value changes from a concurrent write (instant swap).

---

## 5. Interaction model

| Action | Trigger | Response | Committed | Cancel |
|---|---|---|---|---|
| Add first abilities | Tap `+ Ability reference` | Label fades out; empty textarea fades in, autofocused | Tap Save or ⌘/Ctrl+Enter | Tap Cancel or Esc — label returns, nothing persisted |
| Read full abilities | Tap `Show more` | Expands inline | None (read only) | Tap `Show less` |
| Edit existing | Tap `✎` (in expanded view) | Read text → textarea, autofocused at end | Tap Save or ⌘/Ctrl+Enter | Tap Cancel or Esc — original text returns |
| Clear all | Tap `Clear field` (in edit mode) | Textarea emptied | Tap Save to commit | Tap Cancel — original text restored |
| Active turn auto-expand | Initiative advances to this NPC | Auto-expands (220ms) | n/a — visual state | Auto-collapses on turn-off; DM can still manually toggle during turn |

**Keyboard**: `Esc` = cancel. `⌘/Ctrl+Enter` = save. Plain `Enter` = newline (DM writes multi-line content).

**Per-card isolation**: opening one card's abilities for edit does not close other cards' expanded states. Each card is independent.

**No confirmation dialogs** — "Clear field" then "Save" is the two-step pattern.

---

## 6. Edge cases

| Case | Behaviour |
|---|---|
| No abilities entered (80% case) | Quiet `+ Ability reference` affordance only. Card looks normal. |
| Whitespace-only on save | Treated as cleared; card returns to empty state |
| Content approaching 255 chars | Character counter appears below textarea when within 30 chars of limit. Soft limit — DM can exceed it but backend truncates at write time. |
| Active turn + DM currently editing | Edit mode is sticky — never auto-collapse a textarea with unsaved input. Auto-expand for the next turn suppressed if already in edit mode. |
| Save fails (network error) | Textarea stays open, inline error shown, DM retains their text |
| End Combat | Removes the NPC entry entirely. `abilities` persists for the lifetime of the NPC entry, not beyond. Recurring villain template persistence is a future story. |
| Multiple NPCs of same type | `abilities` is per-NPC-instance. Two Goblin Sneaks have independent fields. No auto-replicate. |

---

## 7. Responsive behaviour

NPC cards are ~320–380px wide at all breakpoints. No layout variant needed. `min(60vh, 480px)` expanded cap is the load-bearing mobile constraint — keeps action buttons on-screen on a 700px-tall phone viewport even when fully expanded. All touch targets padded to ≥44px.

Desktop only: `title="Edit abilities"` tooltip on `✎` hover.

---

## 8. Resolved decisions

1. **"Survives End Combat"** — `abilities` persists for the lifetime of the NPC entry. Full cross-session reuse of recurring enemies is handled by **Story 24 — NPC Library**, which lets the DM save any NPC card to a persistent library and reload it in future sessions. The `abilities` field in this story is the foundation that makes the library worthwhile.
2. **Auto-expand on active turn** — ✅ **On.** When this NPC becomes the active turn, abilities auto-expand. Auto-collapse on turn-off.
3. **Add Enemy form** — ✅ **Keep it lightweight.** No abilities field at creation. The DM spawns the enemy first (fast), then adds ability reference as a second operation on the card. This is the right ROI tradeoff — spawning multiple enemies should stay frictionless.
4. **Character limit** — ✅ **255 character soft limit** on the `abilities` field. Enforced in the textarea with a character counter shown when within 30 characters of the limit. No hard block — the DM can see they're over but can still save; the backend will truncate at write time if needed. 255 characters is one dense line of spell shorthand or two brief ability entries — enough for the intended use.

---

## 9. Data model (for architect)

- `abilities: string` (optional) on each entry in `npcCombat.npcs[]`. Absent = empty string.
- Written via existing `putNpcCombat` path. No new endpoint, no new auth.
- No changes to existing `notes` field or session-patch path.
- Optimistic update pattern matches existing `commitNpcList` flow in `NpcCombatSection.jsx`.

---

## 10. Distinction from session notes strip

| | Ability reference (new) | Session notes strip (existing) |
|---|---|---|
| Position | Card body, between conditions and actions | Bottom drawer, below actions |
| Persistence | NPC definition lifetime | Session-scoped, discarded on End Combat |
| Chrome | None — `◆` + text on card surface | Strip with border-top, count badge, caret |
| Read affordance | Two-line preview, Show more/less | Collapsed strip, expand caret |
| Edit affordance | Pencil ✎ (expanded view only) | Inline input visible when strip is open |
| Author intent | "I prepared this before the session" | "I'm scribbling this during the fight" |
| Empty state | `+ Ability reference` (inline, lightest) | `+ Note` (in the strip) |

Spatial separation (body vs. drawer) communicates the conceptual difference without labels.

---

## Implementation paths

- `src/features/dmDashboard/NpcCombatSection.jsx` — host for new ability reference UI in the `NpcCard` sub-component
- `src/features/dmDashboard/npcCombat.css` — new classes: `.npc-ability-ref`, `.npc-ability-ref-preview`, `.npc-ability-ref-editor`, `.npc-ability-ref-actions`
- Visual ground truth: wireframes 3a–3d above
