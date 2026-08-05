# Performance backlog

Measured work, ordered by expected impact. Every number here was measured
against a real setup (LG C5, TVHeadend with **1060 channels**, all carrying a
logo URL, and **87,890 EPG events - about 113 per channel**), not estimated.

## Done

| Change | Result |
|---|---|
| Retarget build to `chrome >= 87`, drop `core-js` / `regenerator-runtime` (`0b32b42`) | 267.3 kB -> **212.9 kB** gzipped (-20%); raw 1,075,270 -> 897,577 B; ships native ES2020 instead of transpiled ES5 |

## 1. EPG draws every event, every frame (bug, not just slowness)

`TVGuide.tsx:508-519`:

```js
let wasVisible = false;
epgEvents.forEach((event) => {
    const isVisible = isEventVisible(event.getStart(), event.getEnd());
    if (isVisible) { wasVisible = true; drawEvent(...); }
    if (wasVisible && !isVisible) {
        return;   // returns from the CALLBACK - does NOT break the loop
    }
});
```

The comment above it - *"the list is ordered by time so its only a few events
processed"* - states the intent, but `return` inside a `forEach` callback only
skips to the next item. The early exit never happens.

Cost: ~113 events x ~12 visible channels = **~1,350 visibility checks per
frame**, at 60fps **~81,000 per second**, to draw the ~30 events actually on
screen. Roughly 2% of the work is useful.

Fix: a plain `for` loop with `break`, or `some()`. Extract `isEventVisible`
plus the loop bound into a tested pure helper, the way `ChannelListGeometry`
and `StreamIdentity` already are.

## 2. Two `measureText` calls per label per frame

`CanvasUtils.getShortenedText` calls `getWidthPerCharacter(canvas)`, which
measures a 30-character probe string, and then measures the real text as well.
`measureText` is among the more expensive canvas operations on a TV SoC.

The per-character width depends only on the current font, so it is a constant
being recomputed thousands of times a second. Cache it keyed on
`canvas.font`. Halves the text cost of every canvas surface at a stroke.

## 3. `FavoritesStore.has()` hits localStorage inside the draw loop

`ChannelList.tsx:336` calls `FavoritesStore.has()` per row, inside
`drawChannelItem` -> `drawChannelListItems` -> the `requestAnimationFrame`
scroll loop. Each call is a `localStorage.getItem` **plus a `JSON.parse`**.

Cost: ~12 visible rows x 60fps = **~720 reads and parses per second** while
scrolling.

Fix: read once per draw pass, or hold the set in `AppContext` invalidated by
the `favoritesVersion` counter that already exists for exactly this purpose.

Related: `FavoritesStore`'s own comment says it stores a JSON array "rather
than a Set because the build targets es5 without downlevelIteration". That
constraint died with the retarget above - it can be a `Set` now, turning the
per-row `indexOf` from O(n) into O(1).

## 4. Channel logos are rescaled on every frame

`ChannelList.drawChannelItem` calls `drawImage` with the full-resolution PNG
and scales it to roughly 117x90 **every frame**. Decode once, draw into an
offscreen canvas at final size, then blit that. Usually the single largest
canvas win in a list like this.

## 5. 1060 logo fetches at startup

`App.preloadImages()` walks every channel and constructs an `Image`
immediately. On this lineup that is **1060 concurrent requests** the moment the
channel list loads. (th0enix commented this out in their fork; we kept it
deliberately when choosing to keep our UI.)

Fix: load logos for visible rows only - the canvas already knows which rows
those are - and bound concurrency to ~6 so the TV's network stack stays
responsive. This is a **visible behaviour change**: logos would appear as you
scroll rather than all being present up front. Worth confirming on the TV.

## Server-side, free, independent of the app

TVHeadend ships an `imagecache` module. Enabled, it fetches each logo once and
serves it locally from `/imagecache/<id>` instead of every TV hitting the
original external URLs - removing a DNS lookup and TLS handshake per logo.
Costs nothing in the app and helps item 5 considerably.

## Suggested order

1-3 are pure logic, unit-testable without the TV, and low risk. 4-5 change
visible behaviour and want checking on the C5.

## Related

- UI work: `docs/ui-redesign-backlog.md`
