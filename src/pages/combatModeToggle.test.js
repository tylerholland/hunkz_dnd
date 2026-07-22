import { describe, it, expect } from "vitest";
import { computeMapSwitch } from "./combatModeToggle";

const ADV = { id: "map-adv", name: "Forest", tokens: [], mapMode: "adventure" };
const BAT = { id: "map-bat", name: "Dungeon", tokens: [], mapMode: "battle" };

function lib({ activeMapId = "map-adv", adventureMapId = null, battleMapId = null } = {}) {
  return { activeMapId, adventureMapId, battleMapId, maps: [ADV, BAT] };
}

describe("computeMapSwitch — full setup (both maps registered)", () => {
  it("returns switch action with correct modeOpts when entering combat", () => {
    const result = computeMapSwitch(false, lib({
      activeMapId:    "map-adv",
      adventureMapId: "map-adv",
      battleMapId:    "map-bat",
    }));
    expect(result.action).toBe("switch");
    expect(result.incomingMap.id).toBe("map-bat");
    expect(result.modeOpts).toEqual({ adventureMapId: "map-adv", battleMapId: "map-bat" });
  });

  it("returns switch action with correct modeOpts when leaving combat", () => {
    const result = computeMapSwitch(true, lib({
      activeMapId:    "map-bat",
      adventureMapId: "map-adv",
      battleMapId:    "map-bat",
    }));
    expect(result.action).toBe("switch");
    expect(result.incomingMap.id).toBe("map-adv");
    expect(result.modeOpts).toEqual({ adventureMapId: "map-adv", battleMapId: "map-bat" });
  });

  it("returns none (not switch) when the incoming map is already the active map", () => {
    // Edge case: both mode slots point to the same map.
    const result = computeMapSwitch(false, lib({
      activeMapId:    "map-bat",
      adventureMapId: "map-bat",
      battleMapId:    "map-bat",
    }));
    // incomingMap.id === currentActiveMapId → must not switch
    expect(result.action).not.toBe("switch");
  });
});

describe("computeMapSwitch — first-time setup (no maps registered yet)", () => {
  it("records the current map as adventureMapId when entering combat with nothing registered", () => {
    // This is the common first-run case: adventure map was already active,
    // DM couldn't click 'Set Active' on it (no button for already-active maps),
    // so adventureMapId was never written. Toggle should record it now.
    const result = computeMapSwitch(false, lib({
      activeMapId:    "map-adv",
      adventureMapId: null,
      battleMapId:    null,
    }));
    expect(result.action).toBe("record");
    expect(result.incomingMap).toBeNull();
    expect(result.modeOpts).toEqual({ adventureMapId: "map-adv" });
  });

  it("records the current map as battleMapId when leaving combat with nothing registered", () => {
    const result = computeMapSwitch(true, lib({
      activeMapId:    "map-bat",
      adventureMapId: null,
      battleMapId:    null,
    }));
    expect(result.action).toBe("record");
    expect(result.modeOpts).toEqual({ battleMapId: "map-bat" });
  });

  it("records adventure map even when only the battle map is registered (partial setup)", () => {
    // DM registered battle map but never registered adventure map yet.
    const result = computeMapSwitch(false, lib({
      activeMapId:    "map-adv",
      adventureMapId: null,
      battleMapId:    "map-bat",
    }));
    // battleMapId is registered but incomingId (battleMapId) IS in the library
    // and IS different from active — so this is actually a switch.
    expect(result.action).toBe("switch");
    expect(result.incomingMap.id).toBe("map-bat");
    // Also records adventureMapId alongside the switch
    expect(result.modeOpts.adventureMapId).toBe("map-adv");
    expect(result.modeOpts.battleMapId).toBe("map-bat");
  });
});

describe("computeMapSwitch — edge cases", () => {
  it("returns none when no active map exists at all", () => {
    const result = computeMapSwitch(false, lib({ activeMapId: null }));
    expect(result.action).toBe("none");
    expect(result.modeOpts).toBeNull();
  });

  it("handles missing mapLibrary gracefully", () => {
    const result = computeMapSwitch(false, null);
    expect(result.action).toBe("none");
  });
});
