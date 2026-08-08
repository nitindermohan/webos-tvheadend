import {
    buildCategoryEntries,
    buildFilterEntries,
    categoryHeadingIndex,
    indexOfFilter,
    isEntryActive,
    labelForFilter,
    SEARCH_ENTRY
} from './FilterEntries';
import ChannelTag from '../models/ChannelTag';
import { ALL_CHANNELS, FAVORITE_CHANNELS, tagFilter } from '../models/ChannelFilter';

const tags: ChannelTag[] = [
    { uuid: 'tag-movies', name: 'Movies', index: 0, channelCount: 49 },
    { uuid: 'tag-news', name: 'News', index: 0, channelCount: 417 },
    { uuid: 'tag-sdtv', name: 'SDTV', index: 0, channelCount: 1049 }
];

describe('buildCategoryEntries', () => {
    it('always starts with All', () => {
        expect(buildCategoryEntries([], []).map((entry) => entry.label)).toEqual(['All']);
    });

    it('appends only the selected tags, in tag order', () => {
        const entries = buildCategoryEntries(tags, ['tag-news', 'tag-movies']);
        expect(entries.map((entry) => entry.label)).toEqual(['All', 'Movies', 'News']);
    });

    it('ignores selected uuids that no longer exist on the server', () => {
        const entries = buildCategoryEntries(tags, ['tag-gone', 'tag-news']);
        expect(entries.map((entry) => entry.label)).toEqual(['All', 'News']);
    });

    it('carries the right filter on each entry', () => {
        const entries = buildCategoryEntries(tags, ['tag-news']);
        expect(entries[0].filter).toEqual({ kind: 'all' });
        expect(entries[1].filter).toEqual({ kind: 'tag', tagUuid: 'tag-news' });
    });

    // Favorites has its own one-press control beside the dropdown. If it were
    // also a dropdown row, selecting it there would leave the dropdown
    // highlighting a row the control next to it also claims.
    it('never offers favorites', () => {
        const entries = buildCategoryEntries(tags, ['tag-news']);
        expect(entries.some((entry) => entry.filter.kind === 'favorites')).toBe(false);
    });
});

describe('buildFilterEntries', () => {
    it('puts favorites first, then the categories', () => {
        const entries = buildFilterEntries(tags, ['tag-news']);
        expect(entries.map((entry) => entry.label)).toEqual(['★ Favorites', 'All', 'News']);
    });

    it('offers favorites even with no tags at all', () => {
        expect(buildFilterEntries([], []).map((entry) => entry.label)).toEqual(['★ Favorites', 'All']);
    });
});

describe('indexOfFilter', () => {
    const entries = buildFilterEntries(tags, ['tag-news']);

    it('finds a filter by value, not by identity', () => {
        expect(indexOfFilter(entries, { kind: 'tag', tagUuid: 'tag-news' })).toBe(2);
    });

    it('finds the plain kinds', () => {
        expect(indexOfFilter(entries, FAVORITE_CHANNELS)).toBe(0);
        expect(indexOfFilter(entries, ALL_CHANNELS)).toBe(1);
    });

    it('reports -1 for a filter that is not offered', () => {
        expect(indexOfFilter(entries, tagFilter('tag-movies'))).toBe(-1);
    });
});

describe('labelForFilter', () => {
    const entries = buildCategoryEntries(tags, ['tag-news']);

    it('names the active category', () => {
        expect(labelForFilter(entries, tagFilter('tag-news'))).toBe('News');
    });

    // A tag filter outlives the tag it names: it is persisted across restarts,
    // and the tag can be deselected in the picker or removed on the server.
    // An unlabelled control reads as broken, so fall back to All.
    it('falls back to All when the active tag is no longer offered', () => {
        expect(labelForFilter(entries, tagFilter('tag-vanished'))).toBe('All');
    });

    it('names All when All is active', () => {
        expect(labelForFilter(entries, ALL_CHANNELS)).toBe('All');
    });
});

describe('categoryHeadingIndex', () => {
    // The column leads with Search and Favorites, which are not categories. A
    // heading over the whole column labelled both of them as one.
    const columnEntries = () => [SEARCH_ENTRY, ...buildFilterEntries(tags, ['tag-movies'])];

    it('puts the heading above All, not above the column', () => {
        const entries = columnEntries();
        const index = categoryHeadingIndex(entries);
        expect(entries[index].label).toBe('All');
        expect(index).toBeGreaterThan(0);
    });

    it('skips every leading row that is not a category', () => {
        const entries = columnEntries();
        entries.slice(0, categoryHeadingIndex(entries)).forEach((entry) => {
            expect(['search', 'favorites']).toContain(entry.filter.kind);
        });
    });

    it('follows the rows rather than a fixed index', () => {
        // adding or removing a leading row must move the heading with it, or
        // it silently mislabels one more thing
        const withSearch = categoryHeadingIndex(columnEntries());
        const withoutSearch = categoryHeadingIndex(buildFilterEntries(tags, ['tag-movies']));
        expect(withSearch - withoutSearch).toBe(1);
    });

    it('reports no heading when there are no categories to head', () => {
        expect(categoryHeadingIndex([SEARCH_ENTRY])).toBe(-1);
    });
});

describe('isEntryActive', () => {
    it('keeps the search row active once a query has been typed', () => {
        // compared by value, the row's empty-query filter stops matching the
        // moment a character arrives - the one moment the user most needs to
        // see where they are
        expect(isEntryActive(SEARCH_ENTRY, { kind: 'search', query: 'zdf' })).toBe(true);
    });

    it('does not light the search row for any other filter', () => {
        expect(isEntryActive(SEARCH_ENTRY, ALL_CHANNELS)).toBe(false);
        expect(isEntryActive(SEARCH_ENTRY, FAVORITE_CHANNELS)).toBe(false);
    });

    it('still compares other rows by value', () => {
        const entries = buildFilterEntries(tags, ['tag-movies']);
        const movies = entries.find((entry) => entry.label === 'Movies') as typeof entries[0];
        expect(isEntryActive(movies, tagFilter('tag-movies'))).toBe(true);
        expect(isEntryActive(movies, tagFilter('tag-news'))).toBe(false);
    });
});
