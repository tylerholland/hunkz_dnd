# Ironwhistle's Emporium — item art prompts

Item art for the shop: one square (1:1) image per item, shown in the round item frames. The style matches the shop scene (`design/prototypes/assets/shop-mags.jpg`): cinematic, realistic fantasy, rich materials, warm lantern light. The difference is that each item sits alone in the centre against a **quiet backdrop coloured by its category**, so the goods stand out and the shelves read as a set.

## How to use these

1. **Lock the style first.** Generate the first item (the Martial Weapon is a good test). When you like one, use it as a style reference for every other prompt by adding `--sref <that image's URL>`, alongside the shop scene: `--sref <item URL> <shop scene URL>`. Add `--sw 150` if items drift in style.
2. **Paste the template** with the item's subject and its category's backdrop (below) filled in.
3. **Keep the item centred, with room around it.** The frame is a circle, so anything in the corners gets cut off. The template asks for space around the item; reroll if it touches the edges.
4. **Generic items** (Light Weapon, Martial Weapon and so on) are drawn as one representative piece. The subject lines say which.
5. **Save each as** `item-<id>.png` (ids are in the tables) and send them to me. I'll upload them and attach them to the catalog.

### Template

```
a single [SUBJECT], centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; [BACKDROP]; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

### Backdrops by category

Each category has its own colour, deep and muted so it never competes with the item. The shop uses the same colours for its category tabs.

| Category | Backdrop (paste into `[BACKDROP]`) |
|---|---|
| Arms | `smooth deep oxblood-crimson backdrop with a soft dark vignette` |
| Armour | `smooth deep steel-blue backdrop with a soft dark vignette` |
| Adventuring gear | `smooth deep warm umber-brown backdrop with a soft dark vignette` |
| Tools | `smooth deep moss-olive green backdrop with a soft dark vignette` |
| Occult | `smooth deep violet-plum backdrop with a faint drifting haze and a soft dark vignette` |
| Fancy goods | `smooth deep teal backdrop with a soft dark vignette` |
| Mounts & carts | `smooth deep ochre-gold backdrop with a soft dark vignette` |
| Hirelings | `smooth deep slate-navy backdrop with a soft dark vignette` |

Hirelings and animals are people and creatures, so swap the template's "no people" for "single figure, waist-up portrait" (hirelings) or "full body, standing in profile" (mounts).

---

## Arms (oxblood backdrop)

| id | Item | `[SUBJECT]` |
|---|---|---|
| `light-weapon` | Light Weapon | `well-worn short sword with a leather-wrapped grip and a small crossguard, beside a slim dagger` |
| `martial-weapon` | Martial Weapon | `steel longsword with a fuller down the blade, brass pommel and crossguard, leather grip` |
| `great-weapon` | Great Weapon | `massive two-handed battle-axe with a broad crescent blade on a long iron-banded haft` |
| `shortbow` | Shortbow | `small recurved shortbow of dark wood with a waxed string, a sling coiled beside it` |
| `bow` | Bow | `crossbow of oak and blackened steel with a loaded bolt` |
| `heavy-bow` | Heavy Bow / Gun | `heavy arbalest with a steel prod and a crank windlass, and an ornate flintlock musket` |

## Armour (steel-blue backdrop)

| id | Item | `[SUBJECT]` |
|---|---|---|
| `light-armor` | Light Armour | `hardened brown leather cuirass with riveted shoulder guards and buckled straps, on a simple wooden stand` |
| `full-armor` | Full Armour | `full suit of polished plate armor with a visored great helm, on an armor stand` |
| `shield` | Shield | `round wooden shield with an iron boss and a painted heraldic rim, slightly battered` |

## Adventuring gear (umber backdrop)

| id | Item | `[SUBJECT]` |
|---|---|---|
| `rope` | 20ft Rope | `neat coil of thick hemp rope tied with a cord` |
| `spike` | Iron Spike | `three hand-forged iron spikes with flattened heads` |
| `chalk` | Chalk | `a few sticks of white chalk in an open small cloth pouch, chalk dust` |
| `parchment` | Parchment | `small stack of rolled and flat parchment sheets tied with string` |
| `flint` | Flint & Steel | `flint stone and curved fire steel striker with a spark, beside a tinder pouch` |
| `torches` | Torches (4) | `bundle of four wooden torches wrapped in pitch-soaked cloth, one lit` |
| `tent` | Tent | `rolled canvas tent bundle with wooden poles and pegs, tied with leather straps` |
| `dice` | Dice | `pair of carved bone dice and a small leather dice cup` |
| `caltrops` | Caltrops | `handful of spiked iron caltrops spilling from a small sack` |
| `bandages` | Bandages | `rolls of linen bandages and a small clay jar of salve` |
| `rations` | Travel Rations | `travel rations wrapped in cloth: hard bread, cheese wheel, dried meat and an apple` |
| `waterskin` | Waterskin | `leather waterskin with a wooden stopper and carrying strap` |
| `wineskin` | Wineskin | `stained leather wineskin with a brass spout, a drop of red wine on it` |

## Tools (moss-olive backdrop)

| id | Item | `[SUBJECT]` |
|---|---|---|
| `crowbar` | Crowbar | `heavy iron crowbar, slightly rusted, with a split claw end` |
| `hatchet` | Hatchet | `small woodsman's hatchet with a hickory handle` |
| `trap` | Animal Trap | `iron jaw-trap with a chain and stake, set open` |
| `lockpicks` | Lockpicks | `set of fine steel lockpicks fanned out on an open leather roll` |
| `ink` | Pen & Pot of Ink | `quill pen and a squat glass pot of black ink` |
| `fishing` | Fishing Pole | `simple wooden fishing pole with line, a bobber and a hooked lure` |
| `shovel` | Shovel | `sturdy iron spade with a worn wooden handle` |
| `grapple` | Grappling Hook | `four-pronged iron grappling hook with a length of rope tied on` |
| `pickaxe` | Pickaxe | `miner's pickaxe with an iron head and a scuffed ash handle` |
| `pole` | Collapsible Pole | `collapsible ten-foot pole of nested wooden sections with brass ferrules, partly extended` |

