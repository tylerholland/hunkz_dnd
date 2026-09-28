// Story 69 — who is looking at the Chronicle, from the credentials this
// browser already holds: the DM password, or any character passwords the
// player has unlocked (sessionStorage `dnd_char_<slug>`).

export function readChronicleViewer() {
  let dmPassword = null;
  const characters = [];
  try {
    dmPassword = sessionStorage.getItem("dnd_dm_password");
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith("dnd_char_")) {
        const password = sessionStorage.getItem(key);
        if (password !== null) characters.push({ slug: key.slice("dnd_char_".length), password });
      }
    }
  } catch {
    // storage unavailable — read-only view
  }
  if (dmPassword) return { role: "dm", password: dmPassword, characters };
  if (characters.length) return { role: "player", characters };
  return { role: "anon", characters: [] };
}

/** Credentials for API calls: the DM, or the chosen character. */
export function viewerCredentials(viewer, asSlug) {
  if (viewer.role === "dm") return { password: viewer.password };
  const character = viewer.characters.find((c) => c.slug === asSlug) || viewer.characters[0];
  return character ? { password: character.password, asSlug: character.slug } : null;
}

export function viewerPaletteKey(viewer, asSlug) {
  try {
    if (viewer.role === "dm") return sessionStorage.getItem("dnd_dm_palette") || "ocean";
    const slug = asSlug || viewer.characters[0]?.slug;
    return (slug && sessionStorage.getItem(`dnd_palette_${slug}`)) || "ocean";
  } catch {
    return "ocean";
  }
}
