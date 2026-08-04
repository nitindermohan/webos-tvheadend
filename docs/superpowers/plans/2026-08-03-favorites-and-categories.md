# Favorites and Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users mark channels as favorites and filter the 1,049-channel lineup by TVHeadend tag, reachable entirely from a Magic Remote that has no colour buttons.

**Architecture:** `EPGData` becomes the single filtering authority — it holds the full lineup plus a filtered view, and every existing consumer keeps calling `getChannels()`. Filter state, favorites and category selection live in localStorage behind three small stores. Categories come from two new read-only TVHeadend API calls joined onto the M3U channels by uuid. The filter rail is a DOM overlay above the existing canvas channel list, matching how `ChannelListDetails` already works.

**Tech Stack:** React 16 + TypeScript 3.9 (strict), Create React App 4, canvas 2D for list rendering, Jest 26 via `react-scripts test`, localStorage for persistence.

**Spec:** `docs/superpowers/specs/2026-08-03-favorites-and-categories-design.md`

## Global Constraints

- **TypeScript is 3.9.7 with `strict: true`.** No `satisfies`, no template literal types, no 4.x syntax.
- **`target: es5` and `downlevelIteration` is OFF.** Never spread a `Set` or `Map` (`[...set]` will not compile). Use arrays, or `Array.from()`.
- **Never renumber channels.** `EPGChannel.getChannelID()` is the global 1-based position assigned at load and must stay stable regardless of the active filter, or digit entry breaks.
- **Filtering must never interrupt playback.** Changing filters only moves focus.
- **CH+ / CH− (key codes 33 / 34) must zap channels from every screen**, including while the channel list, filter rail or EPG is open.
- **Categories are additive and must never block startup.** Any failure in the tag calls degrades the rail to `★ Favorites | All`.
- **Auto-untick threshold for tags is `channelCount >= 0.95 * totalChannelCount`.** This only affects which boxes start ticked; every tag stays selectable.
- **Colour button codes (403/404/405/406) stay bound as hidden aliases** so older remotes keep working.
- Run tests non-interactively: `CI=true npm test -- --testPathPattern='<pattern>'`

---

### Task 1: Test infrastructure and remote key constants

The repo has Jest 26 available through `react-scripts` but zero test files and no `@types/jest`, so a TypeScript test will not compile. This task makes tests possible and lands the key-code constants every later task depends on.

**Files:**
- Modify: `package.json` (devDependencies)
- Create: `src/utils/RemoteKeys.ts`
- Test: `src/utils/RemoteKeys.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `RemoteKeys` default export — a frozen object literal of `number` constants: `OK`, `BACK`, `ARROW_LEFT`, `ARROW_UP`, `ARROW_RIGHT`, `ARROW_DOWN`, `CHANNEL_UP`, `CHANNEL_DOWN`, `GUIDE`, `INFO`, `DIGIT_0`, `DIGIT_9`, `RED`, `GREEN`, `YELLOW`, `BLUE`, `KEY_B`, `KEY_C`, `KEY_G`, `KEY_R`, `KEY_Y`

- [ ] **Step 1: Add the Jest type package**

```bash
npm install --save-dev @types/jest@26.0.24
```

- [ ] **Step 2: Write the failing test**

Create `src/utils/RemoteKeys.test.ts`:

```ts
import RemoteKeys from './RemoteKeys';