## Occult (violet backdrop, faint haze)

| id | Item | `[SUBJECT]` |
|---|---|---|
| `quicksilver` | Quicksilver (dose) | `small stoppered glass vial of shimmering liquid quicksilver, mirror-bright, sealed with black wax` |
| `bone-dust` | Pouch of Bone Dust | `small drawstring leather pouch spilling pale grey bone dust, a tiny finger bone beside it` |
| `holy-water` | Vial of Holy Water | `glass vial of clear holy water glowing with a soft golden light, a silver cap stamped with a sun symbol` |
| `blood` | Vial of Blood | `slender glass vial of dark red blood, wax-sealed, with a hand-written tag` |
| `incense` | Ritual Incense & Oils | `brass censer with curling incense smoke and two small oil bottles beside it` |

## Fancy goods (teal backdrop)

| id | Item | `[SUBJECT]` |
|---|---|---|
| `mirror` | Mirror | `ornate oval hand mirror with a tarnished silver frame` |
| `lantern` | Lantern | `iron and brass lantern with horn windows, a warm flame glowing inside` |
| `spyglass` | Spyglass | `brass and leather spyglass, partly extended` |
| `timer` | Sand Timer | `hourglass sand timer in a carved wooden frame, sand mid-flow` |
| `boardgame` | Board Game | `small folding wooden game board with carved pieces mid-game` |
| `clothes` | Elaborate Clothes | `folded embroidered velvet doublet with gold thread and a feathered cap on top` |
| `holy-symbol` | Holy Symbol | `silver holy symbol amulet on a chain, a sunburst inlaid with a small gem` |
| `fire-oil` | Fire Oil (flask) | `stoppered clay flask of fire oil with a cloth wick, faint flames licking the neck` |

## Mounts & carts (ochre backdrop; full body, in profile)

