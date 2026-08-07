import CategoryStore from './CategoryStore';
import { ALL_CHANNELS, FAVORITE_CHANNELS, tagFilter, searchFilter } from '../models/ChannelFilter';

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

    describe('search filters', () => {
        it('are not persisted, so the app never opens into an old query', () => {
            CategoryStore.setActiveFilter(tagFilter('tag-1'));
            CategoryStore.setActiveFilter(searchFilter('sport'));
            // still the tag: the search wrote nothing rather than overwriting
            expect(CategoryStore.getActiveFilter()).toEqual(tagFilter('tag-1'));
        });

        it('are still refused on read, if one is ever written by other means', () => {
            // belt and braces - the reader's allow-list is what actually
            // protects launch, and it must not come to depend on the writer
            localStorage.setItem('activeChannelFilter', JSON.stringify({ kind: 'search', query: 'sport' }));
            expect(CategoryStore.getActiveFilter()).toEqual(ALL_CHANNELS);
        });
    });

    describe('when stored data is corrupt', () => {
        let consoleLogSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        });

        afterEach(() => {
            consoleLogSpy.mockRestore();
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
});
