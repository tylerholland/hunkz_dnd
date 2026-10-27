// Story 72 — the item shop's shared data: shelves, icons, keepers and their
// scenes, each keeper's usual setup, and the stock and price rolls. Used by
// the player shop page and the DM's shop page. Lifted from the approved
// prototype (design/prototypes/shop.html).

// Simple line-drawn icons, for items without art yet.
export const I = {
  blade: '<path d="M10 54 L46 18 L50 10 L42 14 L6 50 Z"/><path d="M14 40 L24 50"/><path d="M8 52 L12 56"/>',
  sword: '<path d="M32 4 L36 10 L36 40 L28 40 L28 10 Z"/><path d="M20 40 H44"/><path d="M32 40 V54"/><circle cx="32" cy="57" r="3"/>',
  great: '<path d="M32 2 L37 9 L37 38 L27 38 L27 9 Z"/><path d="M16 38 H48"/><path d="M32 38 V58"/><path d="M28 50 H36"/><circle cx="32" cy="60" r="2"/>',
  bow: '<path d="M18 6 C44 18 44 46 18 58"/><path d="M18 6 V58"/><path d="M10 32 H54"/><path d="M48 28 L54 32 L48 36"/>',
  xbow: '<path d="M8 26 C24 16 40 16 56 26"/><path d="M32 18 V58"/><path d="M8 26 L32 34 L56 26"/><path d="M26 50 H38"/>',
  armor: '<path d="M18 10 L26 6 H38 L46 10 L52 22 L46 26 V56 H18 V26 L12 22 Z"/><path d="M26 6 C28 14 36 14 38 6"/>',
  heavy: '<path d="M16 12 L26 6 H38 L48 12 L54 24 L48 28 V56 H16 V28 L10 24 Z"/><path d="M20 30 H44 M20 38 H44 M20 46 H44"/>',
  shield: '<path d="M32 4 L54 12 V30 C54 44 44 54 32 60 C20 54 10 44 10 30 V12 Z"/><path d="M32 12 V52 M16 26 H48"/>',
  rope: '<ellipse cx="32" cy="32" rx="20" ry="12"/><ellipse cx="32" cy="32" rx="12" ry="7"/><path d="M50 36 C56 44 52 54 44 56"/>',
  torch: '<path d="M28 60 L30 26 H34 L36 60 Z"/><path d="M32 24 C22 18 28 10 32 4 C36 10 42 18 32 24 Z"/>',
  pack: '<path d="M16 22 C16 12 48 12 48 22 V54 H16 Z"/><path d="M24 22 V14 M40 22 V14"/><path d="M22 32 H42 V44 H22 Z"/>',
  pick: '<path d="M10 20 C24 8 40 8 54 20"/><path d="M32 12 V58"/>',
  key: '<circle cx="20" cy="22" r="10"/><path d="M28 28 L54 54 M44 44 L50 38 M50 50 L56 44"/>',
  flask: '<path d="M26 6 H38 M28 6 V24 L14 50 C12 56 16 60 22 60 H42 C48 60 52 56 50 50 L36 24 V6"/><path d="M18 44 H46"/>',
  skull: '<path d="M14 30 C14 14 50 14 50 30 C50 40 44 42 44 48 H20 C20 42 14 40 14 30 Z"/><circle cx="25" cy="31" r="4"/><circle cx="39" cy="31" r="4"/><path d="M26 48 V56 M32 48 V56 M38 48 V56"/>',
  lantern: '<path d="M24 14 H40 L44 20 V48 L40 54 H24 L20 48 V20 Z"/><path d="M28 6 H36 V14 M26 6 C26 0 38 0 38 6"/><path d="M32 26 C27 32 30 40 32 42 C34 40 37 32 32 26 Z"/>',
  mirror: '<ellipse cx="32" cy="24" rx="14" ry="18"/><path d="M32 42 V60 M26 56 H38"/>',
  fire: '<path d="M32 60 C16 60 12 46 18 36 C20 44 26 44 26 38 C26 28 34 22 32 6 C46 16 52 32 46 42 C44 34 40 34 40 40 C44 48 42 60 32 60 Z"/>',
  horse: '<path d="M14 56 L18 36 C14 30 16 20 26 16 L32 6 L36 16 C46 18 50 26 48 34 L44 30 L40 40 V56"/><path d="M30 40 H40"/>',
  cart: '<path d="M6 22 H50 L46 40 H12 Z"/><circle cx="18" cy="48" r="7"/><circle cx="40" cy="48" r="7"/><path d="M50 22 L58 14"/>',
  boat: '<path d="M6 40 H58 L50 54 H14 Z"/><path d="M32 40 V6 L50 34 H32"/>',
  person: '<circle cx="32" cy="16" r="9"/><path d="M14 58 C14 38 50 38 50 58"/>',
  bed: '<path d="M6 44 V20 M6 36 H58 V52 M58 44 H6"/><path d="M12 36 V30 C12 26 24 26 24 30 V36"/>',
  house: '<path d="M8 30 L32 8 L56 30"/><path d="M14 26 V56 H50 V26"/><path d="M28 56 V42 H36 V56"/>',
  coin: '<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="15"/>',
};

