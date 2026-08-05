# UI redesign backlog

Deferred UI work, to be picked up in the visual redesign rather than patched
piecemeal. Everything here is known and deliberate — not a bug list.

## Headline goals

### Make the whole UI Magic Remote friendly

The app was built for D-pad navigation. The LG Magic Remote has a **pointer**
and sends real mouse events, so every surface needs to work by pointing as
well as by pressing.

Two pointer paths have been fixed already, both of which were genuinely
broken on the remote and not just in a desktop browser:

- Filter rail pills are clickable and stop propagation, instead of falling
  through to the channel list's wrapper handler (`891346b`).
- Channel rows resolve to the row actually under the pointer, instead of
  always selecting whatever row the keyboard cursor was on (`52cbb2f`).

Still to do:

- **Audit every remaining surface for the same class of defect.** The pattern
  is: a DOM overlay rendered inside a parent that has its own `onClick`, with
  no `stopPropagation`, so clicking a control does the parent's action instead
  of its own. `ChannelListDetails`' action rows and the category picker's rows
  already stop propagation; the EPG, the menu and the settings panels have not
  been checked.
- **Hover states.** Nothing highlights under the pointer today, so there is no
  feedback before clicking. Canvas-rendered surfaces need this hooked into the
  draw loop, not CSS.
- **Keep pointer focus and D-pad focus in agreement.** Clicking a rail pill now
  moves rail focus to it; the same rule needs applying wherever both input
  methods can move a cursor, or pressing a direction after clicking jumps from
  a stale position.
- **Hit targets.** Pills and action rows are sized for a 10-foot D-pad UI, not
  for pointing. Review minimum target sizes.

### Replace the horizontal filter rail with a category dropdown

**Decided direction (user, 2026-08-05).** The horizontal pill rail is being
replaced rather than patched. Categories become a single collapsed control
fixed at the top of the channel list; selecting it expands a **vertical
dropdown** of all categories, and choosing one shows that category's channels.
The long channel list stops being the default thing on screen - you pick a
category first. `All` keeps everything, `★ Favorites` keeps the favourites.

Why replace rather than fix: the rail has three separate defects and a vertical
list removes all three at once.

1. **It overflows.** Measured on a live server with 14 tags: the pills need
   ~2282px against the 852px the rail offers (900px minus 24px padding a side).
2. **It paints over the channel rows.** `.filterRail` is `display: flex` with
   no `flex-wrap` and no `overflow` (`src/styles/app.css:242`), so pills first
   squash and then spill outside the 900px column, over the video behind it.
3. **Focus moves but the view does not follow.** With the rail focused,
   left/right *do* step through every entry and even wrap
   (`ChannelList.tsx:432-438`) - but nothing scrolls the focused pill into
   view, so once focus passes the visible edge the user gets no feedback at
   all and the rail feels stuck. This is the defect users actually report.

A vertical dropdown fixes all three: 14 items fit or scroll naturally, up/down
is the natural remote gesture for a list, and it needs no horizontal scrolling
model at all.

**Constraint carried over:** `ChannelList.tsx` hardcodes
`mFilterRailHeight = 86` and derives every canvas row position from it -
`getTopFrom(position) = position * mChannelLayoutHeight + mFilterRailHeight - scrollY`
- and `src/utils/ChannelListGeometry.ts` takes the same value as `railHeight`
for pointer hit-testing. The collapsed control must either keep a fixed known
height, or that height must be measured and fed to both consumers. Getting this
wrong puts the drawn rows and the click targets out of step - a worse bug than
the one being fixed.

**Open design questions, to settle before building:**

- Opening the channel list with right-arrow: does focus land on the category
  control or on the channel list?
- Does `★ Favorites` stay a always-visible one-press control, or move inside
  the dropdown with everything else?
- Does the dropdown reopen on the last-used category, and is the playing
  channel's category indicated?
- Key budget is tight: left/right already drive the details panel from the
  channel list (`ChannelList.tsx:520-541`). Which key opens the dropdown, and
  what closes it?
- Does the same treatment apply to the EPG, which has its own channel column?

### Make the lists scrollable by pointer

The channel list and EPG are canvas-rendered with their own scroll model
(`scrollY` plus an animated `requestAnimationFrame` loop). `onWheel` is wired,
but there is no pointer-driven scrolling beyond that.

- Drag-to-scroll / flick with the Magic Remote pointer.
- A visible scrollbar or position indicator — there is currently no affordance
  showing where you are in a 1000-channel lineup.
- Decide whether the same treatment applies to the EPG's horizontal time axis.

## Layout and visual items carried over

These were all found during the favorites/categories work and deliberately
deferred as cosmetic:

| Item | Detail |
|---|---|
| Rail height is a hardcoded guess | `mFilterRailHeight = 86` in `ChannelList.tsx` is an estimate of the rail overlay's rendered height; the CSS measures to roughly 87px, so the top row may lose a pixel. The redesign should derive it or measure it rather than hardcode. |
| Bottom row renders as a ~4px sliver | On a 1080-tall viewport, `86` is not a multiple of the 90px row height, so the last visible row is a thin strip. Consistent with the existing fade-in-while-scrolling design, but worth deciding on deliberately. |
| Favorite star clearance is tight | The ★ sits in a 44px gap between the channel number (ends at x=70) and the name column (starts at x=114), with roughly 6px clear each side at an assumed ~32px glyph width. Never verified against real rendered glyph metrics. |
| `.filterRail.focused` is inert | The rail wrapper toggles a `focused` class but no CSS rule exists for it — only the individual pill is styled when focused. Either style the wrapper or drop the class. |
| Empty-filter banner copy is fixed | Reads "No favorites yet — hold OK on a channel to add it" for *any* empty filter. Briefly reachable with a tag filter during the ~1s window before tags load. Make the copy filter-aware. |
| Channel name can overrun the logo | Worst case the name's right edge reaches x=783 against a logo starting at ~780, and x=810 on recording rows. Pre-existing; mitigated in practice by text truncation. |
| Details panel lost channel browsing | ↑/↓ in the details panel now move between the two action rows rather than scrolling channels. Deliberate, but a capability was lost — reconsider in the redesign. |

## Interaction items worth revisiting

- **Arrow keys leak past the audio/subtitle panel.** `ChannelSettings`
  consumes only OK, BACK, YELLOW and 'y' (`ChannelSettings.tsx:61-73`); every
  arrow bubbles up to `TV.tsx`. Right-arrow was fixed during the th0enix merge
  (it used to swap the open panel for the channel list), but **up/down still
  zap channels while the panel is open** instead of moving within the track
  list. Same root cause, wider fix — the panel should own its arrows, or
  `TV.tsx` should gate all four on `State.CHANNEL_SETTINGS`.

- **Menu and category picker swallow CH+/CH−.** Every other screen zaps.
  The menu returns early on `menuState`; the picker unmounts `<TV/>` entirely
  so there is nothing playing to zap.
- **The details-panel action rows are pointer-only in spirit.** They are
  keyboard-reachable, but the discoverability of hold-OK-to-favorite depends
  on the user finding the panel first.
- **First-run picker stops playback** for the ~1s it is open, because it
  unmounts `<TV/>`. Consistent with how the settings view already behaves.

## Related

- Performance: `docs/performance-backlog.md`
- Plan: `docs/superpowers/plans/2026-08-03-favorites-and-categories.md`
- Design: `docs/superpowers/specs/2026-08-03-favorites-and-categories-design.md`
