# TiviMate-shaped UI redesign — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.
>
> **REQUIRED SUB-SKILL:** `.claude/skills/run-app` — every phase ends by
> running the app and looking at it. Do not mark a phase done from a passing
> test suite alone.

**Status:** Phase 0 not started. Supersedes
`2026-08-05-oled-theme-and-typography.md`, which is folded in as Phase 0.

**Goal:** Rebuild the interface around TiviMate's organising idea — a
persistent **Groups | Channels** column pair — on a deliberate type and colour
foundation, with visible response to every input.

**Architecture:** One `Theme.ts` feeds both CSS custom properties and the
canvas draw code, because canvas cannot read CSS variables — that dual
consumption is the reason it is a module and not a stylesheet. One
`GroupsColumn` component serves both the channel list and the EPG, replacing
today's two divergent implementations. Canvas geometry constants become
parameters so density is a setting rather than a rewrite.

**Tech Stack:** React 18.3.1 (legacy `ReactDOM.render`), react-scripts 5.0.1,
TypeScript 4.9.5, Jest 27, @enact/moonstone 4.5.6, `@fontsource/inter`.

## Decisions (user, 2026-08-05 / 2026-08-06)

| Question | Answer |
|---|---|
| Inspiration | **TiviMate.** Its layout is `CATEGORIES | GROUPS | content`. |
| Column model | **Two-column: `GROUPS | CHANNELS`**, persistent. The category dropdown shipped in `d5dc909` is retired. App sections stay in the existing popup `Menu`. |
| Densities | **List (90px) + Compact (48px).** No grid view. |
| Appearance settings | **Full** — themes, colours, sizes, exposed to the user. |
| Visual direction | **OLED true black**, `#000` base, one accent for selection, focus amber reserved for the cursor. |
| Typography | **Bundle Inter** (SIL OFL 1.1). |

**Accepted consequence of two-column:** app sections (`Menu`) and groups use
two different navigation idioms — a popup and a column. TiviMate uses one. If
this reads as inconsistent on the C5, promoting `Menu` to a third column is an
additive change, not a rework.

## What running the app already showed

From `npm run start:mock` at 1920×1080, before any of this work:

- **The selected channel row is grey text on cyan** — poor contrast, and the
  clearest single reason the list looks unfinished. Phase 0 fixes it by
  construction: selection becomes accent-bar-plus-fill rather than a flooded
  row.
- **Rows have no logo placeholder.** With the fixtures' logos unreachable the
  logo column is simply empty, which is also what a real channel with no logo
  looks like. Needs a deliberate fallback (Phase 1).
- The category bar's near-black sits above a **blue-gradient channel list** —
  two unrelated backgrounds touching. Phase 0 collapses them.

## Global Constraints

- **Canvas geometry is duplicated.** `ChannelList` derives row positions from
  `mChannelLayoutHeight` and `mCategoryBarHeight`; `src/utils/ChannelListGeometry.ts`
  hit-tests pointer clicks against the same numbers. **Phase 1 and Phase 3 both
  change these.** Every such change updates both consumers and
  `ChannelListGeometry.test.ts` in the same commit. Getting it wrong puts drawn
  rows and click targets out of step — worse than anything being fixed.
- **Never swap adapters by editing `Config.ts`.** Use `npm run start:mock`.
- **`npm run build` before every push.** CRA's eslint runs inside the build and
  catches what neither `tsc --noEmit` nor jest sees. This project has been bitten
  twice.
- **Tests run through CRA:** `CI=true npx react-scripts test`. Bare `npx jest`
  fails on `@babel/parser`.
- **No new characters outside `GlyphCoverage.test.ts`'s allowlist.** UI chrome
  is drawn in CSS. TiviMate-style icons are drawn or inline SVG, never glyphs.
- **Mutation-test every new guard.** A guard that has never failed is not known
  to work.
