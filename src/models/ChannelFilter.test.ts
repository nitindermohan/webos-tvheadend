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
