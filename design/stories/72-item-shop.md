# Feature Story 72: The Item Shop

**Status**: Built (2026-10-26/27), all three phases: `/characters/:slug/shop`, `/dm/shop` (+ `/dm/shop/preview`), `backend/src/handlers/shop.js`, `backend/src/lib/shop.js`, `backend/src/lib/shopHaggle.js`, `src/features/shop/` (each keeper's lines in `keeperLines.js`). Coin and hirelings decided as recommended below; very high rolls (14+) win back 1 patience; selling back is per shop ("Buys back", on by default) at half the list price, never hirelings; purchases and sales are logged to the roll history as `type: "shop"`. Still open: Mags's expression variants (no art yet) and renaming keepers for saved shops.
**Prototype**: `design/prototypes/shop.html`. It is the reference for layout, copy and interactions. Its top bar switches view, shopper, scene and shop state.
**Art**:
- Shop scenes: `design/prototypes/assets/shop-mags.jpg` and `design/prototypes/assets/shops/*.jpg` (web copies; Tyler's PNG originals sit beside them and are not committed).
- Item art: `design/prototypes/assets/items/` (weapons and armour so far; Tyler is making the rest).
- Prompts: `design/art/shop-item-prompts.md`, `design/art/shop-scene-prompts.md`.

## Goal

Let players buy gear between and before sessions without eating table time. The DM decides when a shop is open, which shop it is, what it sells and how dear it is. Players shop on their own devices: browse the shelves, see what they already carry, haggle with the shopkeeper, and pay. Purchases land in their inventory and the coins leave their purse.

The usual case: the DM schedules the shop to open 45 minutes before the next session and close when it starts. People who arrive early shop while they wait, and a late DM doesn't hold anyone up.

## Rules (settled in design; the prototype implements all of them)

### Opening and closing

The shop is in one of these states. The server works the state out on every read; no timer job runs.

| State | When | Players see |
|---|---|---|
| **Closed** | No opening, or the opening has ended | Shutters down, no shelves, no pack. "Not open right now: the DM opens the shop when the story brings you here." |
| **Scheduled** | Opening saved, start time in the future | Shutters with "Back Soon", the opening time and a countdown. **No browsing.** |
| **Open** | Inside the window, or opened by hand | The full shop |
| **Locking up** | For 2 minutes after a close, whether by hand or at the scheduled time | A banner with a countdown. **Can pay for what's already in the satchel; can't add to it or haggle.** Afterwards, unpaid satchels are lost. |
| **Combat** | Battle mode is on (`map-library.combatMode`) | "Closed for the Fighting" shutters. Reopens when combat ends; satchels keep. |

**Opening window**, set by the DM:
- **Before the next session:** opens N minutes before `chronicle.nextSession.at` (15, 30, 45, 60, 90 or 120; 45 by default). Closes when the session starts, or when the DM closes it. If the session moves, the window moves with it.
- **Pick the times:** explicit start and end, which can span days for downtime.
- **Open now:** closes when the DM closes it, in an hour, or at session start.

### Which shop: keepers, signs and saved shops

- **Shop templates** are the built-in keepers. Each one has:
  - a scene image and face position (used to place the speech bubble);
  - a name and three suggested signs (shop name, place line, subtitle);
  - their own greetings and goodbyes;
  - a **usual setup**: shelves, price level, per-shelf markups and temper.
- The seven keepers are Mags (Ironwhistle's), Aurelian Vey, Master Quibb, Tobias Underbough, Wendel Pipwick, Vesk and Old Nackle. Their data is in `SCENES`, `KEEPERS` and `USUAL` in the prototype. The DM can also write their own sign.
- **Templates remember** the DM's last changes to them. **Reset to usual** restores the defaults.
- **Saved shops** are optional. **Save this shop** stores the keeper, sign and settings under a new entry, and changes to a saved shop are kept with it. The UI shows two segmented lists: **Shop templates** and **Saved shops**.
- **Temper** belongs to the shop, not the stock. It sets the hidden haggle modifier and patience (see Haggling below).

### Shelves, prices and stock

The catalog has eight shelves: Arms, Armour, Gear, Tools, Occult, Fancy goods, Mounts & carts, Hirelings. Prices are in **silver**. Items are seeded from World of Dungeons (`ITEMS` in the prototype).

Each shelf in the setup is one row:
- **Carried or not:** a shelf the shop doesn't carry is hidden from players.
- **Markup:** −50% to +200%, in steps of 5%, with an example price.
- **Stock count:** "In stock 4 of 6". The row opens to show its items as toggle chips.

**Price level** rolls a markup for every shelf in steps of 5%. Each shelf can then be nudged with − and +. Players only ever see the final prices.

| Level | Range |
|---|---|
| Cheap | −20% to 0 |
| Low markup | 0 to +15% |
| High markup | +15% to +50% |

**Stock level** rolls in-stock or out for each item. The chance an item is out is `min(0.95, base × scarcity)`:

| Stock level | Base |
|---|---|
| Everything | 0 |
| Mostly full | 0.13 |
| Half-empty | 0.42 |
| Mostly empty | 0.68 |

| Price | Scarcity |
|---|---|
| ≤ 2s | 0.25 |
| ≤ 5s | 0.5 |
| ≤ 20s | 1 |
| ≤ 60s | 1.4 |
| more | 1.9 |

So staples like bread and rope almost never run out, and armour and mounts go first. The roll happens once per opening, so everyone sees the same shelves. Sold-out items stay on the shelf, greyed out and stamped, with a line from the keeper.

**While the shop is open:**
- Stock edits are live.
- A search box finds items, including ones on shelves the shop doesn't carry. Tapping such an item carries that shelf with only that item in stock.
- Items restocked during an opening show **Just in** on the shelf, and the keeper says so.
- Rerolling stock is off.
- The shop, shelf switches, markups and temper are locked behind an **Unlock** button, so nothing shifts while people shop.

### Haggling

Haggling happens per item, from the item card, with up to **3 tries per item**.
- **The roll:** `2d6 + CHA mod + temper modifier − (earlier tries on this item)`.
- The player sees their own dice and Charisma, never the temper modifier.

| Roll | Result | Patience cost |
|---|---|---|
| 14+ | 30% off | 1 |
| 12–13 | 20% off | 1 |
| 10–11 | 10% off | 1 |
| 7–9 | 5% off | 1 |
| ≤ 6 | price +5% from where it stands (capped at +15%) | 2 |

- The best price reached is kept. A worse success just gets "no lower".
- A great roll can go below list price.
- **Planned, not yet in the prototype:** a very high roll (14+) gives back **+1 patience** ("you charmer").

**Temper** (hidden from players):

| Temper | Modifier | Patience |
|---|---|---|
| Won't haggle | refuses; each try costs 1 | 3 |
| Stubborn | −2 | 3 |
| Fair | 0 | 5 |
| Soft touch | +2 | 8 |

**Tyler's direction:** most shopkeepers expect haggling, so it should be fun, not a quick ban. The main difference between shops should be how much patience they start with. Tune the numbers after playing.

**When patience runs out**, it escalates, separately for each player:
1. **First time:** that item is refused to this player ("Just sold the last of those"). Their **other discounts stay**. Patience refills to 2.
2. **Second time:** that item is refused too, and the keeper is **done haggling** with this player.
3. **After that:** each further haggle try is a push. The 1st is refused, the 2nd is a last warning, and the 3rd **throws the player out**. Their satchel empties and the shop is shut to them for this opening.

**Losing unpaid discounts** is rare. Each refusal makes a hidden 2d6 roll: on the first refusal, 2–3 loses them (1 in 12); on the second, 2–4 (1 in 6). A lost discount returns the item to its marked price, but the tries already used stay used.

The DM sees a **haggling log** for the opening, and anyone thrown out gets a **Let back in** button. They come back with no patience left.

**Mood read (Wisdom):** after each reaction, a hidden roll of `2d6 + WIS mod` sets what the player *thinks* the keeper's mood is: Easy, Wary, Testy or Done with you. It shows as a line under the speech bubble. The player never sees the roll.

| Roll | Read |
|---|---|
| 10+ | correct and sure |
| 7–9 | correct but unsure: "testy… you think?", with a dashed dot |
| ≤ 6 | one step off, and still sure half the time |

The **true mood** comes from patience left (more than 66% Easy, more than 33% Wary, otherwise Testy). It is at least Testy after the first refusal, and Done after the second.

### Player shop page

- **Scene:** the keeper's scene fills the top of the page. The speech bubble is placed by the keeper's face: right of the face, else left of it, else under the chin. On phones, the speech, item card and counter stack below the image.
- **Item card:** floats over the scene, with large art, the stat, notes, "you already carry one", quantity, **Into the satchel** and **Haggle**. It says "Short N silver" when the player can't afford it.
- **Shelf tiles** in category colours, with item frames below them. Each frame shows a price tag (the deal price if haggled), a **have N** badge, and Sold out, Not to you or Just in stamps.
- **Your pack panel:** sticky beside the shelves, collapsible on phones. It shows what the player carries, grouped, with worn items tagged and items on the way from the satchel. It also holds the purse, the satchel count and the sell button.
- **Satchel:** a bottom sheet showing each line's price with any struck-through deal, the total and the purse after paying. **Pay** plays the coin animation, shows a receipt, adds the items to the pack and deducts the purse.

### Where players find it

- The **next-session line** on the homepage and the Chronicle gets a shop line with the keeper's face:
  - **Scheduled:** "Ironwhistle's opens Saturday, 6:15 pm · in 5 days".
  - **Open:** "Open · closes 7:00 pm", with a **Visit** button.
  - **Locking up:** "Two minutes to pay", with a **Pay up** button.
  - **Closed:** not mentioned.
- The **character sheet's session top bar** shows a "Shop · open" button while the shop is open.

### DM page

**Sticky status bar at the top:**
- The state and one main button: Open now, Close now or Close at once. **Preview** and **Cancel opening** are secondary.
- Below it, the schedule line with a right-aligned **＋ Schedule an opening** or **✎ Change** button. That opens the window editor inline, with **Save schedule** and **Cancel**.

**The page below the bar**, with everything else applying as you change it:
- **The shop:** templates and saved shops, preview, sign, temper, Reset to usual, Save this shop.
- **Shelves & stock:** price level with reroll, stock level with reroll, search, expand or collapse all, and the shelf rows.
- **Haggling log.**
- **While open,** the order becomes: lock note, Shelves & stock (live), Haggling log, The shop (locked).

**Preview** shows the player shop with the current settings, even when it's closed. In the real app, preview must not write anything.

**Item catalog** (DM settings): edit items in place, show or hide them, and import or export CSV.
- Matching is by `id`.
- An import shows a diff (new, changed, not in file) before applying.
- Items already bought are the owner's copies, so catalog edits never change anyone's pack.

## Data and API plan

Follow AGENTS.md: put calls in `src/api.js`, extend `getSessionState` rather than adding poll targets, reuse the auth helpers, and register new sentinels in `specialItems.js`.

**New sentinel records** (register in `backend/src/lib/specialItems.js` so they never list as characters):
- **`shop-catalog`:** `{ items: [{ id, name, cat, price, per?, stat?, notes?, icon?, art?, hidden? }], updatedAt }`. Seeded from the WoD list on first read.
- **`shop`**, the setup and the current opening:
  - Setup: `{ keeper, sign: { nameIdx | custom: { name, where } }, carries[], level, markups{}, temper, fill, out[], justIn: { [itemId]: at } }`.
  - Opening: `{ openingId, window: { mode, lead, closeOn, opens?, closes? }, manual: "open"|"closed"|null, lockupUntil? }`.
  - Template memory and saved shops: `{ memo: { [keeper]: setup }, saved: [{ id, keeper, name, where, ...setup }] }`.
  - Haggling: `visits: { [slug]: { deals: { [itemId]: { mult, tries } }, refused[], patience, snaps, pushes, thrownOut } }` and `log[]`. These reset when `openingId` changes.
- Keeper definitions (names, signs, lines, usual setup, image URL, face geometry) can live in frontend code for v1. Images go to S3 with the other portraits, or `public/`.

**Status is derived on read** from the window, `manual`, `lockupUntil`, `chronicle.nextSession` and `map-library.combatMode`. Add a small `shop` summary to `GET /session-state` (status, keeper, sign name, opens and closes) for the next-session line and the sheet button.

**Endpoints:**
- `GET /shop`: the player projection. Status; the keeper and sign; carried shelves with marked prices and in-stock flags (never markups or temper); and this player's own visit (deals, refused, *perceived* mood, thrown out). Never patience, true mood or anyone else's visit.
- `POST /shop/haggle` `{ itemId }`, owner auth. **The server rolls** (like `postCharacterRoll`), applies the rules above, updates the visit and log, and returns the dice, the new price, a line key and the perceived mood.
- `POST /shop/purchase` `{ lines: [{ itemId, qty }] }`, owner auth. Checks that the shop is open (or locking up), the items are in stock and not refused, and the player isn't thrown out. Prices with the player's deals, checks coin, then in **one write** appends the items to the character's inventory and deducts coin. Logs a `type: "purchase"` event to the roll history for the Chronicle.
- DM, with DM auth:
  - `GET /shop/dm`: everything.
  - `PUT /shop`: setup, memo, saved shops.
  - `PUT /shop/stock`: live flips; sets `justIn`.
  - `PUT /shop/status`: open now, close (starts the lock-up), cancel, save the window.
  - `POST /shop/let-in` `{ slug }`.
  - `GET /shop-catalog` and `PUT /shop-catalog`. CSV parsing and the import diff happen on the client.

**Inventory:**
- Arms become `weapons` entries; everything else becomes `equipment`, with `qty`, `equipped: false` and `notes`.
- Use the existing item shapes from `ItemEditorModal` and `constants.js`. Merge quantities for stackable gear.

**Trust model:**
- Purchases, haggles and DM edits are authenticated: owner for buying and haggling, DM for setup.
- The satchel lives only on the client (keep it in `sessionStorage`) until Pay.
- The server enforces open, locking up, stock, coin, refused and thrown out. It doesn't need to know about the satchel.

## Build phases (each one deployable)

1. **Shop basics:**
   - the catalog and `shop` sentinels;
   - the DM page (status bar and schedule, the shop with templates and sign, shelves and stock with rolls, live stock);
   - the player shop page (scene, shelves, item card, pack panel, satchel, Pay) and the purchase endpoint;
   - the closed, scheduled, locking-up and combat states;
   - the next-session line and sheet button;
   - the item catalog page with CSV.

   No haggling yet; temper is saved but unused.
2. **Haggling:** server-side rolls, tries per item, patience and escalation, the rare discount loss, the hidden Wisdom read, thrown out and Let back in, the haggling log, and the +1 patience on very high rolls.
3. **Polish:** saved shops, Preview, selling to the keeper at half price (behind the existing catalog switch), per-keeper haggle and shelf lines (only greetings and goodbyes differ today), and Mags' expression variants once the art exists.

## Decisions still open

- **Coin.**
  - The shop prices in silver, but sheets hold cp, sp, ep, gp and pp.
  - **Recommendation:** pay from the purse's total value in sp (cp 0.1, sp 1, ep 5, gp 10, pp 100), spending the smallest coins first and giving change in sp and cp.
  - The alternative is to charge `coin.sp` only.
- **Hirelings:** an inventory item (e.g. "Torch Bearer — hired, 2s/day"), or a separate party-member note? Recommendation for v1: an equipment item with a note.
- **Selling:** in or out of v1? The prototype shows it; recommendation is phase 3.
- **Shopkeeper renaming for saved shops:** Tyler is open to it. Revisit after the shop has been used in a session.
- **Do purchases appear in the session log and Chronicle?** Recommendation: yes, as one line per purchase.

## Not doing

- No browsing while the shop is closed or scheduled.
- No timers or cron: the status is worked out from times on every read.
- No player-to-player trading.
- No shared satchels.
