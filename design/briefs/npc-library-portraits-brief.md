# NPC Library with HP and Portraits — Design Brief

> Story 31. Expands and supersedes the Story 24 NPC Library brief. The library now stores name + hpMax + portraitUrl + abilities as the single source of truth for recurring NPC definitions. Three surfaces: in-combat picker (inside Add Enemy form), NPC card `⋯` save flow, and a new advance library editor modal. Portrait images feed directly to battle map tokens — one upload, no re-linking.
>
> Produced by design-strategist. Supersedes `design/briefs/npc-library-brief.md`.
>
> Palette: Ocean (DM dashboard chrome) — `bg #0d0f14`, `accent #6a8fa8`, `gem #8ab4c8`. Fonts: Cinzel (display), IM Fell English (UI labels), Crimson Text (body).
>
> **Depends on Story 29b** for `portraitUrl` on NPC combat objects. If 29b has not shipped, this story must introduce that field itself.

---

## 1. Design intent

The DM is building a bestiary, one creature at a time, mostly without realizing they're doing it. The first time they stat a Goblin Shaman mid-fight — typing its HP, dropping in a portrait, writing two attack lines — that work should never have to be redone. Three sessions later the shaman reappears, and it arrives whole: face, hit points, abilities, one tap away. The emotional goal is **accreting permanence** — the campaign's monsters become *furniture the DM owns*, not paperwork they re-fill each week.

The mental model has shifted from Story 24. Story 24's library was "a sketchpad of monster names." Story 31's library is **the canonical creature record** — name, HP, face, abilities — and the **single source of truth for the portrait that appears on the battle map token.** There is one image per creature, uploaded once, that follows the creature from the library to the combat tracker card to the map token. The DM never uploads the same goblin twice.

The non-negotiable constraint inherited from Story 24 stands: **the library is always a second path, never a required step.** A DM spawning a nameless bandit must feel zero weight from the library's existence. The base Add Enemy flow (name + HP + count) is untouched.

---

## 2. Tier declaration

Per the app's information-tier discipline:

- **Tier 1 — combat-critical**: nothing in this feature is Tier 1. The library is reference infrastructure, not live combat state.
- **Tier 2 — secondary, on-demand**: the in-combat library picker and the `⋯` save flow. The DM reaches for these *between* turns ("spawn the next wave," "keep this one I just built"). They live inside the Add Enemy form and the card menu — present, but quiet.
- **Tier 3 — between-session / management**: the **advance library editor**. Used when no combat is running, building the bestiary in advance. Must be *reachable* from the dashboard but must not occupy combat-time real estate.

This tiering drives the placement decision in §5: the advance editor is a **modal opened from a quiet dashboard entry point**, not a persistent dashboard section, because a persistent section would push Tier-1 combat surfaces down the page for a Tier-3 capability.

---

## 3. Information hierarchy

### 3a. In-combat library picker (inside Add Enemy form, expanded)

1. **The picker list** — full-width, scrollable, MRU-first.
2. **Each row's portrait thumbnail + name** — thumbnail anchors the row's identity (eye scans left, hits the face first, then the name).
3. **The HP preview chip** `♥ 27` — tells the DM what HP this spawn will pre-fill with.
4. **The ability preview** (two-line clamp) — demoted below HP because at spawn time HP is the more urgent confirm.
5. **The row delete `×`** — right-aligned, lowest weight.

### 3b. NPC card `⋯` overflow menu (save flow)

1. **Save to library** / **Update existing '[Name]'** — primary intent.
2. Remove enemy — destructive, divider-separated, error red.

### 3c. Advance library editor (new — modal)

1. **The entry list** (left rail, MRU-first) — portrait thumbnail + name + HP chip.
2. **The selected entry's editor panel** — portrait (largest, top-left), then name, then HP, then abilities.
3. **`+ New entry`** — bottom of the list, dashed.
4. **`⧉ Duplicate` / `🗑 Delete`** — lowest weight, revealed on the selected entry.

