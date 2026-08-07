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

## Phase 0 — Foundation: theme and typography — **DONE 2026-08-06**

Landed as `85847e2`, `d01e8dc`, `dcc6021`, `ce3ab2c`, `fd4fdf5`. 188 tests,
build clean at 215.33 kB + 120KB of bundled font. Every task below is complete;
the record is kept because the constraints it documents still bind Phases 1-4.

**What running it caught that reading the diff would not have:** migrating
TVGuide's `mTimeBarLineColor` to `danger` washed the entire past region red,
because one constant was doing two unrelated jobs (dimming the past, and
marking now). Split into `mPastOverlayColor` and `mTimeBarLineColor`.

**Two findings recorded in `docs/ui-redesign-backlog.md` rather than fixed
here:** Enact Moonstone's `Input`/`Button` ignore the theme and still render
light on the settings screen; and the info bar advertises colour buttons the
Magic Remote does not have.

Nothing here changes the layout. It replaces ~86 scattered colour literals and
the complete absence of a font declaration. Everything later depends on it.

**Measured before starting:** `app.css` 66 literals; `ChannelInfo.tsx` 20;
`TVGuide.tsx` 19; `RecordingList.tsx` 10; `ChannelList.tsx` 9;
`ChannelHeader.tsx` 3; `CanvasUtils.ts` 2. No `font-family` anywhere in the
DOM; canvas asks for `'Moonstone'` at 17 call sites.

### The palette (as built)

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
textOnAccent    #0A0E13   text drawn ON an accent/focus fill - added during
                          the build; distinct from surfaceBase because they
                          diverge the moment a light theme exists
