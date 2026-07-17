import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DeathSavesStrip from "./DeathSavesStrip";

describe("DeathSavesStrip", () => {
  it("renders the death saves pip row when mounted at 0 HP", () => {
    render(
      <DeathSavesStrip
        char={{ slug: "aragorn", deathSaves: { successes: 0, failures: 0 } }}
        optimisticHp={0}
        mounted
        isFallen={false}
        setIsFallen={vi.fn()}
        isStable={false}
        setIsStable={vi.fn()}
        commitSessionFields={vi.fn(() => Promise.resolve(true))}
        onForceHpTo1={vi.fn()}
      />
    );

    expect(screen.getByText("Death Saves")).toBeInTheDocument();
    expect(screen.getByTitle("Success 1")).toBeInTheDocument();
    expect(screen.getByTitle("Failure 1")).toBeInTheDocument();
  });

  it("renders the FALLEN tombstone state when isFallen is true", () => {
    render(
      <DeathSavesStrip
        char={{ slug: "aragorn", deathSaves: { successes: 0, failures: 3 } }}
        optimisticHp={0}
        mounted
        isFallen
        setIsFallen={vi.fn()}
        isStable={false}
        setIsStable={vi.fn()}
        commitSessionFields={vi.fn(() => Promise.resolve(true))}
        onForceHpTo1={vi.fn()}
      />
    );

    expect(screen.getByText("Fallen")).toBeInTheDocument();
  });
});