The portrait dominates the editor panel deliberately: this is where the DM curates the creature's identity, and the face is what they're most often there to set.

---

## 4. The three surfaces — annotated wireframes

### Surface A — In-combat library picker (expanded, populated)

```
┌──────────────────────────────────────────────────────────┐
│  ADD ENEMY                                                │
│                                                           │
│  [ Name…                              ]  [ HP  ]          │
│  Count: [ 1 ]                                             │
│                                                           │
│  [          + Add Enemy          ]                        │
│                                                           │
│  Use + Init on a card to add it to the turn order.        │
│                                                           │
│  ◆ Hide library                              ① × Close    │
│  ┌──────────────────────────────────────────────────────┐│
│  │ ②[◔]  ③ Goblin Shaman          ④ ♥ 27       ⑦ ×     ││
│  │       ⑤ ◆ Hex (DC 12); Sacred Flame 1d8… ⑥+2 more   ││
│  ├──────────────────────────────────────────────────────┤│
│  │ [◔]   Goblin                     ♥ 7          ×     ││
│  │       ◆ Scimitar +4, 1d6+2; Nimble Escape           ││
│  ├──────────────────────────────────────────────────────┤│
│  │ [MV]  Malachar the Undying       ♥ 187        ×     ││
│  │       ◆ Legendary Resist (3/day); Paralyzing Touch… ││
│  └──────────────────────────────────────────────────────┘│
│   ⚙ Enemies Gallery                                        │
└──────────────────────────────────────────────────────────┘
```

**①  `× Close`** — IM Fell English 10px, `pal.textMuted`. Unchanged from Story 24.

**②  Portrait thumbnail `[◔]`** — 32px circle, left-most. If `portraitUrl` set: circular image, 1px `npcPal.actionBorder` ring. If not set: first letter(s) initials in Cinzel 14, `npcPal.bright` on `npcPal.chipBg`. Fallback is calm, not a broken-image affordance.

**③  Name** — Cinzel 14, `npcPal.bright`. Truncate with ellipsis + `title` tooltip when long.

**④  HP preview chip `♥ 27`** — IM Fell English 11px, `npcPal.accent`. Heart glyph `♥` + the entry's `hpMax`. Right-aligned on the name row, left of the `×`. **Omitted entirely when `hpMax` is absent/0** — no `♥ —` placeholder. A creature with no default HP shows no chip; the spawn HP field stays blank for the DM to fill.

**⑤  Ability preview** — Crimson Text 11, `pal.textBody`, `opacity:0.85`, leading `◆` glyph, two-line clamp. First 2 abilities joined with ` · `.

**⑥  `+N more`** — IM Fell English 10px `pal.textMuted`, appended inline when `abilities.length > 2`.

**⑦  Row delete `×`** — IM Fell English 13px `pal.textMuted`, 32px target. Two-tap inline confirm, 6-second auto-dismiss.