// The eight shelves, each with its colour (also the backdrop of its item art).
export const SHELVES = [
  { id: "arms", name: "Arms", icon: "sword", line: "Steel for the hand and the string." },
  { id: "armor", name: "Armour", icon: "shield", line: "Stops what it can. Mostly." },
  { id: "gear", name: "Gear", icon: "pack", line: "Two silver apiece. Don't go underground without it." },
  { id: "tools", name: "Tools", icon: "pick", line: "Five silver apiece, and worth every one." },
  { id: "occult", name: "Occult", icon: "skull", line: "Ten silver, no questions — and no refunds." },
  { id: "fancy", name: "Fancy goods", icon: "lantern", line: "Twenty silver for the finer things." },
  { id: "travel", name: "Mounts & carts", icon: "horse", line: "Out back in the yard. Mind the mule." },
  { id: "hire", name: "Hirelings", icon: "person", line: "Priced by the day. Paid up front." },
];
export const SHELF_IDS = SHELVES.map((c) => c.id);
export const shelfOf = (id) => SHELVES.find((c) => c.id === id);
export const shelfColor = (id) => `var(--shop-${id})`;

// Item pictures (public/art/shop/items/<id>.jpg). Items not listed fall back
// to their line icon.
export const ART_IDS = new Set([
  "light-weapon", "martial-weapon", "great-weapon", "shortbow", "bow", "heavy-bow",
  "light-armor", "full-armor", "shield",
  "rope", "spike", "chalk", "parchment", "flint", "torches", "tent", "dice", "caltrops", "bandages", "rations", "waterskin", "wineskin",
  "crowbar", "hatchet", "lockpicks", "ink", "fishing", "shovel", "pickaxe",
  "quicksilver", "bone-dust", "holy-water", "blood", "incense",
  "mirror", "lantern", "spyglass", "timer", "boardgame", "clothes", "clothes-boots", "clothes-cloak", "clothes-gloves", "clothes-hat", "holy-symbol", "fire-oil",
  "mule", "horse",
]);
export const itemArt = (id) => (ART_IDS.has(id) ? `/art/shop/items/${id}.jpg` : null);
// A shelf tile shows one of its pieces behind it.
export const SHELF_ART = { arms: "martial-weapon", armor: "full-armor", gear: "rope", tools: "lockpicks", occult: "quicksilver", fancy: "lantern", travel: "horse" };

