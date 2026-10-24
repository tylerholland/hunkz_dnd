import { describe, expect, it } from "vitest";
import { cardName } from "./roadLayout";

describe("cardName", () => {
  it("keeps at most five words or 24 characters, whichever comes first", () => {
    expect(cardName("\"The Sound of a Hearthfire Burning\" Quietclaw")).toBe("\"The Sound of a Hearthfi…");
    expect(cardName("Eòghan MacGille Fàth")).toBe("Eòghan MacGille Fàth");
    expect(cardName("Bartholomew Fizzlewhistle Thunderbottom")).toBe("Bartholomew Fizzlewhistl…");
    expect(cardName("Liu Sha")).toBe("Liu Sha");
  });
});
