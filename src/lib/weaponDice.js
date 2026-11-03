// What a weapon rolls when its owner hasn't set their own Damage: its shop
// item type's dice, by the table's rules (DM Settings → Weapon damage). The
// map rides session-state's houseRules (`weaponDice: { itemId: "d6+1" }`);
// pages register it here so every attack list reads the same thing.
let byItem = {};

export function setWeaponDice(map) {
  byItem = map && typeof map === "object" ? map : {};
}

/** An inventory entry's item type (older purchases carry it as bought.itemId). */
export const linkedItemId = (entry) => entry?.itemId || entry?.bought?.itemId || null;

/** The dice a weapon entry rolls: its own Damage, else its type's, else "". */
export function weaponDamage(weapon) {
  const own = weapon?.mods?.find((m) => m.attribute === "Damage")?.value;
  if (own) return own;
  const id = linkedItemId(weapon);
  return (id && typeof byItem[id] === "string" && byItem[id]) || "";
}