// The shopkeeper's voice for browsing (shared by every keeper for now).
export const SHELF_LINES = {
  arms: ["That one's only been used the once. Honest.", "Sharp end goes in the other fellow.", "Bought it off a knight. He won't be needing it."],
  armor: ["Stops arrows. Mostly. Some arrows.", "Fits anyone, if you believe hard enough.", "The dent's a feature."],
  gear: ["Rope. You'll want rope. Everyone wants rope, eventually.", "Two silver. Cheapest thing between you and a hole.", "Torches: because the dark is full of teeth."],
  tools: ["Lockpicks? For your own locks, I'm sure.", "A good crowbar opens more doors than charm.", "Shovels dig graves and treasure alike."],
  occult: ["Don't drink it on an empty stomach. Or a full one.", "Bone dust. Whose? Don't ask whose.", "Holy water. Blessed by a very sincere man."],
  fancy: ["A lantern! For the adventurer who's tired of being eaten.", "Spyglass — see trouble before trouble sees you.", "Fire oil. Handle like it hates you, because it does."],
  travel: ["The mule bites. That's extra.", "A warhorse! Out back, eating my profits.", "Boats are cheaper than swimming. Usually."],
  hire: ["They work by the day and run by the hour.", "Torch bearers: cheap, cheerful, flammable.", "The Champion charges more because he lives longer."],
};
export const ITEM_LINES = {
  "fire-oil": "Fire oil. Handle it like it hates you — because it does.",
  "lantern": "A lantern! For the adventurer tired of being eaten in the dark.",
  "lockpicks": "Lockpicks? For your own locks, I'm sure.",
  "quicksilver": "One dose. Two if you're brave. Three if you're stupid.",
  "warhorse": "Out back, eating my profits. He bites.",
  "full-armor": "You'll clank like a kitchen. But you'll clank alive.",
  "holy-water": "Blessed by a very sincere man. Mostly sober.",
  "caltrops": "Throw them behind you. Not in front. People forget.",
};
export const POOR_LINES = ["That's more silver than you've got jingling, friend.", "Come back richer. Or braver. Richer's better."];
export const OUT_LINES = ["Sold the last one to a fellow with too many teeth.", "Sold my last one to a dwarf, Tuesday.", "Next caravan's due in a fortnight. Maybe."];
export const ADD_LINES = ["Good choice.", "A fine pick.", "Into the satchel it goes.", "Ha! Knew you'd want that."];