| id | Item | `[SUBJECT]` |
|---|---|---|
| `mule` | Mule | `sturdy grey mule with a pack saddle and bundles` |
| `horse` | Horse | `brown riding horse with a simple leather saddle and bridle` |
| `warhorse` | Warhorse | `massive armored warhorse in steel barding and a caparison` |
| `cart` | Cart | `small two-wheeled wooden handcart` |
| `wagon` | Wagon | `four-wheeled covered wagon with a canvas top` |
| `rowboat` | Rowboat | `small wooden rowboat with two oars` |

## Hirelings (slate-navy backdrop; single figure, waist-up)

| id | Item | `[SUBJECT]` |
|---|---|---|
| `torchbearer` | Torch Bearer | `scrawny nervous young torch bearer in a patched tunic holding a lit torch, a knife at the belt` |
| `guide` | Guide | `weathered wilderness guide in a travel cloak with a lantern and a coil of rope` |
| `armsman` | Armsman | `stern armsman in light armor with a spear and a round shield` |
| `expert` | Expert | `sharp-eyed expert in a hooded jacket with a bow over the shoulder and a dagger` |
| `champion` | Champion | `towering veteran champion in full plate armor holding a halberd, a sword at the hip` |

---

## Ready to paste: every item

Each prompt below already has its subject and backdrop filled in. Copy them one after another; the file name to save each as is above its prompt. To keep the style consistent, add `--sref <your style image URL>` (and `--sw 150` if needed) to the end of each prompt before submitting.

### Arms

**item-light-weapon.png** — Light Weapon
```
a well-worn short sword with a leather-wrapped grip and a small crossguard, beside a slim dagger, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep oxblood-crimson backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-martial-weapon.png** — Martial Weapon
```
a single steel longsword with a fuller down the blade, brass pommel and crossguard, leather grip, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep oxblood-crimson backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-great-weapon.png** — Great Weapon
```
a single massive two-handed battle-axe with a broad crescent blade on a long iron-banded haft, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep oxblood-crimson backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-shortbow.png** — Shortbow
```
a single small recurved shortbow of dark wood with a waxed string, a sling coiled beside it, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep oxblood-crimson backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-bow.png** — Bow
```
a single crossbow of oak and blackened steel with a loaded bolt, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep oxblood-crimson backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-heavy-bow.png** — Heavy Bow / Gun
```
a heavy arbalest with a steel prod and a crank windlass, and an ornate flintlock musket, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep oxblood-crimson backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

### Armour

**item-light-armor.png** — Light Armour
```
a single hardened brown leather cuirass with riveted shoulder guards and buckled straps, on a simple wooden stand, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep steel-blue backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-full-armor.png** — Full Armour
```
a single full suit of polished plate armor with a visored great helm, on an armor stand, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep steel-blue backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-shield.png** — Shield
```
a single round wooden shield with an iron boss and a painted heraldic rim, slightly battered, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep steel-blue backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

### Adventuring gear

**item-rope.png** — 20ft Rope
```
a single neat coil of thick hemp rope tied with a cord, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep warm umber-brown backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-spike.png** — Iron Spike
```
three hand-forged iron spikes with flattened heads, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep warm umber-brown backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-chalk.png** — Chalk
```
a few sticks of white chalk in an open small cloth pouch, chalk dust, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep warm umber-brown backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-parchment.png** — Parchment
```
a small stack of rolled and flat parchment sheets tied with string, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep warm umber-brown backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-flint.png** — Flint & Steel
```
a flint stone and curved fire steel striker with a spark, beside a tinder pouch, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep warm umber-brown backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-torches.png** — Torches (4)
```
a bundle of four wooden torches wrapped in pitch-soaked cloth, one lit, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep warm umber-brown backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-tent.png** — Tent
```
a single rolled canvas tent bundle with wooden poles and pegs, tied with leather straps, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep warm umber-brown backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-dice.png** — Dice
```
a pair of carved bone dice and a small leather dice cup, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep warm umber-brown backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-caltrops.png** — Caltrops
```
a handful of spiked iron caltrops spilling from a small sack, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep warm umber-brown backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-bandages.png** — Bandages
```
rolls of linen bandages and a small clay jar of salve, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep warm umber-brown backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-rations.png** — Travel Rations
```
travel rations wrapped in cloth: hard bread, cheese wheel, dried meat and an apple, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep warm umber-brown backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-waterskin.png** — Waterskin
```
a single leather waterskin with a wooden stopper and carrying strap, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep warm umber-brown backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-wineskin.png** — Wineskin
```
a single stained leather wineskin with a brass spout, a drop of red wine on it, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep warm umber-brown backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

