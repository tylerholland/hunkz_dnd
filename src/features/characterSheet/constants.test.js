import { describe, expect, it } from "vitest";

import { normalizeSpells, buildAttackEntries } from "./constants";

describe("normalizeSpells", () => {
  it("returns [] for a missing/non-array field", () => {
    expect(normalizeSpells(undefined)).toEqual([]);
    expect(normalizeSpells(null)).toEqual([]);
  });

  it("promotes bare legacy strings to deterministic-id objects, role absent", () => {
    const result = normalizeSpells(["Fire Bolt", "Shield"]);
    expect(result).toEqual([
      { id: "legacy:0:Fire Bolt", name: "Fire Bolt" },
      { id: "legacy:1:Shield", name: "Shield" },
    ]);
    // No role key at all — never role: undefined as an explicit value check via 'in'.
    expect("role" in result[0]).toBe(false);
  });

  it("passes structured entries through unchanged (including role/level/toHit/damage)", () => {
    const spell = { id: "abc123", name: "Eldritch Blast", role: "attack", level: 0, toHit: "+7", damage: "1d10" };
    expect(normalizeSpells([spell])).toEqual([spell]);
  });

  it("handles a mixed array of legacy strings and structured entries", () => {
    const result = normalizeSpells(["Prestidigitation", { id: "xyz", name: "Cure Wounds", role: "heal" }]);
    expect(result).toEqual([
      { id: "legacy:0:Prestidigitation", name: "Prestidigitation" },
      { id: "xyz", name: "Cure Wounds", role: "heal" },
    ]);
  });

  it("keeps duplicate spell names distinct by index-derived id", () => {
    const result = normalizeSpells(["Magic Missile", "Magic Missile"]);
    expect(result[0].id).not.toBe(result[1].id);
    expect(result.map((s) => s.name)).toEqual(["Magic Missile", "Magic Missile"]);
  });

  it("produces stable ids across repeated calls on the same legacy input (poll-tick safety)", () => {
    const spells = ["Fire Bolt", "Shield"];
    expect(normalizeSpells(spells)).toEqual(normalizeSpells(spells));
  });

  it("drops malformed entries (no name, empty string) rather than throwing", () => {
    expect(normalizeSpells(["", { role: "attack" }, 42, null])).toEqual([]);
  });
});

describe("buildAttackEntries", () => {
  const weapon = { id: "w1", name: "Longsword", description: "A blade.", mods: [{ attribute: "Attack Bonus", value: 5 }, { attribute: "Damage", value: "1d8+3" }] };
  const attackSpell = { id: "s1", name: "Fire Bolt", role: "attack", toHit: "+7", damage: "2d10" };
  const healSpell = { id: "s2", name: "Cure Wounds", role: "heal" };
  const unsetSpell = { id: "s3", name: "Prestidigitation" };

  it("weapons only -> header 'Weapons', no spell entries", () => {
    const { entries, weaponEntries, spellEntries, header } = buildAttackEntries({ weapons: [weapon], spells: [] });
    expect(header).toBe("Weapons");
    expect(weaponEntries).toHaveLength(1);
    expect(spellEntries).toHaveLength(0);
    expect(entries).toHaveLength(1);
  });

  it("weapons + attack spells -> header 'Weapons & Spells', weapons first then spells, heal/unset excluded", () => {
    const { entries, header } = buildAttackEntries({ weapons: [weapon], spells: [attackSpell, healSpell, unsetSpell] });
    expect(header).toBe("Weapons & Spells");
    expect(entries.map((e) => e.kind)).toEqual(["weapon", "spell"]);
    expect(entries.map((e) => e.id)).toEqual(["w1", "s1"]);
  });

  it("attack spells only, no weapons -> header 'Spells' (e.g. a Wizard)", () => {
    const { entries, header, weaponEntries } = buildAttackEntries({ weapons: [], spells: [attackSpell] });
    expect(header).toBe("Spells");
    expect(weaponEntries).toHaveLength(0);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("spell");
  });

  it("both empty -> header still 'Weapons' (caller is responsible for not rendering the section at all)", () => {
    const { entries, header } = buildAttackEntries({ weapons: [], spells: [] });
    expect(entries).toHaveLength(0);
    expect(header).toBe("Weapons");
  });

  it("Story 57 — passes spell.level through to the entry (0 = cantrip, absent stays absent, never coerced via || 0)", () => {
    const cantrip = { id: "s4", name: "Fire Bolt", role: "attack", level: 0, toHit: "+7", damage: "1d10" };
    const leveled = { id: "s5", name: "Scorching Ray", role: "attack", level: 2, toHit: "+7", damage: "2d6" };
    const unspecified = { id: "s6", name: "Mystery Bolt", role: "attack", toHit: "+7", damage: "1d6" };
    const { spellEntries } = buildAttackEntries({ weapons: [], spells: [cantrip, leveled, unspecified] });
    expect(spellEntries.find((e) => e.id === "s4").level).toBe(0);
    expect(spellEntries.find((e) => e.id === "s5").level).toBe(2);
    expect(spellEntries.find((e) => e.id === "s6").level).toBeUndefined();
  });
});
