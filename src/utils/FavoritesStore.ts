import { parseStoredStringArray } from './StoredStringArray';

const STORAGE_KEY_FAVORITES = 'favoriteChannels';

/**
 * Favorite channels, keyed by TVHeadend channel uuid so they survive
 * reordering of the lineup. Stored as a JSON array rather than a Set because
 * that is the wire format in localStorage; lookups go through a derived map.
 *
 * has() is called from inside the channel list's requestAnimationFrame draw
 * loop, once per visible row - roughly 720 times a second while scrolling.
 * Every one of those used to be a localStorage read *and* a JSON.parse, then
 * an O(n) indexOf. The parse and the scan are now done once per distinct
 * stored value and reused.
 *
 * The cache is keyed on the raw stored string rather than invalidated on
 * write, so it stays correct when localStorage is changed by anything other
 * than this class - another part of the app, a reset, or a test. Reading a
 * string and comparing it is cheap; parsing it is not.
 */
export default class FavoritesStore {
    private static cachedRaw: string | null = null;
    private static cachedList: string[] = [];
    private static cachedLookup: { [uuid: string]: boolean } = {};

    private static read(): string[] {
        const raw = localStorage.getItem(STORAGE_KEY_FAVORITES);
        if (raw !== FavoritesStore.cachedRaw) {
            FavoritesStore.cachedRaw = raw;
            FavoritesStore.cachedList = parseStoredStringArray(raw, STORAGE_KEY_FAVORITES);
            FavoritesStore.cachedLookup = {};
            FavoritesStore.cachedList.forEach((uuid) => {
                FavoritesStore.cachedLookup[uuid] = true;
            });
        }
        return FavoritesStore.cachedList;
    }

    private static write(uuids: string[]): void {
        localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(uuids));
    }

    static all(): string[] {
        // a copy: read() hands back the cached array, and callers such as
        // EPGData.setFavoriteUuids hold on to what they are given
        return FavoritesStore.read().slice();
    }

    static count(): number {
        return FavoritesStore.read().length;
    }

    static has(uuid: string): boolean {
        FavoritesStore.read();
        return FavoritesStore.cachedLookup[uuid] === true;
    }

    static add(uuid: string): void {
        if (FavoritesStore.has(uuid)) {
            return;
        }
        // slice before mutating - read() returns the cache itself
        const uuids = FavoritesStore.read().slice();
        uuids.push(uuid);
        FavoritesStore.write(uuids);
    }

    static remove(uuid: string): void {
        const uuids = FavoritesStore.read().slice();
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
