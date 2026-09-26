# Simplify the Classic Profile View — Design Brief

> Story 59. Removing the Map and Combat tabs from the classic character sheet
> (`/characters/:slug`). Produced by design-strategist as the implementation spec.
>
> This is a subtraction brief. Almost every section below says "unchanged" — the
> load-bearing content is §0 (what removal actually costs), §3 (the tab strip should
> not shrink, it should die), §7 (wayfinding), and §12 (two blocking questions).

---

## 0. Diagnosis — what removal actually costs

Before the layout: an inventory of what the Combat tab holds and where each thing
survives. Two rows do **not** have a surviving home, and they gate this story.

| Combat-tab content | Surviving home | Status |
|---|---|---|
| Concentration banner + set input | Session mode, right column | ✅ covered |
| Inspiration toggle | Session mode, right column | ✅ covered |
| Condition grid (14 conditions) | Session mode `ConditionPickerModal` | ✅ covered |
| **Exhaustion 0–6 stepper** | Session mode picker — **unverified** | ⚠️ **OQ-2** |
| **Spell slots + Long/Short Rest buttons** | Session mode shows slots **read-only**; rests are DM-dashboard party-wide only | 🛑 **OQ-1 — real regression** |
| Weapons & attack-spells quick reference | Session mode Combat sub-tab (identical merge, Story 56) | ✅ covered |
| Session Notes | Session mode `notes` sub-tab | ✅ covered |
| XP / coin live management | **Classic Inventory tab** (already has XP strip + coin section) | ✅ — see §3.3 |
| Dice Roller | Session mode (mounted outside sub-tabs) | ✅ covered |
| Map tab | Session mode Map sub-tab — strictly better (classic has no token layer at all, per Story 57) | ✅ unambiguous win |

**OQ-1 is the one thing in this story that isn't free.** Today a caster marks a slot
spent, or takes a short rest to recover Pact Magic, from the classic Combat tab.
Session mode's slot display is read-only and its rest buttons don't exist. Deleting
the Combat tab therefore removes the player's *only* self-serve way to spend or
restore a spell slot anywhere in the app. That is a functional regression wearing a
presentation-change costume. See §12.

**Note on the story's third open question** ("is there a between-session use case the
Combat tab serves?"): no — reading last session's conditions/concentration off a
between-sessions page is not a real need, and stale session state on a reference page
is actively misleading. The story's "pretty much deprecated" framing is correct for
everything *except* the two rows flagged above, which are live-play needs the classic
tab is currently absorbing by accident.

**Tier declaration.** The real change here is a tier demotion of the whole page:
the classic Profile view goes from **Tier 1 (combat-critical, default tab `"combat"`)**
to **Tier 3 (on-demand reference)**. The Inventory section within it is **Tier 2**.
Nothing on this page is Tier 1 after this story. That single sentence is the design.

---

## 1. Design intent

The classic sheet becomes one continuous, unhurried reading surface — identity, then
what they carry, then who they are — with no live-play instrumentation and nothing
that demands to be watched. Session mode is where the character *acts*; this page is
where the character *is*.

---

## 2. Information hierarchy

Most → least prominent, after this story:

1. **Portrait + name/identity header** — unchanged, and now unambiguously the page's subject
2. **Stats panel** (HP/hit dice/armor, ability scores, skills/spells/abilities badges) — unchanged
3. **Inventory** — the ledger; sits adjacent to the stats panel because item mods are the literal source of the modifier values in the ability-score flyouts
4. **Persona traits** — short flavour; bridges into the backstory below
5. **Collections / backstory viewer** — unchanged, stays last
6. **Footer line** — unchanged

---

## 3. Layout — the tab strip does not shrink, it is removed

### 3.1 Decision

**Remove the tab strip entirely.** A 64px full-width icon+label strip is chrome that
earns its cost only when it compresses a surface you need to switch between *under
time pressure*. Nobody switches between backstory and inventory under time pressure.
With two panels left it would become the loudest element on a page whose content is
otherwise entirely linear, and it would be the *second* navigation mechanism on a page
that already has the Collections section-button nav directly below it. One page, one
nav idiom.

Rejected: keeping a 2-tab strip (a nav control for two always-available reading
sections is chrome without a job). Rejected: folding Inventory/Persona into the
Collections nav (collections are user-authored data; built-in panels masquerading as
collection sections would lie to edit mode).

### 3.2 DOM layer tree

