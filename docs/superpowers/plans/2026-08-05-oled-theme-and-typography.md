# OLED theme and typography implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: not started.** Paused by the user on 2026-08-05 immediately after the
direction was chosen and the colour inventory taken. Nothing below has been
built. The glyph fix that prompted this work is already shipped (`ee48c60`) and
is *not* part of this plan.

**Goal:** Give the app deliberate typography and a single OLED-black palette
that both the CSS and the canvas draw from, replacing ~86 scattered colour
literals and the current absence of any font declaration.

**Architecture:** One `Theme.ts` is the source of truth. It stamps CSS custom
properties onto `:root` *and* exports the same values as a plain object, because
canvas cannot read CSS variables — that dual consumption is the whole reason
this module exists rather than a stylesheet of `:root` vars. Inter ships inside
the ipk so glyph coverage and metrics stop being a property of the TV. Theme
*switching* is plumbed (the palette is a parameter, not a constant) but only one
palette ships; a picker is deliberately out of scope until this is judged on the
C5.

**Tech Stack:** React 18.3.1 (legacy `ReactDOM.render`), react-scripts 5.0.1,
TypeScript 4.9.5, Jest 27, @enact/moonstone 4.5.6, `@fontsource/inter`.

## Decisions already made (user, 2026-08-05)

| Question | Answer |
|---|---|
| Visual direction | **OLED true black.** Pure `#000` base — on the C5's OLED those pixels are physically off. |
| Typography | **Bundle Inter** (SIL OFL 1.1, ~45KB woff2 subset) rather than a system stack. |
| Scope | **Tokens + one new look.** Switching plumbed, one theme shipped. No picker UI. |

## The palette

Role names, never colour names — `--surface-base`, not `--black`. A future
palette must be able to be light without every token lying about itself.

```
surfaceBase     #000000   the page. Pixels off on OLED.
surfaceRaised   #0E0E11   category bar, EPG sidebar, info bar, panels
surfaceCard     #1C1C21   focused/selected row fill, dropdown rows
textPrimary     #FFFFFF
textSecondary   #8A8F98   sub-titles, counts, timestamps
textMuted       #5A5F68   disabled, placeholder
accent          #3EA6FF   SELECTION only — active filter, current channel
focus           #FFC53D   FOCUS RING only — nothing else, ever
danger          #E0483D   record dot, recording markers
favorite        #FFC53D   the ★ (shares the focus hue deliberately; it is the
                          only non-focus use, and it is a persistent state
                          marker rather than a transient cursor)
```

**The discipline this enforces:** today amber does four jobs — focus ring,
favourites, the "new" badge, and the empty-list banner. On a 10-foot screen
that is the main reason the UI reads as busy rather than deliberate. After this
plan, `focus` means "the D-pad cursor is here" and nothing else; the "new" badge
and the empty banner move to `accent` and `textSecondary` respectively.

## Global Constraints

- **Canvas geometry constants must not change.** `ChannelList`'s
  `mChannelLayoutHeight`, `mCategoryBarHeight` (= `CategoryBar.BAR_HEIGHT`) and
  the column offsets are duplicated in `src/utils/ChannelListGeometry.ts` for
  pointer hit-testing. This plan is colour and type only. If a restyle step
  wants a different row height, both consumers change together and
  `ChannelListGeometry.test.ts` must be updated in the same commit — otherwise
  drawn rows and click targets go out of step.
- **`src/config/Config.ts`'s mock/prod toggle is never "fixed".** Its commented
  imports are load-bearing. Verify layout with a static markup harness against
  the real `app.css` instead (pattern established in
  `scratchpad/glyph-harness.html`).
- **`npm run build` before every push.** CRA's eslint runs inside the build and
  catches errors invisible to both `tsc --noEmit` and jest. This project has
  been bitten twice. `CI=false` suppresses only the known ilib
  dynamic-require warnings.
- **Tests run through CRA**, not bare jest: `CI=true npx react-scripts test`.
  Bare `npx jest` fails with `@babel/parser` errors.
- **No new characters outside `GlyphCoverage.test.ts`'s allowlist.** UI chrome
  is drawn in CSS. If a step wants a symbol, it draws it.
- **Mutation-test every new guard.** Reintroduce the defect, confirm the test
  fails, restore. A guard that has never failed is not known to work.

