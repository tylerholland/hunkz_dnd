// The DM shop page's help text: the ⓘ notes beside each section and control, and
// the Quick Start tour (design/prototypes/shop-dm-help.html). Copy describes
// what the shop actually does — keep it in step with shopHaggle.js and
// shopData.js. **Bold** marks emphasis; `secret` is what players never see.

export const HELP = {
  status: {
    title: "The shop's status",
    paras: [
      "**Closed**: players see the shutters. **Scheduled**: it opens on its own. **Open**: players can browse, haggle, buy and sell.",
      "**Locking up** gives anyone with a full satchel 2 minutes to pay. Starting combat shuts it until the fight ends.",
    ],
  },
  schedule: {
    title: "Scheduling an opening",
    paras: [
      "Open it a set time before the next session (taken from the Chronicle), or pick your own times — even several days, for downtime.",
      "You don't need to be online: the shop opens and closes itself.",
    ],
  },
  shop: {
    title: "The shop",
    paras: [
      "Pick a **template**: a shopkeeper with their usual shelves, prices and temper. Change anything; your changes are remembered for that keeper.",
      "**Save this shop** keeps a finished set-up under Saved shops, so you can switch between towns.",
    ],
  },
  town: {
    title: "Sign and town",
    paras: ["The name over the door and where the shop is in your world. Leave the town blank to use the sign's suggestion."],
  },
  temper: {
    title: "Temper",
    paras: [
      "How the keeper takes haggling. Each try rolls 2d6 + the shopper's CHA + the temper (Stubborn −2, Fair +0, Soft touch +2).",
      "Patience runs out with bad tries (Stubborn 3, Fair 5, Soft touch 8): first they refuse that item, then they stop haggling with that shopper.",
    ],
    secret: "Players never see the temper. They only get a sense of the keeper's mood, from a hidden WIS roll.",
  },
  buysBack: {
    title: "Buying back",
    paras: ["When on, players can sell items from their pack to this keeper for half the list price."],
  },
  stock: {
    title: "Shelves & stock",
    paras: [
      "Switch a shelf on to carry it. Each shelf gets its own markup and its own stock, rolled from the two settings above.",
      "Tap an item to mark it sold out or back in stock.",
    ],
  },
  prices: {
    title: "Price level",
    paras: ["Rolls each shelf's markup: **Cheap** −20% to list, **Low markup** list to +15%, **High markup** +15% to +50%."],
    secret: "Players see only the marked price, never the markup.",
  },
  stockLevel: {
    title: "Stock level",
    paras: [
      "How much is on the shelves. The roll favours staples: bread and rope rarely run out; armour, mounts and the occult shelf go first.",
      "No rerolling while open; flip single items instead (they show as “Just in”).",
    ],
  },
  markup: {
    title: "A shelf's markup",
    paras: ["Nudge one shelf up or down in 5% steps. The example shows the marked price with the list price struck through."],
  },
  log: {
    title: "Haggling & sales",
    paras: [
      "Every haggle, purchase and sale back during this opening, newest first. It clears when the next opening starts.",
      "Anyone thrown out appears here with **Let back in**: they can shop again, but the keeper won't haggle with them this opening.",
    ],
  },
  catalog: {
    title: "Item catalog",
    paras: [
      "The list prices for every item, from World of Dungeons. Edit names, prices, shelves and notes here.",
      "Changes never alter items players already own: those are their own copies.",
    ],
  },
  csv: {
    title: "Spreadsheet round trip",
    paras: ["Export to edit in a spreadsheet, then import. You'll see what changes before anything is saved; items missing from the file can be hidden rather than deleted."],
  },
};

// Each step spotlights the element marked data-tour={el}; a step whose
// element isn't on the page (e.g. no main action during combat) is skipped.
export const TOUR = [
  { el: "status", title: "Is the shop open?", text: "This bar always shows the shop's state and its one main action. Players only see inside while it's open." },
  { el: "shop", title: "Choose who keeps shop", text: "Pick a shopkeeper template. Each has a usual set of shelves, prices and temper, and their own voice. Set the sign and the town." },
  { el: "temper", title: "Set their temper", text: "How the keeper takes haggling, from Won't haggle to Soft touch. A shopper's CHA helps their haggling. Players only read the keeper's mood, some better than others (WIS)." },
  { el: "stock", title: "Fill the shelves", text: "Choose the price level and how full the shelves are, then reroll until it feels right, or change the options as you choose. Switch shelves on or off, nudge a shelf's markup, or flip single items." },
  { el: "preview", title: "Walk it first", text: "Preview opens the shop as a player sees it, with these settings. Nothing is bought or changed." },
  { el: "main", title: "Open it", text: "Open now, or schedule it under this bar — for instance 45 minutes before the next session. It opens and closes on its own." },
  { el: "catalog", tab: "catalog", title: "The item catalog", text: "Every item and its list price lives here. Edit in place, or export and import a spreadsheet." },
];

// The first-visit banner offers the tour until it's taken or dismissed on this device.
const TOUR_SEEN_KEY = "dnd_shop_tour_seen";
export function tourSeen() {
  try { return localStorage.getItem(TOUR_SEEN_KEY) === "1"; } catch { return true; }
}
export function markTourSeen() {
  try { localStorage.setItem(TOUR_SEEN_KEY, "1"); } catch { /* storage blocked: the banner may show again */ }
}
