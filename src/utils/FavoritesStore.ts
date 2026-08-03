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
