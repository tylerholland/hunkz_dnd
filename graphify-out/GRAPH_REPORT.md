# Graph Report - .  (2026-07-09)

## Corpus Check
- 79 files · ~318,733 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 407 nodes · 953 edges · 23 communities (14 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 12,000 input · 3,500 output

## Community Hubs (Navigation)
- [[_COMMUNITY_DM Dashboard & Party Management|DM Dashboard & Party Management]]
- [[_COMMUNITY_Character Sheet View & Theming|Character Sheet View & Theming]]
- [[_COMMUNITY_Character Sheet Edit Mode|Character Sheet Edit Mode]]
- [[_COMMUNITY_Greyhawk World Lore|Greyhawk World Lore]]
- [[_COMMUNITY_Dice Roller Engine|Dice Roller Engine]]
- [[_COMMUNITY_Map & Battle Mode UI|Map & Battle Mode UI]]
- [[_COMMUNITY_Battle Tokens & Map Overlay|Battle Tokens & Map Overlay]]
- [[_COMMUNITY_World Guide Drawer|World Guide Drawer]]
- [[_COMMUNITY_Counter Wheels Panel|Counter Wheels Panel]]
- [[_COMMUNITY_NPC Enemies Gallery|NPC Enemies Gallery]]
- [[_COMMUNITY_Characters List Page|Characters List Page]]
- [[_COMMUNITY_Suel Deity Pantheon|Suel Deity Pantheon]]
- [[_COMMUNITY_Oeridian Deity Pantheon|Oeridian Deity Pantheon]]
- [[_COMMUNITY_Eoghan Character|Eoghan Character]]
- [[_COMMUNITY_Underdark Locations|Underdark Locations]]
- [[_COMMUNITY_Baklunish Deity Istus|Baklunish Deity Istus]]
- [[_COMMUNITY_Eoghan Portrait Asset|Eoghan Portrait Asset]]
- [[_COMMUNITY_Hero Image Asset|Hero Image Asset]]
- [[_COMMUNITY_Incabulos Deity|Incabulos Deity]]
- [[_COMMUNITY_Loading Monster Asset|Loading Monster Asset]]
- [[_COMMUNITY_React Logo Asset|React Logo Asset]]
- [[_COMMUNITY_Vite Logo Asset|Vite Logo Asset]]

## God Nodes (most connected - your core abstractions)
1. `request()` - 33 edges
2. `PALETTES` - 26 edges
3. `PalCtx` - 15 edges
4. `CharacterCard()` - 13 edges
5. `withAlpha()` - 13 edges
6. `patchSession()` - 11 edges
7. `useAdaptivePolling()` - 11 edges
8. `isPdfMap()` - 10 edges
9. `useHoldToRepeat()` - 10 edges
10. `useQueuedRefresh()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `SessionNotesSection()` --calls--> `patchSession()`  [EXTRACTED]
  src/features/characterSheet/CharacterSheetSessionMode.jsx → src/api.js
- `DamageHealModal()` --calls--> `patchSession()`  [EXTRACTED]
  src/features/dmDashboard/CharacterCard.jsx → src/api.js
- `CharacterSheet()` --calls--> `useDebouncedOptimisticNumberFlush()`  [EXTRACTED]
  src/components/CharacterSheet.jsx → src/lib/liveSync.js
- `QtyStepperControls()` --calls--> `useHoldToRepeat()`  [EXTRACTED]
  src/features/characterSheet/CharacterSheetViewMode.jsx → src/lib/useHoldToRepeat.js
- `MapViewerPage()` --calls--> `displayMapName()`  [EXTRACTED]
  src/pages/MapViewerPage.jsx → src/features/dmDashboard/MapUploadModal.jsx

## Import Cycles
- None detected.

## Communities (23 total, 9 thin omitted)

### Community 0 - "DM Dashboard & Party Management"
Cohesion: 0.07
Nodes (59): AwardXpModal(), DistributeCoinModal(), ConfirmDialog(), CounterWheelsPanel(), initiativesEqual(), ManagePartyModal(), MapLibraryStrip(), cloneLiveValue() (+51 more)

### Community 1 - "Character Sheet View & Theming"
Cohesion: 0.07
Nodes (39): QtyStepperControls(), PALETTES, CharacterCard(), DamageHealModal(), DENOM_NAMES, DENOM_SHORT, formatGpEquivalent(), getDeathSaveCounts() (+31 more)

### Community 2 - "Character Sheet Edit Mode"
Cohesion: 0.06
Nodes (39): ChangePasswordForm(), CharacterSheetEditMode(), DragHandle(), HR(), CharacterSheetViewMode(), CONDITION_SEVERITY_COLORS, makeCtx(), renderView() (+31 more)

### Community 3 - "Greyhawk World Lore"
Cohesion: 0.05
Nodes (46): Baklunish Empire (former), Baklunish (Human Race), Blackmoor (Archbarony), Bone March, Bright Desert (Empire of the Bright Lands), Greyhawk Calendar (Dozenmonth of Luna), Celene (Lesser Moon of Oerth), Circle of Eight (+38 more)

### Community 4 - "Dice Roller Engine"
Cohesion: 0.10
Nodes (23): ALL_SIDES, DiceRoller(), DieShape(), parseDiceExpr(), rollDie(), STAT_NAMES, STAT_SHORT, ALL_SIDES (+15 more)

### Community 5 - "Map & Battle Mode UI"
Cohesion: 0.16
Nodes (19): BattleModeToggle(), MapLibraryModal(), MapPanel(), mapViewerMocks, displayMapName(), MapUploadModal(), inferMapContentType(), isImageContentType() (+11 more)

### Community 6 - "Battle Tokens & Map Overlay"
Cohesion: 0.10
Nodes (17): HeldTokenFloater, TokenChip, TokenTray(), getPaletteAccent(), npcInitialColor(), npcInitials(), avatarInitial(), CharacterSheetSessionMode() (+9 more)

### Community 7 - "World Guide Drawer"
Cohesion: 0.17
Nodes (7): findSectionMeta(), findTitleByFile(), renderInlineMarkdown(), renderMarkdown(), MOCK_TOC, WorldGuideDrawer(), WorldGuideTrigger()

### Community 8 - "Counter Wheels Panel"
Cohesion: 0.36
Nodes (4): polar(), segPath(), WheelSVG(), WheelSVGInner()

### Community 9 - "NPC Enemies Gallery"
Cohesion: 0.32
Nodes (6): ACCEPTED_PORTRAIT_TYPES, EnemiesGalleryModal(), EntryEditor(), npcInitials(), PortraitCircle(), presignNpcPortrait()

### Community 10 - "Characters List Page"
Cohesion: 0.33
Nodes (3): CharactersListPage(), RESERVED_CHARACTER_SLUGS, apiMocks

### Community 11 - "Suel Deity Pantheon"
Cohesion: 0.60
Nodes (5): Jascar (God of Hills and Mountains), Kord (God of Strength), Lendor (Suel God of Time), Llerg (Suel God of Beasts), Suel Pantheon

### Community 12 - "Oeridian Deity Pantheon"
Cohesion: 0.50
Nodes (4): Joramy (Goddess of Fire and Wrath), Kurell (God of Jealousy and Revenge), Lirr (Goddess of Poetry and Art), Oeridian Pantheon

## Knowledge Gaps
- **56 isolated node(s):** `OPTIONAL_ENDPOINT_SUPPORT`, `apiMocks`, `ALL_SIDES`, `STAT_NAMES`, `STAT_SHORT` (+51 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PALETTES` connect `Character Sheet View & Theming` to `DM Dashboard & Party Management`, `Character Sheet Edit Mode`, `Dice Roller Engine`, `Map & Battle Mode UI`, `Battle Tokens & Map Overlay`, `Characters List Page`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `WorldGuideDrawer()` connect `World Guide Drawer` to `DM Dashboard & Party Management`, `Character Sheet Edit Mode`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `useHoldToRepeat()` connect `Character Sheet View & Theming` to `Character Sheet Edit Mode`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `OPTIONAL_ENDPOINT_SUPPORT`, `apiMocks`, `ALL_SIDES` to the rest of the system?**
  _56 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DM Dashboard & Party Management` be split into smaller, more focused modules?**
  _Cohesion score 0.06869446343130553 - nodes in this community are weakly interconnected._
- **Should `Character Sheet View & Theming` be split into smaller, more focused modules?**
  _Cohesion score 0.07341269841269842 - nodes in this community are weakly interconnected._
- **Should `Character Sheet Edit Mode` be split into smaller, more focused modules?**
  _Cohesion score 0.06453634085213032 - nodes in this community are weakly interconnected._