**Tap a row**: name pre-fills the Name input, HP pre-fills the HP input with `hpMax`, abilities + `portraitUrl` staged for spawned NPCs, picker collapses, **focus returns to the Count stepper** (changed from Story 24 — HP is now pre-filled, so the DM's next decision is *how many*). MRU bump fires as a background write.

**`⚙ Enemies Gallery` link** (bottom of picker) — IM Fell English 11px uppercase, `letter-spacing: 0.18em`, `pal.textMuted`, `⚙` glyph in `npcPal.accent`. Opens the advance editor modal. This replaces Story 24's inline `+ New library entry` form — portrait upload needs the full editor's space.

#### Surface A — empty library

```
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
│                                                          │
│   Library is empty.                                      │
│   Save an NPC from its ⋯ menu, or build creatures        │
│   in advance from  ⚙ Enemies Gallery  below.              │
│                                                          │
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

#### Surface A — search (>20 entries)

Slim search input at picker top. Matches name + joined abilities, case-insensitive substring.

### Surface B — NPC card `⋯` overflow menu (save flow)

Card header gains the `⋯` button between `+ Init` and `×`.

#### B1 — Fresh save (no name conflict)

```
                              ┌────────────────────────────────┐
                              │ ① Save to library              │
                              │    ② [◔] Goblin · ♥ 27 · 3 abl │
                              ├────────────────────────────────┤
                              │ × Remove enemy                 │
                              └────────────────────────────────┘
```

**①  Save to library** — Crimson Text 14, `npcPal.bright`, `◆` glyph `npcPal.accent`, 44px target.

**②  Save preview line** — 20px portrait thumb (or initials) + name + `♥ {hpMax}` + `N abl`. Shows exactly what will be captured: if the card has a `portraitUrl`, the thumb shows it, making visible that *saving captures the image already on the card*.

#### B2 — Name conflict (existing entry, same name)

```
                              ┌────────────────────────────────┐
                              │ ① ALREADY IN LIBRARY:          │
                              │    "Goblin"                    │
                              ├────────────────────────────────┤
                              │ ② Update existing entry        │
                              │    [◔] ♥ 7 → ♥ 27 · 3 abl      │
                              │ ③ Save as new entry            │
                              ├────────────────────────────────┤
                              │ × Remove enemy                 │
                              └────────────────────────────────┘
```

**②  Update — delta preview**: `♥ 7 → ♥ 27` when HP differs, new portrait thumb when changed. When nothing material differs, the delta line collapses to the standard `[◔] ♥ 27 · 3 abl`. The DM sees exactly what an update will overwrite before committing.

**Commit feedback**: `✓ Saved` 220ms in `npcPal.bright` before dismiss. Unchanged from Story 24.

### Surface C — Advance library editor (new — modal)

Opened from the dashboard top-bar `⚙ Enemies Gallery` entry, or the picker's `⚙ Enemies Gallery` link. Two-pane on desktop; single-pane-with-back on mobile.

#### C1 — Desktop (≥720px) — two-pane

```
┌─────────────────────────────────────────────────────────────────────┐
│  NPC LIBRARY                                                  ① ×    │
│ ┌───────────────────────┬─────────────────────────────────────────┐ │
│ │ ② [search…]           │ ⑦  ┌─────────┐                          │ │
│ │ ┌───────────────────┐ │    │  [◔]    │  ⑧ Replace · Remove      │ │
│ │ │③[◔] Goblin Shaman │ │    │  84×84  │                          │ │
│ │ │    ♥ 27  · 3 abl ▸│ │    └─────────┘                          │ │
│ │ ├───────────────────┤ │                                          │ │
│ │ │ [◔] Goblin        │ │  ⑨ NAME                                  │ │
│ │ │    ♥ 7   · 2 abl  │ │    [ Goblin Shaman                    ]  │ │
│ │ ├───────────────────┤ │                                          │ │
│ │ │ [MV] Malachar…    │ │  ⑩ DEFAULT HP                            │ │
│ │ │    ♥ 187 · 6 abl  │ │    [ 27 ]                                │ │
│ │ └───────────────────┘ │                                          │ │
│ │                       │  ⑪ ABILITIES                             │ │
│ │ ④ ＋ New entry        │    ◆ Hex (DC 12), 1d6 necrotic     ×   │ │
│ │                       │    ◆ Sacred Flame 1d8 radiant      ×   │ │
│ │ ⑤ ⧉ Duplicate        │    [ add ability…              ] [ + ]  │ │
│ │ ⑥ 🗑 Delete           │              ⑫ 218 / 255                 │ │
│ │                       │                                          │ │
│ │                       │  ⑬ [        Save changes        ]        │ │
│ └───────────────────────┴─────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**①  Modal close `×`** — Esc closes. Dirty-guard on unsaved edits (see §9).

**②  Search** — shown when `templates.length > 20`. Name + abilities substring match.

**③  Entry row** — portrait thumb + name + `♥ HP · N abl`. Selected row: `npcPal.chipBg` background + 3px `npcPal.accent` left accent bar + `▸` chevron. MRU-sorted.

**④  `+ New entry`** — dashed-border row at list bottom. Creates blank entry, selects it, focuses Name field, portrait shows upload empty state.

**⑤  `⧉ Duplicate`** — visible only when an entry is selected. Copies all fields into a new entry named `{name} (copy)`, selects the copy, focuses Name field with text selected for immediate rename.

**⑥  `🗑 Delete`** — two-step inline (tap → `[Delete] [Cancel]`), error red. No undo.

**⑦  Portrait** — 84×84 circle. Image or initials fallback. Largest element — the curation focus.

**⑧  `Replace · Remove`** — `Replace` opens file picker → presign → S3 → URL (see §6). `Remove` clears `portraitUrl` to initials (two-tap confirm).

**⑨  Name** — `.input-base`, Crimson Text 16. Required.

**⑩  Default HP** — `.input-base`, numeric, optional. Empty = no HP chip on picker rows, blank pre-fill at spawn.

**⑪  Abilities list** — `AbilitiesListEditor` helper (same component as the live card's edit mode). Per-entry rows with `×`, an add input, `[+]`.

**⑫  Char counter `218 / 255`** — per-ability-entry, identical cap to the live card (Story 23). Counter turns `#c06060` at 255. Multi-entry is the intended escape for long-form notes (Lich lair actions go in as multiple entries). The library does not impose a tighter cap.

**⑬  Save changes** — `.btn-primary`. Writes library, bumps `updatedAt`, stays in editor (stays open for continued curation), shows inline `✓ Saved` 220ms. Disabled until dirty.

#### C2 — Mobile (<720px) — single-pane with back

List fills the modal. Tapping an entry slides the editor in from the right (220ms ease-out). `‹ Enemies Gallery` back row returns to the list. Portrait at 72px. Save button sticky at the bottom of the editor pane.

---

## 5. Advance editor placement

**Decision: a modal opened from a quiet dashboard top-bar entry.**

- **Entry point**: `⚙ Enemies Gallery` text button in the DM dashboard top bar, in the existing management-affordance cluster (alongside `Manage Party` and World Guide). Reads as "campaign setup," not "combat tool."
- **Also reachable** from the picker's `⚙ Enemies Gallery` link.
- **Not a dashboard section**: a persistent section would push Tier-1 combat surfaces down the page for a Tier-3 capability.
- **Not a new route**: a full page fragments the DM's session context. The modal overlays the dashboard, preserving live combat state behind it.

Modal: `.modal-overlay` + `.modal-panel`, `max-width: 720px`, `max-height: 85vh`, panes scroll independently.

> **Top-bar label: resolved as `⚙ Enemies Gallery`.**

---

## 6. Portrait upload flow

**Reuse the existing presign → S3 → URL pattern. Recommendation: reuse `/maps/presign` rather than adding a new endpoint.** Both target the same `hunkz-dnd-portraits` bucket. Adding a third near-identical Lambda for a semantic boundary users never perceive is cost without benefit. The architect may override for a distinct S3 prefix (`npc/`); the UX is unaffected.

**Where upload lives**:
- **Advance editor** (Surface C): `Replace` button on the 84px portrait. Primary, roomy path.
- **Live NPC card** (Story 29b): the card already has portrait upload. Saving the card to the library captures the `portraitUrl` that's already on the card. No double-upload.

**The flow the DM sees**:
1. Tap `Replace` → native file picker.
2. File selected → portrait circle immediately shows a **local preview** (object URL) with a subtle upload shimmer overlay + thin determinate progress ring around the circle.
3. Client requests presigned URL, PUTs to S3.
4. On success: shimmer fades (180ms), progress ring completes and fades, `portraitUrl` set on working entry. DM must still tap **Save changes** to persist.
5. On failure: preview reverts to prior portrait (or initials), inline `Couldn't upload — try again` in `#c06060` Crimson italic 12px below portrait.

**Size/validation**: soft client-side warning above ~2MB, max ~5MB with inline rejection message. Accept `image/png`, `image/jpeg`, `image/webp`. Hard server enforcement is the architect's call.

**No portrait set — initials fallback (everywhere)**:
- Circle: `npcPal.chipBg` fill, 1px `npcPal.actionBorder` ring.
- Initials: first letter of each of the first two whitespace-separated name words, uppercased, max 2 chars (`Goblin Shaman` → `GS`, `Malachar the Undying` → `MU`). Cinzel, `npcPal.bright`.
- Calm and intentional — reads as "a creature without a face yet," never a broken image.

---

## 7. Spawn UX — auto-numbering

**Decision: auto-suffix is the default when count > 1. Opt-out, not opt-in.**

```
┌──────────────────────────────────────────────────────────┐
│  ADD ENEMY                                                │
│                                                           │
│  [ Goblin                             ]  [ 7  ]           │
│  Count: [ 4 ]            ① ☑ Number them (Goblin 1–4)     │
│                                                           │
│  [          + Add 4 Enemies          ]                    │
└──────────────────────────────────────────────────────────┘
```

**①  `☑ Number them` toggle** — appears *only when Count > 1*. IM Fell English 11px, `pal.textMuted`, checkbox `npcPal.accent`. Checked by default. Preview text `(Goblin 1–N)` updates live as Count changes. Unchecking spawns N identically-named cards.

**What pre-fills on pick**: Name (editable), HP (`hpMax`, editable override), abilities (staged, independent copy per spawn), `portraitUrl` (staged, same URL per spawn, that's the point). **Count** stays at whatever it was; focus returns to the Count stepper (HP is pre-filled, so Count is the DM's remaining decision).

**Numbering rule**: when on and Count = N, spawned names are `{name} 1` … `{name} N`. The number is part of the NPC's `name` field — rides into initiative and map token label automatically. When Count = 1: no number suffix ever. `Malachar the Undying` spawns as exactly that.

**Unique villain vs. generic creature**: no type toggle. Count = 1 never numbers (unique villain case). Count > 1 numbers by default (generic creature case). The spawn moment decides — no upfront classification needed.

---

## 8. Token visual differentiation

**Decision: a number badge bottom-right of each token, shown only when the token name ends in a trailing integer.**

```
   ┌─────────┐
   │  [◔]    │
   │   Goblin│ ②
   └────●3───┘   ← ① number badge, bottom-right
```

**①  Number badge** — 16px circle (18px on DM side), `npcPal.surfaceSolid` fill, 1px `npcPal.accent` ring, integer in Cinzel 11px `npcPal.bright`. Pinned `bottom: -2px; right: -2px` on the token. **Rendered only when the name matches `/\s(\d+)$/`**. Malachar gets no badge. A single Goblin (Count 1) gets no badge.

**②  Name label** — Story 29's existing label, unchanged. For numbered tokens it reads `Goblin 1` etc. Badge and label are intentionally redundant: badge is glanceable at small zoom; label is precise on hover.

**Why a badge, not a per-token color ring**: a color ring requires storing a per-token color (new data per spawn) and adds the cognitive load of "remember the red goblin." The badge derives entirely from the existing `name` field — **zero new per-token data**. The token layer shape is unchanged; the number is parsed from `name` at render time.

Players see the same badge. No schema slot needed.

---

## 9. Duplicate entry

In the advance editor (Surface C, ⑤), `⧉ Duplicate`:
1. Visible only when an entry is selected.
2. Tap: deep-copies name, hpMax, portraitUrl, abilities[] into a new entry with new `id`, name `{name} (copy)`, `updatedAt = now`.
3. New entry selected; Name field focused with text selected for immediate rename.
4. Fully independent from moment of creation.
5. Original's `updatedAt` not touched.
6. Copy shares the same `portraitUrl` string (same S3 object). Replacing the copy's portrait uploads a new object and repoints only the copy.

---

## 10. Motion & animation spec

All durations assume `prefers-reduced-motion: no-preference`; reduce → instant.

**Picker expand/collapse**: max-height 0↔scrollHeight, opacity 0↔1. Expand 220ms ease-out cubic + row stagger 30ms (first 6 rows, translateY -2px→0). Collapse 160ms ease-in.

**Picker row tap (pick template)**: row flashes `npcPal.chipBg` (120ms). Picker collapses (160ms). Count stepper receives focus after 80ms.

**`⋯` popover open/dismiss**: scale(0.94)→scale(1) + opacity 0→1, transform-origin top-right, 140ms ease-out cubic. Dismiss reverses, 100ms ease-in.

**Save committed (`✓ Saved`)**: tapped row swaps label, 220ms hold, then popover dismisses.

**Advance editor modal open**: overlay fades in (160ms). Panel scales 0.97→1 + opacity 0→1, 200ms ease-out cubic.

**Editor list → entry select (desktop)**: right pane cross-fades content (90ms out / 130ms in). Selected row gains accent bar instantly.

**Editor list → entry select (mobile)**: editor pane slides in from right (220ms ease-out, translateX 12px→0 + opacity). Back reverses (180ms ease-in).

**Duplicate created**: new row inserts at list top — max-height 0→auto, opacity 0→1, 180ms ease-out. Editor pane cross-fades. Name field text auto-selects.

**Portrait upload**: local preview instant. Shimmer + progress ring during upload. On success: shimmer fades 180ms, ring completes + fades 180ms. On failure: preview reverts 120ms, error fades in.

**Portrait remove**: two-tap; confirm cross-fades portrait to initials fallback (160ms).

**Auto-number toggle appear** (Count crosses to >1): fade in 140ms. Preview text updates instantly as Count changes.

**Map token number badge**: appears with the token's Story 29 drop animation. Static at rest.

**Row delete**: first tap → inline `[Delete][Cancel]` expands (max-height 0→32px, 180ms ease-out). Confirm: row collapses + translateX(8px) + opacity→0, 220ms ease-in. Cancel/auto-dismiss reverses 180ms ease-in.

---

## 11. Edge cases & empty states

| Case | Behaviour |
|---|---|
| Library empty, picker opened | Dashed empty state; copy points at `⋯` menu and `⚙ Enemies Gallery`. |
| Library empty, editor opened | List shows only `+ New entry` + one-line instructive copy. Editor pane shows placeholder until an entry exists. |
| No portrait set | Initials fallback everywhere (picker thumb, save-preview, editor 84px, map token, save-back delta). Never a broken-image glyph. |
| No `hpMax` | No `♥` chip anywhere; HP field blank at spawn. |
| No abilities | Picker row shows `(no abilities saved)` italic muted; `0 abl` in save-preview. |
| Ability at 255 chars | Counter turns `#c06060`; hard-stops at 255. Same cap as live card (Story 23). Multi-entry is the escape valve for long notes. |
| Very long NPC name | Truncate with ellipsis + `title` tooltip in rows. Map token label truncates per Story 29. Badge unaffected. |
| Very large library (50+) | Picker and editor list scroll; search present (>20). No virtualization needed at this scale. |
| Save-back, card renamed mid-session | Name-match is case-insensitive + trimmed. Renamed card → fresh-save variant. Save-preview shows current card name so DM sees what's being saved. |
| Upload fails | Inline error; prior portrait preserved; entry not corrupted. |
| Upload succeeds, modal closed without Save | Dirty-guard: `Discard changes` discards working `portraitUrl` (S3 object orphaned — acceptable, matches map-library behavior). `Keep editing` returns. |
| Spawn HP override | DM edits HP field after pick; spawned NPCs use override; library `hpMax` untouched. |
| Spawn with numbering, DM removes one card | Remaining cards keep their numbers (`Goblin 1, 2, 4` after removing 3). No re-numbering — numbers are identity. |
| Duplicate of a duplicate | Allowed. `Goblin (copy) (copy)`. DM renames. |
| Two entries same name (`Save as new`) | Both shown; duplicate names permitted. |
| End Combat | Library untouched. Spawned cards cleared. |
| `npc-library` sentinel absent (first access) | `GET /npc-library` → `{ templates: [] }`. Empty states render. First save creates the row. |
| Portrait S3 object deleted out-of-band | `onError` fallback to initials. Treat failed image load as "no portrait." |

---

## 12. Dirty-guard

Closing the editor (`×` / Esc / backdrop) with unsaved edits shows a 2-button inline bar at the modal footer: `Discard changes` / `Keep editing`. Not a nested modal — an inline bar, consistent with the app's inline-confirm pattern. The library never auto-saves a half-built entry.

---

## 13. Mobile vs. desktop delta

| Surface | < 560px (phone) | ≥ 720px (desktop) |
|---|---|---|
| Picker | max-height `min(50vh, 320px)`, thumb 28px | max-height `min(50vh, 360px)`, thumb 32px |
| `⋯` popover | `min-width: 180px`, shifts left to stay on-screen | `min-width: 200px`, top-right anchored |
| Advance editor | Single-pane drill-in, portrait 72px, Save sticky bottom | Two-pane, portrait 84px |
| Editor abilities list | Full-width rows, `[+]` below on <380px | Inline `[input] [+]` |
| `☑ Number them` | Wraps below Count stepper if tight | Inline right of Count |
| Map token badge | Identical | Identical |

Nothing disappears on mobile.

---

## 14. What carries forward unchanged from Story 24

- Picker is an inline expandable section inside Add Enemy (not modal, not native dropdown).
- Save flow via the `⋯` overflow menu; card's `×` stays put.
- Name conflict → 3-choice (Update / Save as new / dismiss), no silent de-dupe.
- Delete is two-tap inline with 6-second auto-dismiss.
- MRU sort by per-entry `updatedAt`; bumps on both save and pick.
- Search input appears above 20 entries; matches name + joined abilities.
- No polling — mount-fetch + refetch-on-write.
- `✓ Saved` 220ms affirmation is the only success feedback.
- No "saved-to-library" badge on the card.

## 15. Changes vs. Story 24's brief (flag for reviewers)

1. Picker rows now show portrait thumbnail (left) and HP chip (right).
2. Pick pre-fills HP from `hpMax`; focus after pick moves to Count (not HP).
3. Inline `+ New library entry` form **removed** from picker; creation routes to the advance editor modal.
4. New surface: the advance editor modal, opened from `⚙ Enemies Gallery` in the dashboard top bar.
5. New: portrait upload (editor `Replace`/`Remove`), presign→S3 flow.
6. New: `⧉ Duplicate` in the editor.
7. New: auto-numbering on Count > 1 (default on, opt-out toggle) and map token number badge.
8. Save preview + update delta lines in the `⋯` popover.

---

## 16. Open questions

1. **Presign endpoint reuse vs. dedicated** — recommend reusing `/maps/presign`; architect's call on S3 prefix.
2. **Provenance tracking `librarySourceId`** — UX works with name-match; architect decides if worth the field.
3. **Top-bar label** — **Resolved: `⚙ Enemies Gallery`**.
4. **Server-side upload size/mime cap** — client spec is ~5MB; architect decides hard enforcement.
5. **Sequencing** — assumes Story 29b shipped `portraitUrl` on NPC combat objects. Architect to confirm; if 29b hasn't shipped, this story must introduce the field itself.
