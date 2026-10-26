# Shop scene prompts

One scene per shop, in the same style as Ironwhistle's Emporium (`design/prototypes/assets/shop-mags.jpg`).

**Layout the shop page relies on** (all prompts below are written for it):
- The shopkeeper is in the **left third**, waist-up, behind a counter, face about 40% down the frame. Her or his speech bubble sits just right of the face.
- The **right third** shows the shop receding into depth, darker and calmer, with no other people. The item card floats there.
- The **bottom strip** is counter top. The purse and satchel sit there.
- 5:3, Midjourney v7, `--style raw`.

**Keeping the look consistent:** add `--sref <URL of the Mags image> --sw 200` to the end of each prompt. Add `--no beard` for any female dwarf or halfling, and `--no text, letters` if signage turns into gibberish.

---

## Ironwhistle's Emporium (done)

Magpie "Mags" Ironwhistle, dwarf, vast cluttered multi-level emporium. Middle of the range: grand in scale, shabby in finish.

---

## Aurelian & Daughters, Purveyors: grand

An elven outfitter to nobility in a marble arcade. Suggested temper: **Stubborn**, high markup.

```
a tall elegant elderly high-elf gentleman merchant in the left foreground, waist-up, standing behind a polished black marble counter inlaid with gold, long silver hair tied back, thin gold-rimmed spectacles low on his nose, deep emerald velvet coat with gold embroidery and a high collar, rings on long fingers resting on a velvet display cloth, cool appraising half-smile, looking at the viewer; on the counter a jeweller's loupe, a small brass balance and a neat stack of gold coins; behind him a grand vaulted marble hall stretching into the distance on the right: white columns, glass-fronted display cabinets of jewelled daggers and silvered swords, a suit of gilded parade armour on a pedestal, an elegant longbow mounted on the wall, shelves of crystal potion phials glowing pale blue and gold, rolled maps and leather-bound books, a crystal chandelier, tall stained-glass windows casting coloured light across a polished floor, the far right of the frame quieter and in soft shadow, no other people; cinematic fantasy concept art, hyper-detailed, realistic materials and textures, dramatic chiaroscuro lighting, warm and cool contrast, depth and atmosphere, Unreal Engine render quality --ar 5:3 --v 7 --style raw
```

---

## Underbough's Sundries: humble

A halfling grandfather's general store in a farming village. Suggested temper: **Soft touch**, cheap.

```
a plump cheerful elderly halfling grandfather shopkeeper in the left foreground, waist-up, leaning on a worn knotted-pine counter, curly white hair and bushy white sideburns, rosy cheeks, small round spectacles, rolled shirtsleeves, patched green waistcoat and a flour-dusted apron, a clay pipe in one hand, warm twinkling smile, looking at the viewer; on the counter a tin cash box, a few copper and silver coins, a wheel of cheese and a jar of boiled sweets; behind him a cramped low-beamed village shop under a thatched roof stretching back on the right: bundles of drying herbs and onions hanging from the beams, sacks of grain and flour, wooden barrels and crates, a few honest tools on pegs (a hatchet, a shovel, a pickaxe, coils of rope), one old dented sword and a round wooden shield above the hearth, tallow candles and a single lantern, a small stone hearth with a low fire, an old hound asleep on a rag rug, a small diamond-paned window with soft afternoon light, the far right of the frame quieter and in soft shadow, no other people; cinematic fantasy concept art, hyper-detailed, realistic materials and textures, warm cosy lighting, gentle chiaroscuro, depth and atmosphere, Unreal Engine render quality --ar 5:3 --v 7 --style raw
```

---

## The Drowned Lantern: shady

A tiefling fence's dockside den: occult goods, no questions. Suggested temper: **Fair**, high markup on the occult shelf, cheap on arms ("fell off a cart").

```
a sly young tiefling woman fence in the left foreground, waist-up, lounging behind a scarred driftwood counter, deep plum skin, curling black horns hung with tiny silver chains, long dark hair in a loose braid, gold-capped canine tooth, kohl-lined amber eyes, a dark leather coat with the collar turned up over a wine-red silk scarf, many mismatched rings, a coin walking across her knuckles, knowing crooked grin, looking at the viewer; on the counter a lockpick roll, a skull-shaped candle and a scatter of foreign coins; behind her a low cellar beneath a dockside warehouse stretching back on the right: dripping stone arches and wet wooden piles, fishing nets and ropes, crates stamped with foreign marks, a rack of mismatched second-hand swords and crossbows, shelves of murky occult jars, bone charms, dried bats and vials of strange glowing green liquid, an iron cage with a single raven, green-glass lanterns casting sickly light, river water glinting through a grate, mist low on the floor, the far right of the frame darker and in deep shadow, no other people; cinematic fantasy concept art, hyper-detailed, realistic materials and textures, moody chiaroscuro lighting, cold green and warm candle contrast, depth and atmosphere, Unreal Engine render quality --ar 5:3 --v 7 --style raw
```

### Second keeper for The Drowned Lantern

Same cellar, different fence: an ancient goblin broker perched up on crates so he's level with you. Suggested temper: **Stubborn** (he's heard every story), but a big roll charms him.

```
a wizened ancient goblin fence in the left foreground, waist-up, perched on a stack of crates behind a scarred driftwood counter so his face is level with the viewer, grey-green wrinkled skin, enormous ragged ears pierced with brass and bone rings, one milky blind eye and one sharp yellow eye behind a cracked jeweller's loupe, long crooked nose, a few wisps of white hair, a moth-eaten fur-collared coat far too big for him over a stained silk waistcoat, a chain of mismatched keys around his neck, long knobbly fingers steepled over a ledger, sly gap-toothed grin, looking at the viewer; on the counter an open ledger, a quill, a candle stub and a little hoard of foreign coins; behind him a low cellar beneath a dockside warehouse stretching back on the right: dripping stone arches and wet wooden piles, fishing nets and ropes, crates stamped with foreign marks, a rack of mismatched second-hand swords and crossbows, shelves of murky occult jars, bone charms, dried bats and vials of strange glowing green liquid, an iron cage with a single raven, green-glass lanterns casting sickly light, river water glinting through a grate, mist low on the floor, the far right of the frame darker and in deep shadow, no other people; cinematic fantasy concept art, hyper-detailed, realistic materials and textures, moody chiaroscuro lighting, cold green and warm candle contrast, depth and atmosphere, Unreal Engine render quality --ar 5:3 --v 7 --style raw
```

If he comes out cartoonish, add "realistic goblin, grotesque but dignified, aged leathery skin", or `--no cartoon, cute`.

---

## If something drifts

| Problem | Fix |
|---|---|
| The keeper is small or centred | Add "large in frame, close to the viewer" after "waist-up". |
| Extra customers appear | Strengthen it to "the shop is empty apart from the shopkeeper", or add `--no crowd, customers`. |
| The right side is too busy for the item card | Add "the right side of the image softly out of focus". |
| Style drifts from Mags | Raise `--sw` to 300, or drop the style words and rely on `--sref`. |
| Halfling comes out as a child | Add "elderly, wrinkled, grandfatherly" and "adult proportions". |

Name the files like the Mags one, e.g. `shop-aurelian.jpg`, `shop-underbough.jpg`, `shop-drowned-lantern.jpg`. Expression variants work the same as for Mags: Vary (Region) on the face, with Remix on.
