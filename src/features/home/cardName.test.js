import { describe, expect, it } from "vitest";
import { cardName, plateName } from "./roadLayout";

describe("cardName", () => {
  it("keeps at most five words or 24 characters, whichever comes first", () => {
    expect(cardName("\"The Sound of a Hearthfire Burning\" Quietclaw")).toBe("\"The Sound of a Hearthfi…");
    expect(cardName("Eòghan MacGille Fàth")).toBe("Eòghan MacGille Fàth");
    expect(cardName("Bartholomew Fizzlewhistle Thunderbottom")).toBe("Bartholomew Fizzlewhistl…");
    expect(cardName("Liu Sha")).toBe("Liu Sha");
  });

  it("shortens a name for the orb's nameplate", () => {
    expect(plateName("\"The Sound of a Hearthfire Burning\" Quietclaw")).toBe("Quietclaw");
    expect(plateName("Eòghan MacGille Fàth")).toBe("Eòghan");
    expect(plateName("Mr. Meanjeans")).toBe("Meanjeans");
    expect(plateName("Liu Sha")).toBe("Liu");
    expect(plateName("Aesop")).toBe("Aesop");
  });
});
