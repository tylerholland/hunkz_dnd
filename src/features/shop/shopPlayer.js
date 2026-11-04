// Story 72 — pure helpers for the player's shop page: what the shopper
// already carries, the satchel (kept in this tab until they pay), and where
// the keeper's speech bubble goes.
import { itemArt } from "./shopData";

const lower = (s) => String(s || "").trim().toLowerCase();
// An entry's item type — the catalog item it is (older purchases: bought.itemId).
export const linkedId = (entry) => entry?.itemId || entry?.bought?.itemId || null;
const qtyOf = (entry) => Math.max(0, parseInt(entry?.qty ?? 1, 10) || 0);

/** How many of a catalog item the character already carries. */
export function haveCount(character, item) {
  if (!character) return 0;
  const names = new Set([lower(item.name), lower(`${item.name} (hired)`)]);
  const match = (e) => linkedId(e) === item.id || names.has(lower(e?.name));
  const weapons = (character.weapons || []).filter(match).length;
  const gear = (character.equipment || []).filter(match).reduce((n, e) => n + qtyOf(e), 0);
  return weapons + gear;
}

// The shelf a carried thing belongs to, for its colour and icon.
function shelfFor(entry, catalogById) {
  const fromShop = linkedId(entry) && catalogById.get(linkedId(entry));
  if (fromShop) return { cat: fromShop.cat, id: fromShop.id, icon: fromShop.icon };
  const t = lower(entry?.type);
  if (t === "armor") return { cat: "armor", icon: "armor" };
  if (t === "shield") return { cat: "armor", icon: "shield" };
  if (t === "potion") return { cat: "occult", icon: "flask" };
  if (t === "tool") return { cat: "tools", icon: "pick" };
  return { cat: "gear", icon: "pack" };
}

/** The pack panel: weapons, armour, then everything else, as the sheet holds them. */
export function packGroups(character, catalogById) {
  if (!character) return [];
  const row = (entry, isWeapon) => {
    const shelf = isWeapon ? { cat: "arms", icon: "blade", ...(linkedId(entry) ? { id: linkedId(entry) } : {}) } : shelfFor(entry, catalogById);
    // The item type, when the player's name for it differs ("Dagger of Bone" · Light Weapon).
    const typeName = shelf.id ? catalogById.get(shelf.id)?.name : null;
    return {
      key: entry.id || entry.name,
      name: entry.name || "Unnamed",
      kind: typeName && lower(typeName) !== lower(entry.name).replace(/ \(hired\)$/, "") ? typeName : null,
      note: entry.bought?.from ? "" : (entry.description || "").split("\n")[0].slice(0, 60),
      qty: isWeapon ? 1 : qtyOf(entry),
      worn: entry.equipped !== false && (isWeapon || ["armor", "shield"].includes(lower(entry.type))),
      cat: shelf.cat,
      icon: shelf.icon,
      art: shelf.id ? itemArt(shelf.id, catalogById.get(shelf.id)?.tier, catalogById.get(shelf.id)?.art) : null,
    };
  };
  const weapons = (character.weapons || []).map((w) => row(w, true));
  const equipment = (character.equipment || []).map((e) => row(e, false));
  return [
    { name: "Weapons", rows: weapons },
    { name: "Armour", rows: equipment.filter((r) => r.cat === "armor") },
    { name: "Gear & tools", rows: equipment.filter((r) => r.cat !== "armor") },
  ].filter((g) => g.rows.length);
}

// ── The satchel: this tab only, and only for the current opening ──
const satchelKey = (slug) => `dnd_shop_satchel_${slug}`;
export function loadSatchel(slug, openingId) {
  try {
    const raw = JSON.parse(sessionStorage.getItem(satchelKey(slug)) || "null");
    return raw && raw.openingId === openingId && Array.isArray(raw.lines) ? raw.lines : [];
  } catch {
    return [];
  }
}
export function saveSatchel(slug, openingId, lines) {
  try {
    if (!lines.length) sessionStorage.removeItem(satchelKey(slug));
    else sessionStorage.setItem(satchelKey(slug), JSON.stringify({ openingId, lines }));
  } catch {
    // storage unavailable: the satchel just won't survive a reload
  }
}

/**
 * Where the speech bubble sits over the scene: just right of the keeper's
 * face at mouth height; if that leaves too little room before the item card,
 * left of the face; failing both, under the chin. Sizes in px.
 */
export function placeBubble(scene, { width: W, height: H, naturalWidth: iw, naturalHeight: ih }) {
  if (!W || !H || !iw || !ih) return null;
  const k = Math.max(W / iw, H / ih);
  const rw = iw * k, rh = ih * k;
  const [px, py] = scene.pos.split(" ").map((v) => parseFloat(v) / 100);
  const ox = (W - rw) * px, oy = (H - rh) * py;
  const at = (fx, fy) => [ox + fx * rw, oy + fy * rh];
  const floatLeft = W * 0.975 - Math.min(320, W * 0.32);
  const [right, top] = at(scene.r, scene.y);
  const room = floatLeft - 24 - (right + 14);
  if (room >= 230) return { mode: "right", style: { left: right + 14, top, maxWidth: Math.min(340, room) } };
  const [left] = at(scene.l, scene.y);
  if (left - 30 >= 190) {
    const w = Math.min(340, left - 30);
    return { mode: "left", style: { left: left - 14 - w, top, width: w, maxWidth: "none" } };
  }
  const [cx, chin] = at(scene.cx, scene.chin);
  const w = Math.min(340, floatLeft - 24 - Math.max(16, cx - 60));
  const l = Math.max(16, Math.min(cx - 60, floatLeft - 24 - w));
  return { mode: "below", style: { left: l, top: chin + 14, width: w, maxWidth: "none", "--tail-x": `${Math.max(20, Math.min(w - 20, cx - l))}px` } };
}

/** Coins fly from the Pay button to the keeper's counter. */
export function flyCoins(fromEl, sceneEl, total) {
  const from = fromEl?.getBoundingClientRect();
  const to = sceneEl?.getBoundingClientRect();
  if (!from || !to || typeof document === "undefined") return;
  const tx = to.left + to.width * 0.45, ty = to.top + to.height * 0.72;
  const n = Math.min(14, Math.max(4, Math.round(total / 6)));
  for (let i = 0; i < n; i += 1) {
    const c = document.createElement("div");
    c.className = "sp-flycoin";
    c.style.left = `${from.left + from.width / 2}px`;
    c.style.top = `${from.top}px`;
    document.body.appendChild(c);
    const dx = tx - from.left - from.width / 2, dy = ty - from.top;
    const anim = c.animate?.([
      { transform: "translate(0,0)", opacity: 1 },
      { transform: `translate(${dx / 2 + (Math.random() - 0.5) * 90}px, ${dy / 2 - 140}px) scale(1.2)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx + (Math.random() - 0.5) * 60}px, ${dy}px) scale(0.6)`, opacity: 0.2 },
    ], { duration: 750 + i * 45, easing: "cubic-bezier(.4,0,.6,1)" });
    if (anim) anim.onfinish = () => c.remove(); else c.remove();
  }
}
