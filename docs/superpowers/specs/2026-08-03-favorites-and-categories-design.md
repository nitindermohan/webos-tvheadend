# Favorites and Categories

**Date:** 2026-08-03
**Status:** Approved
**Scope:** Channel favorites, tag-derived categories, and the directional remote remap they depend on.

## Context

`webos-tvheadend` is a webOS TV client for TVHeadend. Its main screens (channel list, EPG guide, info bar, recordings) are hand-drawn on a 2D canvas rather than composed from DOM, a deliberate choice to keep webOS 3.x TVs responsive. Channels are read from the TVHeadend M3U playlist; EPG data comes from the JSON API and is cached to disk through a Luna service.

Measurements against the target server (TVHeadend 4.3-2735) drive several decisions below:

| Metric | Value |
| --- | --- |
| Channels | 1,049 |
| Channels with a logo | 1,049 |
| EPG events available | 65,834 |
| Channel tags defined | 14 |
| Tags per channel | exactly 3, for every channel |
| Tags covering all 1,049 channels | `SDTV`, `TV channels` |
| Remaining genre tags | News 417 · Entertainment 140 · Devotional 138 · Educational 87 · Music 69 · Kids 50 · Movies 49 · Infotainment 49 · Lifestyle 25 · Sports 12 · Business 10 · Shopping 3 |

Two consequences shape this spec. First, at 1,049 channels the dominant usability problem is *finding* a channel, which makes favorites and categories load-bearing rather than decorative. Second, because every channel carries exactly one genre tag, categories form a clean partition of the lineup.

## Goals

1. Users can mark channels as favorites and browse only those.
2. Users can filter the lineup by TVHeadend channel tag.
3. Both are reachable on a modern LG Magic Remote, which has no colour buttons.

## Non-goals

These are deliberately deferred to their own specs, in this order:

1. **Performance and data-layer rework** — lazy logo loading, removing the 10,000-event EPG cap, replacing the monolithic `epgcache.json`.
2. **Visual restyle** — applying the agreed "Direction B" design language (each channel a discrete rounded card, monochrome panel, white focus outline, logos supplying colour) across all screens.

The rail and picker introduced here are drawn in the app's current visual idiom. The restyle spec re-themes them along with everything else.

## Design decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Rendering | Keep canvas | Preserves webOS 3.x performance; a DOM rewrite is out of scope. |
| Filter UI | Horizontal rail above the channel list | One control covers favorites and categories; matches modern IPTV players. |
| Filter scope | Global and persisted | Channel list, EPG and channel zapping all honour it. Favorites are only useful while watching if zapping respects them. |
| Category source | TVHeadend channel tags | The only real source. Joined to M3U channels by uuid. |
| Rail contents | User picks tags on first run | 14 tags, two of them useless, would otherwise produce a cluttered rail. |

## Architecture

### Data sources

Two new read-only API calls, both verified against the target server:

- `api/channeltag/grid?limit=999` → tag uuid and name.
- `api/channel/grid?limit=9999` → channel uuid and its `tags[]` array.

Channels continue to come from the M3U playlist, which remains the only source of stream URLs. The tag map joins onto them by **channel uuid** — exactly what the playlist's `tvg-id` attribute carries. Channels the join misses have no tags and appear under *All* only.

### New units

| Unit | Responsibility |
| --- | --- |
| `models/ChannelFilter.ts` | Value type `{ kind: 'all' \| 'favorites' \| 'tag', tagUuid?: string }`. |
| `models/ChannelTag.ts` | `{ uuid, name, channelCount }`. |
| `utils/FavoritesStore.ts` | A `Set<channelUuid>` persisted to localStorage. `has` / `add` / `remove` / `toggle` / `all`. |
| `utils/CategoryStore.ts` | Which tag uuids appear on the rail, the active filter, and the `configured` flag. |
| `utils/RemoteKeys.ts` | Named constants for every remote key code. |
| `components/FilterRail.tsx` | Draws the rail and owns rail focus. |
| `components/CategorySetup.tsx` | First-run tag picker; also reachable from the menu. |

### Modified units

**`EPGChannel`** gains `tagUuids: string[]`, defaulting to empty.

**`EPGData`** becomes the single filtering authority. It already owns the channel array; it gains:

- `setFilter(filter: ChannelFilter)`
- `getChannels()` — returns the **filtered** view (existing signature, existing callers unchanged)
- `getAllChannels()` — the full lineup, for the few places that need it
- `getChannelCount()` — count of the filtered view

Every consumer — `ChannelList`, `TVGuide`, live-TV zapping — keeps calling `getChannels()` and inherits filtering for free.

This boundary is what protects this work from the deferred performance rework: filtering is defined over *a channel list*, not over how that list was loaded. The later spec can replace the loading strategy underneath without touching filter logic.

**`StorageHelper`** changes how the last-watched channel is persisted. It currently stores an **index** (`getLastChannelIndex`). Once a filter can change the list, a stored index resolves to a different channel on the next launch. It changes to persist the **channel uuid**, resolving to an index at startup and falling back to `0` when the uuid is absent. Existing installs read the legacy `lastChannel` key once, migrate it, and remove it.