- **The Magic Remote has no colour buttons** (`RemoteKeys.ts`). Every path must
  work with directional + OK + Back, and with the pointer.

---

## Phase 0 — Foundation: theme and typography

Nothing here changes the layout. It replaces ~86 scattered colour literals and
the complete absence of a font declaration. Everything later depends on it.

**Measured before starting:** `app.css` 66 literals; `ChannelInfo.tsx` 20;
`TVGuide.tsx` 19; `RecordingList.tsx` 10; `ChannelList.tsx` 9;
`ChannelHeader.tsx` 3; `CanvasUtils.ts` 2. No `font-family` anywhere in the
DOM; canvas asks for `'Moonstone'` at 17 call sites.

### The palette

Role names, never colour names — a future light theme must not be described by
tokens that lie about themselves.

```
surfaceBase     #000000   the page. Pixels off on OLED.
surfaceRaised   #0E0E11   groups column, info bar, panels
surfaceCard     #1C1C21   focused/selected row fill
textPrimary     #FFFFFF
textSecondary   #8A8F98
textMuted       #5A5F68
accent          #3EA6FF   SELECTION only
focus           #FFC53D   FOCUS RING only
danger          #E0483D   record dot
favorite        #FFC53D   the ★ — the one deliberate reuse of the focus hue
```

Today amber does four jobs — focus, favourites, the "new" badge, the empty
banner. That is the main reason the UI reads as busy. After this phase `focus`
means "the cursor is here" and nothing else; the badge moves to `accent`, the
banner to `textSecondary`.

- [ ] **Task 0.1 — `Theme.ts` + tests.** `Palette` interface; `OLED_BLACK`;
      `applyTheme(palette)` stamping `--kebab-case` custom properties;
      `getTheme()` returning the current palette, and a sane default before any
      `applyTheme` (a canvas can paint before `index.tsx` finishes). Derive the
      variable name from the role key so a new role cannot be added to the type
      and forgotten in the stamping loop. Mutation-test by dropping one role.
- [ ] **Task 0.2 — Bundle Inter, and win the canvas font race.**
      `npm i @fontsource/inter`, weights 400/600/700, latin.

      **The trap:** canvas does not participate in CSS font loading.
      `ctx.font = '32px Inter'` before Inter arrives silently draws the
      fallback, and nothing repaints when the real font lands. Worse,
      `CanvasUtils.widthPerCharacterByFont` memoises character widths **keyed
      on the `canvas.font` string**, so a fallback measurement is cached under
      `32px Inter` and reused forever — permanently mis-truncating every
      channel name.

      Sequence: preload each spec → `document.fonts.ready` → call the existing
      `CanvasUtils.clearFontMetricsCache()` → force a repaint (reuse the
      context-version-bump pattern that `favoritesVersion` and `logoVersion`
      already use). Put it in `FontReadiness.ts`, tested against a fake
      `FontFaceSet`, asserting the flush happens **after** the load resolves.

      Record the accepted limitation: `font-variant-numeric: tabular-nums`
      works in the DOM, but Chromium 87's `ctx.font` carries no feature
      settings, so canvas figures stay proportional. They sit in a fixed
      right-aligned column, so the effect is nil — noted so it is not later
      read as an oversight.
- [ ] **Task 0.3 — Guard test + CSS migration.** `ThemeGuards.test.ts` scans
      `app.css` and `src/components/**` for colour literals and fails naming
      file, line and literal; allowed only in `Theme.ts`. Include the
      "scans the source tree" sanity assertion from `GlyphCoverage.test.ts` —
      a walker returning nothing makes every other assertion vacuous. Run it
      first and record the real offender count. Then migrate the 66 CSS
      literals. Collapse the four near-identical darks deliberately, not by
      nearest hex.
