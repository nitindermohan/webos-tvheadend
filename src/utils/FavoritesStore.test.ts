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

    describe('when stored data is corrupt', () => {
        let consoleLogSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        });

        afterEach(() => {
            consoleLogSpy.mockRestore();
        });

        it('recovers from corrupted storage instead of throwing', () => {
            localStorage.setItem('favoriteChannels', 'not json');
            expect(FavoritesStore.all()).toEqual([]);
            FavoritesStore.add('uuid-a');
            expect(FavoritesStore.all()).toEqual(['uuid-a']);
        });
    });

    it('ignores non-string entries in storage', () => {
        localStorage.setItem('favoriteChannels', JSON.stringify(['uuid-a', 42, null]));
        expect(FavoritesStore.all()).toEqual(['uuid-a']);
    });
});
