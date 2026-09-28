# Feature Story: Session Chronicle — Tag Sessions, Build Chapters

**Status**: Draft — prototype in review (2026-09-28)
**Supersedes**: [Story 40 — Adventure Breakpoints](40-adventure-breakpoints.md) (never built)
**Prototype**: `design/prototypes/session-chronicle.html`

## Goal

Give the table a central, shared record of the campaign. After (or long after) a session, the DM tags the slice of the activity log it covers. That session gets a page everyone can read: a summary (usually pasted from a transcript summary made offline), highlights drawn from the log, and players' own recollections. Sessions group into named chapters of the larger adventure.

## Why this replaces Story 40

Story 40 marked a chapter end by archiving and then **clearing** the live feeds. That depended on the DM pressing the button at the right moment, and it couldn't skip test noise or join a session played over two nights. Tagging a **time range** of the persistent log has neither problem: nothing is reset, it can be done weeks later, and a range can be widened, narrowed or trimmed.

## User flow

**Chronicle page** (`/chronicle`, in the shared top nav for players and DM): chapters newest first, each with its sessions. A session card shows the title, local date and time span, who played, a short stats line, and the start of the summary.

**Record a session** (DM only):
1. **Activity strip**: one bar per local day across the whole log, with height = number of events. Days already in a session are shaded and can't be picked again.
2. Pick the range by clicking a day, using a preset (**Today**, **Since last session**, **Last 7 days**), or setting exact start/end times.
3. **Preview** the events in the range, grouped by day. Untick single events or a whole day to leave out testing noise. This also covers a two-part session with dead days in between.
4. The title is pre-filled ("Session N · Wed Jul 22"). Choose a chapter or start a new one. Save.
5. Saving **copies** the included events into the session record, so the session survives the live log's 500-event cap.

**Session page** (everyone):
- **Summary**: anyone can edit it (DM and players; "we're all friends here"). It shows "Last edited by … · when". Plain text with paragraphs; the DM usually pastes a transcript summary.
- **Highlights** are computed from the tagged events: natural 20s and fumbles, the highest roll, who rolled most, and counter wheels advanced (map activations too, once logged). No manual work.
- **Recollections**: each player adds short notes in their own voice, shown in their palette colour. Authors edit their own. The DM can hide any.
- **Activity log**: the tagged events, collapsed by default.
- **DM only**: edit the range (reopens the picker), rename, move to another chapter, delete the session. Deleting doesn't touch the live log.

**The Night at a Glance** (session page, above the summary): one timeline across the session.
- **HP lane**: a line per player showing HP over the night.
- **Rounds band**: combat rounds, shaded alternately. Counter-wheel ticks appear as markers.
- **Damage lane**: a bar for each successful hit at the moment it landed, coloured by who dealt it, with the amount on top. Select a bar for details: who, what, how much, round.
- **Real data from now on**: Take Action / Deal Damage (ADR-032) records attacker, target, amount and misses, and initiative records rounds. HP and condition changes are logged from 2026-09-28 on (see Data).
- **Older sessions without that data** (like Jul 22) get an inferred version, clearly labelled: a 2d6 roll counts as an action, a d4–d12 roll by the same player within 5 minutes counts as a hit, and a new round starts when someone acts a second time. On Jul 22 this recovers a steady turn order (Meanjeans → Quietclaw → Eòghan → Liu Sha → Aesop) over about 8 rounds, with 14 damage rolls. HP can't be recovered for those sessions, so that lane says so instead of guessing.

**Chapters**: the DM names a chapter ("Chapter 1: The Road to Hearthfire"), renames it, reorders sessions between chapters. Chapters are labels only; nothing resets.

## Rules

- Sessions can't overlap: each log event belongs to at most one session. The picker shows the conflict instead of saving.
- Days, times and the pre-filled title use the **viewer's local time**. The log stores UTC, and a 7:40pm Pacific session is logged as 02:40 the next day.
- Transcripts aren't stored. The DM summarizes offline and pastes the result. Built-in AI summarizing is out of scope.

## Data (for the build)

- `chronicle` sentinel: `{ chapters: [{ id, name, order }], sessions: [{ id, chapterId, title, startAt, endAt, excludedEventIds, createdAt }] }`. It holds metadata only, so it stays small.
- One record per session for the heavy parts: `slug: "chronicle-session:<id>"` → `{ events: [...snapshot], summary: { text, updatedAt, updatedBy }, recollections: [{ id, authorSlug, authorName, palette, text, createdAt, updatedAt, hidden }] }`. The reserved `chronicle-session:` prefix is filtered out of character listings, the same way the sentinels are (`specialItems.js`).
- Versioned per ADR-030, so two people editing the summary at once get a clear "someone else just edited this" instead of silently overwriting each other.
- Auth: DM password for range, title, chapter and delete, and for hiding recollections. A player's character password (their existing session auth) for editing the summary and their own recollections. Reads are public within the app, like the roll log.
- HP and condition history (**built 2026-09-28**, ahead of the rest of this story): every HP change and condition change, for party and NPCs, is written into the shared roll log as `type: "hp"` (`subject, from, to, max, delta, editor`; plus `by`, `action {name, style, crit}`, `miss`, `rollId` when it came from Take Action / Deal Damage) and `type: "condition"` (`subject, added, removed, exhaustion?`). The DM's log shows them. The public copy drops entries about hidden/invisible creatures, hides NPC HP totals and strips hidden attackers. Recording a session copies them with the rest of its events.
- Carried over from Story 40: `putMapActive` appends a `type: "map"` entry to the roll history, so sessions record which maps were used.

## Out of scope

- AI transcript summarization or storing transcripts.
- Clearing or resetting any live state.
- Export, multiple campaigns, rich-text formatting.