// Who keeps each shop: the name, three suggested signs [name, place, subtitle],
// greetings and goodbyes. Keys match the scene pictures.
export const KEEPERS = {
  "mags": {
    keeper: "Mags",
    names: [
      ["Ironwhistle's Emporium", "Greyhawk · Low Market", "Arms, armour & oddities — Magpie “Mags” Ironwhistle, proprietor, appraiser, liar"],
      ["The Brass Monocle", "Dyvers · Under the Clocktower", "Everything appraised, most things for sale — Mags Ironwhistle, who saw you coming"],
      ["Ironwhistle's Curios & Cutlery", "Hommlet · Behind the Inn", "Sharp things, shiny things, and things best left in the box — Mags, proprietor"],
    ],
    greet: ["Mind the step, the last one was a mimic.", "Ah, {name}. Coin first, questions never.", "Welcome to Ironwhistle's. Everything's for sale except the cat."],
    pay: ["Pleasure doing business. Don't die with it unpaid.", "Coin's good. Mostly silver, even.", "Come back alive, and come back rich."],
  },
  "fancy-1": {
    keeper: "Aurelian",
    names: [
      ["Aurelian & Daughters", "Silverspire · The Gilded Arcade", "Purveyors to the discerning — Aurelian Vey, outfitter by appointment"],
      ["The Gilded Gryphon", "Greyhawk · High Market", "Fine arms and finer manners — Aurelian Vey, by royal warrant (expired)"],
      ["Vey's of Silverspire", "Silverspire · Temple Row", "Four hundred years in trade — Aurelian Vey, who remembers every one"],
    ],
    greet: ["Welcome. Do try not to touch the glass.", "Ah. An adventurer. How… bracing. Do come in, {name}.", "Everything here has a provenance. Some of it is even true."],
    pay: ["A pleasure. Do wipe your boots on the way out.", "Splendid. My daughters will wrap it. Eventually.", "Wear it well, {name}. People will ask where you got it."],
  },
  "fancy-2": {
    keeper: "Master Quibb",
    names: [
      ["Quibb's Cabinet of Wonders", "Greyhawk · The Jewelled Mile", "Rare, remarkable & reasonably priced — Master Pellinore Quibb, collector"],
      ["The Hall of Fine Things", "Rel Astra · Old Cathedral Quarter", "Curated, catalogued and cursed only slightly — Master Quibb, keeper of the Hall"],
      ["Quibb & Quibb", "Mitrik · Lantern Street", "Est. before your grandmother — the younger Master Quibb, now ninety-one"],
    ],
    greet: ["Hm? Oh! A customer. Do mind the suit of armour, it bites.", "Welcome, welcome. Everything is catalogued. Somewhere.", "You have the look of someone about to buy something marvellous, {name}."],
    pay: ["Marvellous. I'll note it in the ledger. Somewhere.", "Do bring it back if it starts whispering.", "A fine choice. I shall miss it terribly."],
  },
  "humble-1": {
    keeper: "Tobias",
    names: [
      ["Underbough's Sundries", "Millbrook · By the Mill Pond", "Bread, rope & honest tools — old Tobias Underbough, since forever"],
      ["The Muddy Boot", "Hobb's End · The Crossroads", "Provisions for the road and a cup of tea — Tobias Underbough, mind your feet"],
      ["Last Stop Provisions", "The Long Road · Final Waystation", "Last bread for forty miles — Tobias, who's seen them all set off"],
    ],
    greet: ["Come in, come in! Kettle's just boiled.", "Well now, {name}! You look like you need a good pair of socks.", "Wipe your feet, love. Then tell me what you're after."],
    pay: ["There you are. Mind how you go!", "And a sweet for the road, on the house.", "Come back and tell me all about it, won't you?"],
  },
  "humble-2": {
    keeper: "Pipwick",
    names: [
      ["Pipwick's Pantry & Provision", "Bramblecross · Under the Old Oak", "Jam, rope & pocket knives — Wendel Pipwick, purveyor of most things"],
      ["The Crooked Kettle", "Bramblecross · Down the Lane", "A bit of everything and a pot of tea — Wendel Pipwick, at your service"],
      ["Odds, Ends & Pipwick", "Fernhollow · Market Green", "If I haven't got it, you don't need it — Wendel Pipwick"],
    ],
    greet: ["Ooh, a visitor! Sit, sit — no, not on that.", "Ah, {name}. I was hoping someone would come by today.", "Everything's priced, near enough. Ask if you can't read my writing."],
    pay: ["Lovely. Don't spend it all on adventures.", "Off you go, then — and do come back in one piece.", "Pleasure's mine. Here, have a biscuit."],
  },
  "shady-1": {
    keeper: "Vesk",
    names: [
      ["The Drowned Lantern", "Greyhawk · Under the River Gate", "Goods of uncertain history — Vesk, no questions asked"],
      ["Velvet & Venom", "Dyvers · The Smugglers' Steps", "Fine things, dark things, both on tick — Vesk, by invitation"],
      ["The Second-Hand Saint", "Port Toli · Wreckers' Row", "Salvage, relics & slightly used miracles — Vesk, who asks nothing"],
    ],
    greet: ["Shut the door, {name}. The draught gets curious.", "Well. You found me. That's half the price already.", "Look all you like. Touching costs extra."],
    pay: ["Pleasure. You were never here.", "If anyone asks, you bought it from a nice old lady.", "Come back soon, {name}. I'll have new old things."],
  },
  "shady-2": {
    keeper: "Old Nackle",
    names: [
      ["Nackle's Nook", "Greyhawk · Beneath the Fishmarket", "Goods found, goods sold — Old Nackle, broker of what fell off carts"],
      ["The Rat & Ledger", "Dyvers · Bilge Street Cellar", "Everything written down, nothing remembered — Old Nackle, keeper of accounts"],
      ["Goods Found, Goods Sold", "Hardby · Under the Old Bridge", "Ask no questions, hear no lies — Old Nackle, ninety years in the trade"],
    ],
    greet: ["Hehh. A customer. Wipe your feet, or don't. Nackle's not fussy.", "Nackle sees you, {name}. Nackle sees your purse too.", "Everything's for sale. Some of it's even Nackle's."],
    pay: ["Hehh. Pleasure. Nackle writes it down. Nackle forgets it.", "Off you go. Didn't buy it here, mind.", "Come back when your pockets are heavy, {name}."],
  },
};