**`TVHDataService`** gains `retrieveChannelTags()` and `retrieveChannelTagMap()`.

### Filter-change semantics

Switching filters never interrupts playback.

- If the playing channel is present in the new filtered set, focus follows it.
- If it is not, playback continues untouched and focus clamps to the top of the new set.
- If the new set is empty (favorites with nothing starred), the list renders an empty state reading *"No favorites yet — hold OK on a channel to add it"*; playback is unaffected. Zapping falls back to the full lineup while the active filter is empty, so CH+/CH− never becomes a dead key.

The active filter is persisted and restored on launch.

## Remote control

The app currently binds four core actions to colour buttons — red record, green menu, yellow audio track, blue EPG. A Magic Remote has none of them, so those actions are unreachable. This spec remaps navigation to directions, OK, Back and Guide.

`utils/RemoteKeys.ts` holds one constant per action so a wrong code is a one-line fix. `Guide` is believed to be `458` (`VK_GUIDE`) and `Info` `457`; both must be confirmed on-device. `TV.tsx` already logs unhandled key codes (`TV-keyPressed:`), so pressing Guide with `ares-inspect` attached reports the real value.

### Key map

| | Live TV | Channel list | Filter rail | EPG |
| --- | --- | --- | --- | --- |
| ↑ | zap channel | move — at the top row, focuses the rail | — | move channel |
| ↓ | zap channel | move | apply filter, return to list | move channel |
| ← | menu drawer | back to TV | previous pill | scroll time back |
| → | channel list | details panel | next pill | scroll time forward |
| **CH+ / CH− (33 / 34)** | **zap** | **zap** | **zap** | **zap** |
| OK (13) | toggle info bar | watch channel | apply filter, return to list | watch channel |
| OK held | — | toggle ★ favorite | — | toggle ★ favorite |
| Guide (458) | open EPG | open EPG | open EPG | close |
| Back (461) | exit | close | return to list | close |
| 0–9 | channel number entry | — | — | — |

**CH+ / CH− remain bound in every state**, including while the channel list, rail or EPG is open, so channel changing always works regardless of what is on screen. They zap within the active filter.

### Rehomed actions

| Action | Was | Now |
| --- | --- | --- |
| Record | red | Action row in the details panel; on the focused programme in the EPG |
| Audio track | yellow | Menu drawer |
| Menu | green | ← from live TV |
| EPG | blue | Guide |

Colour codes stay bound as hidden aliases so older remotes continue to work.

### Toggling a favorite

Two paths, deliberately redundant:

1. **Discoverable** — a `★ Add to favorites` / `★ Remove from favorites` action row in the channel details panel.
2. **Shortcut** — holding OK on a focused channel in the channel list or EPG.

Hold is implemented as a timer started on `keydown` of OK; if it fires, the favorite toggles and the normal select action is suppressed until the matching `keyup`. If hold proves unreliable on-device, the details-panel path stands on its own and the shortcut can be dropped without affecting the feature.

## First-run category picker

After setup verification passes and channels and tags have loaded, if `CategoryStore` reports itself unconfigured the user sees a picker.

1. Lists all tags with live channel counts, sorted by count descending.
2. Any tag whose channel count is **≥ 95% of the total channel count** is **pre-unticked**, with a line explaining why. On the target server this automatically excludes `SDTV` (1049/1049) and `TV channels` (1049/1049). The threshold only affects which boxes start ticked; every tag remains selectable.
3. The remaining genre tags are pre-ticked.
4. Saving writes the selected uuids to localStorage and sets `configured`.

The rail then reads `★ Favorites | All | <selected tags>`, ordered by the tag's `index` field from TVHeadend and falling back to alphabetical when indexes tie — they are all `0` on the target server, so in practice the rail is alphabetical there.

The picker is reopenable at any time from Menu → Categories. Tags that appear on the server later default to **hidden** and are shown in the picker with a `new` marker, so the rail never reshuffles on its own.

## Failure behaviour

- **Either tag call fails** — log it and degrade the rail to `★ Favorites | All`. Categories are additive and never block startup.
- **Server unreachable** — favorites live purely in localStorage and keep working.
- **Join misses a channel** — it appears under *All* only.
- **A configured tag disappears from the server** — it is dropped from the rail silently; if it was the active filter, the filter resets to *All*.

## Testing

The repository contains no tests today, though `react-scripts test` is wired up. This spec does not retrofit tests to the canvas components, whose rendering is not meaningfully unit-testable. It does cover the new logic, which is pure:

- `FavoritesStore` — add, remove, toggle, persistence round-trip.
- `CategoryStore` — selection persistence, `configured` flag, newly-discovered-tag handling.
- `EPGData` filtering — each filter kind, filter-change focus behaviour (surviving channel, non-surviving channel), empty favorites.
- Tag → channel uuid join, including channels absent from the tag map.
- `StorageHelper` — uuid persistence and the legacy index → uuid migration.

Manual verification on-device covers the Guide key code, OK-hold reliability, and that CH+/CH− zap correctly from every screen.

## Open items

- Guide (`458`) and Info (`457`) key codes require on-device confirmation.