```
.cs-view-root
  TopNav
    .topnav-center → NavSegment [❡ Profile | ⚔ Session]   — NEW (§7.1)
    ⋯ NavMenu — `⚔ Session` item REMOVED (now in the center slot)
  header.cs-identity                                       — unchanged
  .cs-portrait + tagline                                   — unchanged
  ── auth gate (unchanged) ──
  .cs-stats-panel                                          — unchanged
  .cs-vm-notice[data-once]                                 — NEW, conditional, self-deleting (§7.2)
  .divider
  .cs-vm-section[data-section="inventory"]                 — was tab panel `loadout`
    .cs-vm-section-head   "Inventory"
    .cs-attunement-banner                                  — unchanged
    .loadout-grid  (weapons col / equipment col)           — unchanged
    .cs-xp-strip           (xp leveling mode only)         — unchanged
    .cs-coin-section                                       — unchanged
  .divider
  .cs-vm-section[data-section="persona"]                   — was tab panel `persona`
    .cs-vm-section-head   "Persona"                          UNMOUNTS ENTIRELY when inPlay[] is empty
    ul.cs-persona-list (◆ bullets, auto-fill grid)         — unchanged
  .divider
  .cs-collections (label + section pills + content viewer) — unchanged
  footer                                                   — unchanged

DELETED: .cs-tabstrip and its four 64px tab buttons; tab panel `combat`; tab panel `map`
```

**Section order rationale (one line each):** Inventory before Persona because item mods
feed the stat block immediately above it; Persona before Collections because traits and
backstory are the same register and should read as one block; Collections stays last
because it already is and the story says don't touch it.

### 3.3 Section head — reuse, don't invent

`.cs-vm-section-head` is the existing Collections **section title** treatment verbatim:
14px IM Fell English, uppercase, `letter-spacing: 0.2em`, `--pal-accent`,
`margin-bottom: 16px`. Preceded by the existing `.divider`. Zero new visual vocabulary —
the two inlined sections read as peers of the backstory sections they now sit above.

### 3.4 Labels

Keep the visible label **"Inventory"** (what the tab shows today), even though the
internal state value is `"loadout"` and session mode calls its sub-tab "Loadout". Do not
rename either surface in this story — see OQ-4.

---

## 4. Colour tokens

| Token | Role |
|---|---|
| `--pal-accent` | `.cs-vm-section-head` label text |
| `--pal-border` | `.divider` between sections; `.cs-vm-notice` hairline border |
| `--pal-text-muted` | `.cs-vm-notice` body text |
| `--pal-accent-bright` | `.cs-vm-notice` inline link + `×` on hover |

**No new tokens. No glow, no `--pal-gem` emphasis, no `#c06060`.** This page no longer
displays any critical state, so it must no longer carry any of the app's danger or
ambient-alert vocabulary. If a colour in this region is doing work, something is wrong.

---

## 5. Motion & animation spec

This story is net-negative on motion. The tab strip's panel-switch was the only
transition in this region; it is deleted and nothing replaces it. The page is one
static scroll.

```
Notice strip dismisses:
  Trigger: tap × , or tap the inline → link
  Animation: opacity 1→0 + max-height →0
  Duration: 140ms, ease-out
  Communicates: "acknowledged — this will not come back"
```

Everything else: **instant, no animation.** Section heads, dividers, and both inlined
sections are present at first paint. Explicit non-goals: no staggered section entrance,
no scroll-spy, no smooth-scroll jump links, no collapse/expand on the Inventory section.
NavSegment uses `topNav.css`'s existing transition, unchanged.

---

## 6. Reduced-motion table

| Animation | `prefers-reduced-motion: reduce` |
|---|---|
| Notice dismiss (140ms fade+collapse) | Instant unmount, 0ms |

(One row is the whole table — that is the point.)

---

## 7. Interaction model & wayfinding

### 7.1 The one addition: promote the mode segment into the classic TopNav

Today session mode's TopNav carries `❡ Profile | ⚔ Session` in its center slot, while
the classic sheet hides `⚔ Session` inside the ⋯ menu. That asymmetry is tolerable
while the classic page has combat tools of its own. The moment it doesn't, it becomes
the central wayfinding failure of this story: a returning user looking for Combat or
Map has nothing on screen pointing at where those went.

