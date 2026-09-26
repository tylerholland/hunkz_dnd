# Feature Story: Persistent Map in Session View

**Status**: Done — collapsible map band at the top of the session right column; open by default in combat, collapsed otherwise; Map sub-tab removed
**Source**: User request
**Prototype**: (leave blank — ux-designer fills this in)

## Goal

Right now, in session mode (`/characters/:slug/session`), the map lives behind one of four sub-tabs (`combat` / `loadout` / `map` / `notes`) — a player has to deliberately tap away from whatever they're doing to see the board, and doing so replaces their current sub-tab content entirely. But battle awareness (where the enemies are, where allies are, where my own token is) isn't something a player consults in isolation — it's something they want passively visible at the exact same moment they're deciding their turn, checking their spell slots, or glancing at their weapon quick-reference. Forcing a choice between "see the map" and "see my other combat info" fights against how a turn actually gets decided at the table. This story moves the map out of the sub-tab rotation so it's visible continuously, alongside whatever else the player is looking at, instead of instead of it.

## User stories

- As a player, I want to see the battle map at the same time as my combat info (weapons, spell slots, conditions) so that I can check enemy positions or my token's status without losing my place in what I was already doing.
- As a player, I want the map to stay visible while I switch between my other sub-tabs (combat/loadout/notes) so that I never have to choose between board awareness and everything else on my sheet.
- As a player, I want passive glanceable awareness of the map (e.g., "did my token just move," "is an enemy adjacent to me") without a dedicated tap-to-check action.

## Functional requirements

