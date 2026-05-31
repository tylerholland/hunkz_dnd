# Death Saves Strip — Design Brief

> Redesign of the death-save tracker. Supersedes the death-save portion of `design/briefs/death-saves-round-tracking-brief.md` §3a. Round counter and damage-at-0 logic from that brief remain unchanged; only the death-save tracker's geometry, placement, and reveal pattern change.
>
> **Story:** `/Users/tyler/Projects/dnd/design/stories/19-death-saves-and-round-tracking.md`

---

## 0. Why this redesign

Version A (the shipped form) is a boxed mid-card panel. It works, but it interrupts the card's vertical rhythm — a form embedded between conditions and footer, with its own left-bar accent fighting the card's red 0-HP border. Under combat load, the DM's eye has to re-acquire what part of the card it's looking at every time the panel appears.

Version B (the bottom strip prototype) solves the visual integration: a slim footer that *belongs* to the card's anatomy, sitting below the Notes strip as the very last element, reading as "card status" rather than "embedded widget." The problem is it dropped every action affordance — only pips remained.

This brief reconciles both: **keep the strip's belonging, restore the shortcuts as a peek-on-demand layer.**

The mental model: the strip is a **state band** that the card grows when a PC drops, ambient at rest, expandable for the special-case actions. The DM taps pips 90% of the time; the shortcuts come into view the 10% of the time a NAT20, NAT1, or external stabilization happens.

---

## 1. Design intent

A footer-strip death-save tracker that is **calm at rest, urgent under pressure, and gets out of the way the moment the moment ends**. The pips are the persistent ambient surface; everything else slides into the band only when asked or demanded. The strip is structural — it extends the card downward, doesn't sit on top of it. When a PC is up, the strip is gone; when a PC drops, the card grows by one slim band; when they die or recover, the band collapses.

---

## 2. Information hierarchy

When `hpCurrent === 0`, ranked by visual weight in the strip itself:

1. **Failure pips (right cluster).** Universal-red filled circles with a soft glow. Right-of-divider — the position the eye rests at after parsing the label. Highest urgency in the entire app.
2. **Success pips (left cluster).** Green filled, no glow. Read first textually (left-aligned after the label), but visually subordinated by the failure glow.
3. **"DEATH SAVES" label.** Small uppercase IM Fell English, red-tinted muted. Anchors the meaning of the row; doesn't shout.
4. **The strip's red wash + red top border.** Card-structural — communicates "this band is the dying zone" without competing for foreground attention.
5. **Shortcut peek affordance (the disclosure chevron).** Recessive — a `⌃` glyph at the right edge. Only the DM who needs NAT20/NAT1/Stable will look for it.
6. **(Behind the disclosure) NAT20 / NAT1 / ✦ Stable pills.** Out of view at rest; revealed below the pip row when the disclosure is opened.

The shortcut pills must NOT compete with the pips. They live behind a one-tap reveal because the pips are the primary surface.

---

## 3. Anatomy

### 3a. Strip at rest (HP = 0, no shortcuts revealed)

```
... card body ends here ...
├──────────────────────────────────────────────────────┤   ① red top border
│ ② DEATH SAVES   ③ ● ● ○  ④│  ⑤ ◆ ◇ ◇         ⑥ ⌃   │   ⑦ red wash
└──────────────────────────────────────────────────────┘
```

① **Top border** — `1px solid rgba(192,96,96,0.45)`. Structural, not injected.

② **"DEATH SAVES" label** — IM Fell English, **11px**, uppercase, `letter-spacing: 0.22em`, colour `rgba(192,96,96,0.65)`. Left padding 12px.

③ **Success pips** — 3 circles, **12px** visible diameter, **gap 8px**. Filled: `#5a9a5a` solid. Empty: transparent, `rgba(90,154,90,0.4)` 1.5px border. Each pip has a **36×40px** tap target.

④ **Vertical divider** — `1px × 16px`, `rgba(192,96,96,0.25)`. Centred vertically.

⑤ **Failure pips** — 3 circles, same size. Filled: `#c06060` with `box-shadow: 0 0 4px rgba(192,96,96,0.55)`. Empty: transparent, `rgba(192,96,96,0.35)` 1.5px border. Same 36×40px tap target.

⑥ **Disclosure chevron** — `⌃` glyph (12px IM Fell English), `rgba(192,96,96,0.5)`, inside **44×40px** tap target at right edge. Rotates 180° when expanded.

⑦ **Red wash** — strip background `rgba(192,96,96,0.07)`.

**Strip dimensions:**
- Height: **40px** resting
- Horizontal padding: `12px` left, `0` right (chevron hugs right edge)
- Layout: `display: flex; align-items: center; gap: 10px;` — label and clusters are flex children; chevron is `margin-left: auto`
- Border-radius: 0 top corners (glued above), card's `4px` bottom corners

