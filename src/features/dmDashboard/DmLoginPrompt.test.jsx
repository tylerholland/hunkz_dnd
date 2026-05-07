import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PALETTES } from "../characterSheet/theme";
import { PalCtx } from "./dashboardShared";
import DmLoginPrompt from "./DmLoginPrompt";

const apiMocks = vi.hoisted(() => ({
  getDmParty: vi.fn(),
}));

vi.mock("../../api", () => ({
  getDmParty: apiMocks.getDmParty,
}));

describe("DmLoginPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the DM Campaign label", () => {
    render(
      <PalCtx.Provider value={PALETTES.ember}>
        <DmLoginPrompt onSuccess={() => {}} />
      </PalCtx.Provider>
    );

    expect(screen.getByText("DM Campaign")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter Campaign" })).toBeInTheDocument();
  });

  it("renders the animated checking state instead of the password form when checking stored creds", () => {
    render(
      <PalCtx.Provider value={PALETTES.ember}>
        <DmLoginPrompt onSuccess={() => {}} checking />
      </PalCtx.Provider>
    );

    expect(screen.getByText("Checking DM Access")).toBeInTheDocument();
    expect(screen.getByTestId("dm-auth-loader")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Password")).not.toBeInTheDocument();
  });

  it("stores the DM password and calls onSuccess after a successful login", async () => {
    const onSuccess = vi.fn();
    apiMocks.getDmParty.mockResolvedValueOnce({ party: [] });

    render(
      <PalCtx.Provider value={PALETTES.ember}>
        <DmLoginPrompt onSuccess={onSuccess} />
      </PalCtx.Provider>
    );

    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "swordfish" } });
    fireEvent.click(screen.getByRole("button", { name: "Enter Campaign" }));

    await waitFor(() => {
      expect(apiMocks.getDmParty).toHaveBeenCalledWith("swordfish");
      expect(onSuccess).toHaveBeenCalledWith("swordfish");
      expect(sessionStorage.getItem("dnd_dm_password")).toBe("swordfish");
    });
  });
});