- The map (with its existing battle-mode token layer, drag support for the player's own token, and the Attack Declaration Bar per Story 57) is visible continuously in session mode, not gated behind a sub-tab selection.
- The remaining sub-tab content (`combat`, `loadout`, `notes`) continues to be reachable and switchable exactly as before — this story changes where the map lives, not what the other three sub-tabs do or how they behave.
- All existing map-surface behavior is preserved unchanged in its new placement: pan/zoom, own-token drag (Story 34), token detail card (hover/tap), Attack Declaration Bar persistence across sub-tab switches (Story 57 — note that "persists across sub-tab switches" was already a stated requirement of Story 57 specifically *because* the bar isn't inside any one sub-tab panel; this story's persistent map placement is a natural extension of that same idea, not a new capability, applied to the whole map surface rather than just the bar).
- If the active map changes size/behavior in this new layout, all existing states (no active map, active map loaded, battle mode on/off) continue to render their existing empty/quiet-state messaging — this story does not change what the map looks like in the no-map or non-battle-mode cases, only where it sits.

## Data model changes

None expected. This is a layout/placement change to an existing, fully-built surface (map viewer + token layer + Attack Declaration Bar) — no new fields, no new API calls. If the eventual design ends up needing new session-only UI state (e.g., a "map minimized/maximized" toggle) that would be a `sessionStorage` addition for design-strategist/code-architect to specify, not something this story pre-commits to.

## Out of scope

- **Exact placement** (top banner, side panel, above/below content, or anything else) — explicitly deferred to design-strategist, per the user's own instruction ("let's leave that to the design strategist to figure out"). This includes the size/viewport tradeoff question: whether there's realistically room for a side-by-side layout on typical viewport sizes (especially mobile, where session mode already collapses to a single column below 900px), or whether persistent map visibility only makes practical sense stacked above or below the other content on narrow screens.
- Any change to the classic full character sheet's Map tab (`/characters/:slug`, the profile-mode surface) — that tab has no token layer today and this story doesn't add one; it's a session-mode-only change.
- Any change to the DM dashboard's own Map Panel — see Open Questions below; this story is written assuming player-side session mode only.
- Any change to what the map displays or how battle mode works — this is purely about visibility/placement of an existing, unchanged surface.

## Open questions

- **Does "session view" mean the player's session mode only, or could it also reasonably include the DM dashboard's map panel?** The user said "on the session view," which most naturally reads as the player-facing `/characters/:slug/session` page (the only surface actually called "session mode" in this app). The DM dashboard already has its own persistent, collapsible Map Panel at the top of its party column — arguably already closer to "always visible" than the player's tabbed version, though it is collapsible and defaults collapsed in some states. Treating this as player-side-only unless told otherwise, but flagging the read that the DM's panel could also be revisited (e.g., should it default to expanded, or lose its collapse toggle entirely) since the underlying complaint — losing board awareness because it's tucked away — could apply to both surfaces.
- Is there any circumstance where a player would still want to explicitly hide the map (e.g., to reclaim screen space on a small phone during a long non-combat scene where the map isn't relevant)? Or should persistent visibility be unconditional whenever a map is active? This affects whether design-strategist needs to design a collapse/minimize affordance or can treat this as strictly always-on.

---

## UX Design

**Brief**: `design/briefs/persistent-map-session-view-brief.md` — the authoritative spec.

**Prototype: REQUIRED — one, tightly scoped.** Unlike Story 63, whose decisions were all
*read*, this story's load-bearing risk is **spatial** and spatial risk is felt on a device.
The one question no spec can settle: *is a 34vh map on a 390×844 phone big enough to read
token positions, and is the remaining ~414px of content column actually usable?* Prototype
exactly one session shell at 1280 / 820 / 390, the band's three states with real curves, a
placeholder map with six realistically-scaled tokens, the 3-tab strip, and a button firing
the auto-promote trigger — plus a static 64px block standing in for Story 57's Attack Bar so
the mobile vertical budget is honest. **Do not** prototype `MapViewer` pan/zoom, the token
effects cluster, or the Attack Bar's own states.

**Tier: 1 while `combatMode` is true, Tier 2 otherwise.** That mode-dependence *is* the
design — it's the whole reason the band's default open/closed state is mode-aware rather than
unconditional. A map during a fight is combat-critical; a map during a tavern scene is
scenery.

**Placement — RESOLVED: a sticky band at the top of the RIGHT column** (`.cs-sm-map-band`),
with three states — **collapsed (44px rail) / docked / full**. On mobile it becomes a sticky
band at the top of the page. The sub-tab strip goes **4 → 3** (`combat` / `loadout` /
`notes`); nothing replaces the map tab, the three survivors just get wider targets.

The deciding argument against the obvious alternative — full-width above both columns — is
that the left column is `position: sticky; top: 48px; height: calc(100vh - 48px)`. A
full-width band makes both of those values a function of the band's current height, so every
collapse/expand reflows the initiative and party strips, the two things you're watching during
someone else's turn. Right-column placement leaves the left column **byte-for-byte
untouched**, and every existing right-column section (concentration, HP hero, conditions,
Story 63's now-interactive Spell Slots, the Spells row, inspiration) keeps its exact order and
position. *Rejected: third column* (collapses to unusable widths at 900–1200px). *Rejected:
inside the left column* (340px wide, and its spare vertical space vanishes with a 9-entry
initiative and a 5-member party — a map that sometimes has room is not persistent).

**Sticky is not a polish choice, it's the feature.** A non-sticky panel above the tabs is gone
the moment you scroll to your spell slots — the exact failure this story exists to fix,
reproduced one screen lower.

**Mobile — RESOLVED, and the story's open question is closed, not deferred: side-by-side is
categorically dead.** At 390px wide a split gives the map ~190px, at which a 36px base token
renders around **7px**. Stacked-sticky is the only viable model below 900px — and because
mobile forces it, desktop uses the same mechanism. One idea, one implementation, two sizes.
Docked height is `clamp(200px, 34vh, 320px)` below 900px and `clamp(300px, 42vh, 520px)`
above. A landscape-phone override (viewport height <500px → default collapsed, 160px floor)
exists because otherwise band + rail + topbar + Attack Bar eat 76% of the screen.

**Story 57 is a real constraint and the brief names it head-on (§10.3).** A 36px token on a
1000px map fitted into a 270px band renders at roughly 10px — far below a reliable
hold-to-target. **The docked band is a situational-awareness surface, not a targeting surface,
and the design doesn't pretend otherwise.** Three things close the gap: the `⤢` **full state**
(not a nice-to-have — it's the direct replacement for the old full-panel map tab; without it
this story is a net *reduction* in usable map area and Story 57's gesture gets worse);
pinch-zoom, unchanged; and auto-promote-on-your-turn, which guarantees the board is at least
docked the moment targeting matters. **Explicitly not specced:** auto-zoom, auto-fullscreen at
turn start, or a minimum-token-size rule that silently changes gesture availability. The band's
`full` state sits at `z-index: 140`, deliberately **below** the Attack Bar's 150, so a player
can target and roll with the map maximised.

**The story's second open question — should a player be able to hide the map? — RESOLVED: yes,
and the default is mode-aware, so they rarely will.** Collapse is a 44px rail with the map
name and a chevron, reusing Counter Wheels' exact rule (`dnd_wheels_open`): mode-aware default
when the key is absent (`combatMode ? docked : collapsed`), last manual toggle wins otherwise,
with one override — a `combatMode` false→true transition promotes to docked and rewrites the
key. Combat starting outranks an hour-old preference. `"full"` is **never persisted** (a
maximised map restored on reload is a lie about intent; restoring is one tap). New key:
`dnd_session_map_${slug}`.

**Auto-promote on your turn** — when the active initiative turn transitions into your own
entry and the band is collapsed, the rail brightens for 120ms and *then* expands over 220ms.
The brighten-then-move sequence communicates **causality**; a bare expand reads as a stray
tap. Fires at most once per turn, and not again that turn if you manually re-collapse. This is
the most direct answer to the story's third user story, and also the cheapest single thing to
cut for a minimum diff (brief OQ-1).

**Motion: this band is a window, not an event.** Arrival 260ms, departure 180ms, collapse
200ms (closing curve), expand 220ms (opening curve — deliberately asymmetric partners),
docked↔full 240/200ms, and a **160ms crossfade when the DM switches maps** so a swap reads as
"different board, same window" rather than a rendering glitch. Full state must be
`position: fixed` with an in-flow spacer, **not** a taller sticky — the latter reflows the
entire right column twice per toggle. **No glow, no pulse, in any state**: Story 63 already
established that the right column's ambient channel is fully spent by the concentration pulse
and HP-critical red. The one ambient signal is static — the rail takes an `--pal-accent-dim`
wash when collapsed *while battle mode is on* ("the board is live behind the fold").

**Data: zero model change, zero new endpoint, zero new poll target.** Reads
`mapLibrary.activeMapId` / `.combatMode` / `.maps[].tokens[]` / `.activeMapView` exactly as
today. **One load-bearing migration:** `dnd_session_subtab_${slug}` can hold `"map"` from a
previous session — coerce to `"combat"` on read, or returning players land on a tab that no
longer exists. Positive side effect worth noting: the map surface is now mounted for the whole
session rather than only while its tab was open, so Story 52's mount/freshness gate fires once
per session mount instead of once per tab open — strictly **fewer** legitimately-missed
impacts and tracers. Collapse is a height clamp + `visibility: hidden`, **never an unmount**,
or that gate resets on every expand.

**The story's own open question about the DM dashboard — RESOLVED: player-side only, with one
optional one-liner, and a push-back on the rest.** The DM's `MapPanel` is *already* persistent,
non-tab-gated, and drag-resizable at the top of the party column — the complaint that generated
this story ("board awareness costs a navigation decision") is simply not true of that surface.
**Do not remove the DM's collapse toggle**: the party column is the densest surface in the app
and reclaiming 300–700px during a non-combat scene is a legitimate need. The single change
worth considering is a default — expand when `combatMode` is true, matching the rule this
brief establishes for players. One line, optional, not bundled (brief OQ-2).

**Empty state — a deliberate deviation from this story's wording, flagged for your call.**
When there's no active map the band **doesn't render at all** — not a rail, not a message. The
"The DM hasn't loaded a map yet" line belonged in a panel a player *chose* to open; a permanent
version of it is exactly the plaintive empty state this app's principles forbid. The 260ms
arrival animation does the announcing instead (brief OQ-4).

**Open questions needing your decision** (brief §13): **OQ-1** — keep auto-promote-on-your-turn
(recommended) or cut for the minimum diff. **OQ-2** — adopt the DM `MapPanel` mode-aware
default (recommended) or leave the DM side entirely alone. **OQ-3** — drag-to-resize the band;
recommend **not** in v1. **OQ-4** — band absent when no map (recommended) vs. this story's
literal "preserve the quiet message." **OQ-5** — *verify, don't decide*: does `MapViewer`
re-fit correctly when its container height animates? The single likeliest implementation
surprise. **OQ-6** — *verify*: the docs disagree on the sticky offset (TopNav 52px vs
`.cs-session-left` `top: 48px`) and on the topbar's z-index (200 vs 110).

**Cross-references**: **Story 57 — AMENDED**; its §10 edge case 8 ("the reticle is only
visible on the Map sub-tab") is now obsolete — the reticle is visible from every sub-tab, and
the only remaining way that case arises is a deliberate collapse. The Attack Bar itself is
unchanged. **Story 63** — right-column content and order untouched; its no-glow rule extended
here for the same reason. **Story 59** — removes the classic sheet's Map tab, making session
mode the app's sole map surface; no dependency either way, either can ship first.
**Stories 52–55** — unchanged code, improved reach (see the freshness-gate note above).
**Story 47a** — `activeMapView.cx/cy` centring now applies at band mount and on every DM map
switch. **Story 34** — own-token drag unchanged. **Story 30 (Counter Wheels)** — its
mode-aware-default collapse rule is reused verbatim; no second version of that logic.
**Story 16** — the tier principle.
