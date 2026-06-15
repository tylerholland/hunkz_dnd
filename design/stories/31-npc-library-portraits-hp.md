# Feature Story: NPC Library with HP and Portraits

**Status**: Needs UX design
**Source**: RPG Consultant
**Prototype**: (leave blank — ux-designer fills this in)

---

**This story supersedes Story 24 (NPC Library).** Story 24 defined a flat name + abilities library and was fully designed and had Architect Notes, but was never implemented. This story expands the scope to include hpMax and portrait images as first-class library fields, and reframes the library as the single persistent source of truth for recurring NPC definitions. Story 24 should not be implemented separately — implement this story instead.

---

## Goal

Give the DM a persistent NPC creature library where each entry stores a name, a default HP maximum, a portrait image, and an ability reference list. The DM builds this library gradually over the course of a campaign — saving a creature mid-session from the combat tracker after it's already on the field, or creating entries directly in a library editor outside of combat. When spawning a creature from the library during a session, all pre-set fields populate automatically so the DM only needs to choose how many and confirm HP. The portrait image stored in the library is the same image that appears on battle map tokens — there is one source of truth, not two separate uploads.

This library is permanent. It survives End Combat, session resets, and long rests. It is the DM's growing bestiary for the campaign.

## User stories

1. As the DM, I want to save an NPC card's name, HP, portrait, and abilities to the library mid-session so that the work I do building a well-specified creature card in combat is reusable in any future session.

2. As the DM, I want to open a library editor outside of active combat so that I can build up creature definitions in advance before a session, without needing enemies on the tracker to do it.

3. As the DM, I want to spawn a library creature into the combat tracker with name, HP, portrait, and abilities already filled in so that adding a recurring enemy is a one-tap action instead of re-typing everything.

4. As the DM, I want to choose the number of instances when spawning from the library and override HP for this specific encounter so that I retain full control for moments like "this one has been weakened" or "there are five this time."

5. As the DM, I want to update a library entry when I've refined a creature's abilities or portrait, so my definitions improve over the campaign without needing to delete and recreate.

6. As the DM, I want to delete library entries so I can remove one-off creatures that don't belong in my permanent collection.

7. As the DM, I want the token on the battle map to automatically use the library creature's portrait so I never have to upload the same image twice.

8. As the DM, I want the Add Enemy form to remain fast for throwaway creatures — spawning a nameless bandit should not require interacting with the library at all.

9. As the DM, I want multiple instances of the same library creature (e.g., three Goblins) to be visually distinguishable on the battle map token layer so I and my players can tell them apart during combat.

10. As the DM, I want to duplicate a library entry so I can create a variant of an existing creature (e.g., "Goblin Boss" based on the "Goblin" entry) without rebuilding the abilities list from scratch.

## Functional requirements

### Library data shape

