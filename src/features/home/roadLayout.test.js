import { describe, expect, it } from "vitest";
import { daysBetween, initials, layoutRoad, sessionTitle, toRoman, upcomingSession } from "./roadLayout";

const now = new Date(2026, 9, 23, 15, 0);

describe("roadLayout", () => {
  it("strips the date suffix the DM tends to put in a title", () => {
    expect(sessionTitle("Up From The Gutter · Wed, Jul 22")).toBe("Up From The Gutter");
    expect(sessionTitle("Through the Lair of the Carrion Crawler· Tue, Sep 29")).toBe("Through the Lair of the Carrion Crawler");
    expect(sessionTitle("Ordinary Johan")).toBe("Ordinary Johan");
  });

  it("counts calendar days, ignoring the hour", () => {
    expect(daysBetween(new Date(2026, 8, 29, 23, 0), new Date(2026, 9, 23, 1, 0))).toBe(24);
  });

  it("describes an upcoming session, and forgets one that's long past", () => {
    const next = upcomingSession({ at: new Date(2026, 9, 30, 19, 0).toISOString() }, now);
    expect(next.label).toBe("Fri, Oct 30, 7 PM");
    expect(next.when).toBe("in 7 days");
    expect(upcomingSession({ at: new Date(2026, 9, 23, 19, 30).toISOString() }, now).when).toBe("today");
    expect(upcomingSession({ at: new Date(2026, 9, 20, 19, 0).toISOString() }, now)).toBeNull();
    expect(upcomingSession(null, now)).toBeNull();
  });

  it("puts the flag at the next session when it's ahead, else none", () => {
    const sessions = [
      { id: "a", startAt: new Date(2026, 6, 22, 19).toISOString() },
      { id: "b", startAt: new Date(2026, 8, 29, 19).toISOString() },
    ];
    const withNext = layoutRoad({ sessions, now, next: new Date(2026, 9, 30, 19) });
    expect(withNext.flag.x).toBeGreaterThan(withNext.today.x);
    expect(withNext.points[1].latest).toBe(true);
    expect(withNext.points[0].x).toBeLessThan(withNext.points[1].x);
    expect(withNext.months.map((m) => m.label)).toEqual(["Aug", "Sep", "Oct", "Nov"]);
    expect(layoutRoad({ sessions, now }).flag).toBeNull();
  });

  it("makes initials and chapter numerals", () => {
    expect(initials("Goblin Boss")).toBe("GB");
    expect(toRoman(4)).toBe("IV");
  });
});
