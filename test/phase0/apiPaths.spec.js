// Phase 0, step 0.5 (frontend) — api.js names the campaign in campaign calls.
// src/lib/apiPaths.js:
//   currentCampaignId() — VITE_DEFAULT_CAMPAIGN, else "hunkz"; setCurrentCampaign(id)
//   currentLibraryId()  — "hunkz" until the campaign says otherwise; setCurrentLibrary(id)
//   campaignPath(path)  → `/c/${campaign}${path}`;  libraryPath(path) → `/libraries/${library}${path}`
// Pages don't change: api.js's exported functions keep their signatures.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const urls = [];
beforeEach(() => {
  urls.length = 0;
  vi.stubGlobal("fetch", vi.fn(async (url) => { urls.push(String(url)); return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const pathOf = (url) => new URL(url, "https://api.example").pathname;
// Imported per test (not statically), so a missing module fails its own tests only.
const APIPATHS = "../../src/lib/apiPaths.js";
const loadApiPaths = () => import(/* @vite-ignore */ APIPATHS);

describe("apiPaths", () => {
  it("builds campaign and library paths, defaulting to hunkz", async () => {
    const p = await loadApiPaths();
    expect(p.currentCampaignId()).toBe("hunkz");
    expect(p.campaignPath("/initiative")).toBe("/c/hunkz/initiative");
    expect(p.libraryPath("/npc-library")).toBe("/libraries/hunkz/npc-library");
    p.setCurrentCampaign("drowned-lantern");
    expect(p.campaignPath("/session-state")).toBe("/c/drowned-lantern/session-state");
    expect(() => p.setCurrentCampaign("Bad Id")).toThrow();
  });
});

describe("api.js uses them", () => {
  it("sends campaign calls under /c/<campaign> and character calls as before", async () => {
    const api = await import("../../src/api.js");
    await api.getSessionState({ slug: "eoghan" });
    await api.putHouseRules("pw", { abilityCheckDice: "2d6" });
    await api.putVote("pw", "open", {});
    await api.getChronicle();
    await api.putInitiative("pw", { entries: [] });
    await api.getMapLibrary();
    await api.putSilence("pw", "start");
    await api.getCharacter("eoghan");
    await api.postCharacterRoll("eoghan", { label: "Free Roll" });
    const paths = urls.map(pathOf);
    for (const p of paths.slice(0, 7)) expect(p).toMatch(/\/c\/hunkz\//);
    expect(paths[7]).toMatch(/\/characters\/eoghan$/);
    expect(paths[8]).toMatch(/\/characters\/eoghan\/rolls$/);
  });

  it("sends library calls under /libraries/<library>", async () => {
    const api = await import("../../src/api.js");
    await api.getNpcLibrary("pw");
    await api.getTalentCodex();
    for (const p of urls.map(pathOf)) expect(p).toMatch(/\/libraries\/hunkz\//);
  });
});
