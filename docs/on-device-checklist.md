# On-device checklist (LG C5)

The browser harness (`.claude/skills/run-app/SKILL.md`) runs the real app
against fixtures, so most of the UI is already verified before anything
reaches a TV. This list is deliberately **only the things the harness cannot
answer** — real logos, real OLED black, the TV's font stack, the Magic Remote,
and playback. Re-checking what fixtures already proved is how an on-device
pass becomes an hour of scrolling that finds nothing.

## Pre-flight (no TV needed)

Done against the CI artifact for `5e01fd8` (run 31193145605, 2.04 MB). That
build still carried the old `com.tvh.app` id — the rename to `com.tvh.next`
came after it — so the artifact to install is the one CI produces for the
rename commit, not that one. Everything checked below is unaffected by the id.

Repeat this for any build before sideloading; each item is a blank screen or a
silent fallback that costs a trip to the TV to discover:

| Check | Why it matters | Result |
|---|---|---|
| `index.html` asset refs are relative (`./static/...`) | webOS serves the app from the filesystem. Absolute `/static/...` paths resolve against the device root and the app launches to a black screen with no error. Guarded by `"homepage": "./"` in `package.json`. | pass |
| Every `@font-face` url in the built CSS resolves to a file inside the ipk | A missing font file does not error — Chromium falls back silently, and the app looks *nearly* right, which is worse than broken. 20/20 urls resolved (8 Inter, 12 Moonstone/Miso/MuseoSans). | pass |
| Both Inter weights and both subsets are packaged | 400 and 700, latin and latin-ext, `.woff2` + `.woff` = 8 files. Missing 700 shows up only on the focused row. | pass |
| `appinfo.json` id matches the service id | `com.tvh.next` / `com.tvh.next.proxy`. A mismatch makes the luna proxy fail silently — the UI loads and no data ever arrives. Now also covered by `src/luna/AppIdentity.test.ts`, which reads all six files, so it fails in CI rather than on the TV. | pass |

```bash
# unpack an ipk to check it yourself
ar x com.tvh.next_1.1.0_all.ipk && mkdir -p x && tar xzf data.tar.gz -C x
ls x/usr/palm/applications/com.tvh.next/static/media/ | grep inter
```

## A second app, not an upgrade

`com.tvh.next` installs **alongside** the existing `com.tvh.app` rather than
replacing it — that is the point of the rename, so the working install stays
available as a fallback. Two consequences:

- **Nothing carries over.** localStorage is scoped per app id, so the server
  URL, credentials, favourites, category selection and appearance settings all
  start empty. First launch shows the setup screen. That is worth having: it
  is the only on-device exercise the first-run path gets.
- **The two are independent installs.** Removing one leaves the other alone
  (`npm run webos:tv-rm` now targets `com.tvh.next`).

## Install

`ares-cli` is not installed on this machine and no `tv` device is registered
(`~/.webos/ose/novacom-devices.json` holds only the emulator stub). One-time
setup:

1. On the TV: install **Developer Mode** from the LG Content Store, sign in
   with an LG developer account, enable it, and note the IP and passphrase.
2. `npm install -g @webosose/ares-cli`
3. `ares-setup-device` — add a device named `tv` at that IP.
4. `ares-novacom --device tv --getkey` — paste the passphrase.

Then either sideload the CI artifact:

```bash
gh run download <run-id> --dir /tmp/ipk   # the run for the rename commit or later
ares-install /tmp/ipk/com.tvh.next_1.1.0/com.tvh.next_1.1.0_all.ipk -d tv
ares-launch com.tvh.next -d tv
```

or build and push in one step with the existing script: `npm run webos:tv`.

Remote devtools — needed for the font check below — are `npm run inspect:tv`.

## Is Inter actually being used?

The plan says to compare a canvas row against a DOM row by eye. Don't: Inter
and the TV's default sans are close enough at a distance that a wrong answer
is easy to get, and the failure this is looking for (the Phase 0 race, where
the canvas measures text before the font finishes loading) is a *metrics*
question, not an appearance one. Paste this into the `inspect:tv` console:

```js
(() => {
    const c = document.createElement('canvas').getContext('2d');
    const s = 'Channel 100 HD Sports';
    c.font = '32px Inter';        const inter = c.measureText(s).width;
    c.font = '32px NoSuchFontXY'; const fallback = c.measureText(s).width;
    return { status: document.fonts.status,
             loaded: document.fonts.check('32px Inter'),
             bold: document.fonts.check('700 32px Inter'),
             inter, fallback, differs: inter !== fallback };
})()
```

Wrapped in an IIFE deliberately — top-level `const` in a console makes the
paste fail the second time you run it.

`loaded` and `bold` both `true`, and `differs` `true`, is the answer. If
`differs` is `false` the canvas is drawing in the fallback font whatever the
DOM is doing — which is exactly the bug the Phase 0 metrics-cache flush
exists to prevent, and it means that flush is not firing on device.

## If no data arrives

The app launching and staying empty is the signature of an id mismatch, and it
looks identical to an unreachable server. This separates them — it pings the
service directly, bypassing everything above it:

```js
webOS.service.request('luna://com.tvh.next.proxy', {
    method: 'ping', parameters: {},
    onSuccess: (r) => console.log('PROXY OK', r),
    onFailure: (e) => console.log('PROXY FAIL', e)
});
```

`PROXY FAIL` (or silence) means the service is not routing — an identity
problem, despite `AppIdentity.test.ts` passing, and worth reporting with the
error. `PROXY OK` puts the fault on the server side or in the URL entered at
setup.

## What only the TV can show

**Logos, against the real lineup.** The fixtures carry a handful of logo urls;
the real lineup has hundreds, of mixed provenance. Look for: channels with no
logo at all (does the fallback read as deliberate, or as a missing image?),
and dark logos on transparent backgrounds — these are invisible against OLED
black and are a known open item, so the question is how many channels it
actually affects, not whether it happens.

**OLED black.** `#0B0F14` and `#121214` (Slate and Graphite's bases) are near
enough to black that on a self-emissive panel they may not read as distinct
surfaces at all — the raised/card layering that separates cleanly on an LCD
can collapse. Check that the channel list still reads as sitting *on top of*
the video, and that the three themes are distinguishable from a sofa rather
than from 40cm.

**Text sizes.** Small and Largest are the ones to judge; Normal is what the
harness already showed. At Largest, check the appearance panel itself scrolls
its focused row into view (the fix in `5e01fd8`) and that no canvas text is
clipped at a row edge. At Small, check the channel numbers are still legible
at viewing distance — that is a question no desktop monitor can answer.

**Magic Remote pointer.** Three known gaps, all pointer-only, so this is the
first time any of them are real: the EPG grid does not hit-test clicks
(`TVGuide.handleClick`), the grid has no hover state, and the lists cannot be
dragged or flicked. Confirm how badly each one reads when the pointer is the
primary input.

**The colour-button legend.** `ChannelInfo` draws a red/green/yellow/blue
legend unconditionally; the C5's remote has no colour buttons. Confirm the
legend is genuinely dead weight on this remote before deciding what replaces
it.

**Playback.** Not exercised by the harness at all — no stream ever runs. Check
a channel starts, the info bar overlays it correctly, and that switching
channels from the list does not leave the previous stream's audio running.

## Related

- Plan: `docs/superpowers/plans/2026-08-06-tivimate-ui-redesign.md`
- Open items: `docs/ui-redesign-backlog.md`
- Harness: `.claude/skills/run-app/SKILL.md`