**Add `center={<NavSegment options=[❡ Profile, ⚔ Session] />}` to the classic view's
TopNav — the exact component, props, and 560px mobile-row behaviour session mode
already uses — and remove the now-duplicated `⚔ Session` item from the ⋯ menu.** Two
tabs and two feature surfaces are being deleted; adding one already-built, already-
learned control that points at their new home is a net reduction in chrome.

### 7.2 The one-time orientation notice (optional, self-deleting)

`dnd_tab_${slug}` defaults to `"combat"`, so most returning users have a stored value
naming a tab that no longer exists. On mount, if that key reads `"combat"` or `"map"`,
render one quiet line in the exact pixels the tab strip used to occupy, then **delete
the key immediately** so it can never appear twice:

> `Combat and Map now live in ⚔ Session mode. →` `×`

12px IM Fell English, `--pal-text-muted`, hairline `--pal-border` top+bottom, 44px
minimum tap targets on both `→` and `×`. Informational register, not accent-tinted —
this is a footnote, not an alert. Cuttable without touching anything else.

### 7.3 Interaction table

| Element | Trigger | Immediate response | Committed action | Cancel / undo |
|---|---|---|---|---|
| NavSegment `⚔ Session` | Tap (44px) | Segment active state | Route to `/characters/:slug/session`; writes `dnd_mode_${slug}` | Tap `❡ Profile` |
| Notice `→` | Tap (44px) | — | Route to session mode; key already deleted | Browser back |
| Notice `×` | Tap (44px) | Fade+collapse 140ms | Key already deleted | None — one-time by design |
| Inventory rows (equip ■ / attune gem / qty stepper / `Use` / Drop) | Unchanged | Unchanged | Unchanged (`patchSession`) | Unchanged |
| Collections section pills | Unchanged | Unchanged | Unchanged | Unchanged |

---

## 8. Data contracts & sync

**No data model changes. No new fields, no new endpoints, no new writes.**

**Fields this page stops writing** (all still written from session mode): `concentration`,
`conditions`, `exhaustionLevel`, `inspiration`, `spellSlots`, `playerNotes`. The classic
page becomes read-mostly — its only remaining `patchSession` writes are the Inventory
section's (`weapons[]`, `equipment[]`, `coin`, `xpCurrent`).

**Polling — do not delete the poll.** `CharacterPage.jsx`'s single
`getSessionState({ slug })` call must stay: `staleClient.reportServerBuildVersion()`
(Story 36b) rides on it, and the Inventory section must reflect items added elsewhere
(especially once Story 58 lands). What it should **stop consuming** is `mapLibrary` /
`activeMap`, whose only consumer on this page was the Map tab.

**Freshness tolerance is now generous.** This is a reference page; nothing on it is
read under pressure. Relaxing this page's poll cadence (or dropping it to the 30s
backgrounded rate unconditionally) is a legitimate follow-on saving — flagged for
`code-architect` to decide, deliberately not specced here.

**Optimistic updates / write failure:** unchanged from today for every surviving control.

---

## 9. Size-degradation ladder

| Step | Change |
|---|---|
| ≥900px | Full layout. `.loadout-grid` two columns. NavSegment in TopNav center slot. |
| 600–900px | Unchanged; `.character-details-grid` already collapses 3→2 at 600px. |
| 560–600px | `.loadout-grid` collapses to 1 column (existing rule). |
| <560px | NavSegment drops out of the center slot into `.topnav-mobile-row` (existing TopNav behaviour). Notice text wraps to two lines; `→` and `×` hold their 44px targets. |

**Net mobile win:** deleting the 64px tab strip returns 64px of vertical space above
the fold on every phone, on every character, permanently.

---

## 10. Key edge cases

1. **Stored tab was `combat` / `map`** → notice renders once, key deleted on mount. All other stored values are equally dead; delete the key in every case.
2. **`inPlay[]` is empty** → the Persona section **unmounts entirely** — head, divider and all. It does *not* show today's empty-state message. An empty tab needs an explanation because the user deliberately navigated to it; an empty section just shouldn't exist. (Sparse-first; this is the one intentional content change to the Persona panel.)
3. **No weapons and no equipment** → Inventory section still renders (coin is always present). The attunement banner keeps its existing 0.45-opacity empty treatment, unchanged.
4. **Sheet locked (no auth)** → unchanged: header + portrait public, everything below gated with the existing note.
5. **DM opens `↗ Sheet` from a dashboard card** → now lands on a pure reference page with no combat data. Intended, not a bug — the DM card already carries HP/conditions/concentration/slots.
6. **Caster arrives here mid-session wanting to spend a slot** → currently broken by this story. See OQ-1.

