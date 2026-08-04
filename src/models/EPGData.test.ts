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

    it('keeps the pinned channel visible under a filter it does not match', () => {
        const data = buildData();
        data.setPinnedChannelUuid('uuid-b');
        data.setFilter(tagFilter('tag-movies'));
        expect(data.getChannelCount()).toBe(3);
        expect(data.getChannel(0)?.getUUID()).toBe('uuid-a');
        expect(data.getChannel(1)?.getUUID()).toBe('uuid-b');
        expect(data.getChannel(2)?.getUUID()).toBe('uuid-c');
    });

    it('does not duplicate a pinned channel the filter already matches', () => {
        const data = buildData();
        data.setPinnedChannelUuid('uuid-a');
        data.setFilter(tagFilter('tag-movies'));
        expect(data.getChannelCount()).toBe(2);
        expect(data.getChannelPositionByUuid('uuid-a')).toBe(0);
    });

    it('resolves the pinned channel to a valid position under any filter', () => {
        const data = buildData();
        data.setPinnedChannelUuid('uuid-d');
        data.setFilter(tagFilter('tag-news'));
        expect(data.getChannelPositionByUuid('uuid-d')).toBeGreaterThanOrEqual(0);
    });

    it('still reports an empty filter when only the pinned channel survives', () => {
        const data = buildData();
        data.setPinnedChannelUuid('uuid-a');
        data.setFilter(tagFilter('tag-gone'));
        expect(data.isFilterEmpty()).toBe(true);
        expect(data.getChannelCount()).toBe(4);
    });

    it('ignores a pinned uuid that is not in the lineup', () => {
        const data = buildData();
        data.setPinnedChannelUuid('uuid-nope');
        data.setFilter(tagFilter('tag-movies'));
        expect(data.getChannelCount()).toBe(2);
    });

    it('keeps the pin across a channel list replacement', () => {
        const data = buildData();
        data.setPinnedChannelUuid('uuid-b');
        data.updateChannels([
            channel(1, 'uuid-a', ['tag-movies']),
            channel(2, 'uuid-b', ['tag-news'])
        ]);
        data.setFilter(tagFilter('tag-movies'));
        expect(data.getChannelCount()).toBe(2);
    });

    it('leaves the full lineup alone when the filter is all', () => {
        const data = buildData();
        data.setPinnedChannelUuid('uuid-b');
        expect(data.getChannelCount()).toBe(4);
        expect(data.getAllChannels().length).toBe(4);
    });
});