describe('RemoteKeys', () => {
    it('maps the navigation keys to their webOS key codes', () => {
        expect(RemoteKeys.OK).toBe(13);
        expect(RemoteKeys.BACK).toBe(461);
        expect(RemoteKeys.ARROW_LEFT).toBe(37);
        expect(RemoteKeys.ARROW_UP).toBe(38);
        expect(RemoteKeys.ARROW_RIGHT).toBe(39);
        expect(RemoteKeys.ARROW_DOWN).toBe(40);
        expect(RemoteKeys.CHANNEL_UP).toBe(33);
        expect(RemoteKeys.CHANNEL_DOWN).toBe(34);
        expect(RemoteKeys.GUIDE).toBe(458);
    });

    it('assigns every key code to exactly one name', () => {
        const codes = Object.keys(RemoteKeys).map((name) => (RemoteKeys as { [k: string]: number })[name]);
        const unique: number[] = [];
        codes.forEach((code) => {
            if (unique.indexOf(code) < 0) {
                unique.push(code);
            }
        });
        expect(unique.length).toBe(codes.length);
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `CI=true npm test -- --testPathPattern='RemoteKeys'`
Expected: FAIL — `Cannot find module './RemoteKeys'`

- [ ] **Step 4: Write the implementation**

Create `src/utils/RemoteKeys.ts`:

```ts
/**
 * webOS remote control key codes.
 *
 * Modern LG Magic Remotes have no colour buttons, so navigation is built on
 * directions, OK, Back and Guide. The colour codes are retained as hidden
 * aliases so older remotes continue to work.
 *
 * GUIDE (458) and INFO (457) are the documented webOS values but have not yet
 * been confirmed on device. TV.tsx logs unhandled codes as "TV-keyPressed:",
 * so pressing Guide with ares-inspect attached reports the real value. If it
 * differs, correcting it here is the only change required.
 */
const RemoteKeys = {
    OK: 13,
    CHANNEL_UP: 33,
    CHANNEL_DOWN: 34,
    ARROW_LEFT: 37,
    ARROW_UP: 38,
    ARROW_RIGHT: 39,
    ARROW_DOWN: 40,
    DIGIT_0: 48,
    DIGIT_9: 57,
    GUIDE: 458,
    INFO: 457,
    BACK: 461,

    // legacy colour buttons - kept so older remotes keep working
    RED: 403,
    GREEN: 404,
    YELLOW: 405,
    BLUE: 406,

    // keyboard aliases used when running in a desktop browser
    KEY_B: 66,
    KEY_C: 67,
    KEY_G: 71,
    KEY_R: 82,
    KEY_Y: 89
};

export default RemoteKeys;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `CI=true npm test -- --testPathPattern='RemoteKeys'`
Expected: PASS, 2 tests

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/utils/RemoteKeys.ts src/utils/RemoteKeys.test.ts
git commit -m "feat: add remote key constants and jest type support"
```

---

### Task 2: FavoritesStore

**Files:**
- Create: `src/utils/FavoritesStore.ts`
- Test: `src/utils/FavoritesStore.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `FavoritesStore` default export with statics `all(): string[]`, `has(uuid: string): boolean`, `add(uuid: string): void`, `remove(uuid: string): void`, `toggle(uuid: string): boolean` (returns the new favorited state), `count(): number`

- [ ] **Step 1: Write the failing test**

Create `src/utils/FavoritesStore.test.ts`:

```ts
import FavoritesStore from './FavoritesStore';

describe('FavoritesStore', () => {
    beforeEach(() => localStorage.clear());

    it('starts empty', () => {
        expect(FavoritesStore.all()).toEqual([]);
        expect(FavoritesStore.count()).toBe(0);
        expect(FavoritesStore.has('a')).toBe(false);
    });

    it('adds a uuid once, even when added twice', () => {
        FavoritesStore.add('uuid-a');
        FavoritesStore.add('uuid-a');
        expect(FavoritesStore.all()).toEqual(['uuid-a']);
        expect(FavoritesStore.has('uuid-a')).toBe(true);
    });

    it('removes a uuid and ignores unknown ones', () => {
        FavoritesStore.add('uuid-a');
        FavoritesStore.remove('uuid-b');
        expect(FavoritesStore.all()).toEqual(['uuid-a']);
        FavoritesStore.remove('uuid-a');
        expect(FavoritesStore.all()).toEqual([]);
    });

    it('toggle returns the resulting state', () => {
        expect(FavoritesStore.toggle('uuid-a')).toBe(true);
        expect(FavoritesStore.has('uuid-a')).toBe(true);
        expect(FavoritesStore.toggle('uuid-a')).toBe(false);
        expect(FavoritesStore.has('uuid-a')).toBe(false);
    });

    it('survives a persistence round trip', () => {
        FavoritesStore.add('uuid-a');
        FavoritesStore.add('uuid-b');
        expect(FavoritesStore.all()).toEqual(['uuid-a', 'uuid-b']);
    });

    it('recovers from corrupted storage instead of throwing', () => {
        localStorage.setItem('favoriteChannels', 'not json');
        expect(FavoritesStore.all()).toEqual([]);
        FavoritesStore.add('uuid-a');
        expect(FavoritesStore.all()).toEqual(['uuid-a']);
    });

    it('ignores non-string entries in storage', () => {
        localStorage.setItem('favoriteChannels', JSON.stringify(['uuid-a', 42, null]));
        expect(FavoritesStore.all()).toEqual(['uuid-a']);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --testPathPattern='FavoritesStore'`
Expected: FAIL — `Cannot find module './FavoritesStore'`

- [ ] **Step 3: Write the implementation**

Create `src/utils/FavoritesStore.ts`:

```ts
const STORAGE_KEY_FAVORITES = 'favoriteChannels';

/**
 * Favorite channels, keyed by TVHeadend channel uuid so they survive
 * reordering of the lineup. Stored as a JSON array rather than a Set because
 * the build targets es5 without downlevelIteration.
 */
export default class FavoritesStore {
    private static read(): string[] {
        const raw = localStorage.getItem(STORAGE_KEY_FAVORITES);
        if (!raw) {
            return [];
        }
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed.filter((entry) => typeof entry === 'string');
        } catch (error) {
            console.log('Failed to parse favorites, starting empty:', error);
            return [];
        }
    }

    private static write(uuids: string[]): void {
        localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(uuids));
    }

    static all(): string[] {
        return FavoritesStore.read();
    }

    static count(): number {
        return FavoritesStore.read().length;
    }

    static has(uuid: string): boolean {
        return FavoritesStore.read().indexOf(uuid) >= 0;
    }

    static add(uuid: string): void {
        const uuids = FavoritesStore.read();
        if (uuids.indexOf(uuid) < 0) {
            uuids.push(uuid);
            FavoritesStore.write(uuids);
        }
    }

    static remove(uuid: string): void {
        const uuids = FavoritesStore.read();
        const index = uuids.indexOf(uuid);
        if (index >= 0) {
            uuids.splice(index, 1);
            FavoritesStore.write(uuids);
        }
    }

    /** Returns the new favorited state of the channel. */
    static toggle(uuid: string): boolean {
        if (FavoritesStore.has(uuid)) {
            FavoritesStore.remove(uuid);
            return false;
        }
        FavoritesStore.add(uuid);
        return true;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npm test -- --testPathPattern='FavoritesStore'`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/utils/FavoritesStore.ts src/utils/FavoritesStore.test.ts
git commit -m "feat: add FavoritesStore backed by localStorage"
```

---

### Task 3: ChannelFilter and ChannelTag models

**Files:**
- Create: `src/models/ChannelFilter.ts`
- Create: `src/models/ChannelTag.ts`
- Test: `src/models/ChannelFilter.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `ChannelFilter` — default-exported interface `{ kind: 'all' | 'favorites' | 'tag'; tagUuid?: string }`
  - Named exports `ALL_CHANNELS: ChannelFilter`, `FAVORITE_CHANNELS: ChannelFilter`, `tagFilter(tagUuid: string): ChannelFilter`, `isSameFilter(a: ChannelFilter, b: ChannelFilter): boolean`
  - `ChannelTag` — default-exported interface `{ uuid: string; name: string; index: number; channelCount: number }`

- [ ] **Step 1: Write the failing test**

Create `src/models/ChannelFilter.test.ts`:

```ts
import { ALL_CHANNELS, FAVORITE_CHANNELS, tagFilter, isSameFilter } from './ChannelFilter';

describe('ChannelFilter', () => {
    it('builds a tag filter carrying its uuid', () => {
        expect(tagFilter('tag-1')).toEqual({ kind: 'tag', tagUuid: 'tag-1' });
    });

    it('treats filters of the same kind and uuid as equal', () => {
        expect(isSameFilter(ALL_CHANNELS, { kind: 'all' })).toBe(true);
        expect(isSameFilter(tagFilter('tag-1'), tagFilter('tag-1'))).toBe(true);
    });

    it('distinguishes different kinds and different tags', () => {
        expect(isSameFilter(ALL_CHANNELS, FAVORITE_CHANNELS)).toBe(false);
        expect(isSameFilter(tagFilter('tag-1'), tagFilter('tag-2'))).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --testPathPattern='ChannelFilter'`
Expected: FAIL — `Cannot find module './ChannelFilter'`

- [ ] **Step 3: Write the implementations**

Create `src/models/ChannelFilter.ts`:

```ts
export type ChannelFilterKind = 'all' | 'favorites' | 'tag';

/** Which subset of the lineup is currently active. */
export default interface ChannelFilter {
    kind: ChannelFilterKind;
    /** Only set when kind is 'tag'. */
    tagUuid?: string;
}

export const ALL_CHANNELS: ChannelFilter = { kind: 'all' };

export const FAVORITE_CHANNELS: ChannelFilter = { kind: 'favorites' };

export const tagFilter = (tagUuid: string): ChannelFilter => ({ kind: 'tag', tagUuid: tagUuid });

export const isSameFilter = (a: ChannelFilter, b: ChannelFilter): boolean =>
    a.kind === b.kind && a.tagUuid === b.tagUuid;
```

Create `src/models/ChannelTag.ts`:

```ts
/** A TVHeadend channel tag, surfaced in the UI as a category. */
export default interface ChannelTag {
    uuid: string;
    name: string;
    /** TVHeadend's own ordering hint; all zero on many servers. */
    index: number;
    /** How many channels in the current lineup carry this tag. */
    channelCount: number;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npm test -- --testPathPattern='ChannelFilter'`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/models/ChannelFilter.ts src/models/ChannelTag.ts src/models/ChannelFilter.test.ts
git commit -m "feat: add ChannelFilter and ChannelTag models"
```

---

### Task 4: CategoryStore

**Files:**
- Create: `src/utils/CategoryStore.ts`
- Test: `src/utils/CategoryStore.test.ts`

**Interfaces:**
- Consumes: `ChannelFilter`, `ALL_CHANNELS`, `tagFilter` from Task 3
- Produces: `CategoryStore` default export with statics `isConfigured(): boolean`, `getSelectedTagUuids(): string[]`, `setSelectedTagUuids(uuids: string[]): void` (also marks configured), `getKnownTagUuids(): string[]`, `setKnownTagUuids(uuids: string[]): void`, `getActiveFilter(): ChannelFilter`, `setActiveFilter(filter: ChannelFilter): void`

- [ ] **Step 1: Write the failing test**

Create `src/utils/CategoryStore.test.ts`:

```ts
import CategoryStore from './CategoryStore';
import { ALL_CHANNELS, FAVORITE_CHANNELS, tagFilter } from '../models/ChannelFilter';

describe('CategoryStore', () => {
    beforeEach(() => localStorage.clear());

    it('is unconfigured until tags are saved', () => {
        expect(CategoryStore.isConfigured()).toBe(false);
        CategoryStore.setSelectedTagUuids(['tag-1']);
        expect(CategoryStore.isConfigured()).toBe(true);
    });

    it('is configured even when the user selects nothing', () => {
        CategoryStore.setSelectedTagUuids([]);
        expect(CategoryStore.isConfigured()).toBe(true);
        expect(CategoryStore.getSelectedTagUuids()).toEqual([]);
    });

    it('round trips selected tag uuids', () => {
        CategoryStore.setSelectedTagUuids(['tag-1', 'tag-2']);
        expect(CategoryStore.getSelectedTagUuids()).toEqual(['tag-1', 'tag-2']);
    });

    it('round trips known tag uuids for new-tag detection', () => {
        CategoryStore.setKnownTagUuids(['tag-1']);
        expect(CategoryStore.getKnownTagUuids()).toEqual(['tag-1']);
    });

    it('defaults the active filter to all channels', () => {
        expect(CategoryStore.getActiveFilter()).toEqual(ALL_CHANNELS);
    });

    it('round trips the active filter', () => {
        CategoryStore.setActiveFilter(FAVORITE_CHANNELS);
        expect(CategoryStore.getActiveFilter()).toEqual(FAVORITE_CHANNELS);
        CategoryStore.setActiveFilter(tagFilter('tag-9'));
        expect(CategoryStore.getActiveFilter()).toEqual({ kind: 'tag', tagUuid: 'tag-9' });
    });

    it('falls back to all channels when the stored filter is corrupt', () => {
        localStorage.setItem('activeChannelFilter', '{{{');
        expect(CategoryStore.getActiveFilter()).toEqual(ALL_CHANNELS);
    });

    it('falls back to all channels when the stored filter kind is unknown', () => {
        localStorage.setItem('activeChannelFilter', JSON.stringify({ kind: 'nonsense' }));
        expect(CategoryStore.getActiveFilter()).toEqual(ALL_CHANNELS);
    });

    it('falls back to all channels when a tag filter has no uuid', () => {
        localStorage.setItem('activeChannelFilter', JSON.stringify({ kind: 'tag' }));
        expect(CategoryStore.getActiveFilter()).toEqual(ALL_CHANNELS);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --testPathPattern='CategoryStore'`
Expected: FAIL — `Cannot find module './CategoryStore'`

- [ ] **Step 3: Write the implementation**

Create `src/utils/CategoryStore.ts`:

```ts
import ChannelFilter, { ALL_CHANNELS } from '../models/ChannelFilter';

const STORAGE_KEY_SELECTED_TAGS = 'categorySelectedTags';
const STORAGE_KEY_KNOWN_TAGS = 'categoryKnownTags';
const STORAGE_KEY_CONFIGURED = 'categoriesConfigured';
const STORAGE_KEY_ACTIVE_FILTER = 'activeChannelFilter';

const readStringArray = (key: string): string[] => {
    const raw = localStorage.getItem(key);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter((entry) => typeof entry === 'string');
    } catch (error) {
        console.log('Failed to parse', key, error);
        return [];
    }
};

/**
 * Which channel tags appear on the filter rail, whether the user has been
 * through the first run picker, and which filter is currently active.
 */
export default class CategoryStore {
    static isConfigured(): boolean {
        return localStorage.getItem(STORAGE_KEY_CONFIGURED) === 'true';
    }

    static getSelectedTagUuids(): string[] {
        return readStringArray(STORAGE_KEY_SELECTED_TAGS);
    }

    /** Saving a selection - even an empty one - counts as configuring. */
    static setSelectedTagUuids(uuids: string[]): void {
        localStorage.setItem(STORAGE_KEY_SELECTED_TAGS, JSON.stringify(uuids));
        localStorage.setItem(STORAGE_KEY_CONFIGURED, 'true');
    }

    /** Every tag uuid seen on the server so far, used to flag new arrivals. */
    static getKnownTagUuids(): string[] {
        return readStringArray(STORAGE_KEY_KNOWN_TAGS);
    }

    static setKnownTagUuids(uuids: string[]): void {
        localStorage.setItem(STORAGE_KEY_KNOWN_TAGS, JSON.stringify(uuids));
    }

    static getActiveFilter(): ChannelFilter {
        const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_FILTER);
        if (!raw) {
            return ALL_CHANNELS;
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.kind === 'favorites') {
                return { kind: 'favorites' };
            }
            if (parsed && parsed.kind === 'tag' && typeof parsed.tagUuid === 'string') {
                return { kind: 'tag', tagUuid: parsed.tagUuid };
            }
            return ALL_CHANNELS;
        } catch (error) {
            console.log('Failed to parse active filter, using all channels:', error);
            return ALL_CHANNELS;
        }
    }

    static setActiveFilter(filter: ChannelFilter): void {
        localStorage.setItem(STORAGE_KEY_ACTIVE_FILTER, JSON.stringify(filter));
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npm test -- --testPathPattern='CategoryStore'`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/utils/CategoryStore.ts src/utils/CategoryStore.test.ts
git commit -m "feat: add CategoryStore for rail tags and active filter"
```

---

### Task 5: EPGChannel tag uuids and EPGData filtering

This is the core of the feature. `EPGData` gains a full lineup plus a filtered view; every existing caller of `getChannels()`, `getChannel()` and `getChannelCount()` transparently sees the filtered list.

**Files:**
- Modify: `src/models/EPGChannel.ts`
- Modify: `src/models/EPGData.ts`
- Test: `src/models/EPGData.test.ts`

**Interfaces:**
- Consumes: `ChannelFilter`, `ALL_CHANNELS`, `FAVORITE_CHANNELS`, `tagFilter` from Task 3
- Produces:
  - `EPGChannel` gains `getTagUuids(): string[]` and `setTagUuids(tagUuids: string[]): void`
  - `EPGData` gains `setFilter(filter: ChannelFilter): void`, `getFilter(): ChannelFilter`, `setFavoriteUuids(uuids: string[]): void`, `getAllChannels(): EPGChannel[]`, `isFilterEmpty(): boolean`, `getChannelPositionByUuid(uuid: string): number`
  - `getChannels()`, `getChannel()`, `getChannelCount()` keep their signatures and now return the filtered view

**Empty-filter behaviour:** when a filter matches nothing (Favorites with nothing starred), the filtered view falls back to the **full lineup** and `isFilterEmpty()` returns `true`. This keeps one index space for the whole app so CH+/CH− can never become a dead key, and the UI shows an explanatory banner over the list.

- [ ] **Step 1: Write the failing test**

Create `src/models/EPGData.test.ts`:

```ts
import EPGData from './EPGData';
import EPGChannel from './EPGChannel';
import { ALL_CHANNELS, FAVORITE_CHANNELS, tagFilter } from './ChannelFilter';

const channel = (id: number, uuid: string, tagUuids: string[]): EPGChannel => {
    const result = new EPGChannel(undefined, 'Channel ' + id, id, uuid, new URL('http://tvh/' + id));
    result.setTagUuids(tagUuids);
    return result;
};

const buildData = (): EPGData => {
    const data = new EPGData();
    data.updateChannels([
        channel(1, 'uuid-a', ['tag-movies']),
        channel(2, 'uuid-b', ['tag-news']),
        channel(3, 'uuid-c', ['tag-movies']),
        channel(4, 'uuid-d', [])
    ]);
    return data;
};

describe('EPGData filtering', () => {
    it('returns every channel with the default filter', () => {
        const data = buildData();
        expect(data.getChannelCount()).toBe(4);
        expect(data.getFilter()).toEqual(ALL_CHANNELS);
        expect(data.isFilterEmpty()).toBe(false);
    });

    it('filters by tag uuid', () => {
        const data = buildData();
        data.setFilter(tagFilter('tag-movies'));
        expect(data.getChannelCount()).toBe(2);
        expect(data.getChannel(0)?.getUUID()).toBe('uuid-a');
        expect(data.getChannel(1)?.getUUID()).toBe('uuid-c');
    });

    it('filters by favorites', () => {
        const data = buildData();
        data.setFavoriteUuids(['uuid-b', 'uuid-d']);
        data.setFilter(FAVORITE_CHANNELS);
        expect(data.getChannelCount()).toBe(2);
        expect(data.getChannel(0)?.getUUID()).toBe('uuid-b');
    });

    it('keeps the full lineup reachable while filtered', () => {
        const data = buildData();
        data.setFilter(tagFilter('tag-news'));
        expect(data.getChannelCount()).toBe(1);
        expect(data.getAllChannels().length).toBe(4);
    });

    it('keeps global channel numbers stable while filtered', () => {
        const data = buildData();
        data.setFilter(tagFilter('tag-movies'));
        expect(data.getChannel(1)?.getChannelID()).toBe(3);
    });

    it('falls back to the whole lineup when the filter matches nothing', () => {
        const data = buildData();
        data.setFilter(FAVORITE_CHANNELS);
        expect(data.isFilterEmpty()).toBe(true);
        expect(data.getChannelCount()).toBe(4);
    });

    it('falls back when a tag no longer matches any channel', () => {
        const data = buildData();
        data.setFilter(tagFilter('tag-gone'));
        expect(data.isFilterEmpty()).toBe(true);
        expect(data.getChannelCount()).toBe(4);
    });

    it('reapplies the filter when favorites change', () => {
        const data = buildData();
        data.setFilter(FAVORITE_CHANNELS);
        expect(data.isFilterEmpty()).toBe(true);
        data.setFavoriteUuids(['uuid-c']);
        expect(data.isFilterEmpty()).toBe(false);
        expect(data.getChannelCount()).toBe(1);
        expect(data.getChannel(0)?.getUUID()).toBe('uuid-c');
    });

    it('reapplies the filter when channels are replaced', () => {
        const data = buildData();
        data.setFilter(tagFilter('tag-movies'));
        data.updateChannels([channel(1, 'uuid-a', ['tag-movies'])]);
        expect(data.getChannelCount()).toBe(1);
    });

    it('finds a channel position by uuid within the filtered view', () => {
        const data = buildData();
        data.setFilter(tagFilter('tag-movies'));
        expect(data.getChannelPositionByUuid('uuid-c')).toBe(1);
        expect(data.getChannelPositionByUuid('uuid-b')).toBe(-1);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --testPathPattern='EPGData'`
Expected: FAIL — `result.setTagUuids is not a function`

- [ ] **Step 3: Add tag support to EPGChannel**

In `src/models/EPGChannel.ts`, add a field beside `events` and two accessors before the closing brace:

```ts
export default class EPGChannel {
    private events: EPGEvent[];
    private tagUuids: string[] = [];
```

```ts
    getTagUuids() {
        return this.tagUuids;
    }

    setTagUuids(tagUuids: string[]) {
        this.tagUuids = tagUuids;
    }
```

- [ ] **Step 4: Add filtering to EPGData**

In `src/models/EPGData.ts`, add the import at the top:

```ts
import ChannelFilter, { ALL_CHANNELS } from './ChannelFilter';
```

Replace the field declarations at the top of the class:

```ts
export default class EPGData {
    /** The complete lineup, never filtered. */
    private allChannels: EPGChannel[] = [];
    /** The active view - what every consumer sees through getChannels(). */
    private channels: EPGChannel[] = [];
    private recordings: EPGEvent[] = [];
    private filter: ChannelFilter = ALL_CHANNELS;
    private favoriteUuids: string[] = [];
    private filterEmpty = false;
```

Replace `updateChannels` with the following, and add the new methods next to it:

```ts
    updateChannels(channels: EPGChannel[]): void {
        this.allChannels = channels;
        this.applyFilter();
    }

    getAllChannels(): EPGChannel[] {
        return this.allChannels;
    }

    getFilter(): ChannelFilter {
        return this.filter;
    }

    setFilter(filter: ChannelFilter): void {
        this.filter = filter;
        this.applyFilter();
    }

    setFavoriteUuids(uuids: string[]): void {
        this.favoriteUuids = uuids;
        this.applyFilter();
    }

    /** True when the active filter matched nothing and we fell back to the full lineup. */
    isFilterEmpty(): boolean {
        return this.filterEmpty;
    }

    getChannelPositionByUuid(uuid: string): number {
        return this.channels.findIndex((channel) => channel.getUUID() === uuid);
    }

    private matchesFilter(channel: EPGChannel): boolean {
        switch (this.filter.kind) {
            case 'favorites':
                return this.favoriteUuids.indexOf(channel.getUUID()) >= 0;
            case 'tag':
                return !!this.filter.tagUuid && channel.getTagUuids().indexOf(this.filter.tagUuid) >= 0;
            default:
                return true;
        }
    }

    /**
     * Recompute the active view. When a filter matches nothing we fall back to
     * the full lineup so channel zapping never dead-ends, and flag it so the UI
     * can explain what happened.
     */
    private applyFilter(): void {
        if (this.filter.kind === 'all') {
            this.filterEmpty = false;
            this.channels = this.allChannels;
            return;
        }

        const filtered = this.allChannels.filter((channel) => this.matchesFilter(channel));
        this.filterEmpty = filtered.length === 0;
        this.channels = this.filterEmpty ? this.allChannels : filtered;
    }
```

Also update `updateStreamUrl` to walk the full lineup rather than the filtered view, so stream urls are refreshed for channels hidden by the active filter. Replace `this.channels` with `this.allChannels` in both places inside that method, and call `this.applyFilter()` before it returns:

```ts
    updateStreamUrl(channels: EPGChannel[]): void {
        for (let i = 0; i < channels.length; i++) {
            for (let k = 0; k < this.allChannels.length; k++) {
                if (channels[i].getUUID() == this.allChannels[k].getUUID()) {
                    this.allChannels[k].setStreamUrl(channels[i].getStreamUrl());
                    break;
                }
            }
        }
        this.applyFilter();
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `CI=true npm test -- --testPathPattern='EPGData'`
Expected: PASS, 10 tests

- [ ] **Step 6: Verify the app still type checks**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/models/EPGChannel.ts src/models/EPGData.ts src/models/EPGData.test.ts
git commit -m "feat: make EPGData the single channel filtering authority"
```

---

### Task 6: Persist the last channel by uuid

`StorageHelper` currently stores the last channel as an **index**. Once a filter can change the list, a stored index points at a different channel on the next launch.

**Files:**
- Modify: `src/utils/StorageHelper.ts`
- Modify: `src/AppContext.tsx:46`
- Modify: `src/components/TV.tsx:329`
- Modify: `src/App.tsx` (inside `reloadData`)
- Test: `src/utils/StorageHelper.test.ts`

**Interfaces:**
- Consumes: `EPGChannel` from Task 5
- Produces: `StorageHelper.setLastChannelUuid(uuid: string): void` and `StorageHelper.resolveInitialChannelPosition(channels: EPGChannel[]): number`. `getLastChannelIndex` and `setLastChannelIndex` are removed.

- [ ] **Step 1: Write the failing test**

Create `src/utils/StorageHelper.test.ts`:

```ts
import StorageHelper from './StorageHelper';
import EPGChannel from '../models/EPGChannel';

const channels = (): EPGChannel[] => [
    new EPGChannel(undefined, 'One', 1, 'uuid-a', new URL('http://tvh/1')),
    new EPGChannel(undefined, 'Two', 2, 'uuid-b', new URL('http://tvh/2')),
    new EPGChannel(undefined, 'Three', 3, 'uuid-c', new URL('http://tvh/3'))
];

describe('StorageHelper.resolveInitialChannelPosition', () => {
    beforeEach(() => localStorage.clear());

    it('returns 0 when nothing is stored', () => {
        expect(StorageHelper.resolveInitialChannelPosition(channels())).toBe(0);
    });

    it('resolves a stored uuid to its position', () => {
        StorageHelper.setLastChannelUuid('uuid-c');
        expect(StorageHelper.resolveInitialChannelPosition(channels())).toBe(2);
    });

    it('returns 0 when the stored uuid is no longer in the lineup', () => {
        StorageHelper.setLastChannelUuid('uuid-gone');
        expect(StorageHelper.resolveInitialChannelPosition(channels())).toBe(0);
    });

    it('migrates a legacy index to a uuid and clears the old key', () => {
        localStorage.setItem('lastChannel', '1');
        expect(StorageHelper.resolveInitialChannelPosition(channels())).toBe(1);
        expect(localStorage.getItem('lastChannel')).toBeNull();
        expect(StorageHelper.resolveInitialChannelPosition(channels())).toBe(1);
    });

    it('ignores a legacy index that is out of range', () => {
        localStorage.setItem('lastChannel', '99');
        expect(StorageHelper.resolveInitialChannelPosition(channels())).toBe(0);
        expect(localStorage.getItem('lastChannel')).toBeNull();
    });

    it('returns 0 for an empty lineup', () => {
        StorageHelper.setLastChannelUuid('uuid-a');
        expect(StorageHelper.resolveInitialChannelPosition([])).toBe(0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --testPathPattern='StorageHelper'`
Expected: FAIL — `StorageHelper.setLastChannelUuid is not a function`

- [ ] **Step 3: Rewrite the channel persistence in StorageHelper**

In `src/utils/StorageHelper.ts`, add the import and replace the two `LastChannelIndex` methods:

```ts
import EPGChannel from '../models/EPGChannel';
```

```ts
const STORAGE_KEY_LAST_CHANNEL_UUID = 'lastChannelUuid';
const STORAGE_KEY_LAST_CHANNEL_LEGACY = 'lastChannel';
```

```ts
    static setLastChannelUuid = (uuid: string) => {
        localStorage.setItem(STORAGE_KEY_LAST_CHANNEL_UUID, uuid);
    };

    /**
     * Resolve the channel to start on. Prefers the stored uuid; falls back once
     * to the legacy stored index, migrating it to a uuid so a later filter
     * change cannot make it point at a different channel.
     */
    static resolveInitialChannelPosition = (channels: EPGChannel[]): number => {
        if (channels.length === 0) {
            return 0;
        }

        const uuid = localStorage.getItem(STORAGE_KEY_LAST_CHANNEL_UUID);
        if (uuid) {
            const position = channels.findIndex((channel) => channel.getUUID() === uuid);
            return position >= 0 ? position : 0;
        }

        const legacyIndex = localStorage.getItem(STORAGE_KEY_LAST_CHANNEL_LEGACY);
        localStorage.removeItem(STORAGE_KEY_LAST_CHANNEL_LEGACY);
        if (legacyIndex) {
            const position = parseInt(legacyIndex);
            if (!isNaN(position) && position >= 0 && position < channels.length) {
                StorageHelper.setLastChannelUuid(channels[position].getUUID());
                return position;
            }
        }

        return 0;
    };
```

Delete `getLastChannelIndex` and `setLastChannelIndex` along with the old `STORAGE_KEY_LAST_CHANNEL` constant.

- [ ] **Step 4: Update the three call sites**

`src/AppContext.tsx:46` — start at 0 and let `App` resolve the real position once channels exist:

```ts
    const [currentChannelPosition, setCurrentChannelPosition] = useState(0);
```

`src/components/TV.tsx:329` — store the uuid of the channel actually playing:

```ts
                StorageHelper.setLastChannelUuid(currentChannel.getUUID());
```

`src/App.tsx` — in `reloadData`, resolve the position **before** `setIsChannelsRetrieved(true)`, because `<TV />` only mounts once that flag is set and reads the position on mount. Replace the block at lines 106-109:

```ts
            setDebugInfo('Updating channels (' + channels.length + ')...');
            epgData.updateChannels(channels);
            setCurrentChannelPosition(StorageHelper.resolveInitialChannelPosition(epgData.getChannels()));
            setDebugInfo('Channels retrieved true...');
            setIsChannelsRetrieved(true);
```

Add `setCurrentChannelPosition` to the `useContext(AppContext)` destructuring at the top of `App.tsx`.

- [ ] **Step 5: Run test to verify it passes**

Run: `CI=true npm test -- --testPathPattern='StorageHelper'`
Expected: PASS, 6 tests

- [ ] **Step 6: Verify the whole project type checks**

Run: `npx tsc --noEmit`
Expected: no errors. If `Player.tsx:162` still references `setLastChannelIndex`, note it is inside a comment and needs no change.

- [ ] **Step 7: Commit**

```bash
git add src/utils/StorageHelper.ts src/utils/StorageHelper.test.ts src/AppContext.tsx src/components/TV.tsx src/App.tsx
git commit -m "fix: persist last channel by uuid so filters cannot corrupt it"
```

---

### Task 7: Fetch and join channel tags

**Files:**
- Create: `src/utils/ChannelTagJoin.ts`
- Test: `src/utils/ChannelTagJoin.test.ts`
- Modify: `src/services/TVHDataService.ts`
- Modify: `src/mock/MockHttpProxyServiceAdapter.ts:35`

**Interfaces:**
- Consumes: `EPGChannel` (Task 5), `ChannelTag` (Task 3)
- Produces:
  - `applyChannelTags(channels: EPGChannel[], tagEntries: TVHChannelTagEntry[], channelEntries: TVHChannelEntry[]): ChannelTag[]` — sets `tagUuids` on each channel and returns non-empty tags sorted by index then name
  - Exported interfaces `TVHChannelTagEntry { uuid: string; name: string; index?: number }` and `TVHChannelEntry { uuid: string; tags?: string[] }`
  - `TVHDataService.retrieveChannelTags(): Promise<ChannelTag[]>` — resolves to `[]` on any failure

- [ ] **Step 1: Write the failing test**

Create `src/utils/ChannelTagJoin.test.ts`:

```ts
import { applyChannelTags } from './ChannelTagJoin';
import EPGChannel from '../models/EPGChannel';

const channels = (): EPGChannel[] => [
    new EPGChannel(undefined, 'One', 1, 'uuid-a', new URL('http://tvh/1')),
    new EPGChannel(undefined, 'Two', 2, 'uuid-b', new URL('http://tvh/2')),
    new EPGChannel(undefined, 'Three', 3, 'uuid-c', new URL('http://tvh/3'))
];

const tagEntries = [
    { uuid: 'tag-news', name: 'News', index: 0 },
    { uuid: 'tag-movies', name: 'Movies', index: 0 },
    { uuid: 'tag-unused', name: 'Shopping', index: 0 }
];

describe('applyChannelTags', () => {
    it('assigns tag uuids to the matching channels', () => {
        const list = channels();
        applyChannelTags(list, tagEntries, [
            { uuid: 'uuid-a', tags: ['tag-movies'] },
            { uuid: 'uuid-b', tags: ['tag-news', 'tag-movies'] }
        ]);
        expect(list[0].getTagUuids()).toEqual(['tag-movies']);
        expect(list[1].getTagUuids()).toEqual(['tag-news', 'tag-movies']);
    });

    it('leaves channels missing from the tag map untagged', () => {
        const list = channels();
        applyChannelTags(list, tagEntries, [{ uuid: 'uuid-a', tags: ['tag-movies'] }]);
        expect(list[2].getTagUuids()).toEqual([]);
    });

    it('counts channels per tag and drops empty tags', () => {
        const result = applyChannelTags(channels(), tagEntries, [
            { uuid: 'uuid-a', tags: ['tag-movies'] },
            { uuid: 'uuid-b', tags: ['tag-news', 'tag-movies'] }
        ]);
        expect(result.map((tag) => tag.name)).toEqual(['Movies', 'News']);
        expect(result[0].channelCount).toBe(2);
        expect(result[1].channelCount).toBe(1);
    });

    it('sorts by index first and name second', () => {
        const result = applyChannelTags(
            channels(),
            [
                { uuid: 'tag-z', name: 'Zebra', index: 1 },
                { uuid: 'tag-b', name: 'Beta', index: 5 },
                { uuid: 'tag-a', name: 'Alpha', index: 1 }
            ],
            [{ uuid: 'uuid-a', tags: ['tag-z', 'tag-b', 'tag-a'] }]
        );
        expect(result.map((tag) => tag.name)).toEqual(['Alpha', 'Zebra', 'Beta']);
    });

    it('treats a missing tags array as untagged', () => {
        const list = channels();
        const result = applyChannelTags(list, tagEntries, [{ uuid: 'uuid-a' }]);
        expect(list[0].getTagUuids()).toEqual([]);
        expect(result).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --testPathPattern='ChannelTagJoin'`
Expected: FAIL — `Cannot find module './ChannelTagJoin'`

- [ ] **Step 3: Write the join module**

Create `src/utils/ChannelTagJoin.ts`:

```ts
import EPGChannel from '../models/EPGChannel';
import ChannelTag from '../models/ChannelTag';

/** An entry from TVHeadend's api/channeltag/grid. */
export interface TVHChannelTagEntry {
    uuid: string;
    name: string;
    index?: number;
}

/** An entry from TVHeadend's api/channel/grid. */
export interface TVHChannelEntry {
    uuid: string;
    tags?: string[];
}

/**
 * Join TVHeadend tag data onto channels loaded from the M3U playlist. The join
 * key is the channel uuid, which the playlist carries as tvg-id. Channels the
 * join misses are simply left untagged and appear under "All" only.
 *
 * Mutates the channels, and returns the tags that actually have channels,
 * ordered by TVHeadend's index then alphabetically.
 */
export const applyChannelTags = (
    channels: EPGChannel[],
    tagEntries: TVHChannelTagEntry[],
    channelEntries: TVHChannelEntry[]
): ChannelTag[] => {
    const tagsByChannelUuid: { [uuid: string]: string[] } = {};
    channelEntries.forEach((entry) => {
        tagsByChannelUuid[entry.uuid] = entry.tags || [];
    });

    const counts: { [tagUuid: string]: number } = {};
    channels.forEach((channel) => {
        const tagUuids = tagsByChannelUuid[channel.getUUID()] || [];
        channel.setTagUuids(tagUuids);
        tagUuids.forEach((tagUuid) => {
            counts[tagUuid] = (counts[tagUuid] || 0) + 1;
        });
    });

    return tagEntries
        .map((entry) => ({
            uuid: entry.uuid,
            name: entry.name,
            index: entry.index || 0,
            channelCount: counts[entry.uuid] || 0
        }))
        .filter((tag) => tag.channelCount > 0)
        .sort((a, b) => (a.index !== b.index ? a.index - b.index : a.name.localeCompare(b.name)));
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npm test -- --testPathPattern='ChannelTagJoin'`
Expected: PASS, 5 tests

- [ ] **Step 5: Add the service method**

In `src/services/TVHDataService.ts`, add imports:

```ts
import ChannelTag from '../models/ChannelTag';
import { applyChannelTags, TVHChannelTagEntry, TVHChannelEntry } from '../utils/ChannelTagJoin';
```

Add two API constants beside the existing ones (after `static M3U_PLAYLIST`):

```ts
    static API_CHANNEL_TAGS = 'api/channeltag/grid?limit=999';
    static API_CHANNELS = 'api/channel/grid?limit=9999';
```

Add a response interface beside the other `TVH*` interfaces:

```ts
interface TVHGrid<T> {
    entries: T[];
    total: number;
}
```

Add the method after `retrieveM3UChannels`:

```ts
    /**
     * Retrieve channel tags and attach them to the already loaded channels.
     * Categories are additive - any failure resolves to an empty list so the
     * rail degrades to "Favorites / All" rather than blocking startup.
     */
    async retrieveChannelTags(): Promise<ChannelTag[]> {
        try {
            const tagResponse = await this.httpProxyServiceAdapter.call<TVHGrid<TVHChannelTagEntry>>({
                url: this.url + TVHDataService.API_CHANNEL_TAGS,
                user: this.user,
                password: this.password
            });
            const channelResponse = await this.httpProxyServiceAdapter.call<TVHGrid<TVHChannelEntry>>({
                url: this.url + TVHDataService.API_CHANNELS,
                user: this.user,
                password: this.password
            });

            const tags = applyChannelTags(this.channels, tagResponse.entries, channelResponse.entries);
            console.log('processed %d channel tags', tags.length);
            return tags;
        } catch (error) {
            console.log('Failed to retrieve channel tags: ', JSON.stringify(error));
            return [];
        }
    }
```

- [ ] **Step 6: Widen the mock adapter route**

In `src/mock/MockHttpProxyServiceAdapter.ts:35`, the tag route only matches the old `list` endpoint. Change it so both spellings resolve:

```ts
        } else if (url.includes('api/channeltag/')) {
```

- [ ] **Step 7: Verify type checking**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/utils/ChannelTagJoin.ts src/utils/ChannelTagJoin.test.ts src/services/TVHDataService.ts src/mock/MockHttpProxyServiceAdapter.ts
git commit -m "feat: fetch TVHeadend channel tags and join them onto channels"
```

---

### Task 8: Load tags and filter state at startup

**Files:**
- Modify: `src/AppContext.tsx`
- Modify: `src/App.tsx` (inside `reloadData`)

**Interfaces:**
- Consumes: `ChannelTag` (Task 3), `CategoryStore` (Task 4), `FavoritesStore` (Task 2), `EPGData` filtering (Task 5), `retrieveChannelTags` (Task 7)
- Produces: `AppContext` gains `channelTags: ChannelTag[]`, `setChannelTags(value: ChannelTag[]): void`, `activeFilter: ChannelFilter`, `setActiveFilter(value: ChannelFilter): void`, `favoritesVersion: number`, `bumpFavoritesVersion(): void`

`favoritesVersion` is a counter incremented whenever favorites change. Components read it to know they must redraw; it exists because favorites live in localStorage rather than React state.

- [ ] **Step 1: Extend AppContext**

In `src/AppContext.tsx`, add imports:

```ts
import ChannelTag from './models/ChannelTag';
import ChannelFilter from './models/ChannelFilter';
import CategoryStore from './utils/CategoryStore';
```

Add to the `AppContext` type:

```ts
    channelTags: ChannelTag[];
    setChannelTags: (value: ChannelTag[]) => void;
    activeFilter: ChannelFilter;
    setActiveFilter: (value: ChannelFilter) => void;
    favoritesVersion: number;
    bumpFavoritesVersion: () => void;
```

Add the state hooks inside `AppContextProvider`:

```ts
    const [channelTags, setChannelTags] = useState<ChannelTag[]>([]);
    const [activeFilter, setActiveFilterState] = useState<ChannelFilter>(CategoryStore.getActiveFilter());
    const [favoritesVersion, setFavoritesVersion] = useState(0);
```

Add to the `appContext` object literal:

```ts
        channelTags: channelTags,
        setChannelTags: (value: ChannelTag[]) => setChannelTags(value),
        activeFilter: activeFilter,
        setActiveFilter: (value: ChannelFilter) => {
            CategoryStore.setActiveFilter(value);
            epgData.setFilter(value);
            setActiveFilterState(value);
        },
        favoritesVersion: favoritesVersion,
        bumpFavoritesVersion: () => {
            epgData.setFavoriteUuids(FavoritesStore.all());
            setFavoritesVersion((version) => version + 1);
        },
```

Add the `FavoritesStore` import alongside the others:

```ts
import FavoritesStore from './utils/FavoritesStore';
```

- [ ] **Step 2: Seed the filter and tags during load**

In `src/App.tsx`, add imports:

```ts
import FavoritesStore from './utils/FavoritesStore';
import CategoryStore from './utils/CategoryStore';
```

Add `setChannelTags` to the `useContext(AppContext)` destructuring.

In `reloadData`, replace the channel block so favorites and the stored filter are applied *before* the initial position is resolved, and tags load in the background without blocking the UI:

```ts
            setDebugInfo('Updating channels (' + channels.length + ')...');
            epgData.updateChannels(channels);
            // restore favorites and the persisted filter before resolving position
            epgData.setFavoriteUuids(FavoritesStore.all());
            epgData.setFilter(CategoryStore.getActiveFilter());
            setCurrentChannelPosition(StorageHelper.resolveInitialChannelPosition(epgData.getChannels()));
            setDebugInfo('Channels retrieved true...');
            setIsChannelsRetrieved(true);

            // categories are additive - never block startup on them
            tvhDataService
                .retrieveChannelTags()
                .then((tags) => {
                    setChannelTags(tags);
                    // re-apply the filter now that channels carry their tags
                    epgData.setFilter(CategoryStore.getActiveFilter());
                })
                .catch((error) => console.log('Failed to load channel tags:', error));
```

- [ ] **Step 3: Verify type checking**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Verify the app still boots against mock data**

Temporarily switch `src/config/Config.ts` to the mock adapters (comment the prod block, uncomment the mock block), then run `npm start`. Confirm in the browser console that `processed N channel tags` is logged and the channel list still renders. Revert `Config.ts` before committing.

- [ ] **Step 5: Commit**

```bash
git add src/AppContext.tsx src/App.tsx
git commit -m "feat: load channel tags, favorites and persisted filter at startup"
```

---

### Task 9: FilterRail component

A DOM overlay above the canvas channel list, following the pattern `ChannelListDetails` already uses.

**Files:**
- Create: `src/components/FilterRail.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `ChannelTag` (Task 3), `ChannelFilter`, `ALL_CHANNELS`, `FAVORITE_CHANNELS`, `tagFilter`, `isSameFilter` (Task 3)
- Produces: default-exported `FilterRail` component taking props `{ entries: RailEntry[]; activeFilter: ChannelFilter; focusedIndex: number; isFocused: boolean }`, plus the named export `buildRailFilters(tags: ChannelTag[], selectedTagUuids: string[]): RailEntry[]` and interface `RailEntry { label: string; filter: ChannelFilter }`

`buildRailFilters` is where the rail's contents are decided, kept separate from rendering so it can be unit tested.

- [ ] **Step 1: Write the failing test**

Create `src/components/FilterRail.test.ts`:

```ts
import { buildRailFilters } from './FilterRail';
import ChannelTag from '../models/ChannelTag';

const tags: ChannelTag[] = [
    { uuid: 'tag-movies', name: 'Movies', index: 0, channelCount: 49 },
    { uuid: 'tag-news', name: 'News', index: 0, channelCount: 417 },
    { uuid: 'tag-sdtv', name: 'SDTV', index: 0, channelCount: 1049 }
];

describe('buildRailFilters', () => {
    it('always starts with favorites and all', () => {
        const entries = buildRailFilters([], []);
        expect(entries.map((entry) => entry.label)).toEqual(['★ Favorites', 'All']);
    });

    it('appends only the selected tags, in tag order', () => {
        const entries = buildRailFilters(tags, ['tag-news', 'tag-movies']);
        expect(entries.map((entry) => entry.label)).toEqual(['★ Favorites', 'All', 'Movies', 'News']);
    });

    it('ignores selected uuids that no longer exist on the server', () => {
        const entries = buildRailFilters(tags, ['tag-gone', 'tag-news']);
        expect(entries.map((entry) => entry.label)).toEqual(['★ Favorites', 'All', 'News']);
    });

    it('carries the right filter on each entry', () => {
        const entries = buildRailFilters(tags, ['tag-news']);
        expect(entries[0].filter).toEqual({ kind: 'favorites' });
        expect(entries[1].filter).toEqual({ kind: 'all' });
        expect(entries[2].filter).toEqual({ kind: 'tag', tagUuid: 'tag-news' });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --testPathPattern='FilterRail'`
Expected: FAIL — `Cannot find module './FilterRail'`

- [ ] **Step 3: Write the component**

Create `src/components/FilterRail.tsx`:

```tsx
import React from 'react';
import ChannelTag from '../models/ChannelTag';
import ChannelFilter, { ALL_CHANNELS, FAVORITE_CHANNELS, tagFilter, isSameFilter } from '../models/ChannelFilter';

export interface RailEntry {
    label: string;
    filter: ChannelFilter;
}

/**
 * The rail always offers Favorites and All, then the tags the user selected in
 * the category picker, in the order the server reported them. Selected uuids
 * that no longer exist on the server are dropped silently.
 */
export const buildRailFilters = (tags: ChannelTag[], selectedTagUuids: string[]): RailEntry[] => {
    const entries: RailEntry[] = [
        { label: '★ Favorites', filter: FAVORITE_CHANNELS },
        { label: 'All', filter: ALL_CHANNELS }
    ];

    tags.forEach((tag) => {
        if (selectedTagUuids.indexOf(tag.uuid) >= 0) {
            entries.push({ label: tag.name, filter: tagFilter(tag.uuid) });
        }
    });

    return entries;
};

const FilterRail = (props: {
    entries: RailEntry[];
    activeFilter: ChannelFilter;
    focusedIndex: number;
    isFocused: boolean;
}) => (
    <div className={props.isFocused ? 'filterRail focused' : 'filterRail'}>
        {props.entries.map((entry, index) => {
            const classNames = ['filterPill'];
            if (isSameFilter(entry.filter, props.activeFilter)) {
                classNames.push('active');
            }
            if (props.isFocused && index === props.focusedIndex) {
                classNames.push('focused');
            }
            return (
                <div className={classNames.join(' ')} key={index}>
                    {entry.label}
                </div>
            );
        })}
    </div>
);

export default FilterRail;
```

- [ ] **Step 4: Add the styles**

Append to `src/styles/app.css`:

```css
.filterRail {
    position: absolute;
    top: 0;
    left: 0;
    width: 900px;
    box-sizing: border-box;
    padding: 18px 24px;
    display: flex;
    align-items: center;
    background-color: rgba(5, 8, 12, 0.93);
    z-index: 9;
}

.filterPill {
    font-size: 26px;
    color: rgba(233, 238, 244, 0.7);
    background-color: rgba(255, 255, 255, 0.07);
    border: 2px solid transparent;
    border-radius: 8px;
    padding: 8px 18px;
    margin-right: 10px;
    white-space: nowrap;
}

.filterPill.active {
    color: #0a0e13;
    background-color: #ffffff;
    font-weight: 700;
}

.filterPill.focused {
    border-color: #ffcc4d;
    color: #ffffff;
}

.filterPill.active.focused {
    color: #0a0e13;
}

.channelListEmptyBanner {
    position: absolute;
    top: 96px;
    left: 0;
    width: 900px;
    box-sizing: border-box;
    padding: 16px 24px;
    font-size: 24px;
    color: #ffcc4d;
    background-color: rgba(5, 8, 12, 0.93);
    z-index: 9;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `CI=true npm test -- --testPathPattern='FilterRail'`
Expected: PASS, 4 tests

- [ ] **Step 6: Commit**

```bash
git add src/components/FilterRail.tsx src/components/FilterRail.test.ts src/styles/app.css
git commit -m "feat: add filter rail component"
```

---

### Task 10: Wire the rail into the channel list

**Files:**
- Modify: `src/components/ChannelList.tsx`

**Interfaces:**
- Consumes: `FilterRail`, `buildRailFilters`, `RailEntry` (Task 9); `CategoryStore` (Task 4); `AppContext` additions (Task 8); `RemoteKeys` (Task 1)
- Produces: no new exports

**Behaviour:** ↑ at the top row moves focus into the rail. While the rail has focus, ←/→ move between pills, ↓ or OK applies the focused filter and returns focus to the list, Back returns to the list without applying. The canvas is offset downward so the rail does not cover the first row.

- [ ] **Step 1: Add rail state and imports**

In `src/components/ChannelList.tsx`, add imports:

```ts
import FilterRail, { buildRailFilters, RailEntry } from './FilterRail';
import CategoryStore from '../utils/CategoryStore';
import RemoteKeys from '../utils/RemoteKeys';
import { isSameFilter } from '../models/ChannelFilter';
```

Extend the `State` enum:

```ts
enum State {
    NORMAL = 'normal',
    DETAILS = 'details',
    RAIL = 'rail'
}
```

Add a layout constant beside the other `mChannelLayout*` constants:

```ts
    const mFilterRailHeight = 86;
```

Extend the context destructuring to pull in the new values:

```ts
    const {
        epgData,
        imageCache,
        currentChannelPosition,
        setCurrentChannelPosition,
        isAnimationsEnabled,
        channelTags,
        activeFilter,
        setActiveFilter,
        favoritesVersion
    } = useContext(AppContext);
```

Add rail state below the existing `useState` calls:

```ts
    const railEntries: RailEntry[] = buildRailFilters(channelTags, CategoryStore.getSelectedTagUuids());
    const [railFocusedIndex, setRailFocusedIndex] = useState(() => {
        const index = railEntries.findIndex((entry) => isSameFilter(entry.filter, activeFilter));
        return index >= 0 ? index : 1;
    });
```

- [ ] **Step 2: Offset the list below the rail**

`getTopFrom` positions every row, so offsetting it moves the whole list at once. Replace it:

```ts
    const getTopFrom = (position: number) => {
        const y = position * mChannelLayoutHeight + mFilterRailHeight;
        return y - scrollY.current;
    };
```

- [ ] **Step 3: Add rail key handling**

In `handleKeyPress`, insert a rail branch before the existing `switch`, so rail focus intercepts navigation:

```ts
        if (state === State.RAIL) {
            switch (keyCode) {
                case RemoteKeys.ARROW_LEFT:
                    event.stopPropagation();
                    setRailFocusedIndex(railFocusedIndex > 0 ? railFocusedIndex - 1 : railEntries.length - 1);
                    return;
                case RemoteKeys.ARROW_RIGHT:
                    event.stopPropagation();
                    setRailFocusedIndex(railFocusedIndex < railEntries.length - 1 ? railFocusedIndex + 1 : 0);
                    return;
                case RemoteKeys.ARROW_DOWN:
                case RemoteKeys.OK:
                    event.stopPropagation();
                    applyFocusedFilter();
                    return;
                case RemoteKeys.BACK:
                    event.stopPropagation();
                    setState(State.NORMAL);
                    return;
                case RemoteKeys.CHANNEL_UP:
                case RemoteKeys.CHANNEL_DOWN:
                    // fall through to the normal handler so zapping always works
                    break;
                default:
                    break;
            }
        }
```

Add the handler beside `scrollUp` / `scrollDown`:

```ts
    const applyFocusedFilter = () => {
        const entry = railEntries[railFocusedIndex];
        if (entry) {
            setActiveFilter(entry.filter);
            // the filtered view has changed - restart at the top of it
            setChannelPosition(0);
        }
        setState(State.NORMAL);
    };
```

- [ ] **Step 4: Enter the rail from the top row**

Replace the `scrollUp` implementation so the top row lifts focus into the rail instead of wrapping:

```ts
    const scrollUp = () => {
        if (channelPosition.current === 0) {
            // at the top row, move focus into the filter rail
            setState(State.RAIL);
        } else {
            setChannelPosition(channelPosition.current - 1);
        }
    };
```

- [ ] **Step 5: Redraw when the filter or favorites change**

Add an effect beside the existing `useLayoutEffect`:

```ts
    useEffect(() => {
        // the filtered view or the favorite markers changed - repaint
        recalculateAndRedraw(false);
    }, [activeFilter, favoritesVersion]);
```

- [ ] **Step 6: Render the rail and the empty banner**

In the returned JSX, add above the `<canvas>`:

```tsx
            <FilterRail
                entries={railEntries}
                activeFilter={activeFilter}
                focusedIndex={railFocusedIndex}
                isFocused={state === State.RAIL}
            />

            {epgData.isFilterEmpty() && (
                <div className="channelListEmptyBanner">
                    No favorites yet &mdash; hold OK on a channel to add it
                </div>
            )}
```

- [ ] **Step 7: Verify type checking and run the full test suite**

Run: `npx tsc --noEmit && CI=true npm test`
Expected: no type errors; all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/components/ChannelList.tsx
git commit -m "feat: wire filter rail into the channel list"
```

---

### Task 11: Toggle favorites

**Files:**
- Modify: `src/components/ChannelList.tsx`
- Modify: `src/components/ChannelListDetails.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `FavoritesStore` (Task 2), `bumpFavoritesVersion` (Task 8), `RemoteKeys` (Task 1)
- Produces: no new exports

**Behaviour:** a ★ is drawn on favourited rows. Holding OK for 600 ms toggles the favourite and suppresses the select that would otherwise fire on release. The details panel shows an explicit add/remove row so the feature is discoverable without knowing about the hold.

- [ ] **Step 1: Draw the star on favourited rows**

In `src/components/ChannelList.tsx`, import the store:

```ts
import FavoritesStore from '../utils/FavoritesStore';
```

In `drawChannelItem`, after the channel logo block, add:

```ts
        // favorite marker
        if (FavoritesStore.has(channel.getUUID())) {
            CanvasUtils.writeText(canvas, '★', drawingRect.left + 30, drawingRect.middle, {
                fontSize: mChannelLayoutTextSize,
                textAlign: 'center',
                fillStyle: '#ffcc4d',
                isBold: true
            });
        }
```

- [ ] **Step 2: Add hold-to-favorite handling**

Add a ref beside the other refs:

```ts
    const holdTimer = useRef<NodeJS.Timeout | null>(null);
    const holdFired = useRef(false);
```

Add the handlers beside `toggleRecording`:

```ts
    const toggleFavorite = () => {
        const channel = epgData.getChannel(channelPosition.current);
        if (!channel) return;
        FavoritesStore.toggle(channel.getUUID());
        bumpFavoritesVersion();
        updateCanvas();
    };

    const handleOkDown = () => {
        if (holdTimer.current) return; // key repeat while already held
        holdFired.current = false;
        holdTimer.current = setTimeout(() => {
            holdFired.current = true;
            holdTimer.current = null;
            toggleFavorite();
        }, 600);
    };

    const handleOkUp = () => {
        if (holdTimer.current) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
        }
        if (holdFired.current) {
            // the hold already acted - swallow the select
            holdFired.current = false;
            return;
        }
        setCurrentChannelPosition(channelPosition.current);
        props.unmount();
    };
```

Add `bumpFavoritesVersion` to the context destructuring from Task 10.

- [ ] **Step 3: Route OK through the hold handlers**

Replace the existing `case 13:` branch in `handleKeyPress` with:

```ts
            case RemoteKeys.OK:
                event.stopPropagation();
                handleOkDown();
                break;
```

Add a key-up handler beside `handleKeyPress`:

```ts
    const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.keyCode === RemoteKeys.OK) {
            event.stopPropagation();
            handleOkUp();
        }
    };
```

Wire it on the wrapper div in the returned JSX, beside `onKeyDown`:

```tsx
            onKeyUp={handleKeyUp}
```

Clear the timer when the component unmounts by extending the existing cleanup in the mount effect:

```ts
        return () => {
            cancelAnimationFrame(scrollAnimationId.current);
            holdTimer.current && clearTimeout(holdTimer.current);
        };
```

- [ ] **Step 4: Add the details panel action**

In `src/components/ChannelListDetails.tsx`, import the store and context helper:

```ts
import FavoritesStore from '../utils/FavoritesStore';
```

Pull `bumpFavoritesVersion` from context:

```ts
    const { locale, bumpFavoritesVersion } = useContext(AppContext);
```

Render an action row wherever the channel heading is emitted, guarded on having a channel:

```tsx
            {props.epgChannel && (
                <div
                    className="favoriteAction"
                    onClick={() => {
                        FavoritesStore.toggle(props.epgChannel!.getUUID());
                        bumpFavoritesVersion();
                    }}
                >
                    {FavoritesStore.has(props.epgChannel.getUUID())
                        ? '★ Remove from favorites'
                        : '☆ Add to favorites'}
                </div>
            )}
```

- [ ] **Step 5: Style the action row**

Append to `src/styles/app.css`:

```css
.favoriteAction {
    font-size: 26px;
    color: #ffcc4d;
    padding: 12px 0;
}
```

- [ ] **Step 6: Verify type checking and tests**

Run: `npx tsc --noEmit && CI=true npm test`
Expected: no type errors; all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/components/ChannelList.tsx src/components/ChannelListDetails.tsx src/styles/app.css
git commit -m "feat: toggle channel favorites from the list and details panel"
```

---

### Task 12: First-run category picker

**Files:**
- Create: `src/components/CategorySetup.tsx`
- Test: `src/components/CategorySetup.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `ChannelTag` (Task 3), `CategoryStore` (Task 4), `RemoteKeys` (Task 1)
- Produces: default-exported `CategorySetup` component taking `{ unmount: () => void }`, plus named export `defaultTagSelection(tags: ChannelTag[], totalChannels: number): string[]` and `findNewTagUuids(tags: ChannelTag[], knownUuids: string[]): string[]`

- [ ] **Step 1: Write the failing test**

Create `src/components/CategorySetup.test.ts`:

```ts
import { defaultTagSelection, findNewTagUuids } from './CategorySetup';
import ChannelTag from '../models/ChannelTag';

const tags: ChannelTag[] = [
    { uuid: 'tag-sdtv', name: 'SDTV', index: 0, channelCount: 1049 },
    { uuid: 'tag-all', name: 'TV channels', index: 0, channelCount: 1049 },
    { uuid: 'tag-news', name: 'News', index: 0, channelCount: 417 },
    { uuid: 'tag-shopping', name: 'Shopping', index: 0, channelCount: 3 }
];

describe('defaultTagSelection', () => {
    it('unticks tags covering 95% or more of the lineup', () => {
        expect(defaultTagSelection(tags, 1049)).toEqual(['tag-news', 'tag-shopping']);
    });

    it('keeps a tag that covers just under the threshold', () => {
        expect(defaultTagSelection([{ uuid: 'tag-x', name: 'X', index: 0, channelCount: 94 }], 100)).toEqual(['tag-x']);
    });

    it('unticks a tag exactly at the threshold', () => {
        expect(defaultTagSelection([{ uuid: 'tag-x', name: 'X', index: 0, channelCount: 95 }], 100)).toEqual([]);
    });

    it('selects nothing when there are no channels', () => {
        expect(defaultTagSelection(tags, 0)).toEqual([]);
    });
});

describe('findNewTagUuids', () => {
    it('reports tags never seen before', () => {
        expect(findNewTagUuids(tags, ['tag-sdtv', 'tag-all', 'tag-news'])).toEqual(['tag-shopping']);
    });

    it('reports nothing when everything is known', () => {
        expect(findNewTagUuids(tags, ['tag-sdtv', 'tag-all', 'tag-news', 'tag-shopping'])).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npm test -- --testPathPattern='CategorySetup'`
Expected: FAIL — `Cannot find module './CategorySetup'`

- [ ] **Step 3: Write the component**

Create `src/components/CategorySetup.tsx`:

```tsx
import React, { useContext, useEffect, useRef, useState } from 'react';
import AppContext from '../AppContext';
import ChannelTag from '../models/ChannelTag';
import CategoryStore from '../utils/CategoryStore';
import RemoteKeys from '../utils/RemoteKeys';
import { ALL_CHANNELS } from '../models/ChannelFilter';

/** Tags at or above this share of the lineup are useless as filters. */
const UNIVERSAL_TAG_THRESHOLD = 0.95;

/**
 * Which tags start ticked in the picker. Tags carried by nearly every channel
 * cannot usefully filter anything, so they start unticked - the user can still
 * tick them.
 */
export const defaultTagSelection = (tags: ChannelTag[], totalChannels: number): string[] => {
    if (totalChannels <= 0) {
        return [];
    }
    return tags
        .filter((tag) => tag.channelCount < totalChannels * UNIVERSAL_TAG_THRESHOLD)
        .map((tag) => tag.uuid);
};

/** Tags the server reports that we have never shown the user before. */
export const findNewTagUuids = (tags: ChannelTag[], knownUuids: string[]): string[] =>
    tags.filter((tag) => knownUuids.indexOf(tag.uuid) < 0).map((tag) => tag.uuid);

const CategorySetup = (props: { unmount: () => void }) => {
    const { epgData, channelTags, setActiveFilter } = useContext(AppContext);
    const wrapper = useRef<HTMLDivElement>(null);

    const totalChannels = epgData.getAllChannels().length;
    const isConfigured = CategoryStore.isConfigured();
    const newTagUuids = findNewTagUuids(channelTags, CategoryStore.getKnownTagUuids());

    const [selected, setSelected] = useState<string[]>(() =>
        isConfigured ? CategoryStore.getSelectedTagUuids() : defaultTagSelection(channelTags, totalChannels)
    );
    const [focusedIndex, setFocusedIndex] = useState(0);

    const toggle = (uuid: string) => {
        const index = selected.indexOf(uuid);
        const next = selected.slice();
        if (index >= 0) {
            next.splice(index, 1);
        } else {
            next.push(uuid);
        }
        setSelected(next);
    };

    const save = () => {
        // preserve server order so the rail matches the picker
        const ordered = channelTags.filter((tag) => selected.indexOf(tag.uuid) >= 0).map((tag) => tag.uuid);
        CategoryStore.setSelectedTagUuids(ordered);
        CategoryStore.setKnownTagUuids(channelTags.map((tag) => tag.uuid));
        // a category that just disappeared must not stay active
        const active = CategoryStore.getActiveFilter();
        if (active.kind === 'tag' && ordered.indexOf(active.tagUuid || '') < 0) {
            setActiveFilter(ALL_CHANNELS);
        }
        props.unmount();
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLDivElement>) => {
        switch (event.keyCode) {
            case RemoteKeys.ARROW_UP:
                event.stopPropagation();
                setFocusedIndex(focusedIndex > 0 ? focusedIndex - 1 : channelTags.length);
                break;
            case RemoteKeys.ARROW_DOWN:
                event.stopPropagation();
                setFocusedIndex(focusedIndex < channelTags.length ? focusedIndex + 1 : 0);
                break;
            case RemoteKeys.OK:
                event.stopPropagation();
                focusedIndex === channelTags.length ? save() : toggle(channelTags[focusedIndex].uuid);
                break;
            case RemoteKeys.BACK:
                event.stopPropagation();
                // back without saving still counts as configured on first run,
                // otherwise the picker reappears on every launch
                if (!isConfigured) {
                    save();
                } else {
                    props.unmount();
                }
                break;
            default:
                break;
        }
    };

    useEffect(() => {
        wrapper.current?.focus();
    }, []);

    return (
        <div
            id="category-setup"
            className="categorySetup"
            ref={wrapper}
            tabIndex={-1}
            onKeyDown={handleKeyPress}
        >
            <h2>Choose your categories</h2>
            <p className="categoryHint">
                These become the filters above your channel list. Tags carried by almost every channel are unticked
                because they cannot narrow anything down.
            </p>

            {channelTags.map((tag, index) => (
                <div
                    className={index === focusedIndex ? 'categoryRow focused' : 'categoryRow'}
                    key={tag.uuid}
                    onClick={() => toggle(tag.uuid)}
                >
                    <span className="categoryBox">{selected.indexOf(tag.uuid) >= 0 ? '☑' : '☐'}</span>
                    <span className="categoryName">{tag.name}</span>
                    <span className="categoryCount">{tag.channelCount}</span>
                    {newTagUuids.indexOf(tag.uuid) >= 0 && <span className="categoryNew">new</span>}
                </div>
            ))}

            <div
                className={focusedIndex === channelTags.length ? 'categoryRow focused' : 'categoryRow'}
                onClick={save}
            >
                <span className="categoryName">Save</span>
            </div>
        </div>
    );
};

export default CategorySetup;
```

- [ ] **Step 4: Add the styles**

Append to `src/styles/app.css`:

```css
.categorySetup {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 60px 80px;
    overflow-y: auto;
    color: #e9eef4;
    background-color: rgba(5, 8, 12, 0.97);
    z-index: 30;
}

.categoryHint {
    font-size: 24px;
    color: rgba(233, 238, 244, 0.65);
    max-width: 1100px;
}

.categoryRow {
    display: flex;
    align-items: center;
    font-size: 30px;
    padding: 12px 18px;
    border: 2px solid transparent;
    border-radius: 8px;
}

.categoryRow.focused {
    border-color: #ffcc4d;
    background-color: rgba(255, 255, 255, 0.09);
}

.categoryBox {
    width: 48px;
}

.categoryName {
    flex: 1;
}

.categoryCount {
    color: rgba(233, 238, 244, 0.5);
    margin-left: 24px;
}

.categoryNew {
    margin-left: 18px;
    font-size: 20px;
    text-transform: uppercase;
    color: #ffcc4d;
}
```

- [ ] **Step 5: Wire it into App**

In `src/App.tsx`, add to the `AppViewState` enum:

```ts
export enum AppViewState {
    TV,
    SETTINGS,
    RECORDINGS,
    HELP,
    CONTACT,
    CATEGORIES
}
```

Append rather than insert, so the numeric values of the existing members do not shift.

Import the component:

```ts
import CategorySetup from './components/CategorySetup';
```

Add a menu entry after the Setup entry:

```ts
        {
            icon: 'denselist',
            label: 'Categories',
            action: () => updateAppViewState(AppViewState.CATEGORIES),
            isActive: appViewState === AppViewState.CATEGORIES
        },
```

Render it, and open it automatically the first time tags arrive:

```tsx
            {appViewState === AppViewState.CATEGORIES && (
                <CategorySetup unmount={() => setAppViewState(AppViewState.TV)} />
            )}
```

In `reloadData`, extend the tag callback from Task 8 so an unconfigured install lands in the picker:

```ts
                .then((tags) => {
                    setChannelTags(tags);
                    epgData.setFilter(CategoryStore.getActiveFilter());
                    if (tags.length > 0 && !CategoryStore.isConfigured()) {
                        setAppViewState(AppViewState.CATEGORIES);
                    }
                })
```

- [ ] **Step 6: Run tests and type check**

Run: `npx tsc --noEmit && CI=true npm test`
Expected: no type errors; all tests pass including 6 new CategorySetup tests

- [ ] **Step 7: Commit**

```bash
git add src/components/CategorySetup.tsx src/components/CategorySetup.test.ts src/App.tsx src/styles/app.css
git commit -m "feat: add first run category picker"
```

---

### Task 13: Remap the remote to directional navigation

The last task replaces every hard-coded key code with `RemoteKeys` and moves the four colour-button actions onto reachable keys.

**Files:**
- Modify: `src/components/TV.tsx`
- Modify: `src/components/ChannelList.tsx`
- Modify: `src/components/TVGuide.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `RemoteKeys` (Task 1), `EPGData.getAllChannels` / `getChannelPositionByUuid` (Task 5), `setActiveFilter` (Task 8)
- Produces: no new exports

- [ ] **Step 1: Remap live TV navigation**

In `src/components/TV.tsx`, import `RemoteKeys` and `ALL_CHANNELS`:

```ts
import RemoteKeys from '../utils/RemoteKeys';
import { ALL_CHANNELS } from '../models/ChannelFilter';
```

Replace the arrow cases so Left opens the menu and Right opens the channel list, while Up/Down keep zapping. Replace the `case 40:` and `case 67: case 38:` branches with:

```ts
            case RemoteKeys.ARROW_DOWN:
                event.stopPropagation();
                // zap down
                if (currentChannelPosition === 0) {
                    return;
                }
                changeChannelPosition(currentChannelPosition - 1);
                break;
            case RemoteKeys.ARROW_UP:
                event.stopPropagation();
                // zap up
                if (currentChannelPosition === epgData.getChannelCount() - 1) {
                    return;
                }
                changeChannelPosition(currentChannelPosition + 1);
                break;
            case RemoteKeys.ARROW_RIGHT:
            case RemoteKeys.KEY_C:
                event.stopPropagation();
                setState(State.CHANNEL_LIST);
                break;
            case RemoteKeys.ARROW_LEFT:
                event.stopPropagation();
                setMenuState(true);
                break;
```

Replace the blue-button EPG branch:

```ts
            case RemoteKeys.GUIDE:
            case RemoteKeys.BLUE:
            case RemoteKeys.KEY_B:
                event.stopPropagation();
                setState(State.EPG);
                break;
```

Replace the yellow-button branch so audio settings stay reachable by its legacy code only:

```ts
            case RemoteKeys.YELLOW:
            case RemoteKeys.KEY_Y:
                event.stopPropagation();
                handleChannelSettingsSwitch();
                break;
```

Also convert the two surviving channel-key literals in the same switch — `case 34:` becomes `case RemoteKeys.CHANNEL_DOWN:` and `case 33:` becomes `case RemoteKeys.CHANNEL_UP:` — leaving their bodies unchanged. They now sit alongside the arrow branches rather than sharing them.

Add `setMenuState` to the `useContext(AppContext)` destructuring in `TV.tsx`.

- [ ] **Step 2: Make digit entry search the whole lineup**

Digit entry currently searches the filtered view, so typing the number of a channel outside the active filter does nothing. Replace the timeout body inside `enterChannelNumberPart`:

```ts
            timeoutChangeChannel.current = setTimeout(() => {
                const channelNumber = parseInt(newChannelNumberText);
                const target = epgData
                    .getAllChannels()
                    .find((channel) => channel.getChannelID() === channelNumber);
                if (!target) {
                    setChannelNumberText('');
                    return;
                }

                let position = epgData.getChannelPositionByUuid(target.getUUID());
                if (position < 0) {
                    // the channel is hidden by the active filter - widen to All
                    setActiveFilter(ALL_CHANNELS);
                    position = epgData.getChannelPositionByUuid(target.getUUID());
                }
                if (position >= 0) {
                    changeChannelPosition(position);
                }
            }, 3000);
```

Add `setActiveFilter` to the `useContext(AppContext)` destructuring in `TV.tsx`.

- [ ] **Step 3: Keep CH+/CH− zapping from the channel list**

In `src/components/ChannelList.tsx`, the arrow keys and channel keys currently share a branch, which means CH+/CH− moves the highlight rather than changing channel. Split them so CH+/CH− actually zaps:

```ts
            case RemoteKeys.ARROW_UP:
                event.stopPropagation();
                scrollUp();
                break;
            case RemoteKeys.ARROW_DOWN:
                event.stopPropagation();
                scrollDown();
                break;
            case RemoteKeys.CHANNEL_UP:
                event.stopPropagation();
                if (currentChannelPosition < epgData.getChannelCount() - 1) {
                    setCurrentChannelPosition(currentChannelPosition + 1);
                    setChannelPosition(currentChannelPosition + 1);
                }
                break;
            case RemoteKeys.CHANNEL_DOWN:
                event.stopPropagation();
                if (currentChannelPosition > 0) {
                    setCurrentChannelPosition(currentChannelPosition - 1);
                    setChannelPosition(currentChannelPosition - 1);
                }
                break;
```

Replace the remaining literals in that switch (`67`, `461`, `403`, `82`, `39`, `37`) with `RemoteKeys.KEY_C`, `RemoteKeys.BACK`, `RemoteKeys.RED`, `RemoteKeys.KEY_R`, `RemoteKeys.ARROW_RIGHT`, `RemoteKeys.ARROW_LEFT`.

Add a Guide branch so the EPG is reachable from the list:

```ts
            case RemoteKeys.GUIDE:
                // let it bubble to TV so it can switch to the EPG
                break;
```

- [ ] **Step 4: Remap the EPG guide**

In `src/components/TVGuide.tsx`, import `RemoteKeys` and replace the literals in `handleKeyPress`: `39` → `RemoteKeys.ARROW_RIGHT`, `37` → `RemoteKeys.ARROW_LEFT`, `40` → `RemoteKeys.ARROW_DOWN`, `38` → `RemoteKeys.ARROW_UP`, `403` → `RemoteKeys.RED`, `461` → `RemoteKeys.BACK`, `406` → `RemoteKeys.BLUE`, `66` → `RemoteKeys.KEY_B`, `13` → `RemoteKeys.OK`.

Add `RemoteKeys.GUIDE` to the same branch as `RemoteKeys.BLUE` so Guide closes the EPG:

```ts
            case RemoteKeys.BACK:
            case RemoteKeys.GUIDE:
            case RemoteKeys.BLUE:
            case RemoteKeys.KEY_B:
```

Add CH+/CH− zapping to the guide, beside the arrow cases:

```ts
            case RemoteKeys.CHANNEL_UP:
                event.stopPropagation();
                if (currentChannelPosition < epgData.getChannelCount() - 1) {
                    setCurrentChannelPosition(currentChannelPosition + 1);
                }
                break;
            case RemoteKeys.CHANNEL_DOWN:
                event.stopPropagation();
                if (currentChannelPosition > 0) {
                    setCurrentChannelPosition(currentChannelPosition - 1);
                }
                break;
```

- [ ] **Step 5: Remap the app-level menu key**

In `src/App.tsx`, import `RemoteKeys` and replace the literals in `handleKeyPress`: `404` → `RemoteKeys.GREEN`, `71` → `RemoteKeys.KEY_G`, `461` → `RemoteKeys.BACK`, `66` → `RemoteKeys.KEY_B`.

- [ ] **Step 6: Verify type checking and the full suite**

Run: `npx tsc --noEmit && CI=true npm test`
Expected: no type errors; all tests pass

- [ ] **Step 7: Build to confirm nothing broke**

Run: `npm run build`
Expected: build succeeds

- [ ] **Step 8: Commit**

```bash
git add src/components/TV.tsx src/components/ChannelList.tsx src/components/TVGuide.tsx src/App.tsx
git commit -m "feat: remap remote to directional navigation for magic remote"
```

---

### Task 14: Rehome record and audio settings off the colour buttons

Task 13 makes navigation reachable, but two actions are still only bound to colour codes a Magic Remote cannot send: **record** (red) and **audio/subtitle track** (yellow). The spec rehomes both.

**Files:**
- Modify: `src/components/ChannelListDetails.tsx`
- Modify: `src/components/ChannelList.tsx`
- Modify: `src/components/TVGuide.tsx`
- Modify: `src/components/TV.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `FavoritesStore` (Task 2), `RemoteKeys` (Task 1), `DialogPopup` (existing, props `{ title, subtitle, confirmText, abortText, confirmAction, abortAcion }` — note the existing misspelling of `abortAcion`)
- Produces: `ChannelListDetails` gains props `focusedActionIndex: number` and `onToggleFavorite: () => void`, `onToggleRecording: () => void`

**Where each action lands:**

| Action | New binding |
| --- | --- |
| Toggle favorite | Details panel action row 0, plus hold OK in the list (Task 11) |
| Record / cancel recording | Details panel action row 1, and OK on a future programme in the EPG |
| Audio & subtitle tracks | Hold OK on live TV — the key map leaves that gesture unassigned |

While the details panel is open, ↑/↓ move between the two action rows rather than scrolling channels. Channel changing stays available there through CH+/CH−, which the global constraints already require to work from every screen.

- [ ] **Step 1: Make the details panel actions focusable**

In `src/components/ChannelListDetails.tsx`, extend the props:

```ts
const ChannelListDetails = (props: {
    isRecording: (event: EPGEvent) => boolean;
    currentEvent?: EPGEvent;
    epgChannel?: EPGChannel;
    nextEvents: EPGEvent[];
    nextSameEvents: EPGEvent[];
    focusedActionIndex: number;
    onToggleFavorite: () => void;
    onToggleRecording: () => void;
}) => {
```

Replace the favorite row added in Task 11 with a two-row action block:

```tsx
            {props.epgChannel && (
                <div className="detailsActions">
                    <div
                        className={props.focusedActionIndex === 0 ? 'detailsAction focused' : 'detailsAction'}
                        onClick={props.onToggleFavorite}
                    >
                        {FavoritesStore.has(props.epgChannel.getUUID())
                            ? '★ Remove from favorites'
                            : '☆ Add to favorites'}
                    </div>
                    <div
                        className={props.focusedActionIndex === 1 ? 'detailsAction focused' : 'detailsAction'}
                        onClick={props.onToggleRecording}
                    >
                        {props.currentEvent && props.isRecording(props.currentEvent)
                            ? '● Cancel recording'
                            : '● Record'}
                    </div>
                </div>
            )}
```

`bumpFavoritesVersion` is no longer called here — the parent owns both actions now, so drop it from this component's `useContext` destructuring and leave `const { locale } = useContext(AppContext);` as it was.

- [ ] **Step 2: Own the action focus in ChannelList**

In `src/components/ChannelList.tsx`, add state beside `railFocusedIndex`:

```ts
    const [detailsActionIndex, setDetailsActionIndex] = useState(0);
```

In `handleKeyPress`, add a details branch immediately after the rail branch from Task 10:

```ts
        if (state === State.DETAILS) {
            switch (keyCode) {
                case RemoteKeys.ARROW_UP:
                    event.stopPropagation();
                    setDetailsActionIndex(detailsActionIndex === 0 ? 1 : 0);
                    return;
                case RemoteKeys.ARROW_DOWN:
                    event.stopPropagation();
                    setDetailsActionIndex(detailsActionIndex === 1 ? 0 : 1);
                    return;
                case RemoteKeys.OK:
                    event.stopPropagation();
                    detailsActionIndex === 0 ? toggleFavorite() : toggleRecording();
                    return;
                default:
                    break;
            }
        }
```

Reset the focus when the panel opens by extending the existing `useLayoutEffect` on `state`:

```ts
    useLayoutEffect(() => {
        if (state === State.DETAILS) {
            setDetailsActionIndex(0);
            setDetailsData();
        }
    }, [state]);
```

Pass the new props where `ChannelListDetails` is rendered:

```tsx
                <ChannelListDetails
                    isRecording={(event: EPGEvent) => {
                        return epgData.isRecording(event);
                    }}
                    epgChannel={detailsState?.focusedChannel}
                    currentEvent={detailsState?.focusedEvent}
                    nextEvents={nextEvents.current}
                    nextSameEvents={nextSameEvents.current}
                    focusedActionIndex={detailsActionIndex}
                    onToggleFavorite={toggleFavorite}
                    onToggleRecording={toggleRecording}
                />
```

- [ ] **Step 3: Style the action rows**

Replace the `.favoriteAction` rule added in Task 11 in `src/styles/app.css` with:

```css
.detailsActions {
    margin-top: 24px;
}

.detailsAction {
    font-size: 26px;
    color: rgba(233, 238, 244, 0.8);
    padding: 10px 16px;
    border: 2px solid transparent;
    border-radius: 8px;
}

.detailsAction.focused {
    border-color: #ffcc4d;
    color: #ffffff;
    background-color: rgba(255, 255, 255, 0.09);
}
```

- [ ] **Step 4: Record a future programme from the EPG**

In `src/components/TVGuide.tsx`, import the dialog and add state:

```ts
import DialogPopup from './DialogPopup';
```

```ts
    const [recordDialogEvent, setRecordDialogEvent] = useState<EPGEvent | undefined>(undefined);
```

Replace the `RemoteKeys.OK` branch in `handleKeyPress` so a future programme opens the dialog while the currently airing one keeps switching channel:

```ts
            case RemoteKeys.OK: {
                event.stopPropagation();
                const focusedEvent = epgData.getEvent(channelPosition.current, eventPosition.current);
                if (focusedEvent && !focusedEvent.isCurrent() && !focusedEvent.isPastDated(EPGUtils.getNow())) {
                    setRecordDialogEvent(focusedEvent);
                    return;
                }
                setCurrentChannelPosition(channelPosition.current);
                props.unmount();
                break;
            }
```

Render the dialog in the returned JSX, beside the existing canvas:

```tsx
            {recordDialogEvent && (
                <DialogPopup
                    title={recordDialogEvent.getTitle()}
                    subtitle={
                        epgData.isRecording(recordDialogEvent)
                            ? 'Cancel the planned recording?'
                            : 'Record this programme?'
                    }
                    confirmText={epgData.isRecording(recordDialogEvent) ? 'Cancel recording' : 'Record'}
                    abortText="Close"
                    confirmAction={() => {
                        props.toggleRecording(recordDialogEvent, () => updateCanvas());
                        setRecordDialogEvent(undefined);
                    }}
                    abortAcion={() => setRecordDialogEvent(undefined)}
                ></DialogPopup>
            )}
```

If `eventPosition` is not the name of the focused-event ref in this file, use whichever ref `TVGuide` already keeps the focused event position in — search for `getEvent(` in the draw code to find it.

- [ ] **Step 5: Open audio settings by holding OK on live TV**

In `src/components/TV.tsx`, add refs beside the existing ones:

```ts
    const okHoldTimer = useRef<NodeJS.Timeout | null>(null);
    const okHoldFired = useRef(false);
```

Replace the `RemoteKeys.OK` branch in `handleKeyPress`:

```ts
            case RemoteKeys.OK:
                event.stopPropagation();
                if (okHoldTimer.current) break; // key repeat while already held
                okHoldFired.current = false;
                okHoldTimer.current = setTimeout(() => {
                    okHoldFired.current = true;
                    okHoldTimer.current = null;
                    handleChannelSettingsSwitch();
                }, 600);
                break;
```

Add a key-up handler beside `handleKeyPress`:

```ts
    const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.keyCode !== RemoteKeys.OK) return;
        event.stopPropagation();
        if (okHoldTimer.current) {
            clearTimeout(okHoldTimer.current);
            okHoldTimer.current = null;
        }
        if (okHoldFired.current) {
            okHoldFired.current = false;
            return;
        }
        handleChannelInfoSwitch();
    };
```

Wire it on the wrapper div beside `onKeyDown`:

```tsx
            onKeyUp={handleKeyUp}
```

Clear the timer in the existing unmount effect:

```ts
        return () => {
            okHoldTimer.current && clearTimeout(okHoldTimer.current);
            const videoElement = getMediaElement();
            if (!videoElement) return;
            resetPlayer(videoElement);
        };
```

- [ ] **Step 6: Verify type checking, tests and build**

Run: `npx tsc --noEmit && CI=true npm test && npm run build`
Expected: no type errors; all tests pass; build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/components/ChannelListDetails.tsx src/components/ChannelList.tsx src/components/TVGuide.tsx src/components/TV.tsx src/styles/app.css
git commit -m "feat: rehome record and audio settings off colour buttons"
```

---

## On-device verification

These cannot be covered by unit tests and must be checked on the TV with `npm run webos:tv` and `ares-inspect -d tv com.willinux.tvh.app --open`:

1. **Guide key code.** Press Guide on the live TV screen. If the EPG does not open, read the logged `TV-keyPressed: <code>` value and correct `RemoteKeys.GUIDE` in `src/utils/RemoteKeys.ts`.
2. **OK-hold reliability.** Hold OK on a channel row for ~1s and confirm the ★ appears and no channel switch happens. If webOS key repeat makes this unreliable, the details-panel action is the fallback and the hold handling in Task 11 can be removed.
3. **CH+/CH− from every screen** — live TV, channel list, filter rail, details panel, EPG.
4. **Record and audio settings** — record a future programme from the EPG dialog, cancel it again, and confirm hold-OK on live TV opens the audio/subtitle picker.
5. **First-run picker** — clear app data, relaunch, confirm `SDTV` and `TV channels` start unticked and the other 12 genres start ticked.
6. **Filter persistence** — select a category, exit the app, relaunch, confirm the rail and list restore that category.
