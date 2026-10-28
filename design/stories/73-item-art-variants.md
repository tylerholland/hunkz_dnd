# Feature Story 73: Item Art Variants

**Status**: Backlog — not started (written 2026-10-27, to revisit when more item art exists).
**Builds on**: Story 72 (The Item Shop) — item art lives in `public/art/shop/items/<id>.jpg`, listed in `ART_IDS` in `src/features/shop/shopData.js`.

## Goal

A little variety in the shop's pictures keeps it fresh. Some items have more than one good image; the shop should sometimes show a different one, so the same shelves don't look identical every opening or in every shop. The item itself never changes — same name, price, stats and notes; only the picture varies.

## What exists today

Unused alternates already sit in `design/art/items/` (Tyler's Midjourney PNGs, not yet converted). The first take wasn't always ideal and a second try came out interesting, so these are worth keeping:

| Item id | Live picture from | Alternates |
|---|---|---|
| `full-armor` | `item-full-armor.png` | `item-full-armor-2.png` |
| `holy-symbol` | `item-holy-symbol.png` | `item-holy-symbol-2.png`, `item-holy-symbol-3.png` |
| `shield` | `item-shield.png` | `item-shield-2.png` |
| `shortbow` | `item-shortbow.png` | `item-shortbow-2.png` |
| `torches` | `item-torches.png` | `item-torch-2.png` |
| `waterskin` | `item-waterskin.png` | `item-waterskin-2.png` |
| `tent` | `item-tent-2.png` (already swapped in) | `item-tent.png` |

More will come as Tyler makes more art; the design should take any number per item.

## Suggested approach (to settle when we pick this up)

- **Files**: convert alternates like the rest (480×480 JPEG, quality 80) as `public/art/shop/items/<id>-2.jpg`, `<id>-3.jpg`… The base `<id>.jpg` stays the default.
- **Data**: an `ART_VARIANTS` count per item id beside `ART_IDS` (e.g. `{ "holy-symbol": 3, shield: 2 }`), with the art-files test extended to check every variant file exists.
- **Choosing**: pick a variant from a stable hash of the **shop opening id + item id** (or saved shop + item), not `Math.random()` per render — so every player sees the same picture during one opening, it doesn't flicker on polling, and it changes next time.
- **Per shop flavour (optional)**: let a keeper lean towards some variants (a shady shop's battered shield, a fancy shop's polished one) — only if the art supports it.
- **Where it applies**: the shop's shelves, item-in-hand view and receipt. Items already in a character's pack: decide whether they keep the picture they were bought with (store the variant on purchase in `bought`) or always show the base image.
- **DM side**: the DM page could show which variant is up, and perhaps pin one — only if wanted.

## Open questions

- Should a bought item remember its picture?
- Purely random per opening, or does the DM get any control?
- Do Mags's expression variants (Story 72, still open) follow the same mechanism?
