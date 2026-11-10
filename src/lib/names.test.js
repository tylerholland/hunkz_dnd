import { describe, expect, it } from "vitest";
import { shortName } from "./names";

describe("shortName", () => {
  it("drops a quoted epithet", () => {
    expect(shortName('"The Sound of a Hearthfire Burning" Quietclaw')).toBe("Quietclaw");
    expect(shortName("“Smiles” Meanjeans")).toBe("Meanjeans");
  });
  it("keeps short names whole", () => {
    expect(shortName("Liu Sha")).toBe("Liu Sha");
    expect(shortName("Aesop")).toBe("Aesop");
  });
  it("shortens long names to the first word", () => {
    expect(shortName("Bartholomew Thistlewood III")).toBe("Bartholomew");
  });
  it("copes with blanks and a quote-only name", () => {
    expect(shortName("")).toBe("");
    expect(shortName('"Ghost"')).toBe('"Ghost"');
  });
});
