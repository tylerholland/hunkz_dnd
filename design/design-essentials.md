# Design essentials

Start here for an HTML prototype. Search the full [design system](design-system.md) only for the affected component pattern, token, or layout. Use the current UI and relevant source/CSS to resolve stale descriptions.

## Product and hierarchy

A D&D tool used during play: players need quick character actions; the DM must scan party/combat state while narrating. Prioritize readable state and fast, reversible actions.

- Tier 1: combat-critical HP, turns, conditions, and immediate actions.
- Tier 2: secondary resources such as XP/coin.
- Tier 3: on-demand details such as notes and configuration.
- Preserve existing theme character, typography, active-turn indicators, and shared token effects. Keep dense information legible; reduce competing visual emphasis.

## Visual foundations

- Cinzel: headings/stat numbers; Crimson Text: body; IM Fell English: labels/UI.
- Use existing palette roles (`bg`, `surface`, `surfaceSolid`, `border`, `accent`, `accentBright`, `text`, `textBody`, `textMuted`) through CSS variables. Exact values: `src/features/characterSheet/theme.jsx`. Use the affected character's palette or ocean by default; shared UI must also support light vellum.
- **Light palettes (vellum) invert the tokens**: `accentBright` is its darkest brown, `accentDim` is translucent, and `accent` is dark. Treatments that read well on dark palettes — "mix in N% accent", fills built from `accentDim`, glows — come out muddy, dark or see-through there. For any wash, highlight or fill, set a per-palette value (light palettes use roughly a third of the accent strength, over a warm off-white), always put an opaque base under overlays (`surfaceSolid`), and check vellum in the prototype before calling it done.
- Typical headings 18–24px, body 15–16px, stats 28–36px. Keep text at least 12px unless the user approves a specific exception. Match existing spacing and component shapes.
- Touch targets at least 44×44px; keyboard access and visible focus. Hover must not be required. Label icon-only actions accessibly.
- Motion should explain a change. Prefer existing durations/easing, preserve meaningful transitions, and provide reduced-motion alternatives. Do not add animation to every incidental update.

## Prototype deliverable

One self-contained `design/prototypes/<feature>.html` with embedded CSS/vanilla JS, no build step, and no live API writes. Google Fonts may be loaded with the import from the Fonts section of the full design system.

Show the affected surface with realistic data, working interactions, relevant empty/error/overflow states, and responsive desktop/mobile behavior. Include only states that matter to the change. For asynchronous actions, demonstrate pending/success/failure recovery when relevant.

The prototype is the primary design artifact. Include a short implementation note (HTML comments or a companion note, roughly 10–20 lines) covering behavior, state/data assumptions, significant edge cases, and unresolved decisions. Do not require a separate story or long brief. User approval of the prototype precedes application implementation.

Validate the preview visually and exercise its controls when a browser is available; report limitations honestly. Update this guide only when shared design principles change; feature details belong in their own artifacts.
