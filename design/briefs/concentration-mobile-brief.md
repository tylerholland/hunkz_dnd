# Concentration Banner — Mobile Fix Brief

> Fixes the active concentration section in the player combat tab on narrow mobile viewports.
> No redesign — targeted layout fix only.

---

## 1. Problem diagnosis

`.cs-conc-banner` is a `display: flex; justify-content: space-between` row with no `flex-wrap`. The left block (dot + label/spell name) has no `min-width: 0`, and the "Drop Concentration" button carries `white-space: nowrap`. At narrow viewports (≤ ~360px), the button's intrinsic width (~155px) plus the spell-name block exhausts the row, forcing overflow — the button clips to "DROP CONCENTRA…".

**Relevant rules in `src/features/characterSheet/characterSheet.css`:**
- `.cs-conc-banner` (line 861) — missing `flex-wrap`
- `.cs-conc-banner-left` (line 872) — missing `min-width: 0`
- `.cs-conc-drop-btn` (line 902) — `white-space: nowrap` correct but needs full-width fallback at narrow widths

---

## 2. Design intent

The banner communicates one thing at a glance: *you are concentrating on X, and you can drop it.* On mobile, the action (drop) should never be harder to reach or read than on desktop. The banner should never overflow its container.

Preferred behavior at narrow widths:
- Spell name stays on top row (full width), readable and unclipped.
- "Drop Concentration" button wraps to a second row, full-width, with adequate tap target height.
- No text truncation on either element.

---

## 3. Recommended changes

### CSS-only fix — `characterSheet.css`

**`.cs-conc-banner`** — add `flex-wrap: wrap`:

```css
.cs-conc-banner {
  border: 1px solid var(--pal-accent);
  border-radius: 4px;
  padding: 11px 16px;
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;          /* NEW — allows button to wrap to second row */
}
```

**`.cs-conc-banner-left`** — add `min-width: 0` and `flex: 1 1 auto` so it can compress before wrapping:

```css
.cs-conc-banner-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;             /* NEW — allows spell name to compress/wrap */
  flex: 1 1 auto;           /* NEW — takes available space before button wraps */
}
```

**`.cs-conc-spell`** — add `overflow-wrap: anywhere` so very long spell names don't force overflow:

```css
.cs-conc-spell {
  font-family: var(--font-display);
  font-size: 15px;
  color: var(--pal-accent-bright);
  overflow-wrap: anywhere;  /* NEW — long names wrap gracefully */
}
```

**Mobile breakpoint** — at ≤ 480px, force button to full width for a better tap target:

```css
@media (max-width: 480px) {
  .cs-conc-drop-btn {
    width: 100%;
    padding: 9px 12px;      /* taller tap target on touch */
    text-align: center;
  }
}
```

---

## 4. Size and breakpoint spec

| Property | Value |
|---|---|
| Wrap breakpoint | 480px (consistent with existing player-sheet breakpoints) |
| Button full-width padding | `9px 12px` (versus desktop `5px 12px`) |
| Min tap target height | 38px (9+9 padding + 11px font + line-height) |

---

## 5. Motion

No animation changes needed. The layout adjustment is structural; no transition is required.

---

## 6. Files to touch

- `src/features/characterSheet/characterSheet.css` — the four changes above (`.cs-conc-banner`, `.cs-conc-banner-left`, `.cs-conc-spell`, new `@media` block)
- No JSX changes needed — the class names and structure are correct as-is.