- [ ] **Task 0.4 — Canvas migration**, one commit per component, largest
      first. Read `getTheme()` inside the draw call, never at module scope, or
      a later theme switch paints stale. `rgba(35,64,84,0.9)` appears 7 times
      and `rgba(11,39,58,0.7)` 4 times — confirm each means the same *role*
      before collapsing. Two colours being equal today is not evidence they
      mean the same thing. Guard must reach zero; mutation-test it.
- [ ] **Task 0.5 — Run the app, screenshot every surface, look at them.**

---

## Phase 1 — The two-column layout

The structural change. `GROUPS | CHANNELS`, both persistent, no modal state.

```
┌──────────────┬───────────────────────────────┐
│   GROUPS     │          CHANNELS             │
│  ★ Favorites │    101  [logo]  ARD HD        │
│    All       │  ▍ 102  [logo]  ZDF HD        │
│  ▍ News      │    103  [logo]  RTL           │
└──────────────┴───────────────────────────────┘
     280px            video plays behind
```

**What survives from `d5dc909`:** `FilterEntries` (both builders),
`ListNavigation.wrapIndex`, and `EpgSidebar` — which is already a groups
column and becomes the shared one. **Retired:** the dropdown, `CategoryBar`,
and `ChannelList`'s `BAR` and `DROPDOWN` states.

- [ ] **Task 1.1 — `GroupsColumn.tsx`**, generalised from `EpgSidebar`.
      Exports `GROUPS_WIDTH = 280`. Props: entries, activeFilter,
      focusedIndex, isFocused, onSelect. Keeps `EpgSidebar`'s two proven
      details: `scrollIntoView({block:'nearest'})` on the focused row, and
      `stopPropagation` on the container so a click that misses a row does not
      fall through to the parent's zap handler.
- [ ] **Task 1.2 — Re-anchor the channel list canvas.** This is the risky
      step. Removing the 86px bar and adding a 280px column changes both
      origins: `getTopFrom` loses `mCategoryBarHeight`, and the canvas shifts
      right. Use the trick that already works in `TVGuide` — subtract
      `GROUPS_WIDTH` from the width and shift the element with `marginLeft`,
      leaving the grid's 0-origin coordinate space untouched.
      **`ChannelListGeometry.ts` and its tests change in this same commit.**
      Write the geometry test first, watch it fail, then move the constants.