danger          #E0483D   record dot
favorite        #FFC53D   the ★ — the one deliberate reuse of the focus hue
```

Today amber does four jobs — focus, favourites, the "new" badge, the empty
banner. That is the main reason the UI reads as busy. After this phase `focus`
means "the cursor is here" and nothing else; the badge moves to `accent`, the
banner to `textSecondary`.

- [x] **Task 0.1 — `Theme.ts` + tests.** `Palette` interface; `OLED_BLACK`;
      `applyTheme(palette)` stamping `--kebab-case` custom properties;
      `getTheme()` returning the current palette, and a sane default before any
      `applyTheme` (a canvas can paint before `index.tsx` finishes). Derive the
      variable name from the role key so a new role cannot be added to the type
      and forgotten in the stamping loop. Mutation-test by dropping one role.
- [x] **Task 0.2 — Bundle Inter, and win the canvas font race.**
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
- [x] **Task 0.3 — Guard test + CSS migration.** `ThemeGuards.test.ts` scans
      `app.css` and `src/components/**` for colour literals and fails naming
      file, line and literal; allowed only in `Theme.ts`. Include the
      "scans the source tree" sanity assertion from `GlyphCoverage.test.ts` —
      a walker returning nothing makes every other assertion vacuous. Run it
      first and record the real offender count. Then migrate the 66 CSS
      literals. Collapse the four near-identical darks deliberately, not by
      nearest hex.
- [x] **Task 0.4 — Canvas migration**, one commit per component, largest
      first. Read `getTheme()` inside the draw call, never at module scope, or
      a later theme switch paints stale. `rgba(35,64,84,0.9)` appears 7 times
      and `rgba(11,39,58,0.7)` 4 times — confirm each means the same *role*
      before collapsing. Two colours being equal today is not evidence they
      mean the same thing. Guard must reach zero; mutation-test it.
- [x] **Task 0.5 — Run the app, screenshot every surface, look at them.**

---

## Phase 1 — The two-column layout — **DONE 2026-08-06**

Landed as `e784248` and `2002bf2`. 199 tests, build clean at 215.19 kB.

**What running it caught:** the document was 1089px against a 1080 viewport,
and `GroupsColumn`'s `scrollIntoView` scrolled into those 9px and dragged the
whole UI up, clipping the top channel row. `html, body { overflow: hidden }` -
a TV app's page should never scroll. The old 86px bar had been hiding it.

**Correction to the note below:** it claimed white-on-transparent logos vanish
on black. Backwards - white on black is high contrast; it is *dark* logos on
transparent that disappear. Initials now cover the missing-logo case; the
dark-logo case still needs the real server (see Task 1.5).

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

- [x] **Task 1.1 — `GroupsColumn.tsx`**, generalised from `EpgSidebar`.
      Exports `GROUPS_WIDTH = 280`. Props: entries, activeFilter,
      focusedIndex, isFocused, onSelect. Keeps `EpgSidebar`'s two proven
      details: `scrollIntoView({block:'nearest'})` on the focused row, and
      `stopPropagation` on the container so a click that misses a row does not
      fall through to the parent's zap handler.
- [x] **Task 1.2 — Re-anchor the channel list canvas.** This is the risky
      step. Removing the 86px bar and adding a 280px column changes both
      origins: `getTopFrom` loses `mCategoryBarHeight`, and the canvas shifts
      right. Use the trick that already works in `TVGuide` — subtract
      `GROUPS_WIDTH` from the width and shift the element with `marginLeft`,
      leaving the grid's 0-origin coordinate space untouched.
      **`ChannelListGeometry.ts` and its tests change in this same commit.**
      Write the geometry test first, watch it fail, then move the constants.
- [x] **Task 1.3 — Rewire `ChannelList`'s state machine.** `NORMAL | DETAILS |
      GROUPS`. LEFT from the channel list enters the groups column; RIGHT
      leaves it; UP/DOWN walk whichever column has focus; OK applies a group
      and moves focus to the channels. Delete `applyCategoryAt`,
      `openDropdown`, `selectCategoryAt`, `barControl`, `dropdownIndex`.
- [x] **Task 1.4 — Point `TVGuide` at `GroupsColumn`**, deleting `EpgSidebar`.
      The width constant it subtracts becomes `GROUPS_WIDTH`.
- [x] **Task 1.5 — Logo fallback.** Done for the missing-logo case: initials
      on a muted plate (`ChannelInitials`). **Still open, needs the real
      server:** whether *dark* logos on transparent backgrounds disappear
      against `#000`. The harness cannot answer it - every fixture logo URL
      points at the original author's server and fails - and the fix if needed
      is a light plate behind real logos too, which is a one-line change to
      `drawChannelInitials`' sibling branch.
- [x] **Task 1.6 — Delete `CategoryBar.tsx`.** Confirm no orphaned imports:
      CRA's eslint catches these inside `npm run build` and nowhere else.
      This exact class of error has broken a push here before.
- [x] **Task 1.7 — Run the app.** Walk both columns, both screens, with keys
      *and* with the pointer.

---

## Phase 2 — Responsiveness — **DONE 2026-08-06**

Landed as `de48640`, `87580f5` and the scroll-indicator commit. 218 tests,
build clean at 215.64 kB.

"Buttons and everything responsive" — every input produces immediate visible
feedback, on canvas surfaces as well as DOM ones.

**Tasks 2.2 and 2.3 collapsed into one.** They were written as a hover
highlight plus a rule keeping it in step with the cursor, but those are the
same mark: two highlights that must always agree about which row OK acts on is
a bug waiting to happen, and when they disagree you get exactly the stale-focus
problem 2.3 exists to prevent. Hover moves the cursor, and the cursor highlight
*is* the hover feedback.

**The non-obvious constraint:** hover must not scroll.
`scrollToChannelPosition` pins the cursor to the sixth visible row, so
re-pinning on hover yanks the list out from under the pointer, puts a different
row beneath it, and yanks again on the next mousemove. Hover moves the cursor
in place; the next direction press re-pins, so the list jumps once — bounded,
and visibly a response to the key rather than to the pointer.

**Found by drawing the indicator:** the list scrolls two rows past its own
content, so the last screen ends in ~180px of empty canvas. Recorded in the
backlog and left for Phase 3, which parameterises that same function for
densities — fixing it now would mean writing the geometry test twice.

- [x] **Task 2.1 — DOM focus and press states.** `cursor: pointer`, `:hover`
      below `:focused` (so the pointer never restyles a row the D-pad already
      owns), and `:active` with `transition-duration: 0s` — the press answers
      instantly and only the release fades. A 120ms ease-in on the press itself
      reads as lag once the remote has already spent a frame or two.
- [x] **Task 2.2/2.3 — Canvas hover, moving the cursor.**
      `FrameThrottle.createFrameThrottle` coalesces the mousemove burst to one
      repaint per frame — the list is a megapixel of fill, text and image
      blitting on a SoC that is also decoding video. Newest-value-wins is the
      load-bearing half; keeping the value that opened the frame highlights a
      row the pointer has already left.
- [x] **Task 2.4 — Scroll position indicator.**
      `ScrollIndicator.scrollThumb` plus a 4px track down the right edge. Both
      clamps in it fire in normal use, not at pathological inputs: the list's
      own scrollY overshoots its content, and a 908-channel thumb hits the
      48px floor — where positioning by `progress * trackHeight` instead of
      `progress * (trackHeight - height)` would leave it 48px short of the end.
      The artwork column gave up 12px, and `mChannelArtRight` is now the single
      right edge the logo box, the initials plate and the name's `maxWidth` all
      read.
- [x] **Task 2.5 — Run the app** and drive it with the mouse specifically.

---

## Phase 3 — Densities — **DONE 2026-08-06**

Landed as `7a5493b` and `874f15c`. 254 tests, build clean at 215.92 kB.

**Density is a parameter, not yet a setting.** `AppContext` holds it and
`setDensity` exists, but nothing calls it and nothing is persisted — Phase 4's
`AppearanceStore` owns the whole appearance slice, and a lone localStorage key
for density would only have to be folded back in. Both densities were verified
by flipping `DEFAULT_DENSITY` and reloading.

**Horizontal geometry is deliberately shared** between the two. Switching
density changes the rhythm of the list without reshuffling it sideways, so the
numbers and names stay where the eye left them.

**Two scroll bugs fell out of this**, both pre-existing, both invisible at 90px:

1. **The clamp.** `scrollToChannelPosition`'s bottom bound was
   `rowHeight * (channelCount - 2 * topPadding)` — a bound that never consults
   the viewport, so it cannot be right for two row heights. Wrong in both
   directions: two rows of dead canvas below the last channel at 90px (twelve
   at 48px), and *negative* for any list shorter than 10 channels, which pushed
   every row down the canvas and left a band of nothing above the first one.
   Confirmed live against SDTV's 3 channels: rows were 540px down the screen.
   All three of the old branches collapse into `clamp(desired, 0, contentHeight
   - viewportHeight)`.
2. **The animation never landed where it was aimed.** It steps by a fixed delta
   and asks whether it has *already passed* the target, so it stops wherever
   the overshooting step left it. `distance / (rowHeight / 5)` is
   `distance / 18` at 90px — eighteen whole steps, landing correctly by
   accident. At 48px it is `distance / 9.6`. Both branches carried the fix
   commented out; it presumably read as a no-op, because correcting the offset
   without a repaint changes nothing on screen. Writing the test then caught a
   second defect the first fix left: testing the *current* offset draws one
   frame past the target before snapping back.

**The partial last row is fine and needs no decision.** 1080 *is* a multiple of
90, and at 48px the clamp makes the last row land flush at the bottom, so a
clipped row only ever appears mid-list — where it reads as "there is more
below", which is what it should.

- [x] **Task 3.1 — Parameterise row height** into a `Density` descriptor
      (`LIST` 90px, `COMPACT` 48px) threaded through `AppContext` to
      `ChannelList` and `ChannelListGeometry`. Geometry tests run at both
      densities: the failure the module exists to prevent is silent, and a
      suite pinned to 90px would pass while COMPACT was completely wrong.
- [x] **Task 3.2 — Compact row rendering.** Number and name only, centred
      rather than sitting on the upper of two lines. No logo: at 48px the box
      is 62px wide, too small to recognise a broadcaster by, and dropping it
      gives the name the full row width. One `isCompact` flag rather than
      separate logo/event switches — a logo with no programme line leaves the
      logo floating, and a programme line with no logo wastes the room it
      needs, so they travel together.
- [x] **Task 3.3 — Run the app** in both densities, including the bottom row,
      a 3-channel category, and a before/after on the old clamp.

---

## Phase 4 — Appearance settings

User-facing, matching TiviMate's `Settings > Appearance`. Everything here is a
parameter established in Phases 0–3, so this phase is wiring plus UI.

- [x] **Task 4.1 — `AppearanceStore`**, persisted in localStorage following the
      existing `CategoryStore` / `FavoritesStore` pattern, with the same
      degrade-on-garbage behaviour as `StoredStringArray`. One key holding one
      record, not a key per setting: the screen holds the whole record and
      writes it whole, so splitting it would buy nothing and cost the
      guarantee that a half-finished write leaves a consistent set rather
      than a mixture of two. Only choice *keys* are stored — a stored
      `#3EA6FF` would outlive the palette revision that changed it and strand
      one colour of the old theme inside the new one.
- [x] **Task 4.2 — Settings screen**, reachable from the `Menu` (`brightness`
      icon). Left/right cycles a setting's choices rather than opening a
      submenu: a submenu costs two presses to reach the alternatives and hides
      the fact that alternatives exist, while the strip shows all of them and
      one press moves one along. `selectedChoiceIndex` falls back to the
      setting's *default*, not to index 0 — for any setting whose default is
      not first (`channelNumbers`) those differ, and the strip would highlight
      one value while the app drew another.
- [x] **Task 4.3 — The options:** all seven. `APPEARANCE_SETTINGS` declares
      each as a label plus a list of choices, so the screen renders them
      without knowing what any of them mean, and `resolveAppearance` turns the
      stored keys into drawable values. The split makes the real failure
      testable: a setting the screen renders that nothing resolves is a
      control which moves, persists and changes nothing.
- [x] **Task 4.4 — Live application.** `publishAppearance` runs synchronously
      in the setter, *not* in a provider effect — effects run child-first, so a
      provider-level effect hands every canvas surface the previous palette on
      the one render that repaints them, and then never fires again. The
      canvas surfaces list the whole `appearance` object in their draw effects.
      **No metrics-cache flush**, contrary to what this task originally said:
      the Phase 0 flush exists because a measurement taken in the fallback font
      was cached under the key `32px Inter` and reused for the real one — same
      key, wrong answer. A size change produces a *different* key, so the old
      entries stay correct for the sizes they describe and flushing would only
      throw away good measurements.
- [x] **Task 4.5 — Run the app** and change every setting. All seven verified
      live and across a reload; both the channel list and the guide redrawn at
      each. Two things the run caught that review had not: the panel overflows
      the screen at the larger text sizes — which is exactly the setting a user
      changing the text size is standing on — so the focused row now
      `scrollIntoView`s; and the screen had no `KEY_B` alias for Back, so it
      could not be left in a desktop browser.

**The text scale scales the boxes, not just the text.** Scaling only the text
is the tempting version and it is wrong: at Largest a 32px name becomes 42px
inside an unchanged 48px compact row, and a three-digit channel number
right-aligned at x+70 grows wide enough to start at x-11 and be clipped by the
edge of the canvas. Row heights and the channel list's whole left gutter scale
with it — and that gutter is now three derived offsets rather than three
literals, because switching the numbers off has to collapse it too. 70px of
empty black where a number used to be reads as a rendering fault, not a
setting.

**The guide's labels thin out as the span widens.** Twelve hours at the old
fixed 30 minutes is 24 labels across ~1800px, and a bold 28px "20:30" is about
70px wide in a 75px slot. The rounding follows the label spacing rather than a
hardcoded 30, or an hourly ruler would read 19:00, 19:30, 21:00. Changing the
span also needs more than a repaint: `millisPerPixel` is derived from it and
`scrollX` is measured in pixels against that, so a repaint alone draws the grid
at the new scale scrolled to a position computed at the old one.

---

## Phase 5 — On-device

Nothing is done until it is seen on the C5. The harness cannot show: real
channel logos, actual OLED black rendering, Inter's on-device metrics, Magic
Remote pointer behaviour, or playback.

The checks are written up as `docs/on-device-checklist.md`, because this pass
recurs every release and "check every surface" is the kind of instruction that
gets done badly — the checklist names only what fixtures cannot answer, so the
time goes on the parts that need a TV.

- [x] **Pre-flight the artifact** (2026-08-08, added to the plan — none of the
      three items below can start until the ipk is known good, and the two
      ways it silently is not are both findable without a TV). Checked the CI
      artifact for `5e01fd8` (run 31193145605, 2.04 MB): asset refs are
      relative, so it will not launch to a black screen; all 20 `@font-face`
      urls resolve to files inside the ipk, including all 8 Inter files; app
      id and service id agree. A missing font file does not error — Chromium
      falls back silently and the result looks nearly right, which is the
      failure mode most likely to survive an on-device eyeball.
- [ ] Install the artifact; work through the checklist.
- [ ] Confirm Inter is genuinely in use rather than silently falling back.
      **Not** by comparing a canvas row against a DOM row as originally
      written: at a TV's viewing distance Inter and a default sans are close
      enough that a wrong answer is easy to get, and the Phase 0 race is a
      metrics failure rather than a visible one. The checklist gives a console
      one-liner that measures `32px Inter` against a deliberately absent font
      — equal widths mean the canvas is in the fallback whatever the DOM shows.
- [ ] Confirm the logo fallback against the real lineup.

Blocked on hardware access, not on work: `ares-cli` is not installed and no
`tv` device is registered, and registering one needs Developer Mode enabled on
the TV behind an LG developer account sign-in. Setup steps are in the
checklist.

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
