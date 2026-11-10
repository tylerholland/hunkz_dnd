// Short names for compact spots — a portrait with a name under it, a chip, a
// button — so a long name doesn't stretch the row. A quoted epithet ("The
// Sound of a Hearthfire Burning" Quietclaw) and a leading "Mr." drop off, and
// anything still long shortens to its first word. Put the full name in a
// title attribute where it's shortened.
const MAX = 14;

/** The name without a quoted epithet or a leading "Mr." — never cut short. */
export function bareName(name) {
  const full = String(name || "").trim();
  return full.replace(/^["“][^"”]*["”]\s*/, "").replace(/^Mr\.\s+/, "").trim() || full;
}

export function shortName(name) {
  const bare = bareName(name);
  return bare.length > MAX ? bare.split(/\s+/)[0] : bare;
}
