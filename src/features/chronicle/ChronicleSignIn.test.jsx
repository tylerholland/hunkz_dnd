import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listCharacters: vi.fn(),
  verifyPassword: vi.fn(),
}));
vi.mock("../../api", () => api);

import ChronicleSignIn from "./ChronicleSignIn";
import { readChronicleViewer } from "./chronicleViewer";

describe("ChronicleSignIn", () => {
  beforeEach(() => {
    api.listCharacters.mockResolvedValue([{ slug: "eoghan", name: "Eoghan" }, { slug: "aragorn", name: "Aragorn" }]);
  });
  afterEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  async function signIn(password) {
    const onSignedIn = vi.fn();
    render(<ChronicleSignIn onSignedIn={onSignedIn} />);
    await screen.findByRole("option", { name: "Eoghan" });
    fireEvent.change(screen.getByLabelText("Character"), { target: { value: "eoghan" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    return onSignedIn;
  }

  it("unlocks a player's character in this tab", async () => {
    api.verifyPassword.mockResolvedValue({ valid: true, role: "owner" });
    const onSignedIn = await signIn("hunter2");
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith("eoghan"));
    expect(api.verifyPassword).toHaveBeenCalledWith("eoghan", "hunter2");
    expect(readChronicleViewer()).toMatchObject({ role: "player", characters: [{ slug: "eoghan", password: "hunter2" }] });
  });

  it("signs the DM in when the DM password is used", async () => {
    api.verifyPassword.mockResolvedValue({ valid: true, role: "dm" });
    const onSignedIn = await signIn("swordfish");
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(readChronicleViewer().role).toBe("dm");
  });

  it("says so when the password is wrong and saves nothing", async () => {
    api.verifyPassword.mockResolvedValue({ valid: false });
    const onSignedIn = await signIn("nope");
    expect(await screen.findByRole("alert")).toHaveTextContent("didn't work");
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(readChronicleViewer().role).toBe("anon");
  });
});