### Tools

**item-crowbar.png** — Crowbar
```
a single heavy iron crowbar, slightly rusted, with a split claw end, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep moss-olive green backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-hatchet.png** — Hatchet
```
a single small woodsman's hatchet with a hickory handle, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep moss-olive green backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-trap.png** — Animal Trap
```
a single iron jaw-trap with a chain and stake, set open, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep moss-olive green backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-lockpicks.png** — Lockpicks
```
a set of fine steel lockpicks fanned out on an open leather roll, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep moss-olive green backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-ink.png** — Pen & Pot of Ink
```
a quill pen and a squat glass pot of black ink, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep moss-olive green backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-fishing.png** — Fishing Pole
```
a single simple wooden fishing pole with line, a bobber and a hooked lure, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep moss-olive green backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-shovel.png** — Shovel
```
a single sturdy iron spade with a worn wooden handle, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep moss-olive green backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-grapple.png** — Grappling Hook
```
a single four-pronged iron grappling hook with a length of rope tied on, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep moss-olive green backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-pickaxe.png** — Pickaxe
```
a single miner's pickaxe with an iron head and a scuffed ash handle, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep moss-olive green backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-pole.png** — Collapsible Pole
```
a single collapsible ten-foot pole of nested wooden sections with brass ferrules, partly extended, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep moss-olive green backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

### Occult

**item-quicksilver.png** — Quicksilver (dose)
```
a single small stoppered glass vial of shimmering liquid quicksilver, mirror-bright, sealed with black wax, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep violet-plum backdrop with a faint drifting haze and a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-bone-dust.png** — Pouch of Bone Dust
```
a single small drawstring leather pouch spilling pale grey bone dust, a tiny finger bone beside it, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep violet-plum backdrop with a faint drifting haze and a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-holy-water.png** — Vial of Holy Water
```
a single glass vial of clear holy water glowing with a soft golden light, a silver cap stamped with a sun symbol, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep violet-plum backdrop with a faint drifting haze and a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-blood.png** — Vial of Blood
```
a single slender glass vial of dark red blood, wax-sealed, with a hand-written tag, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep violet-plum backdrop with a faint drifting haze and a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-incense.png** — Ritual Incense & Oils
```
a brass censer with curling incense smoke and two small oil bottles beside it, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep violet-plum backdrop with a faint drifting haze and a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

### Fancy goods

**item-mirror.png** — Mirror
```
a single ornate oval hand mirror with a tarnished silver frame, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep teal backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-lantern.png** — Lantern
```
a single iron and brass lantern with horn windows, a warm flame glowing inside, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep teal backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-spyglass.png** — Spyglass
```
a single brass and leather spyglass, partly extended, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep teal backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-timer.png** — Sand Timer
```
a single hourglass sand timer in a carved wooden frame, sand mid-flow, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep teal backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-boardgame.png** — Board Game
```
a small folding wooden game board with carved pieces mid-game, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep teal backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-clothes.png** — Elaborate Clothes
```
a folded embroidered velvet doublet with gold thread and a feathered cap on top, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep teal backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-holy-symbol.png** — Holy Symbol
```
a single silver holy symbol amulet on a chain, a sunburst inlaid with a small gem, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep teal backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

**item-fire-oil.png** — Fire Oil (flask)
```
a single stoppered clay flask of fire oil with a cloth wick, faint flames licking the neck, centered, shown whole with generous empty space around it, three-quarter view, resting slightly angled as if on display; smooth deep teal backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no hands, no people --ar 1:1 --v 7 --style raw
```

