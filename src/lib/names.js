// Short names for compact spots — a portrait with a name under it, a chip, a
// button — so a long name doesn't stretch the row. A quoted epithet ("The
// Sound of a Hearthfire Burning" Quietclaw) and a leading "Mr." drop off, and
// anything still long shortens to its first word. Put the full name in a
// title attribute where it's shortened.
const MAX = 14;

export function shortName(name) {
  const full = String(name || "").trim();
  const bare = full.replace(/^["“][^"”]*["”]\s*/, "").replace(/^Mr\.\s+/, "").trim() || full;
  return bare.length > MAX ? bare.split(/\s+/)[0] : bare;
}