// Each keeper's scene (public/art/shop/scenes/<key>.jpg) and where their face
// is, as fractions of the picture, so the speech bubble can sit beside it at
// mouth height (y): right of the face (r) first, else left of it (l), else
// under the chin (chin), centred on the face (cx). `pos` is the picture's
// object-position.
export const SCENES = {
  "mags": { l: 0.26, src: "/art/shop/scenes/mags.jpg", r: 0.375, y: 0.49, cx: 0.32, chin: 0.56, pos: "30% 40%" },
  "fancy-1": { l: 0.2, src: "/art/shop/scenes/fancy-1.jpg", r: 0.4, y: 0.27, cx: 0.29, chin: 0.33, pos: "30% 20%" },
  "fancy-2": { l: 0.25, src: "/art/shop/scenes/fancy-2.jpg", r: 0.49, y: 0.44, cx: 0.38, chin: 0.56, pos: "30% 40%" },
  "humble-1": { l: 0.22, src: "/art/shop/scenes/humble-1.jpg", r: 0.44, y: 0.37, cx: 0.33, chin: 0.46, pos: "30% 35%" },
  "humble-2": { l: 0.255, src: "/art/shop/scenes/humble-2.jpg", r: 0.51, y: 0.37, cx: 0.4, chin: 0.5, pos: "30% 35%" },
  "shady-1": { l: 0.23, src: "/art/shop/scenes/shady-1.jpg", r: 0.42, y: 0.48, cx: 0.31, chin: 0.56, pos: "30% 45%" },
  "shady-2": { l: 0.205, src: "/art/shop/scenes/shady-2.jpg", r: 0.49, y: 0.42, cx: 0.39, chin: 0.54, pos: "30% 40%" },
};

// Each keeper's usual shop: shelves carried, price level, markup per shelf,
// and temper.
const ALL = SHELVES.map((c) => c.id);
export const USUAL = {
  "mags": { cats: ALL, level: "low", markups: { arms: 10, armor: 5, gear: 0, tools: 5, occult: 15, fancy: 10, travel: 0, hire: 5 }, temper: "fair" },
  "fancy-1": { cats: ["arms", "armor", "fancy", "occult", "travel"], level: "high", markups: { arms: 30, armor: 35, gear: 0, tools: 0, occult: 25, fancy: 50, travel: 40, hire: 0 }, temper: "tough" },
  "fancy-2": { cats: ["fancy", "occult", "tools", "arms"], level: "high", markups: { arms: 20, armor: 0, gear: 0, tools: 15, occult: 40, fancy: 30, travel: 0, hire: 0 }, temper: "fair" },
  "humble-1": { cats: ["arms", "gear", "tools", "travel", "hire"], level: "cheap", markups: { arms: -5, armor: 0, gear: -15, tools: -10, occult: 0, fancy: 0, travel: -20, hire: -10 }, temper: "soft" },
  "humble-2": { cats: ["gear", "tools", "fancy", "travel"], level: "cheap", markups: { arms: 0, armor: 0, gear: -10, tools: -5, occult: 0, fancy: -5, travel: -15, hire: 0 }, temper: "soft" },
  "shady-1": { cats: ["arms", "occult", "fancy", "tools", "gear"], level: "high", markups: { arms: -10, armor: 0, gear: 10, tools: 20, occult: 45, fancy: 25, travel: 0, hire: 0 }, temper: "fair" },
  "shady-2": { cats: ["arms", "armor", "occult", "tools", "gear"], level: "high", markups: { arms: -15, armor: -10, gear: 15, tools: 25, occult: 50, fancy: 0, travel: 0, hire: 0 }, temper: "tough" },
};

// ── Prices and stock ────────────────────────────────────────────────────────
// A price level rolls a markup for each shelf within its range, in steps of 5%.
export const LEVELS = {
  cheap: { name: "Cheap", lo: -20, hi: 0 },
  low: { name: "Low markup", lo: 0, hi: 15 },
  high: { name: "High markup", lo: 15, hi: 50 },
};
export const markupName = (m) => (m === 0 ? "list" : `${m > 0 ? "+" : "−"}${Math.abs(m)}%`);
export function rollMarkups(level, random = Math.random) {
  const { lo, hi } = LEVELS[level] || LEVELS.low;
  return Object.fromEntries(SHELF_IDS.map((id) => [id, lo + 5 * Math.floor(random() * ((hi - lo) / 5 + 1))]));
}
export const sameMarkups = (a = {}, b = {}) => SHELF_IDS.every((id) => (a[id] || 0) === (b[id] || 0));
/** The price players see: list price with the shelf's markup. */
export const markedPrice = (item, markups) => Math.max(1, Math.round(item.price * (1 + (markups?.[item.cat] || 0) / 100)));

