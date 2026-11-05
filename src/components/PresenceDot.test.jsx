import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PresenceDot from "./PresenceDot";

describe("PresenceDot", () => {
  it("shows the state as a colour class and the words on tap", () => {
    render(<PresenceDot name="Liu Sha" lastSeen="2026-11-05T09:50:00.000Z" now="2026-11-05T10:00:00.000Z" light />);
    const dot = screen.getByRole("img", { name: "Liu Sha · last here 10 min ago" });
    expect(dot.className).toMatch(/presence-dot--recent/);
    expect(dot.className).toMatch(/presence-dot--light/);
    fireEvent.click(dot);
    expect(dot.className).toMatch(/\bopen\b/);
  });
});
