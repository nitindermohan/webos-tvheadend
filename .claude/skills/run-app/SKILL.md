---
name: run-app
description: Use when you need to actually run webos-tvheadend and look at it - inspecting UI changes, reproducing a layout bug, driving the remote navigation, or taking screenshots. Runs the real app against fixture data in a desktop browser, with no TVheadend server and no TV.
---

# Running webos-tvheadend

Runs the real React app — real state, real canvas rendering, real key
handling — against the fixtures in `src/mock/` (908 channels, full EPG, tags,
recordings).

## Why not the webOS emulator

The LG emulator needs two things only the user can provide: VirtualBox
(admin install plus a system-extension approval in System Settings) and the
webOS TV SDK image (behind an LG developer account login). `ares-cli` is not
installed either. The `webos:emu` / `inspect:emu` scripts in `package.json`
assume all of that and will not work as things stand.

None of it is needed to look at the UI. Use the browser.

## Start it

```bash
BROWSER=none PORT=3000 npm run start:mock
```

`start:mock` sets `REACT_APP_USE_MOCKS=true`. `src/config/Config.ts` reads it
**and** `NODE_ENV !== 'production'` — both, deliberately: CRA inlines
`process.env` as a whole object, so a `REACT_APP_*` check alone is not
statically foldable and webpack keeps the mock modules in the production
bundle. That was measured, not assumed — the bundle went from 214 kB to
441 kB. The `NODE_ENV` half is what webpack folds, so `npm run build` cannot
produce a mock build and the fixtures never reach the ipk.

**Never** swap the adapters by editing `Config.ts`. The flag exists so that
file stays untouched.

## Get past the setup screen

First load shows `TVheadend Setup`, because nothing is persisted yet. Seed
localStorage and reload — tag uuids come from `src/mock/channelTags.json`:

```js
localStorage.setItem('TVH_SETTINGS', JSON.stringify(
  { tvhUrl: 'http://mock.local:9981/', user: '', password: '', dvrUuid: 0 }));
localStorage.setItem('categoriesConfigured', 'true');
localStorage.setItem('categorySelectedTags', JSON.stringify([
  'a51d37f97a47ffb2208bc3f0e9fa3010',  // SDTV
  'ac291c2414188cb42d712138060f30d8',  // HDTV
  '7dfb969159aefe38655248e2a10084b4',  // UHDTV
  '2d54c363d362fc517d88f66048a0ae44'   // Radio channels
]));
```

To exercise the first-run category picker instead, clear
`categoriesConfigured`. To exercise favourites, seed `favoriteChannels` with
uuids from `src/mock/channels.json`.

## Drive it

Viewport **1920x1080** — the canvas geometry assumes it. Keys map to the
remote: `ArrowRight` from live TV opens the channel list, `ArrowUp`/`Down`
walk it, `Enter` is OK, `Escape` is Back. See `src/utils/RemoteKeys.ts`.

Take a screenshot after each step and **look at it**. The canvas surfaces
(channel list rows, EPG grid, info bar) do not appear in the accessibility
snapshot at all — a snapshot showing an empty page is not evidence the app
failed to render.

## Hide the CRA error overlay

The dev overlay covers the app whenever a resource fails, which here is
constant (see below). Hide it once per page load:

```js
const hide = () => document.querySelectorAll('iframe').forEach((f) => {
  if ((f.id || '').includes('overlay') || (f.src || '').includes('webpack')) {
    f.style.display = 'none';
  }
});
hide();
new MutationObserver(hide).observe(document.body, { childList: true });
```

## What the fixtures cannot show you

The fixtures carry **absolute URLs to the original author's server**
(`userver.fritz.box:9981`), which does not resolve. So:

- **No channel logos.** Every `imagecache` request fails. Anything about
  logo layout, logo contrast against the background, or the fallback for a
  channel with no logo **cannot be judged here** — it needs the real server
  or intercepted requests serving placeholder images.
- **No video.** The stream URL fails, so the player shows a spinner and the
  app logs `Network not available`. Expected; not a bug.
- **The EPG grid is empty.** `epg.json`'s 1000 events are all dated
  **8-9 December 2020**, so nothing overlaps "now" and no programme blocks
  are drawn. The grid, time bar, now-line, past shading and channel column
  all render fine - only the event rectangles are missing. Do not read an
  empty guide as a regression. To exercise event rendering, either shift the
  fixture timestamps forward or fake the clock.
- Console errors are dominated by these. Filter them out before reading the
  console for anything real.

## Stop it

```bash
pkill -f "react-scripts start"
```

Screenshots written by the Playwright MCP land in the **parent** directory
(`/Users/nitindermohan/Documents/GitProjects/`), not the project, along with
a `.playwright-mcp/` folder. Delete both when finished.