## What is actually there right now

Measured 2026-08-05, before any of this work:

| Surface | Colour literals | Notes |
|---|---|---|
| `src/styles/app.css` | 66 | includes four near-identical darks: `rgba(5,8,12,.97)`, `rgba(5,16,24,.9)`, `rgba(11,39,58,.7)`, `rgba(11,39,58,.95)` |
| `src/components/ChannelInfo.tsx` | 20 | canvas |
| `src/components/TVGuide.tsx` | 19 | canvas |
| `src/components/RecordingList.tsx` | 10 | canvas |
| `src/components/ChannelList.tsx` | 9 | canvas |
| `src/components/ChannelHeader.tsx` | 3 | canvas |
| `src/utils/CanvasUtils.ts` | 2 | canvas defaults |

Typography: **no `font-family` is declared anywhere in the DOM.** The canvas
asks for `'Moonstone'` at 17 call sites — an Enact *theme* font name, not
necessarily a loaded text family. So the DOM half and the canvas half of the UI
are not guaranteed to share a typeface, and neither is pinned across webOS
versions. This is also the root cause of the caret bug fixed in `ee48c60`.

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/Theme.ts` | **create.** Palette type, the OLED palette, `applyTheme`, `getTheme`. The single source of truth for both consumers. |
| `src/utils/Theme.test.ts` | **create.** Role completeness, CSS var stamping, `getTheme` after apply. |
| `src/utils/FontReadiness.ts` | **create.** Preload the canvas font specs, then invalidate canvas metrics and notify. Isolated because the race it fixes is subtle (see Task 2). |
| `src/utils/FontReadiness.test.ts` | **create.** Fake `document.fonts`; asserts the cache flush and the callback both happen, and happen after the load resolves. |
| `src/utils/ThemeGuards.test.ts` | **create.** Source-scanning guards: no raw colour literals outside `Theme.ts`, no `px Moonstone` left. Same shape as `GlyphCoverage.test.ts`. |
| `src/styles/app.css` | **modify.** All 66 literals become `var(--…)`. |
| `src/index.tsx` | **modify.** Import the font CSS, `applyTheme` before render, kick off `FontReadiness`. |
| `src/utils/CanvasUtils.ts` | **modify.** `fontFace` default comes from the theme, not `'Moonstone'`. Already exposes `clearFontMetricsCache()` — the seam Task 2 needs. |
| `src/components/{ChannelInfo,TVGuide,RecordingList,ChannelList,ChannelHeader}.tsx` | **modify.** Canvas colours read `getTheme()`. |
| `package.json` | **modify.** `@fontsource/inter`. |

---

### Task 1: The theme module

**Files:**
- Create: `src/utils/Theme.ts`, `src/utils/Theme.test.ts`

**Interfaces:**
- Produces: `interface Palette` (the role names above, all `string`);
  `OLED_BLACK: Palette`; `applyTheme(palette: Palette): void`;
  `getTheme(): Palette`; `cssVariableName(role: keyof Palette): string`.

Everything downstream imports `getTheme()`. Nothing imports `OLED_BLACK`
directly except `index.tsx` and the tests — that is what keeps the palette a
parameter rather than a constant, and what makes a second theme a data change
rather than a refactor.

- [ ] **Step 1: Write the failing test** — every role in `Palette` gets a
      value; `applyTheme` stamps a `--kebab-case` custom property per role onto
      `document.documentElement`; `getTheme()` returns the applied palette;
      `getTheme()` before any `applyTheme` returns the default rather than
      throwing (a canvas can paint before `index.tsx` finishes).
- [ ] **Step 2: Run it, confirm it fails** —
      `CI=true npx react-scripts test --testPathPattern Theme`
- [ ] **Step 3: Implement `Theme.ts`.** Derive the CSS variable name from the
      role key so a new role cannot be added to the type and forgotten in the
      stamping loop.
- [ ] **Step 4: Run it, confirm it passes.**
- [ ] **Step 5: Mutation-test** — drop one role from the stamping loop, confirm
      a failure, restore.
- [ ] **Step 6: Commit.**

---

### Task 2: Bundle Inter, and win the canvas font race

**Files:**
- Modify: `package.json`, `src/index.tsx`, `src/utils/CanvasUtils.ts`
- Create: `src/utils/FontReadiness.ts`, `src/utils/FontReadiness.test.ts`

**Interfaces:**
- Consumes: `getTheme` (Task 1), `CanvasUtils.clearFontMetricsCache`.
- Produces: `CANVAS_FONT_SPECS: string[]`;
  `whenFontsReady(fonts: FontFaceSet, onReady: () => void): Promise<void>`.

**This is the task with the trap in it.** Canvas does not participate in CSS
font loading: `ctx.font = '32px Inter'` before Inter has loaded silently draws
in the fallback, and the canvas is never told to repaint when the real font
arrives. Worse, `CanvasUtils.widthPerCharacterByFont` memoises character-width
measurements **keyed on the `canvas.font` string** — so a measurement taken
against the fallback is cached under the key `32px Inter` and reused forever,
permanently mis-truncating every channel name and event title. The existing
`clearFontMetricsCache()` seam exists for exactly this and must be called.

So the sequence is: preload each spec the canvas will use → `document.fonts.ready`
→ flush the metrics cache → force a repaint of every canvas surface.

- [ ] **Step 1: `npm install --save @fontsource/inter`.** Import only the
      weights actually used (400/600/700, latin subset) in `index.tsx`. Record
      the licence (SIL OFL 1.1) in the commit message.
- [ ] **Step 2: Write the failing test** for `FontReadiness` against a fake
      `FontFaceSet` — assert every spec in `CANVAS_FONT_SPECS` is passed to
      `load()`, that `clearFontMetricsCache` is called **after** the promise
      resolves and not before, and that `onReady` fires exactly once.
- [ ] **Step 3: Run it, confirm it fails.**
- [ ] **Step 4: Implement `FontReadiness.ts`.**
- [ ] **Step 5: Run it, confirm it passes.**
- [ ] **Step 6: Point `CanvasUtils`' `fontFace` default at the theme's family**
      instead of the literal `'Moonstone'`, and replace the 17 `canvas.font =
      '…px Moonstone'` call sites.
- [ ] **Step 7: Wire `whenFontsReady` in `index.tsx`** so the repaint reaches
      every canvas surface. Find the existing redraw entry point rather than
      inventing one — `updateCanvas` already exists per component; the
      cheapest correct trigger is a context version bump of the kind
      `favoritesVersion` and `logoVersion` already use.
- [ ] **Step 8: Mutation-test** — call `clearFontMetricsCache` *before* the
      await instead of after, confirm the ordering assertion fails.
- [ ] **Step 9: `npm run build`, then commit.**

**Accepted limitation to record in the commit:** `font-variant-numeric:
tabular-nums` will be set on the DOM's numeric columns, but Chromium 87's canvas
has no equivalent — `ctx.font` carries no feature settings. Canvas channel
numbers keep proportional figures. They sit in a fixed right-aligned column, so
the practical effect is nil; noted so nobody later reads it as an oversight.

---

### Task 3: Migrate the stylesheet to tokens

**Files:**
- Modify: `src/styles/app.css` (66 literals)
- Create: `src/utils/ThemeGuards.test.ts`

- [ ] **Step 1: Write the failing guard test** — scan `src/styles/app.css` and
      `src/components/**` for `#rrggbb` / `rgb()` / `rgba()` literals and fail,
      naming file, line and literal. Allow them only in `Theme.ts`. Model it on
      `GlyphCoverage.test.ts`, including its "scans the source tree" sanity
      assertion — a walker that silently returns nothing makes every other
      assertion vacuous.
- [ ] **Step 2: Run it. It must fail with roughly 86 offenders.** Record the
      real count in the commit message.
- [ ] **Step 3: Replace the CSS literals with `var(--…)`.** The four
      near-identical darks collapse to `--surface-raised`; decide each one
      deliberately rather than mapping by nearest hex.
- [ ] **Step 4: Apply the amber discipline** — `--focus` on focus rings only.
      The "new" badge goes to `--accent`, the empty-filter banner to
      `--text-secondary`.
- [ ] **Step 5: Run the guard;** CSS offenders should be gone, canvas ones
      remain (Task 4).
- [ ] **Step 6: Verify in the static harness** at 1920×1080 — extend
      `scratchpad/glyph-harness.html`, screenshot, **look at it**. Confirm the
      bar is still exactly 86px.
- [ ] **Step 7: Clean up harness artifacts** (`glyph-check.png`,
      `.playwright-mcp/`, the http server) — they land in the *parent* directory,
      not the project, and have twice needed sweeping up afterwards.
- [ ] **Step 8: `npm run build`, then commit.**

---

### Task 4: Migrate the canvas to tokens

**Files:**
- Modify: `ChannelInfo.tsx` (20), `TVGuide.tsx` (19), `RecordingList.tsx` (10),
  `ChannelList.tsx` (9), `ChannelHeader.tsx` (3), `CanvasUtils.ts` (2)

One commit per component, largest first — each is independently verifiable and
independently revertable, and `ChannelInfo` is where the surprises will be.

- [ ] **Step 1: For each component, replace literals with `getTheme()` roles.**
      Read `getTheme()` inside the draw call, not at module scope, or a later
      theme switch will paint with a stale palette.
- [ ] **Step 2: Watch for semantic collisions.** `rgba(35,64,84,0.9)` appears 7
      times and `rgba(11,39,58,0.7)` 4 times — confirm each occurrence means
      the same *role* before collapsing them. Two colours being equal today is
      not evidence they mean the same thing.
- [ ] **Step 3: After each component, run the full suite and `npm run build`.**
- [ ] **Step 4: Run the Task 3 guard;** it should now report zero offenders.
- [ ] **Step 5: Mutation-test the guard** — put one literal back, confirm the
      failure names it, restore.
- [ ] **Step 6: Commit per component.**

---

### Task 5: The restyle itself

Everything above is plumbing that leaves the app looking much as it does now.
This is the task that makes it look different. Keep it last so that if it is
wrong it reverts without taking the foundation with it.

- [ ] **Step 1: Elevation.** `--surface-base` behind everything, `--surface-raised`
      for the category bar / EPG sidebar / info bar / panels, `--surface-card`
      for focused and selected rows. Three real steps replacing four accidental
      near-duplicates.
- [ ] **Step 2: Selection vs focus, on canvas as well as DOM.** Selected channel
      row: 4px `--accent` left bar plus `--surface-card` fill. Focused row:
      `--focus` ring. They must be distinguishable when they land on the same
      row — check that case explicitly.
- [ ] **Step 3: Type scale.** Inter with a deliberate ramp; channel name and
      number sized against a 10-foot viewing distance rather than the current
      inherited sizes. **Row height must not change** (see Global Constraints).
- [ ] **Step 4: Logo treatment.** Logos currently sit on whatever is behind
      them; on true black, white-on-transparent logos will vanish. Decide:
      a `--surface-card` chip behind each, or leave them. This is a real
      regression risk unique to the black palette — check it against the
      user's actual lineup, not a mock.
- [ ] **Step 5: Screenshot in the harness at 1920×1080 and look at it.**
- [ ] **Step 6: `npm run build`, commit, push, confirm CI green.**

---

### Task 6: On-device confirmation

Nothing in this plan is done until it has been seen on the C5. The static
harness verifies layout against the real stylesheet; it cannot verify the
OLED's actual black rendering, Inter's on-device metrics, or whether the logo
treatment survives contact with real channel logos.

- [ ] Install the CI artifact, check the channel list, EPG, info bar, details
      panel, category picker and settings.
- [ ] Confirm Inter is actually in use rather than silently falling back —
      it is visually obvious against the current default, but the canvas is
      where the race in Task 2 would show, so compare a canvas row against a
      DOM row.

## Deliberately out of scope

- **A theme picker.** Plumbed, not built — the user asked for one theme first
  and to judge it on the C5. Adding a second palette afterwards is a data
  change plus a settings row, which is why Task 1 insists nothing imports the
  palette constant directly.
- **Layout changes.** Colour and type only. The canvas geometry constants and
  their duplicate in `ChannelListGeometry.ts` stay untouched.
- **Everything already in `docs/ui-redesign-backlog.md`** — the pointer audit,
  hover states, drag-scrolling, the arrow-key leak past the audio/subtitle
  panel, the bottom-row sliver. Unrelated to theming; they stay on that list.

## Related

- Backlog: `docs/ui-redesign-backlog.md`
- Performance: `docs/performance-backlog.md`
- The glyph fix that prompted this: `ee48c60`
