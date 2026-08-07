import AppearanceStore, { STORAGE_KEY_APPEARANCE } from './AppearanceStore';
import { APPEARANCE_SETTINGS, DEFAULT_APPEARANCE } from './Appearance';

describe('AppearanceStore', () => {
    beforeEach(() => localStorage.clear());

    describe('reading', () => {
        it('returns an empty record when nothing is stored', () => {
            // first launch. Must not throw and must not invent keys - an empty
            // record is what resolveAppearance turns into the defaults.
            expect(AppearanceStore.read()).toEqual({});
        });

        it('returns what was written', () => {
            AppearanceStore.write({ theme: 'slate', density: 'compact' });
            expect(AppearanceStore.read()).toEqual({ theme: 'slate', density: 'compact' });
        });

        it('degrades to an empty record on unparseable data', () => {
            // the same rule StoredStringArray follows: a corrupt value costs
            // the user their settings, never the app its startup
            localStorage.setItem(STORAGE_KEY_APPEARANCE, '{not json');
            expect(AppearanceStore.read()).toEqual({});
        });

        it('degrades on a value that parses but is not a record', () => {
            // The non-empty array is the one that matters. `typeof []` is
            // 'object', so without an explicit Array.isArray guard a stored
            // `["slate"]` walks its indices and yields the record `{0: 'slate'}`
            // - which resolves to the defaults, but is then written back on the
            // next save as a shape nothing will ever read again. An empty array
            // degrades correctly either way and proves nothing.
            ['["slate","compact"]', '[]', '"slate"', '42', 'null', 'true'].forEach((raw) => {
                localStorage.setItem(STORAGE_KEY_APPEARANCE, raw);
                expect(AppearanceStore.read()).toEqual({});
            });
        });

        it('drops entries that are not strings, keeping the rest', () => {
            // one bad entry must not cost the user the other six. Only keys
            // survive to be resolved, and a non-string key would reach
            // resolveAppearance's lookups as an object.
            localStorage.setItem(
                STORAGE_KEY_APPEARANCE,
                JSON.stringify({ theme: 'slate', density: { key: 'compact' }, textSize: 7, gridLines: 'off' })
            );

            expect(AppearanceStore.read()).toEqual({ theme: 'slate', gridLines: 'off' });
        });
    });

    describe('writing', () => {
        it('replaces the stored record rather than merging into it', () => {
            AppearanceStore.write({ theme: 'slate', density: 'compact' });
            AppearanceStore.write({ theme: 'graphite' });

            // the screen always holds the whole record, so a merge here would
            // make a setting impossible to return to its default
            expect(AppearanceStore.read()).toEqual({ theme: 'graphite' });
        });

        it('survives a storage that refuses the write', () => {
            // webOS clears localStorage under memory pressure and can report a
            // quota error. Losing the setting is acceptable; taking down the
            // settings screen mid-change is not.
            const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });

            expect(() => AppearanceStore.write({ theme: 'slate' })).not.toThrow();

            setItem.mockRestore();
        });
    });

    describe('the settings it round-trips', () => {
        it('carries every declared setting through storage', () => {
            // proves the store is generic over the settings rather than
            // knowing a hardcoded subset of the keys
            const everything = APPEARANCE_SETTINGS.reduce(
                (record, setting) => ({ ...record, [setting.id]: setting.choices[1].key }),
                {}
            );

            AppearanceStore.write(everything);

            expect(AppearanceStore.read()).toEqual(everything);
        });

        it('resolves a stored record back to something different from the defaults', () => {
            // end to end: written, read back, and actually resolved. Catches a
            // store that persists faithfully into keys nothing resolves.
            AppearanceStore.write({ theme: 'graphite', textSize: 'largest', density: 'compact' });

            expect(AppearanceStore.resolved()).not.toEqual(DEFAULT_APPEARANCE);
            expect(AppearanceStore.resolved().textScale).toBeGreaterThan(1);
        });

        it('resolves to the defaults when storage is empty', () => {
            expect(AppearanceStore.resolved()).toEqual(DEFAULT_APPEARANCE);
        });
    });
});
