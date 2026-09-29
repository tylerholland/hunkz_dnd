// Party member detail for other players (Story 61). Everything is computed
// here so players get finished numbers — never the inventory those numbers
// come from (weapons/equipment stay private between players by design).

const ABILITIES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];

function toInt(value) {
  const parsed = parseInt(String(value ?? "").trim(), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function equippedItems(item) {
  return [...(item?.weapons || []), ...(item?.equipment || [])].filter((i) => i && i.equipped !== false);
}

function itemBonus(item, attribute) {
  return equippedItems(item).reduce((sum, gear) => (
    sum + (gear.mods || []).filter((m) => m && m.attribute === attribute).reduce((s, m) => s + toInt(m.value), 0)
  ), 0);
}

const names = (list) => (Array.isArray(list) ? list : [])
  .map((entry) => (typeof entry === "string" ? entry : entry?.name))
  .filter((n) => typeof n === "string" && n.trim())
  .map((n) => n.trim());

function buildPartyCard(item) {
  const stats = Array.isArray(item?.stats) ? item.stats : [];
  const abilityMods = Object.fromEntries(ABILITIES.map((stat) => {
    const entry = stats.find((s) => (s?.stat ?? s?.name) === stat);
    const score = entry && Number.isFinite(Number(entry.score)) ? Number(entry.score) : 10;
    return [stat, Math.floor((score - 10) / 2) + itemBonus(item, stat)];
  }));
  const armorClass = toInt(item?.armorTotal) + itemBonus(item, "Armor");
  const spells = (Array.isArray(item?.spells) ? item.spells : [])
    .map((s) => (typeof s === "string" ? { name: s } : s))
    .filter((s) => s && typeof s.name === "string" && s.name.trim())
    .map((s) => ({
      name: s.name.trim(),
      ...(typeof s.description === "string" && s.description.trim() ? { description: s.description.trim().slice(0, 600) } : {}),
      ...(Number.isFinite(s.level) ? { level: s.level } : {}),
      ...(s.role === "attack" || s.role === "heal" ? { role: s.role } : {}),
    }));
  // Spell slots (per level: max / used) — shown when a teammate's card is
  // expanded, so the party can tell who still has a heal left.
  const spellSlots = (Array.isArray(item?.spellSlots) ? item.spellSlots : [])
    .filter((slot) => slot && Number.isFinite(Number(slot.level)) && Number(slot.max) > 0)
    .map((slot) => ({
      level: Number(slot.level),
      max: Number(slot.max),
      used: Math.max(0, Math.min(Number(slot.max), Number(slot.used) || 0)),
      ...(slot.isPactMagic ? { isPactMagic: true } : {}),
    }));
  return {
    race: typeof item?.race === "string" ? item.race : "",
    charClass: typeof item?.charClass === "string" ? item.charClass : "",
    subclass: typeof item?.subclass === "string" ? item.subclass : "",
    level: Number.isFinite(Number(item?.level)) ? Number(item.level) : null,
    armorClass: armorClass > 0 ? armorClass : null,
    abilityMods,
    skills: names(item?.skills),
    specialAbilities: names(item?.specialAbilities),
    spells,
    spellSlots,
  };
}

module.exports = { buildPartyCard };
