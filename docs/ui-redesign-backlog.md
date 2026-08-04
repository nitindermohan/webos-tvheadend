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

### Fix the filter rail overflowing the channel list

**User-reported, and the most visible defect on the list today.** With a real
server's tag set the category pills spill out of the channel list column and
look broken.

The numbers, measured against a live server with 14 channel tags (longest name
13 chars): the pills need roughly **2282px**, and `.filterRail` gives them
**852px** — 900px wide minus `24px` padding each side. About 2.7x over.

The mechanism, all in `.filterRail` / `.filterPill` (`src/styles/app.css:242`):

- `display: flex` with **no `flex-wrap`**, so it defaults to `nowrap`.
- **no `overflow`**, so it defaults to `visible`.
- The rail is `position: absolute` inside the 900px-wide list.

So the pills first squash (flex items shrink by default, mangling the labels)
and then spill outside the 900px column, over the video behind it.

**The trap when fixing this:** `ChannelList.tsx` hardcodes
`mFilterRailHeight = 86` and every canvas row position is derived from it -
`getTopFrom(position) = position * mChannelLayoutHeight + mFilterRailHeight - scrollY`,
and the pointer hit-testing in `src/utils/ChannelListGeometry.ts` takes the
same value as `railHeight`. Adding `flex-wrap: wrap` would make the rail two or
three rows tall while that constant stayed at 86, silently pushing every channel
row up underneath the rail and putting the click targets out of step with what
is drawn - a much worse bug than the one being fixed. Any fix must either keep
the rail exactly one row tall, or measure the rendered height and feed it to
both consumers.

Options worth weighing:

- **Horizontal scroll with the focused pill scrolled into view.** Keeps the
  height fixed, so `mFilterRailHeight` stays valid. Needs a pointer affordance
  (see the pointer-scrolling item below) and edge fade hinting.
- **Cap what reaches the rail** and move the rest behind an overflow entry.
  The category picker already drops tags covering >=95% of channels, so the
  mechanism for trimming the set exists.
- **Wrap to a measured height**, deriving `mFilterRailHeight` from the DOM
  rather than hardcoding it - which also closes the "rail height is a hardcoded
  guess" item below.

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

- Plan: `docs/superpowers/plans/2026-08-03-favorites-and-categories.md`
- Design: `docs/superpowers/specs/2026-08-03-favorites-and-categories-design.md`