Each library entry stores: a name, a default hpMax, an optional portrait image URL, and an abilities list (the same `string[]` as the NPC card's existing ability reference field). All fields except name are optional — an entry with just a name is valid.

The library persists in a dedicated DynamoDB sentinel item, separate from the `npc-combat` session record and separate from the `map-library` record. It survives End Combat entirely.

### Portrait images

- A portrait image can be uploaded for any library entry. The upload follows the same presign-to-S3 flow used for character portraits and map images.
- The resulting S3 URL is stored on the library entry as `portraitUrl`.
- When an NPC is spawned from a library entry into the combat tracker, the entry's `portraitUrl` is copied onto the spawned NPC object. This is the `portraitUrl` field that Story 29b introduced on NPC combat objects.
- Because the battle map token layer uses `portraitUrl` from the NPC combat object, a library-spawned NPC automatically shows its portrait on the battle map. No second upload, no re-linking.
- If the DM uploads a portrait directly on a live NPC card (the Story 29b flow), that portrait lives only on that session's NPC object. Saving the card to the library at that point copies the `portraitUrl` to the library entry, making it permanent. The DM does not need to upload twice — saving to library captures the image that's already there.

### Building the library

**Path 1 — Save from live combat tracker card**: an affordance on each NPC card (in the card's overflow/action area) lets the DM save the current card's name, hpMax, portraitUrl, and abilities as a new library entry. If an entry with the same name already exists, the DM is offered a choice: update the existing entry or save as a new one. The DM explicitly chooses — no silent de-duplication.

**Path 2 — Create directly in library editor**: the library has its own management interface, accessible from the DM dashboard outside of combat. The DM can create a new entry from scratch: enter a name, set a default HP, upload a portrait, and write an abilities list. No live NPC card is needed.

**Path 3 — Save from library after spawning**: after spawning a creature and editing its abilities mid-session, the DM can re-save the updated card back to its library source to keep the library current. This is the same flow as Path 1, but the save action offers "Update existing '[Name]'" prominently because there's a clear name match.

In all cases: mid-session edits to an NPC card do NOT automatically propagate to the library. The DM always chooses to save explicitly. This prevents session-time scratchpad notes from polluting canonical creature definitions.

### Spawning from library

The Add Enemy form gains an optional "From library" path. When the DM opens it, they can browse or search saved entries. Selecting an entry pre-fills: name, hpMax, abilities, and stages the portraitUrl for the spawned NPC objects. The count field remains blank — the DM sets it. The HP field pre-fills with the library entry's hpMax but the DM can override it for this spawn (e.g., "only 14 HP — this one is injured"). Overriding HP at spawn time does not modify the library entry.

When count > 1, each spawned NPC gets its own independent copy of all fields. They are independent combat objects from the moment they're created. Editing one does not affect the others or the library.

When count > 1 and all spawned NPCs share the same portrait, the DM needs a way to distinguish them on the battle map. The minimum differentiator is an auto-appended number suffix in the name (e.g., "Goblin 1", "Goblin 2", "Goblin 3"). This is sufficient for the NPC card list, where each card is already a separate row. For the map token layer, identical portraits with only a name difference may cause confusion at the table. Whether an additional visual differentiator is applied to the token itself (e.g., a number overlay or color ring) is an open question deferred to UX design — but the data model must at minimum support distinct names per spawned instance.

The base Add Enemy flow (name + HP + count, no library) remains completely unchanged. Using the library is optional for every spawn.

### Library management

The DM can update any library entry: rename it, change the default HP, upload or replace the portrait, or edit the abilities list. These updates do not affect NPCs already spawned and active in the current combat tracker.

The DM can delete any library entry. Deletion does not affect NPCs already spawned. A two-step confirmation is required before permanent deletion.

The library supports basic search/filter once it grows large. When the entry count exceeds roughly 20, a filter field appears that matches against name and ability text.

Entries are sorted by most-recently-used (both saving to the library and picking from it count as "used").

### Duplicate entry

The DM can duplicate any library entry to create a variant. The duplicate is created with all fields copied and a modified name (e.g., "Goblin Boss (copy)"). The duplicate is immediately editable. This is not a live link to the original — it is a fully independent entry from the moment of creation. Duplicating does not affect the original entry's MRU timestamp.

### End Combat behavior

End Combat clears the `npc-combat` session record as it always has. The `npc-library` record is completely unaffected. The DM's library persists indefinitely.

## Data model changes

- New DynamoDB sentinel item: `slug: "npc-library"`. Shape: `{ templates: [{ id, name, hpMax?, portraitUrl?, abilities: string[], updatedAt }] }`. This expands Story 24's proposed shape (`{ id, name, abilities }`) to add `hpMax` and `portraitUrl`.
- `portraitUrl: string` on NPC combat objects (the `npc-combat` sentinel). This field is introduced by Story 29b. Story 31 depends on Story 29b having shipped this field first, or on this story introducing it if 29b has not yet shipped.
- The `npc-library` sentinel is filtered from `list.js` and `dmParty.js` via `filterPublicCharacterItems()` in `specialItems.js` exactly as Story 24's Architect Notes specify. Add `NPC_LIBRARY_SLUG = "npc-library"` to `specialItems.js`.
- New API endpoints: `GET /npc-library` (DM auth) and `PUT /npc-library` (DM auth, full array replacement). A new `POST /npc-library/presign` or reuse of the existing portrait presign endpoint is needed for portrait image uploads — the UX designer and architect should decide whether to extend the existing presign endpoint or add a library-specific one.
- No changes to character records, session fields, or initiative data.

## Out of scope

- Full stat blocks (CR, saving throws, all six ability scores, damage immunities). The library stores only what the combat tracker card uses.
- Player visibility. The library is DM-only.
- Importing from external sources (D&D Beyond, Roll20, SRD). All entries are DM-authored.
- Tags, categories, or hierarchical organization. Flat list with search for v1.
- Sharing the library across multiple DM accounts or campaigns.
- Per-entry roll buttons. The library is a reference store; rolls go through the DM dice roller.
- Undo for delete.
- Automatic library updates when a live NPC card is edited mid-session. Save is always explicit.

## Open questions

1. **Does this story require Story 29b to have shipped first, or can they be developed in parallel?** The `portraitUrl` field on NPC combat objects is introduced by Story 29b. If Story 31 ships independently, it needs to introduce that field itself. Recommendation: sequence Story 29b first since it's a smaller story; then Story 31 builds on the established field. The architect should confirm.

2. **Portrait presign endpoint: extend the existing `/maps/presign` or add a new `/npc-library/portraits/presign`?** The map presign uses the same S3 bucket. Reusing it is operationally simpler but muddies the semantic boundary. A dedicated endpoint is cleaner but adds a Lambda. The architect should decide.

3. **Library editor location on the DM dashboard**: does the library management UI live in a dedicated section on the DM dashboard (below NPC combat, always accessible), or is it a modal/drawer opened from the Add Enemy form? Given that the DM may want to build the library between sessions (not during combat), some persistent access point outside the combat form seems desirable. The UX designer should decide the entry point.

4. **How does the DM see which live NPC cards came from a library entry?** If the card tracks its library source (a `librarySourceId` field), the save-back flow can offer "Update existing '[Name]'" contextually. If not, the match is done by name at save time (same as Story 24). The name-match approach is simpler but fragile if the DM renames the NPC mid-session. The architect should decide whether to track provenance.

5. **Portrait image size limits and validation**: should the presign flow enforce maximum file size or mime type at the Lambda level? The map upload flow has a size warning UI but no server-side hard cap. Consistent enforcement would be ideal. The architect should specify.

6. **Auto-numbering when spawning count > 1**: when the DM spawns 3 Goblins from the library, should names be auto-suffixed ("Goblin 1", "Goblin 2", "Goblin 3") or left identical and differentiated only by their NPC card order? Identical names work fine for the card list (cards are ordered rows) but create confusion when the same name appears multiple times in the initiative tracker. Recommendation: auto-suffix is the right default and should be opt-out rather than opt-in. The UX designer should decide how prominently to surface this behavior at spawn time.

7. **Token visual differentiation for identical portraits on the map**: D&D Beyond Maps solves this with a colored border ring per token; Roll20 uses token markers. This app's battle map token layer (Story 29) uses `portraitUrl` directly — there is currently no mechanism to distinguish three Goblin tokens that share the same portrait image. For v1 the name suffix on the NPC card (open question 6) is sufficient since tokens are not interactively selectable on the map today. If Story 29 evolves toward clickable tokens with identity, this will need revisiting. The architect should note whether the token layer shape already has a slot for a color indicator or label overlay.

8. **Named villain vs. generic creature type in the library**: a recurring villain (e.g., "Malachar the Undying") is a single unique entity — the library entry IS the creature, and the DM will likely only ever spawn one instance. A generic creature type (e.g., "Goblin") is a template that might be spawned in groups of 5 every session. These two use patterns are meaningfully different, but the data model does not distinguish them. Should the library expose a "type" toggle (Unique / Generic) that changes the default spawn UX — e.g., Unique entries default to count 1 and are not auto-numbered, while Generic entries default to the numbered multi-spawn path? This is optional for v1 but worth flagging before design begins.

---

## RPG Consultant Notes

- **The multi-instance token problem is real and unsolved in this story.** When a DM spawns 4 Skeletons from the library, all four tokens on the battle map will display the same portrait. Without at least a name-suffix on the NPC card and some minimal visual differentiator on the token (a number overlay or color ring, as both Roll20 and D&D Beyond Maps provide), players and the DM will lose track of which token is "Skeleton 3" the moment any of them moves. Auto-numbering spawned names is a low-cost fix that should be treated as a functional requirement, not a UX nicety. The token layer visual differentiator can be deferred, but the DM will feel the pain immediately.

- **Duplicate entry is a real DM workflow, not a nice-to-have.** In practice, a "Hobgoblin Captain" and a "Hobgoblin Warlord" share 70% of their ability text. Requiring the DM to type the shared abilities from scratch defeats much of the library's value for variant creatures. The duplicate-and-edit path is how real DMs build out a bestiary. Keeping it scope-minimal (copy all fields, rename, done) is correct — just make sure it exists.

- **The "save back after refinement" path (Path 3) is the most important library-building moment, and the story handles it correctly.** After a mid-session encounter where the DM discovers the Vampire Spawn is more interesting with an extra ability they improvised, the path from live card back to the library needs to be a single confident action ("Update existing 'Vampire Spawn'?"). Any friction here — extra taps, unclear confirmation, accidental duplicate creation — means the library stagnates. The explicit three-choice conflict UI from Story 24's UX design (Update / Save as new / Cancel) is the right call.

- **Flat list + MRU + search is sufficient for this campaign's scale.** DMs running a single campaign rarely accumulate more than 50–80 creature types. The 20-entry search threshold from Story 24 is a reasonable trigger. The concern about campaign lifecycle organization (tags, chapters, folders) is real at the scale of a professional publisher running multiple campaigns, but not relevant here. Flat is right for v1 and likely for v2 too given the audience size.

- **The story correctly excludes full stat blocks, but ability text is doing a lot of work.** In practice the `abilities: string[]` field holds not just spell names but DM shorthand like "Multiattack: 2 claws +5 to hit, 1d6+3 slashing each" or "Legendary Resistance (3/day): succeeds on failed save". This is the DM's actual reference material at the table — the thing they glance at mid-turn instead of flipping to the Monster Manual. The 255-character cap per entry (from Story 23) is tight for anything more than a single attack line. If the DM can't fit a Lich's lair action summary in one entry, they'll abandon the ability list. Worth confirming the cap isn't enforced on the library side.

---

## UX Design

**Brief**: `design/briefs/npc-library-portraits-brief.md`

### Scope summary

- **Tier**: Tier 2 (in-combat picker + save flow) / Tier 3 (advance editor). The editor is a modal, never a persistent dashboard section.
- **Three surfaces**: (A) in-combat library picker inside Add Enemy form, (B) NPC card `⋯` overflow menu save flow, (C) advance library editor modal.
- **Entry point to advance editor**: `⚙ Enemies Gallery` button in DM dashboard top bar; also reachable from picker's `⚙ Enemies Gallery` link.
- **Picker rows**: portrait thumbnail (32px circle, left) + Cinzel name + `♥ hpMax` chip (right, omitted when absent) + two-line ability preview + `×` delete. Initials fallback when no portrait.
- **Save flow (`⋯` menu)**: save-preview line shows thumb + name + `♥ HP + N abl` before committing. Conflict variant shows delta preview (`♥ 7 → ♥ 27`) so the DM sees exactly what an Update will overwrite.
- **Advance editor**: two-pane desktop (list rail + editor panel), single-pane drill-in mobile. 84px portrait circle is dominant (curation focus). `Replace`/`Remove` portrait actions. Name + Default HP + `AbilitiesListEditor` + Save changes (disabled until dirty). `⧉ Duplicate` + `🗑 Delete` on selected entry. Dirty-guard on close with unsaved edits.
- **Portrait upload**: presign → S3 → URL (recommend reusing `/maps/presign`). Local preview + shimmer + progress ring during upload. Stored on library entry; copied onto spawned NPC objects; same URL on battle map token.
- **Initials fallback**: first letters of first two name words, Cinzel, `npcPal.bright` on `npcPal.chipBg`.
- **Spawn UX**: pick pre-fills name + HP + abilities + portrait; focus moves to Count stepper. `☑ Number them` toggle when Count > 1 (default: checked, opt-out); live preview `(Goblin 1–N)`. Count = 1 never numbered.
- **Token number badge**: 16px circle bottom-right of token, parsed from trailing integer in name (`/\s(\d+)$/`). Zero new token data — derives from `name` field at render time.
- **Duplicate entry**: copies all fields + `(copy)` suffix, selects copy, Name auto-selected. Original MRU untouched. Shared `portraitUrl` string.
- **Motion**: picker expand 220ms + row stagger; editor modal open 200ms scale+fade; pane drill-in (mobile) 220ms slide; duplicate insert 180ms; row delete 220ms. All instant under `prefers-reduced-motion`.
- **Carries forward from Story 24**: picker inline, save via `⋯`, name-conflict 3-choice, two-tap delete + 6s auto-dismiss, MRU sort, search >20, no polling, `✓ Saved` 220ms only.
- **Changed from Story 24**: rows show portrait + HP chip; pick focuses Count; inline `+ New library entry` form removed (routes to editor); new advance editor modal; portrait upload; `⧉ Duplicate`; auto-numbering + token badge; save-preview + update delta.

### Open questions for user

1. **Top-bar label** — **Resolved: `⚙ Enemies Gallery`**.
2. **Presign endpoint** — reuse `/maps/presign` or add `/npc-library/portraits/presign`? Architect's call; UX unaffected.
3. **Provenance `librarySourceId`** — name-match is simpler; `librarySourceId` enables exact save-back after rename. Architect decides.
4. **Server-side upload cap** — client spec ~5MB; architect decides hard enforcement.
5. **Sequencing with Story 29b** — assumes 29b shipped `portraitUrl` on NPC combat objects. If not, this story introduces the field itself.
