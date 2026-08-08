# webos-tvheadend

A [TVheadend](https://tvheadend.org/) client for LG webOS TVs — live TV, a full
EPG, recordings, and a channel list built for a remote rather than a mouse.

Most of the UI is drawn with the canvas 2D API rather than the DOM. A TV has to
scroll a nine-hundred-channel list smoothly on hardware several generations
behind a phone, and canvas is what makes that possible; the cost is that these
surfaces have no accessibility tree and cannot be inspected as elements.

**This fork targets modern webOS only** — webOS 22 and later (LG 2022+ sets,
Chromium 87+). It installs as **`com.tvh.next`**, alongside rather than over any
existing install.

## What it looks like

The screenshots below were taken against a live TVheadend server with ~1000
channels.

### Channel list

Categories on the left, channels in the middle, the playing channel marked with
an accent bar. Each row carries the channel number, its logo, and what is on now
with a progress bar.

![Channel list](screenshots/channellist.png?raw=true "Channel list")

### Channel details

Right from a row opens the details panel: the synopsis, what follows, and the
two actions a row has — favourite and record.

![Channel list with details](screenshots/channellist_details.png?raw=true "Channel list with details")

### Guide

The same category column beside a scrolling grid, with the focused programme
described underneath.

![EPG](screenshots/epg.png?raw=true "EPG")

### Search

By name or by channel number, in the same field. Digits match the number by
prefix and the name by substring, so `4` finds both channel 4 and "Channel 4".
Queries are matched past case and accents, so `sudwest` finds "Südwest".

![Search](screenshots/search.png?raw=true "Search")

### Appearance

Seven settings, applied as you change them rather than behind a Save button.

![Appearance](screenshots/appearance.png?raw=true "Appearance")

### Categories

Shown once on first run, and reachable from the menu afterwards. Tags carried by
almost every channel are unticked by default, because a filter that matches
everything cannot narrow anything down.

![Categories](screenshots/categories.png?raw=true "Category picker")

### Menu and info bar

![Menu](screenshots/menu.png?raw=true "Menu")

![Info bar](screenshots/infobar.png?raw=true "Info bar")

## Features

- Live TV with an info bar, channel zapping and an audio/subtitle panel
- Full EPG, with a configurable time span
- Record from the guide, or schedule from a channel; manage and delete recordings
- Favourites — hold OK on a channel
- Categories derived from TVheadend's channel tags
- Search by channel name or number
- Appearance settings: three themes, six accent colours, four text sizes, two row
  densities, channel numbers on/off, guide span and grid lines
- User authentication: basic and digest (md5, sha256)

## Running it locally

There is no TV and no TVheadend server involved: `start:mock` swaps the three
service adapters for fixtures in `src/mock/`.

```bash
npm install
npm run start:mock          # http://localhost:3000
```

First load shows the setup screen, because nothing is persisted yet. Seed
localStorage and reload:

```js
localStorage.setItem('TVH_SETTINGS', JSON.stringify(
  { tvhUrl: 'http://mock.local:9981/', user: '', password: '', dvrUuid: 0 }));
localStorage.setItem('categoriesConfigured', 'true');
```

Use a **1920x1080** viewport — the canvas geometry assumes it. Keys map to the
remote: `ArrowRight` from live TV opens the channel list, `Enter` is OK, `Escape`
is Back, `g` opens the menu. See `src/utils/RemoteKeys.ts`.

**Never swap the adapters by editing `src/config/Config.ts`.** The flag exists so
that file stays untouched. It is also what keeps the fixtures out of the ipk:
`Config.ts` checks `NODE_ENV !== 'production'` as well as the flag, because CRA
only folds the former at build time — checking `REACT_APP_USE_MOCKS` alone left
the mock modules in the production bundle and took it from 214 kB to 441 kB.

The fixture EPG was captured in December 2020 and is re-anchored onto today at
request time (`src/mock/FixtureClock.ts`), shifted by whole days so programmes
keep their time of day. It is a thin sample — around ten events per channel over
two days — so the guide is populated where the fixture has data and empty where
it does not.

## Building and installing on a TV

```bash
npm run build               # production web build
CI=true npm test            # 343 tests, 37 suites (without CI= it watches)
npx tsc --noEmit            # type check
```

Note that eslint runs only inside `npm run build` — `tsc --noEmit` and jest both
pass on code the build rejects, so run the build before pushing.

CI builds every push and uploads a packaged `.ipk` artifact.

To sideload, enable **Developer Mode** on the TV, then:

```bash
npm install -g @webosose/ares-cli
ares-setup-device                     # add a device named "tv"
ares-novacom --device tv --getkey     # paste the passphrase from the TV

npm run webos:tv                      # build, package, install, launch
npm run inspect:tv                    # remote devtools
```

`docs/on-device-checklist.md` covers what to verify on the TV and what can be
checked in the ipk beforehand — the two ways a build is silently wrong (absolute
asset paths, a font file missing from the package) are both findable without a
TV.

## Things worth knowing before changing it

**The app id is repeated in six files, in three languages.** webOS requires a JS
service id to be prefixed by its app id, and a mismatch is invisible to every
gate: tsc, jest and the build all pass, webOS just declines to route the luna
call, and the app launches looking healthy while no data ever arrives. The id
lives in `src/luna/AppIdentity.ts` and `AppIdentity.test.ts` asserts the other
files agree — change the constant and let the test name what is left.

**Colour literals belong in `src/utils/Theme.ts` and nowhere else**, enforced by
`ThemeGuards.test.ts`. The canvas cannot read CSS custom properties, so the
palette is published to both consumers at once.

**Non-ASCII characters in source are restricted to a list confirmed to render on
a real C5** (`GlyphCoverage.test.ts`). The TV's fallback font draws `.notdef`
boxes for glyphs it lacks, and the check covers whole files, comments included.

**Channel positions are indexes into the filtered view, not channel ids.** They
are different spaces; comparing one to the other is a bug that silently tunes the
wrong channel. Re-filtering pins the playing channel and reconciles its position
— see `EPGData.applyFilter`.

Open items are tracked in `docs/ui-redesign-backlog.md` and
`docs/performance-backlog.md`. They are deliberate deferrals, not a bug list.

## Stack

React 18.3.1 (legacy `ReactDOM.render`), react-scripts 5.0.1, TypeScript,
@enact/moonstone 4.5.6 for the settings widgets and the menu. Production bundle
is 219 kB gzipped.

Browserslist is pinned to `chrome >= 87` and the `core-js` /
`regenerator-runtime` polyfills upstream carried for webOS 3.0 are gone —
together worth about 20% of the bundle, and it ships as native ES2020 rather than
transpiled ES5. Upstream still supports webOS 3, 4 and 5; this fork does not. To
restore that, put back the broad browserslist and the two polyfill imports at the
top of `src/index.tsx`.

## Lineage

A fork of [WillinuX-Code/webos-tvheadend](https://github.com/WillinuX-Code/webos-tvheadend)
by Jens Willhardt, by way of the sharpluck build (dependency updates, extended
request timeout and video preload disable from
[MartB](https://github.com/MartB/webos-tvheadend), right-key opens the menu for
remotes without colour buttons) and a later merge from
[th0enix](https://github.com/th0enix/webos-tvheadend).

The app id has changed twice along the way — `com.willinux.tvh.app`, then
`com.tvh.app`, now `com.tvh.next`. Each change installs as a separate app rather
than an upgrade, so an older install keeps working alongside — deliberately, but
it means settings and favourites do not carry over, since localStorage is scoped
per app id.

## Links

- TVheadend API: https://github.com/dave-p/TVH-API-docs/wiki
- webOS media playback:
  http://webostv.developer.lge.com/develop/app-developer-guide/resuming-media-quickly-mediaoption/
- webOS mediaOption parameters:
  http://webostv.developer.lge.com/api/web-api/mediaoption-parameter/