// The stock roll: each fill level is a base chance of being out, scaled by how
// scarce the thing is. Staples almost never run out; big-ticket goods go first.
export const FILL = { all: 0, full: 0.13, half: 0.42, empty: 0.68 };
export const FILL_NAMES = { all: "Everything", full: "Mostly full", half: "Half-empty", empty: "Mostly empty" };
const scarcity = (item) => (item.price <= 2 ? 0.25 : item.price <= 5 ? 0.5 : item.price <= 20 ? 1 : item.price <= 60 ? 1.4 : 1.9);
/** Ids of the items that are out of stock this opening. */
export function rollStock(items, fill, random = Math.random) {
  const base = FILL[fill] ?? FILL.full;
  return items.filter((it) => random() < Math.min(0.95, base * scarcity(it))).map((it) => it.id);
}

// The keeper's temper: a hidden modifier on haggling, and how much patience
// they have with each shopper (haggling arrives in phase 2).
export const TEMPERS = {
  no: { name: "Won't haggle", hint: "Turns every haggle down." },
  tough: { name: "Stubborn", hint: "Haggles at −2, patience 3. A couple of bad tries and they stop selling to you." },
  fair: { name: "Fair", hint: "Haggles at +0, patience 5: three to five tries before they won't sell you something." },
  soft: { name: "Soft touch", hint: "Haggles at +2, patience 8. A good word goes a long way here." },
};

/** What players see over the door: keeper name, shop name, place, subtitle. */
export function signFor(keeperKey, sign = {}) {
  const k = KEEPERS[keeperKey] || KEEPERS.mags;
  const idx = Math.max(0, Math.min(k.names.length - 1, sign.nameIdx || 0));
  const [name, where, sub] = k.names[idx];
  if (sign.custom?.name) {
    return { keeperName: k.keeper, name: sign.custom.name, where: sign.custom.where || where, sub: `${sub.split(" — ")[0]} — ${k.keeper}, proprietor` };
  }
  return { keeperName: k.keeper, name, where, sub };
}

export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const say = (line, name) => line.replace("{name}", name || "friend");

// ── Times ───────────────────────────────────────────────────────────────────
export const fmtDay = (ms) => new Date(ms).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
export const fmtTime = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase();
export function fromNow(ms, now = Date.now()) {
  const m = Math.round((ms - now) / 60000);
  if (m < 60) return `in ${Math.max(1, m)} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `in ${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.round(h / 24);
  return `in ${d} day${d === 1 ? "" : "s"}`;
}
/** "closes when the session starts, 7:00 pm" etc., for an open shop. */
export function closesText({ closesAt }, nextSessionAt) {
  if (!closesAt) return "open until the DM closes it";
  const c = Date.parse(closesAt);
  if (nextSessionAt && Date.parse(nextSessionAt) === c) return `closes when the session starts, ${fmtTime(c)}`;
  const today = new Date(c).toDateString() === new Date().toDateString();
  return `closes ${today ? "" : `${fmtDay(c)} `}at ${fmtTime(c)}`;
}

/** A keeper's face cropped into a small square or circle (background style). */
export function keeperFaceStyle(key) {
  const sc = SCENES[key] || SCENES.mags, S = 3.3, Sy = S * 0.6;
  const px = Math.max(0, Math.min(1, (S * sc.cx - 0.5) / (S - 1)));
  const py = Math.max(0, Math.min(1, (Sy * (sc.y - 0.04) - 0.5) / (Sy - 1)));
  return { backgroundImage: `url(${sc.src})`, backgroundSize: `${S * 100}% auto`, backgroundPosition: `${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%` };
}
