# DM Card Expand — Weapons, Spells & Inventory — Design Brief

> Story 51. A bounded, in-place drawer on each DM party card that answers "what is this character carrying / capable of" in under five seconds, without occluding initiative, without a page load, and without interrupting the player.
>
> Produced by design-strategist. Implementation spec for ux-designer.
>
> **Information tier: 3 (on-demand).** The trigger row is Tier-3-ambient. The content is Tier 3 and must never out-weigh HP, conditions, or death saves on the same card.

---

## 1. Design intent

The DM asked a question they can answer themselves: *"what's your rapier do?" / "does anyone have rope?" / "can you actually still cast that?"* This drawer is the DM leaning over the player's shoulder for three seconds and leaning back. It should feel like **reading a card the player already handed you** — not like opening an app.

Emotionally: unremarkable. This is the one surface on the dashboard allowed to be boring. No glow, no pulse, no accent fills. It appears where the DM's finger already is, answers the question in a bounded rectangle, and gets out of the way.

Mental model reinforced: **the card is a folder.** HP is printed on the front; the loadout is a page you flip to inside it. It is always the *same character's* page, because it opens directly beneath that character's portrait and HP bar.

---

## 2. Structural decision — and why not the alternatives

The story's open question is expand-in-place vs. slide-out/modal. **Expand-in-place wins, with three mandatory constraints.** Reasoning, stated so it isn't relitigated:

| Option | Verdict |
|---|---|
| **Expand-in-place (chosen)** | Occludes nothing. The initiative tracker, NPC section, map panel and every other card's HP remain fully visible and interactive. The character's identity + HP sit directly above the content, so "whose dagger is this" is never a question. Reuses the dashboard's existing vocabulary — DM notes strip, death saves strip, counter wheels, NPC ability reference are all in-place expanders. Identical behaviour on mobile and desktop. |
| Right-edge drawer (World Guide pattern) | **Rejected.** At desktop the DM dashboard's right column *is* the initiative tracker. A 440px right drawer covers the one thing the DM is not allowed to lose during combat. It also puts two drawers in competition for the same edge and the same z-index band. |
| Modal overlay | **Rejected.** Directly contradicts the story ("don't lose my place in the party strip or initiative tracker"). Modals also lose the identity anchor — the DM has to re-read a name to know whose kit they're looking at. |

The three constraints that make expand-in-place safe (all non-negotiable):

1. **Accordion — one card open at a time, dashboard-wide.** Opening card B closes card A's drawer. Prevents the party strip turning into a wall of loadouts.
2. **Bounded height.** Drawer body is capped (`min(48vh, 420px)` desktop / `min(56vh, 380px)` mobile) with internal scroll. The DM learns "opening this costs me about half a screen," every time, predictably.
3. **Scroll anchoring.** On open, if the card header would be pushed above the viewport top, or the drawer's bottom edge would land below the fold, smooth-scroll the *card header* to a stable position. The DM's eye never has to go hunting for the card it just opened.

---

## 3. What earns its place — the reduction

Adding a permanent full-width trigger row to a card that already carries portrait/HP/stepper/Damage-Heal/conditions/concentration/inspiration/talents/XP/coin/notes/death-saves is not acceptable at zero cost. **The cost is paid by the DM notes strip.**

The card's existing full-width notes strip becomes a **half-width segment of a single shared footer band**:

```
BEFORE:  [ ▣ + Note                                        ▼ ]   40px
AFTER:   [ ⚔ Loadout   ⚗2      │      ▣ Notes · 2          ⌄ ]   44px
```

Net card height change: **+4px** (40→44, to meet the 44px touch minimum), for two drawers instead of one. Both segments open into the *same* drawer region below the band — opening Loadout closes Notes and vice versa. This is a deliberate, minor evolution of `DmNotesStrip`'s footprint; its internal design (count badge, accent tint when open, player-shared divider, add-note input) is otherwise unchanged.

The death saves strip continues to mount **below** this band, unchanged, and continues to strip the band's bottom border-radius via `has-death-strip-below`.

---

## 4. Information hierarchy

### Within the card (unchanged priority, drawer inserted at the bottom)