---

## 11. Files touched

- `src/features/characterSheet/CharacterSheetViewMode.jsx` — delete tab strip + `combat` and `map` panels; inline the two surviving panels as sections; add the notice
- `src/features/characterSheet/characterSheet.css` — delete the view-mode tab-strip classes; add `.cs-vm-section`, `.cs-vm-section-head`, `.cs-vm-notice`
- `src/components/CharacterSheet.jsx` — drop `activeMap` passthrough and combat-tab-only state/props
- `src/pages/CharacterPage.jsx` — stop consuming `mapLibrary`/`activeMap`; **keep** the `getSessionState` poll (Story 36b depends on it)
- TopNav usage in view mode — add `center` NavSegment; remove `⚔ Session` from `menuItems`
- `design/app-overview.md`, `design/design-system.md` — feature-builder updates (tab-strip section, "Map tab on character sheet" section)

**Do not delete any component.** `DiceRoller.jsx` and `SessionNotesSection` are both
mounted by session mode. This story removes *usages*, not files. Deleting either
component breaks session mode.

---

## 12. Open questions

- **OQ-1 (BLOCKING, needs your decision).** Removing the Combat tab removes the player's
  only self-serve spell-slot spend/restore and the only player-facing Short/Long Rest
  buttons — session mode's slot display is read-only and rests are DM-dashboard-only.
  **Recommendation: make this a prerequisite** — a small follow-on that makes session
  mode's slot pips tappable (spend/restore) and adds Short/Long Rest there. Ship the
  **Map tab removal immediately** (zero cost, strictly better elsewhere) and hold the
  **Combat tab removal** behind that follow-on. Alternative, if you disagree: accept the
  loss on the grounds that you (the DM) trigger every rest anyway — but say so
  explicitly, because a caster will hit this in the first session after it ships.
- **OQ-2 (verify before deleting).** Does session mode's `ConditionPickerModal` include
  the 0–6 exhaustion stepper? If not, exhaustion becomes uneditable by players app-wide.
  Same class of gap as OQ-1, cheaper to close.
- **OQ-3 (the story's own open question) — recommendation: KEEP the Inventory tab.**
  Three independent reasons, none of which depend on Story 58's outcome: (a) it is the
  classic sheet's **only remaining view-mode home for XP and coin** once Combat is gone
  — removing both leaves a sheet that can't show you your gold; (b) it is the *rich* read
  view (attunement banner, expandable descriptions, mod chips, drop/use) where session
  mode's Loadout is a simplified name/qty/attunement grid, and Story 58 explicitly does
  **not** cover editing existing items; (c) inventory is a between-session planning
  activity, not live session state, so it doesn't violate this story's own
  "one place for what's happening right now" principle the way conditions and
  concentration did. **This is a design recommendation, not a judgment call I'm making
  for you** — if you'd rather the classic sheet be backstory-only, say so and the answer
  is a one-line change to §3.2 (drop the section, and XP/coin must then be confirmed
  present in Story 58's session Loadout before Combat is removed).
- **OQ-4 (low priority).** "Inventory" (classic) vs "Loadout" (session) name the same
  data. Recommend aligning on one word in a later pass; not this story.
- **OQ-5.** Is the §7.2 one-time notice wanted, or would you rather the smallest possible
  diff? Recommend keeping it — it self-deletes and costs ~15 lines.

---

## 13. Cross-references

- **Story 58 (session inventory editing)** — genuinely independent. OQ-3's recommendation
  does not depend on 58's outcome. Revisit only if 58 ships *full* parity including
  per-item descriptions, mods and attunement editing, which its own scope currently excludes.
- **Story 57** — retires its footnote "the classic full character sheet's Map tab (no
  token layer at all) is unaffected." That caveat disappears with the tab.
- **Story 37 (TopNav / NavSegment)** — §7.1 reuses `NavSegment` and the `.topnav-mobile-row`
  <560px behaviour with zero new component work.
- **Story 36b (staleClient)** — depends on `CharacterPage.jsx`'s `getSessionState` poll
  continuing to run; §8 is explicit that the poll survives.
- **Story 16 (DM card tiers)** — this brief applies the same tier principle to a whole page:
  Profile view demoted Tier 1 → Tier 3.
- **`dnd_tab_${slug}`** — retired. Read once for §7.2's notice, then deleted; no writes remain.
