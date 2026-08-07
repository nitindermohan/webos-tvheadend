import ChannelFilter, { ALL_CHANNELS } from '../models/ChannelFilter';
import { readStoredStringArray } from './StoredStringArray';

const STORAGE_KEY_SELECTED_TAGS = 'categorySelectedTags';
const STORAGE_KEY_KNOWN_TAGS = 'categoryKnownTags';
const STORAGE_KEY_CONFIGURED = 'categoriesConfigured';
const STORAGE_KEY_ACTIVE_FILTER = 'activeChannelFilter';

/**
 * Which channel tags appear on the filter rail, whether the user has been
 * through the first run picker, and which filter is currently active.
 */
export default class CategoryStore {
    static isConfigured(): boolean {
        return localStorage.getItem(STORAGE_KEY_CONFIGURED) === 'true';
    }

    static getSelectedTagUuids(): string[] {
        return readStoredStringArray(STORAGE_KEY_SELECTED_TAGS);
    }

    /** Saving a selection - even an empty one - counts as configuring. */
    static setSelectedTagUuids(uuids: string[]): void {
        localStorage.setItem(STORAGE_KEY_SELECTED_TAGS, JSON.stringify(uuids));
        localStorage.setItem(STORAGE_KEY_CONFIGURED, 'true');
    }

    /** Every tag uuid seen on the server so far, used to flag new arrivals. */
    static getKnownTagUuids(): string[] {
        return readStoredStringArray(STORAGE_KEY_KNOWN_TAGS);
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

    /**
     * Persist the filter, except a search.
     *
     * A search is a transient act, not a preference: restoring one on launch
     * would open the app showing a fraction of the lineup for a reason the
     * user typed days ago. getActiveFilter already refuses to read one back -
     * its allow-list covers only favorites and tag - so writing it would be
     * dead data written on every keystroke. This keeps the two ends honest
     * about the same rule instead of relying on the reader to undo the writer.
     */
    static setActiveFilter(filter: ChannelFilter): void {
        if (filter.kind === 'search') {
            return;
        }
        localStorage.setItem(STORAGE_KEY_ACTIVE_FILTER, JSON.stringify(filter));
    }
}