- [ ] **Task 1.3 — Rewire `ChannelList`'s state machine.** `NORMAL | DETAILS |
      GROUPS`. LEFT from the channel list enters the groups column; RIGHT
      leaves it; UP/DOWN walk whichever column has focus; OK applies a group
      and moves focus to the channels. Delete `applyCategoryAt`,
      `openDropdown`, `selectCategoryAt`, `barControl`, `dropdownIndex`.
- [ ] **Task 1.4 — Point `TVGuide` at `GroupsColumn`**, deleting `EpgSidebar`.
      The width constant it subtracts becomes `GROUPS_WIDTH`.
- [ ] **Task 1.5 — Logo fallback.** On true black a white-on-transparent logo
      vanishes, and a channel with no logo currently renders nothing. Decide
      the fallback — a `surfaceCard` chip behind every logo, or initials drawn
      for channels without one. **Cannot be judged in the harness** (fixtures'
      logo URLs do not resolve); check against the real server.
- [ ] **Task 1.6 — Delete `CategoryBar.tsx`.** Confirm no orphaned imports:
      CRA's eslint catches these inside `npm run build` and nowhere else.
      This exact class of error has broken a push here before.
- [ ] **Task 1.7 — Run the app.** Walk both columns, both screens, with keys
      *and* with the pointer.

---

## Phase 2 — Responsiveness

"Buttons and everything responsive" — every input produces immediate visible
feedback, on canvas surfaces as well as DOM ones. This is where the UI stops
feeling static.

- [ ] **Task 2.1 — DOM focus and press states.** Focus ring plus fill, and a
      short press transition (~120ms). Applies to groups rows, details actions,
      settings rows, the category picker.
- [ ] **Task 2.2 — Canvas hover.** Today nothing highlights under the Magic
      Remote pointer, so there is no feedback before clicking.
      `ChannelListGeometry.channelPositionAt` already resolves a pointer
      position to a row — feed it from `mousemove` and draw a hover fill.
      **Throttle to the existing rAF loop**; redrawing the list on every
      `mousemove` on a TV SoC will cost more than the feature is worth.
- [ ] **Task 2.3 — Keep pointer focus and D-pad focus in agreement.** Moving
      the pointer over a row must move the keyboard cursor there too, or the
      next direction press jumps from a stale position. Already fixed for
      clicks (`52cbb2f`); this extends it to hover.
- [ ] **Task 2.4 — Scroll position indicator.** There is currently no
      affordance showing where you are in a 908-channel lineup.
- [ ] **Task 2.5 — Run the app** and drive it with the mouse specifically.

---

## Phase 3 — Densities

- [ ] **Task 3.1 — Parameterise row height.** `mChannelLayoutHeight` and the
      column offsets become a `Density` descriptor (`LIST` 90px, `COMPACT`
      48px) threaded to both `ChannelList` and `ChannelListGeometry`.
      Geometry tests parameterise over both densities — the hit-testing bug
      this guards against is silent and only reproduces with a pointer.
- [ ] **Task 3.2 — Compact row rendering.** Number + name only, no logo, no
      event line.
- [ ] **Task 3.3 — Run the app** in both densities; check the bottom row in
      each. (1080 is not a multiple of either height, so both will show a
      partial last row — decide it deliberately rather than inheriting it.)

---

## Phase 4 — Appearance settings

User-facing, matching TiviMate's `Settings > Appearance`. Everything here is a
parameter established in Phases 0–3, so this phase is wiring plus UI.

- [ ] **Task 4.1 — `AppearanceStore`**, persisted in localStorage following the
      existing `CategoryStore` / `FavoritesStore` pattern, with the same
      degrade-on-garbage behaviour as `StoredStringArray`.
- [ ] **Task 4.2 — Settings screen**, reachable from the existing `Menu`.
- [ ] **Task 4.3 — The options:** theme (the three palettes drawn up on
      2026-08-05: OLED black, slate+cyan, graphite+violet); accent colour;
      global font scale; channel list density; show channel numbers; EPG
      timeline span (2/4/6/12h); EPG grid lines.
- [ ] **Task 4.4 — Live application.** Changing a setting must repaint the
      canvases — same version-bump mechanism as Phase 0's font readiness, and
      the metrics cache must be flushed on any font-size change for the same
      reason.
- [ ] **Task 4.5 — Run the app** and change every setting.

---

## Phase 5 — On-device

Nothing is done until it is seen on the C5. The harness cannot show: real
channel logos, actual OLED black rendering, Inter's on-device metrics, Magic
Remote pointer behaviour, or playback.

- [ ] Install the CI artifact; check every surface.
- [ ] Confirm Inter is genuinely in use rather than silently falling back —
      compare a canvas row against a DOM row, since the canvas is where the
      Phase 0 race would show.
- [ ] Confirm the logo fallback against the real lineup.

## Out of scope

- **A third `CATEGORIES` column.** Additive later if the split idiom grates.
- **Grid view.** Depends entirely on logo quality, and the server's
  `imagecache` is still not enabled.
- **Picture-in-picture preview.** TiviMate previews the focused channel in a
  small window; ours plays full-bleed behind the overlay, which is arguably
  better on a large TV. Revisit only if the overlay proves too opaque.
- Unrelated backlog items in `docs/ui-redesign-backlog.md`: the arrow-key leak
  past the audio/subtitle panel, drag/flick scrolling, details-panel channel
  browsing.

## Related

- Backlog: `docs/ui-redesign-backlog.md`
- Superseded: `docs/superpowers/plans/2026-08-05-oled-theme-and-typography.md`
- Running it: `.claude/skills/run-app/SKILL.md`
