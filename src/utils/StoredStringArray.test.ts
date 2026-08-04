import { readStoredStringArray } from './StoredStringArray';

describe('readStoredStringArray', () => {
    beforeEach(() => localStorage.clear());

    it('returns an empty array when the key is missing', () => {
        expect(readStoredStringArray('missing-key')).toEqual([]);
    });

    it('round trips a plain string array', () => {
        localStorage.setItem('some-key', JSON.stringify(['a', 'b']));
        expect(readStoredStringArray('some-key')).toEqual(['a', 'b']);
    });

    describe('when stored data is malformed', () => {
        let consoleLogSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
        });

        afterEach(() => {
            consoleLogSpy.mockRestore();
        });

        it('returns an empty array when the stored value is corrupt JSON', () => {
            localStorage.setItem('some-key', 'not json');
            expect(readStoredStringArray('some-key')).toEqual([]);
        });

        it('returns an empty array when the stored value is not an array', () => {
            localStorage.setItem('some-key', JSON.stringify({ not: 'an array' }));
            expect(readStoredStringArray('some-key')).toEqual([]);
        });

        it('filters out non-string entries from a mixed-type array', () => {
            localStorage.setItem('some-key', JSON.stringify(['a', 42, null, 'b', {}]));
            expect(readStoredStringArray('some-key')).toEqual(['a', 'b']);
        });
    });
});
