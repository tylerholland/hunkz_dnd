// The phase 0 test suite (design/architecture/multi-campaign-plan.md) — kept
// out of the main run until each step is built. `npm run test:phase0`.
import base from "./vite.config.js";

export default { ...base, test: { ...base.test, include: ["test/phase0/**/*.spec.{js,jsx}"] } };
