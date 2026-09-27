import { beforeEach, describe, expect, it } from "vitest";
import { acceptVersion, characterVersionKey, noteVersions, resetVersionFloors } from "./versionFloors";

describe("versionFloors", () => {
  beforeEach(() => resetVersionFloors());

  it("drops a poll older than this screen's own write", () => {
    noteVersions({ [characterVersionKey("eoghan")]: 12 }); // our write produced v12
    expect(acceptVersion("char:eoghan", 11)).toBe(false); // in-flight poll from before it
    expect(acceptVersion("char:eoghan", 12)).toBe(true);
    expect(acceptVersion("char:eoghan", 13)).toBe(true); // someone else's later write
  });

  it("never steps backwards between polls (out-of-order responses)", () => {
    expect(acceptVersion("map-library", 40)).toBe(true);
    expect(acceptVersion("map-library", 39)).toBe(false);
    expect(acceptVersion("map-library", 40)).toBe(true); // same data again is fine
  });

  it("tracks records independently and accepts unversioned data", () => {
    noteVersions({ initiative: 5, "npc-combat": 2 });
    expect(acceptVersion("initiative", 4)).toBe(false);
    expect(acceptVersion("npc-combat", 2)).toBe(true);
    expect(acceptVersion("initiative", undefined)).toBe(true);
  });
});