### 3b. Strip with shortcuts revealed

```
├──────────────────────────────────────────────────────┤
│  DEATH SAVES   ● ● ○  │  ◆ ◇ ◇                  ⌄   │   pip row (unchanged)
│ ─────────────────────────────────────────────────── │   inner divider
│  ⟨ NAT 20 ⟩   ⟨ NAT 1 ⟩              ⟨ ✦ STABLE ⟩   │   shortcut row
└──────────────────────────────────────────────────────┘
```

**Inner divider** — `1px solid rgba(192,96,96,0.18)` horizontal rule.

**Shortcut pills** — all three: 32px visible / **44px tap target**, padding `8px 12px`, IM Fell English 11px uppercase `letter-spacing: 0.14em`, border-radius 3px, background transparent.

- **NAT 20** — border `rgba(90,154,90,0.5)`, text `#a8c8a8`. Press: bg `rgba(90,154,90,0.15)`. Action: atomic `patchSession({ hpCurrent: 1, deathSaves: {0,0} })`.
- **NAT 1** — border `rgba(192,96,96,0.5)`, text `#d89494`. Press: bg `rgba(192,96,96,0.15)`. Action: add 2 failures (capped at 3).
- **✦ STABLE** — same green family as NAT 20. Action: `patchSession({ deathSaves: {0,0} })`. HP stays at 0. Strip collapses; card dims to 0.85.

NAT 20 and NAT 1 are left-grouped (roll outcomes); ✦ STABLE is right-aligned (external intervention). The asymmetry is semantic.

**Strip dimensions (expanded):** 40px + 1px divider + 48px shortcut row = **89px** total.

### 3c. Damage-at-0 prompt — replaces pip row contents temporarily

```
├──────────────────────────────────────────────────────┤
│  + DAMAGE AT 0   ⟨+1 FAIL⟩  ⟨CRIT +2⟩  ⟨NO FAIL⟩    │
└──────────────────────────────────────────────────────┘
```

- **Label** — IM Fell English 10px uppercase `letter-spacing: 0.16em`, `rgba(192,96,96,0.75)` (one tone brighter than resting label — this is a new event).
- **Three pills**, same dims as shortcut pills.
- **"+1 FAIL"** — red border family, default focus (1.5px border + hairline outer glow).
- **"CRIT +2"** — red border family, no focus ring. Bold the "+2".
- **"NO FAIL"** — muted border `rgba(100,130,160,0.3)`, text `var(--pal-text-muted)`. The only palette-derived colour in the strip — reads as "neutral exit."
- Strip stays 40px. Does NOT coexist with the shortcut row — if shortcuts were open, collapse them first (180ms), then swap to prompt.
- **Auto-resolve to "No Fail" after 12 seconds** if not tapped (safer default: never apply a failure without confirmation).

### 3d. FALLEN state — tombstone

```
├──────────────────────────────────────────────────────┤
│  ⨯  FALLEN                                ◆ ◆ ◆   │
└──────────────────────────────────────────────────────┘
```

- **"FALLEN"** — Cinzel **13px** uppercase `letter-spacing: 0.22em`, `#c06060`. Prefixed by `⨯` glyph (`#a04040`). Cinzel (not IM Fell English) — the app's weight font; the character's life is now a noun.
- **Frozen failure pips** — three filled red pips remain on the right, `filter: grayscale(0.3)`, glow removed. A tombstone record, not an active surface.
- **Chevron hidden.** No shortcuts valid for a dead character.
- **Background** deepens to `rgba(192,96,96,0.11)`. Top border deepens to `rgba(192,96,96,0.6)`.
- **Reversibility** — tapping any frozen pip un-fills it; strip transitions back to active pip row; card un-dims.

### 3e. Stable state — strip collapses

When 3 successes reached (or ✦ STABLE tapped): `deathSaves: {0,0}` written. HP stays 0. Strip collapses (250ms). Card dims to `opacity: 0.85`. No "STABLE" label — the dimmed card communicates "down but safe."

---

## 4. Interaction model

**Pip tap:**
- Empty pip → fill up to that index (inclusive). Write: `{ deathSaves: { successes, failures } }` full object, clamped 0–3. Optimistic.
- Filled pip → un-fill from that index onward.
- 3rd success → stable (§3e). 3rd failure → FALLEN (§3d).

**Chevron tap:**
- Toggles shortcut row. Strip 40px → 89px. Chevron rotates.
- Auto-collapses on: damage-at-0 prompt fires; HP rises above 0; FALLEN state; 30s inactivity.

**NAT 20 / NAT 1 / ✦ STABLE** — see §3b. Single tap, no confirm.

**Damage-at-0 prompt** — see §3c. Any pill resolves immediately; strip snaps back to pip row.

---

## 5. Motion & animation spec