### Mounts & carts

**item-mule.png** — Mule
```
a single sturdy grey mule with a pack saddle and bundles, full body, standing in profile, centered with generous empty space around it; smooth deep ochre-gold backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no people --ar 1:1 --v 7 --style raw
```

**item-horse.png** — Horse
```
a single brown riding horse with a simple leather saddle and bridle, full body, standing in profile, centered with generous empty space around it; smooth deep ochre-gold backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no people --ar 1:1 --v 7 --style raw
```

**item-warhorse.png** — Warhorse
```
a single massive armored warhorse in steel barding and a caparison, full body, standing in profile, centered with generous empty space around it; smooth deep ochre-gold backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no people --ar 1:1 --v 7 --style raw
```

**item-cart.png** — Cart
```
a single small two-wheeled wooden handcart, centered, shown whole with generous empty space around it, three-quarter view; smooth deep ochre-gold backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no people --ar 1:1 --v 7 --style raw
```

**item-wagon.png** — Wagon
```
a single four-wheeled covered wagon with a canvas top, centered, shown whole with generous empty space around it, three-quarter view; smooth deep ochre-gold backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no people --ar 1:1 --v 7 --style raw
```

**item-rowboat.png** — Rowboat
```
a single small wooden rowboat with two oars, centered, shown whole with generous empty space around it, three-quarter view; smooth deep ochre-gold backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light, subtle shadow beneath; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text, no people --ar 1:1 --v 7 --style raw
```

### Hirelings

**item-torchbearer.png** — Torch Bearer
```
a scrawny nervous young torch bearer in a patched tunic holding a lit torch, a knife at the belt, single figure, waist-up portrait, centered with generous empty space around the head and shoulders, facing the viewer at a slight angle; smooth deep slate-navy backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text --ar 1:1 --v 7 --style raw
```

**item-guide.png** — Guide
```
a weathered wilderness guide in a travel cloak with a lantern and a coil of rope, single figure, waist-up portrait, centered with generous empty space around the head and shoulders, facing the viewer at a slight angle; smooth deep slate-navy backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text --ar 1:1 --v 7 --style raw
```

**item-armsman.png** — Armsman
```
a stern armsman in light armor with a spear and a round shield, single figure, waist-up portrait, centered with generous empty space around the head and shoulders, facing the viewer at a slight angle; smooth deep slate-navy backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text --ar 1:1 --v 7 --style raw
```

**item-expert.png** — Expert
```
a sharp-eyed expert in a hooded jacket with a bow over the shoulder and a dagger, single figure, waist-up portrait, centered with generous empty space around the head and shoulders, facing the viewer at a slight angle; smooth deep slate-navy backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text --ar 1:1 --v 7 --style raw
```

**item-champion.png** — Champion
```
a towering veteran champion in full plate armor holding a halberd, a sword at the hip, single figure, waist-up portrait, centered with generous empty space around the head and shoulders, facing the viewer at a slight angle; smooth deep slate-navy backdrop with a soft dark vignette; soft warm key light from upper left, gentle rim light; cinematic realistic fantasy, rich detailed materials and textures, high detail, no text --ar 1:1 --v 7 --style raw
```

---

## Category art (optional)

The shop's category tabs can show one hero image each. Use the template with that category's backdrop and these subjects:

| Category | `[SUBJECT]` |
|---|---|
| Arms | `crossed longsword and battle-axe over a crossbow` |
| Armour | `plate helm resting on a round shield` |
| Adventuring gear | `traveler's pack with a coiled rope, a torch and a waterskin` |
| Tools | `pickaxe, shovel and crowbar leaning together` |
| Occult | `glowing potion vials around a small skull and a censer` |
| Fancy goods | `lit brass lantern beside a spyglass and a hand mirror` |
| Mounts & carts | `pack mule beside a small cart` |
| Hirelings | `a lantern-bearing guide and an armored armsman side by side` |
