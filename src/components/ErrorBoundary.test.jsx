import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

function Boom() {
  throw new Error("bad persona entry");
}

describe("ErrorBoundary", () => {
  it("shows the error message instead of a blank page", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <MemoryRouter>
        <ErrorBoundary><Boom /></ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("bad persona entry");
  });
});
