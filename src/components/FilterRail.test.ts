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