1. HP numerals + bar (Tier 1)
2. Death saves strip, when mounted (Tier 1)
3. Conditions / concentration (Tier 1)
4. Name + portrait + AC
5. Damage / Heal buttons
6. Talents badges, XP / coin (Tier 2)
7. **Footer band — Loadout | Notes (Tier 3 trigger)**
8. **Loadout drawer content (Tier 3, only when open)**

### Within the open drawer — the eye order

1. **ATK and DMG numerals on weapon rows.** Cinzel, the largest and only weighted type in the drawer. These are the payload; everything else is the label for them.
2. **Item / weapon names.** Crimson Text 15px, `--pal-text`.
3. **Quantity numerals** on potions and ammunition. Cinzel, `--pal-gem` — the second-most-asked question after damage.
4. **Tab strip.** High in *reading* order (it tells you what you're looking at), deliberately low in *visual weight* — IM Fell English 11px. It is navigation, not content.
5. Type tags, mod chips, damage-type suffixes. IM Fell English / Crimson 11–12px, `--pal-text-muted`.
6. Equipped ■/□ and attunement ◆ glyphs. Ambient — read without focusing.
7. `↗ Open full sheet` footer link. The deliberate exit.

**Competition resolved:** ATK/DMG numerals vs. item names. Names are longer and left-aligned (natural first fixation), so the numerals must win on *weight and colour*, not position — Cinzel at 15px in `--pal-accent-bright` / `--pal-gem` against Crimson 15px in `--pal-text`. The DM scans the right rail of numbers first, then reads left to the name. This is why the ATK and DMG columns are **fixed-width and right-aligned**: they must form a clean vertical rail. A missing damage value renders `—`, it does not collapse the column.

---

## 5. Annotated wireframes

### 5a. Card footer band — resting (~400px card)

```
┌──────────────────────────────────────────────────┐
│ ▌[◍] Eoghan                          ⋯   [AC 16] │
│ ▌    Half-Elf · Warlock 5             ↗ Sheet    │
│  ─────────────────────────────────────────────── │
│     31 / 44   [███████████░░░░░]    −    +       │
│     [⚔ Damage]                 [✦ Heal]          │
│  ── conditions · concentration · talents ──────── │
│  ── XP ·  coin ────────────────────────────────── │
│ ①⚔ LOADOUT  ⚗2 ⌄ │② ▣ NOTES · 2               ⌄  │
└──────────────────────────────────────────────────┘
```

① **Loadout segment** — 50% width, 44px tall, full-height tap target. Label `⚔ LOADOUT`: IM Fell English, 11px, uppercase, `letter-spacing: 0.18em`, `--pal-text-muted`. The `⚔` glyph in `--pal-accent` at 0.7 opacity, 6px right margin. Chevron `⌄` right-aligned within the segment, 10px, `--pal-text-muted`. Background transparent at rest; 1px top border `--pal-border`.

**⚗2 consumable badge** — the only ambient data on the trigger. Total quantity across all `type === "potion"` equipment entries. IM Fell English 11px, `--pal-text-muted`; the `⚗` glyph in `--pal-gem` at 0.75 opacity. **Rendered only when the total is ≥ 1** (sparse-first — a party with no potions shows nothing, not a zero). Rationale: this is the one loadout number that decays during a session and that a DM wants without asking. Everything else requires the drawer.

② **Notes segment** — 50% width, existing `DmNotesStrip` collapsed treatment, now scoped to half the band. Separated by a 1px `--pal-border` vertical divider at 60% band height, vertically centred.

**Both-empty case:** a character with zero weapons, zero spells and zero equipment renders the Loadout segment at `opacity: 0.35`, no badge — still tappable (a disabled control creates a "why won't this work" moment; an empty state does not).

### 5b. Open — Weapons tab (default in Combat mode)

```
│ ①⚔ LOADOUT  ⚗2 ⌃ │  ▣ NOTES · 2               ⌄  │
│ ────────────────────────────────────────────────  │
│ ③ WEAPONS │ SPELLS │ ITEMS              ④ ◆ 2/3   │
│ ────────────────────────────────────────────────  │
│ ⑤■ Pact Blade  ◆        ATK +7    1d8+4 force     │
│  ■ Hand Crossbow        ATK +5    1d6+3 piercing  │
│ ⑥□ Dagger               ATK +5    1d4+3 piercing  │
│  ■ Unarmed              ATK +4    1     bludg.    │
│ ────────────────────────────────────────────────  │
│ ⑦                              ↗ Open full sheet  │
└──────────────────────────────────────────────────┘
```

③ **Tab strip** — 32px visible height, 44px touch target via `::before` (matching the `NavSegment` convention in `topNav.css`). Labels IM Fell English 11px uppercase, `0.18em` tracking. Active: `--pal-accent-bright` text over `--pal-accent-dim` background, 1px `--pal-accent` border, `border-radius: 3px`. Inactive: `--pal-text-muted`, transparent, no border. Separated by `·`-free 1px `--pal-border` hairlines. Left-aligned, not stretched — the strip is navigation, it should not span and imply four equal-weight destinations.

④ **Attunement meta** — right-aligned in the tab strip row, IM Fell English 11px. Shows `◆ N/3` **only when N ≥ 1**. Over limit (`4/3`+) renders in `#c06060` — matching the sheet's attunement banner treatment. Zero cost in vertical space; the DM gets attunement state for free while looking at anything.

⑤ **Weapon row** — min-height 40px, padding `8px 12px`, `border-bottom: 1px solid var(--pal-border)` at 0.5 alpha (last row: none).
- **Equipped glyph** ■ / □ — 10px, `--pal-gem` when equipped, `--pal-text-muted` at 0.5 when not. Read-only here (toggling stays owner-side, per story scope).
- **Attunement gem** ◆ — 9px, immediately after the name when `requiresAttunement`: filled `--pal-gem` when attuned, hollow `--pal-text-muted` when not. **No pulse animation** — the sheet pulses it because the player acts on it; the DM only reads it.
- **Name** — Crimson Text 15px, `--pal-text`. `flex: 1; min-width: 0;` single line, ellipsis truncation. The name is the only element allowed to truncate.
- **ATK column** — fixed 62px, right-aligned. Label `ATK` in IM Fell English 10px `--pal-text-muted`, value in Cinzel 15px `--pal-accent-bright`.
- **DMG column** — fixed 96px, right-aligned. Dice expression in Cinzel 15px `--pal-gem`, rendered **verbatim from the Damage mod**; damage-type word (if present in the item) trailing in Crimson Text 12px `--pal-text-muted`, allowed to truncate.

**Consistency requirement:** the to-hit and damage strings shown here must be produced by the same computation as the player's Combat-tab weapons quick-reference. DM and player must never see two different numbers for the same weapon. If that logic is currently local to the sheet, extract it — do not reimplement.

⑥ **Unequipped weapon** — name and glyphs at `opacity: 0.5`. **Sorted last** within the tab. An unequipped weapon is almost never the answer to the DM's question.

⑦ **Drawer footer** — `↗ Open full sheet`, right-aligned, IM Fell English 10px uppercase `--pal-text-muted`, hover `--pal-accent`. Opens `/characters/:slug` in a new tab (same target as the header's `↗ Sheet`). This is the story's required escape hatch for anything deeper than a lookup, and it lives at the *bottom* — the DM only reaches for it after the drawer has failed to answer.

### 5c. Open — Items tab (default in Adventure mode)

```
│  WEAPONS │ SPELLS │ ITEMS               ◆ 2/3    │
│ ────────────────────────────────────────────────  │
│ ⑧■ Potion of Healing      POTION            × 3   │
│  ■ Arrows                 AMMUNITION       × 14   │
│  ■ Silk Rope (50 ft)      TOOL                    │
│  ■ Cloak of Elvenkind ◆   WONDROUS                │
│  ■ Bag of Holding         WONDROUS                │
│ ⑨■ Torch                  —                 × 0   │
│  □ Chain Shirt            ARMOR                   │
│ ────────────────────────────────────────────────  │
│                                ↗ Open full sheet  │
```

⑧ **Item row sort order** (computed once per drawer open, never re-sorted while open):
1. `type === "potion"` with `qty > 0`
2. `type === "ammunition"` with `qty > 0`
3. everything else, author order preserved
4. unequipped items, author order preserved

Rationale: the DM's real-time need is consumables. Author order is preserved everywhere else because the player ordered their sheet meaningfully and re-sorting breaks the DM's ability to say "third one down."

- **Type tag** — IM Fell English 11px uppercase, `0.12em` tracking, `--pal-accent` at 0.7. `—` when unset (keeps the column rail intact).
- **Qty** — `× N`, Cinzel 15px `--pal-gem`, right-aligned in a fixed 56px column. Rendered only when `qty != null`.

⑨ **Depleted item** (`qty === 0`) — `× 0` in `#c06060`, name dimmed to `--pal-text-muted`. Matches the sheet's depleted treatment exactly.

### 5d. Open — Spells tab

```
│  WEAPONS │ SPELLS │ ITEMS                         │
│ ────────────────────────────────────────────────  │
│ ⑩[Eldritch Blast] [Hex] [Armor of Agathys]        │
│  [Misty Step] [Hunger of Hadar] [Darkness]        │
│ ────────────────────────────────────────────────  │
│ ⑪ SLOTS REMAINING      I ●●○     II ●○            │
│ ────────────────────────────────────────────────  │
│                                ↗ Open full sheet  │
```

⑩ **Spell tags** — the existing spell/ability tag treatment from the design system, scaled down for the drawer: IM Fell English **13px** (not 16), `letter-spacing: 0.08em`, `padding: 4px 10px`, 1px `--pal-border`, `border-radius: 2px`, `--pal-accent`. Wrapped flex row, `gap: 6px`. Author order preserved.

Tooltip on hover / focus / tap reuses the **existing** `Type: Name` tooltip component already used by the card's talents badges and the sheet's badge rows. Do not invent a second tooltip. When Story 50's richer tooltip content lands, this inherits it for free.

⑪ **Slots remaining row** — 26px, rendered only when `spellSlots` is non-empty. Label IM Fell English 10px uppercase `--pal-text-muted`; per-level roman numeral + filled/hollow pips (`●` available `--pal-gem`, `○` used `--pal-text-muted` at 0.4). Read-only.

**This is a deliberate, bounded duplication of the card face.** Normally I'd delete it — but user story #2 is *"sanity-check what a player says they're casting,"* which is a two-part question ("do they know it" + "can they cast it"). Co-locating both halves of one answer beats de-duplicating across 150px of vertical scroll. It costs 26px and only when the drawer is open on this tab.

### 5e. Row description expand (all tabs)

Tapping any weapon or item row with a `description` expands it inline beneath the row:

```
│  ■ Pact Blade  ◆        ATK +7    1d8+4 force     │
│    ⑫ Summoned blade; counts as magical. Can be    │
│       reshaped as a bonus action on summon.       │
│       ⑬ [STR +1]  [Attack Bonus +2]               │
```

⑫ Crimson Text italic 13px, `--pal-text-body`, `line-height: 1.6`, `padding: 2px 12px 10px 24px`.
⑬ Mod chips — existing modifier chip treatment: IM Fell English 11px, `--pal-text-muted`, 1px `--pal-border`, `border-radius: 2px`, `padding: 2px 7px`, `gap: 5px`.

Rows with no description are **not tappable** and show no chevron — no affordance without a payload. Multiple rows may be expanded at once (unlike the card-level accordion; within a list, expansions are cheap and comparative reading is common).

### 5f. Empty states

Each tab renders one quiet line, not a call to action. Crimson Text italic 13px, `--pal-text-muted`, `opacity: 0.6`, `padding: 14px 12px`, left-aligned:

- Weapons: *"No weapons on this sheet."*
- Spells: *"No spells listed."*
- Items: *"Nothing in inventory."*
- All three empty (drawer opened from the dimmed trigger): a single line replacing the tab strip entirely — *"This sheet has no loadout recorded."* + the `↗ Open full sheet` footer. Do not render three empty tabs.

The empty state is calm and terminal. There is no "Add item" affordance — this surface is read-only by design (story requirement), and offering an action the DM can't take here would be worse than silence.

### 5g. Desktop (~1200px, party column)

The party column is a fixed-width strip; the card does not get meaningfully wider on desktop. The drawer layout is **identical**. Desktop-only additions:

- Row hover: `background: rgba(--pal-accent, 0.06)` + 2px left inset border `--pal-accent` at 0.5. 90ms. Enhancement only.
- Drawer body max-height `min(48vh, 420px)`.
- Tab strip labels shown in full.

---

## 6. Motion & animation spec

```
Drawer opens (Loadout segment tapped):
  Trigger:      tap on ⚔ LOADOUT segment
  Animation:    drawer max-height 0 → measured height;
                content opacity 0 → 1 (120ms, 60ms delay);
                chevron ⌄ rotates 0° → 180°;
                band background transparent → rgba(accent, 0.10)
  Duration:     200ms, cubic-bezier(0.2, 0.8, 0.2, 1)
  Communicates: "a page of this folder opened, downward, from where you touched"

Row entrance stagger (on drawer open and on tab switch):
  Animation:    per-row opacity 0 → 1 + translateY(4px → 0)
  Duration:     140ms ease-out each, 14ms stagger, capped at the first 8 rows
                (rows 9+ appear with row 8)
  Communicates: "this is a list; read it top-down"
  Note:         cap exists so a 30-item inventory doesn't take 500ms to settle

Drawer closes (segment tapped again, Escape, or another card opened):
  Animation:    reverse of open; content opacity → 0 first (70ms), then height
  Duration:     160ms, cubic-bezier(0.4, 0, 0.6, 1)
  Communicates: departures are faster than arrivals — the DM has already
                got what they came for

Accordion displacement (opening card B while card A is open):
  Animation:    A collapses (160ms) and B expands (200ms) SIMULTANEOUSLY,
                not sequentially
  Communicates: "these two are the same drawer moving" — a sequential
                close-then-open reads as two unrelated events and doubles
                the perceived latency

Scroll anchoring (on open):
  Trigger:      drawer open where the card header would leave the viewport,
                or the drawer bottom would fall below the fold
  Animation:    smooth scroll of the CARD HEADER to 12px below the sticky TopNav
  Duration:     260ms, cubic-bezier(0.2, 0.8, 0.2, 1), starting at the same
                frame as the expand (not after it)
  Communicates: "you are still looking at this character"

Tab switch:
  Animation:    outgoing panel opacity 1 → 0 + translateX(∓6px) (80ms);
                incoming opacity 0 → 1 + translateX(±6px → 0) (110ms).
                Direction follows the tab's position relative to the previous one.
  Duration:     ~130ms total, ease-out
  Communicates: "sibling content — you moved sideways, not deeper"

Row description expand:
  Animation:    max-height 0 → measured, opacity 0 → 1
  Duration:     160ms ease-out
  Communicates: "more of this same thing"

Live value change while the drawer is open (poll or WS nudge):
  Trigger:      a qty, ATK, DMG, attunement or slot value differs from
                the rendered value
  Animation:    the CHANGED VALUE ONLY flashes — color → --pal-accent-bright,
                scale 1 → 1.12 → 1
  Duration:     500ms ease-out
  Communicates: "the player just did that, live, while you were looking"
  CRITICAL:     the drawer must NOT re-run entrance animations, must NOT
                re-sort, and must NOT scroll on poll updates. Sort order is
                computed once, at open. Re-sorting under the DM's finger is
                hostile.

Consumable badge (⚗N) count changes:
  Animation:    same 500ms value flash on the badge
  Communicates: "the party's healing supply just changed"

Trigger segment at rest:
  Animation:    none. Instant. It is a static label — animating an idle
                affordance on a card that also carries a death-glow and a
                concentration pulse would steal attention from things that
                actually matter.

prefers-reduced-motion: reduce
  All of the above → 0ms. Opacity swaps only (no transform, no stagger,
  no scale). Scroll anchoring becomes instant (`behavior: 'auto'`).
  The value flash becomes a 500ms color hold with no scale.
```

---

## 7. Interaction model

| Element | Trigger | Immediate response | Committed action | Cancel / undo |
|---|---|---|---|---|
| `⚔ LOADOUT` segment | Tap (44px full-segment target) | Chevron rotates, band tints, drawer expands | Drawer open; any other card's drawer closes; Notes drawer on this card closes | Tap again, or `Escape`, or open any other drawer |
| Tab (`WEAPONS`/`SPELLS`/`ITEMS`) | Tap (44px target) | Active pill moves, panel cross-fades | Tab persisted to `sessionStorage.dnd_dm_loadout_tab` | Tap another tab |
| Weapon / item row **with** description | Tap anywhere on the row | Description expands below | None — read-only | Tap the row again |
| Weapon / item row **without** description | — | No hover state, no cursor change, no chevron | — | — |
| Spell tag | Hover / focus / tap | Existing `Type: Name` tooltip | None | Tap elsewhere / blur / `Escape` |
| `↗ Open full sheet` | Tap | — | Opens `/characters/:slug` in a **new tab** | Browser |
| Equipped ■ / attunement ◆ / qty | — | **Not interactive.** No hover, no cursor change | — | — |

**Explicit non-interactions**, because leaving these open guarantees a bad guess:
- **No editing of anything.** Not qty, not attunement, not equipped, not drop. Story scope, hard line.
- **No swipe between tabs.** The drawer body scrolls vertically inside a vertically-scrolling column inside a page; a third gesture axis in that stack will misfire. Tabs only.
- **No long-press.** Reserved elsewhere on this dashboard (token removal).
- **No search / filter.** Three characters, ~10 items each. A search input would cost 44px and answer nothing.
- **The drawer never auto-closes.** Not on turn change, not on damage, not on a poll, not when the character drops to 0 HP. Something the DM opened deliberately stays open until they close it. (A character going down while their Items tab is open is *precisely* when the DM wants to see the healing potions — see §8.)

**Default tab resolution**, in order:
1. `sessionStorage.dnd_dm_loadout_tab` if the DM has explicitly chosen a tab this session (global key — the DM's mode of thought is campaign-wide, not per-character).
2. Otherwise, mode-derived: active map `mapMode === "battle"` → `WEAPONS`; otherwise → `ITEMS`.
3. Otherwise (no map) → `WEAPONS`.

This mirrors the Counter Wheels panel's established "mode-aware default, last manual choice wins" pattern.

**Open state is not persisted across reloads.** Drawer tab is; drawer openness isn't. A page reload mid-session should return the DM to a clean strip.

---

## 8. Edge cases

| Case | Behaviour |
|---|---|
| All three arrays empty | Trigger segment at `opacity: 0.35`, no `⚗` badge, still tappable → single-line combined empty state (§5f), no tab strip |
| One tab empty, others populated | Tab remains present and tappable; renders its own empty line. Never hide a tab — a missing tab reads as a bug |
| Very long item/weapon name | Single line, ellipsis. ATK/DMG/qty columns never truncate and never shrink |
| Weapon with no Attack Bonus mod | `ATK —` in `--pal-text-muted`. Column preserved |
| Weapon with no Damage mod | `DMG —` in `--pal-text-muted`. Column preserved |
| Damage mod holds a plain integer (e.g. `1`) | Rendered verbatim as `1`. No synthesised `d` notation |
| 30+ equipment entries | Body scrolls internally at the height cap; a 16px bottom fade mask (`--pal-surface` → transparent) signals more content. Row stagger caps at 8 |
| Character at 0 HP / FALLEN | Drawer fully available and unchanged. Death saves strip mounts **below** the footer band as today. This is a high-value moment for the Items tab |
| Player edits loadout while drawer is open | Value flash (§6). **No re-sort, no re-animate, no scroll** |
| Player *deletes* an item while the drawer is open | The row fades out (140ms) and collapses (140ms) in place. Remaining rows do not re-sort |
| Card's Notes drawer is open, DM taps Loadout | Notes collapses and Loadout expands simultaneously (same simultaneous-swap rule as the cross-card accordion) |
| Vellum (light) palette | Every colour is `--pal-*`-derived except: depleted-qty `#c06060`, over-limit attunement `#c06060`. Verify the 0.5-alpha row hairline and the 0.06-alpha hover tint remain visible on parchment — bump to 0.10 alpha on `.vellum` if not |
| Narrow card (<340px effective row width) | ATK + DMG wrap to a second line inside the row, right-aligned as a pair, preserving their relative order. Row grows to ~58px |
| Story 50 lands | A fourth `ABILITIES` tab appends to the strip. No other change. See §10 |

---

## 9. Mobile vs desktop delta

| | 320–560px | 560–900px | ≥900px |
|---|---|---|---|
| Card width | full viewport − 16px | full − 24px | party column width |
| Footer band | 44px, two segments, `⚗N` badge hidden below 360px | 44px, badge shown | 44px, badge shown |
| Tab strip | full labels (`WEAPONS`/`SPELLS`/`ITEMS` fit at 11px) | full | full |
| Drawer body max-height | `min(56vh, 380px)` | `min(52vh, 400px)` | `min(48vh, 420px)` |
| Weapon row | ATK/DMG wrap to line 2 below 340px row width | single line | single line |
| Row hover | none (touch) | none | background tint + left inset border |
| Attunement `◆ N/3` meta | hidden below 360px | shown | shown |
| Scroll anchoring | anchors card header 12px below the sticky TopNav + mobile row | same | anchors 12px below TopNav |

Nothing disappears on mobile except the two ambient badges (`⚗N`, `◆ N/3`) at the narrowest width — both are conveniences, and both are recoverable by opening the drawer.

---

## 10. Story 50 compatibility

This brief is designed so Story 50 can land with **no rework here**:

- Story 50's requirement is explicitly *glance-level, no expand* — so **skills and special abilities belong on the card face**, in the existing talents badge area, not in this drawer. The two stories are not in conflict; they occupy different tiers.
- If Story 50 concludes that the *full* ability list is too long for the card face, the overflow ("+N more") should open **this drawer on a fourth `ABILITIES` tab**, not a new surface. The tab strip is built left-aligned and non-stretched specifically to absorb a fourth entry without relayout.
- Both stories must share the single existing `Type: Name` tooltip component. When Story 50 upgrades tooltip content, the Spells tab inherits it.
- If the two are implemented together, the trigger label should NOT become `⚔ LOADOUT & ABILITIES`. Keep it `⚔ LOADOUT`. Four tabs are self-describing once open, and a two-word trigger label breaks the band's 50/50 split. Stated so it isn't reopened.

---

## 11. Implementation notes for ux-designer

- **CSS prefix**: `.cc-ld-` (card / loadout drawer), alongside the card's existing `.cc-*` namespace in `characterCard.css`.
- Suggested classes: `.cc-ld-band`, `.cc-ld-seg`, `.cc-ld-seg--active`, `.cc-ld-seg-divider`, `.cc-ld-badge`, `.cc-ld-drawer`, `.cc-ld-drawer--open`, `.cc-ld-tabs`, `.cc-ld-tab`, `.cc-ld-tab--active`, `.cc-ld-attune-meta`, `.cc-ld-row`, `.cc-ld-row--unequipped`, `.cc-ld-name`, `.cc-ld-atk`, `.cc-ld-dmg`, `.cc-ld-qty`, `.cc-ld-qty--empty`, `.cc-ld-type`, `.cc-ld-desc`, `.cc-ld-chips`, `.cc-ld-tags`, `.cc-ld-slots`, `.cc-ld-empty`, `.cc-ld-footer`, `.cc-ld-fade-mask`.
- Suggested keyframes (in `dashboard.css` alongside the existing card keyframes): `ccLdRowIn`, `ccLdValueFlash`.
- Palette: all values via `var(--pal-*)` inherited from the card root. No new palette entries required.
- `sessionStorage` key: `dnd_dm_loadout_tab` — `"weapons" | "spells" | "items"` (+ `"abilities"` if Story 50 lands). Global, no slug suffix.
- Accordion state (`openLoadoutSlug`) must live at the **dashboard** level, not per-card, for the cross-card accordion to work.
- `Escape` closes the open drawer; do not swallow `Escape` when a modal is above the dashboard.

---

## 12. Open questions

1. **Consumable badge `⚗N` on the trigger.** I've specified it as the total qty of `type === "potion"` items, hidden at 0. **Assumption**: potions are the consumable a DM tracks ambiently. Alternatives if you disagree: (a) potions + ammunition combined, (b) no badge at all — trigger shows only `⚔ LOADOUT`. Option (b) is the safe fallback and costs the design nothing.

2. **Default tab in Adventure mode = `ITEMS`.** This assumes the "do you have rope?" question dominates outside combat. If your table's adventure scenes are more spell-heavy (rituals, utility casting), `SPELLS` may be the better adventure default. Easy to change; flagging rather than silently choosing for you.

3. **DM notes strip becoming a half-width segment.** This is the reduction that pays for the new trigger, and it slightly shrinks an existing component's presence. If you'd rather keep the notes strip full-width and accept +44px of card height, say so — the drawer design itself is unaffected either way.

4. **Slots row duplicated inside the Spells tab.** I've argued for it (§5d) as bounded, justified duplication. If you'd rather hold the no-duplication line strictly, delete the row; the tab still works.

5. **Should the drawer be reachable from the initiative tracker's PC entries too?** Out of scope as written (card only). Flagging because during combat the DM's attention is often on the tracker rather than the card strip — but adding a second entry point doubles the surface and I'd want to see the card version used first.
