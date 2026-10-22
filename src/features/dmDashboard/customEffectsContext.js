import { createContext } from "react";

// Story 70 — the DM dashboard provides { create(name, kind) } so condition
// pickers deep in the tree can add a custom effect to the table's house rules
// (resolving to the effect's name once saved, or throwing).
export const CustomEffectsCtx = createContext(null);
