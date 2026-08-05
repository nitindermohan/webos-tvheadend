# ---sharpluck Build---
* Update dependencies
* Remove background, splash, icons
* Added extended request timeout & video preload disable (MartB)
* Right key opens Menu in TV-State (Special non-colorbutton remotes)

# webos-tvheadend
* This is a WebOS Client for TVHeadend
* It can currently only be installed using the Developer App or Homebrew
* The design is similiar to the famous Media Center Kodi
* This fork targets **modern webOS only** - webOS 22 and later (LG 2022+ sets,
  Chromium 87+). The build's browserslist is pinned to `chrome >= 87` and the
  `core-js` / `regenerator-runtime` polyfills upstream carried for webOS 3.0
  have been removed. Together that cut the bundle from 267.3 kB to 212.9 kB
  gzipped (-20%) and let it ship as native ES2020 instead of transpiled ES5.
  `chrome >= 87` was chosen over a tighter floor because it produces a
  byte-identical bundle while covering three more webOS releases.
  Upstream still supports webOS 3, 4 and 5; this fork does not. To restore
  that, put back the broad browserslist and the two polyfill imports at the top
  of `src/index.tsx`.
* It uses react but most components use the canvas 2d api to improve performance on older TVs

## Setup
![Setup](screenshots/setup_verification.png?raw=true "Setup Verification")
## Channel list
![Channel List](screenshots/channellist.png?raw=true "Channel List")
## Channel list with details
![Channel List Details](screenshots/channellist_details.png?raw=true "Channel List Details")
## EPG
![EPG](screenshots/epg.png?raw=true "EPG")
## Current Channel info
![Infobar](screenshots/infobar.png?raw=true "Infobar")
## Menu
![Menü](screenshots/menu.png?raw=true "Menü")

## Build
Normal build without webos running
* TVGuides.js:getNow() needs to return 1607462851000 as mock timestamp for now
* TVHDataService:constructor() needs to use MockServiceAdapter instead of LunaServiceAdapter
```s
npm run start
```
* Device Setup
```s
name      deviceinfo                    connection  profile
--------  ----------------------------  ----------  -------
emulator  developer@127.0.0.1:6622      ssh         tv
tv        prisoner@192.168.178.22:9922  ssh         tv
```

Deployment to emulator/webos
```s
npm run webos:emu
npm run webos:tv

# for debugging attach to device
ares-inspect -d emulator com.willinux.tvh.app --open
ares-inspect -d tv com.willinux.tvh.app --open
```
## Features
- EPG
- Channel List
- Record live tv or plan recordings using EPG
- Play and Manage recordings
- User Authentication: basic and digest (md5, sha256)

## WebOS
Useful links for video playback using webos

* http://webostv.developer.lge.com/develop/app-developer-guide/resuming-media-quickly-mediaoption/
* http://webostv.developer.lge.com/api/web-api/mediaoption-parameter/

## tvheadend

#### API documentation
https://github.com/dave-p/TVH-API-docs/wiki