| Event | Animation | Duration |
|---|---|---|
| Strip mounts (HP → 0) | `max-height 0 → 40px`, opacity 0 → 1 | 300ms ease-out |
| Strip unmounts (healed / stable) | opacity out then `max-height → 0` | 250ms ease-in |
| Pip fill — success | Reuse `dmConditionIn` (scale 0.7→1, opacity 0→1) | 180ms ease-out |
| Pip fill — failure | `dmConditionIn` + strip `dmDeathSaveShake` after fill | 180ms + shake 300ms |
| NAT 1 (two failures) | Staggered fills (+60ms offset), one combined shake at +180ms | ~480ms total |
| FALLEN transition | Final shake → cross-fade pip row out / tombstone in → card dim | ~700ms total |
| Resolve glow (NAT20 / Stable / 3rd success) | Green outer glow pulse, then strip unmounts | 400ms glow + 250ms unmount |
| Disclosure expand | `max-height 40 → 89px`, chevron rotates 180°, shortcut content fades in (delayed 100ms) | 220ms ease-out |
| Disclosure collapse | Shortcut content fades out, then `max-height → 40px`, chevron rotates back | 180ms ease-in |
| Damage-at-0 ↔ pip row swap | Cross-fade prompt out, pip row in (slightly delayed) | 150ms + 200ms |
| Reduced motion | All animations instant or colour-swap only; card glow and resolve glow remain |  |

Reuse existing keyframes: `dmConditionIn`, `dmDeathSaveShake`, `dmFadeOut`, `dmConditionOut` (from `dashboard.css`).
New keyframes needed: `dsStripExpand` (shortcut row reveal), FALLEN cross-fade.

---

## 6. Coexistence with Notes strip

Notes strip and Death Saves strip coexist. Death Saves sits **below** Notes. The Death Saves strip's red top border is the visual separator — no gap needed. Death Saves owns the card's bottom corners when mounted. Notes strip stays in its current open/closed state when Death Saves mounts (don't slam it closed).

---

## 7. Colour palette (universal — not palette-derived)

| Token | Value | Use |
|---|---|---|
| Success | `#5a9a5a` | Filled success pip; NAT20 / ✦ Stable pill |
| Success rim | `rgba(90,154,90,0.4)` | Empty pip border |
| Failure | `#c06060` | Filled failure pip; FALLEN label; NAT1/damage pills |
| Failure rim | `rgba(192,96,96,0.35)` | Empty pip border |
| Failure glow | `rgba(192,96,96,0.55)` | Filled failure pip glow |
| Strip wash | `rgba(192,96,96,0.07)` | Resting background |
| Strip wash (FALLEN) | `rgba(192,96,96,0.11)` | Tombstone background |
| Top border | `rgba(192,96,96,0.45)` | Resting |
| Top border (FALLEN) | `rgba(192,96,96,0.6)` | Tombstone |
| Label red | `rgba(192,96,96,0.65)` | DEATH SAVES label |
| Damage label | `rgba(192,96,96,0.75)` | DAMAGE AT 0 label |
| Inner divider | `rgba(192,96,96,0.18)` | Between pip row and shortcut row |
| Vertical divider | `rgba(192,96,96,0.25)` | Between success / failure clusters |
| Chevron | `rgba(192,96,96,0.5)` | ⌃ / ⌄ |
| FALLEN glyph | `#a04040` | ⨯ prefix |
| No-Fail pill | `var(--pal-text-muted)` | Only palette-derived element — the neutral exit |

---

## 8. Size cheat sheet

| Element | Value |
|---|---|
| Strip height (resting) | 40px |
| Strip height (shortcuts revealed) | 89px |
| Strip height (damage-at-0 / FALLEN) | 40px |
| Strip horizontal padding | 12px left, 0 right |
| Pip visible diameter | 12px |
| Pip tap target | 36×40px |
| Pip gap within cluster | 8px |
| Cluster gap (label→success→divider→failure) | 10px |
| Vertical divider | 1px × 16px |
| Chevron tap target | 44×40px |
| Label font | IM Fell English 11px |
| Shortcut / damage pill height visible | 32px |
| Shortcut / damage pill tap target | 44px |
| Pill padding | 8px 12px |
| Pill border-radius | 3px |
| FALLEN label font | Cinzel 13px |

---

## 9. Files to touch

- `src/features/dmDashboard/CharacterCard.jsx` — move death-save block from mid-card slot to below the Notes strip; add `deathShortcutsOpen` boolean local state; add damage-at-0 prompt inside the strip
- `src/features/dmDashboard/characterCard.css` — replace `.cc-death-saves*` block rules with strip rules
- `src/features/dmDashboard/dashboard.css` — add `dsStripExpand` keyframe; add FALLEN cross-fade keyframe; reuse existing `dmConditionIn` / `dmDeathSaveShake`
