import { selectedChoiceIndex } from './AppearanceSettings';
import { APPEARANCE_SETTINGS, AppearanceSetting } from '../utils/Appearance';

const settingFor = (id: string): AppearanceSetting =>
    APPEARANCE_SETTINGS.find((setting) => setting.id === id) as AppearanceSetting;

/**
 * The screen has one piece of logic worth testing on its own: which choice it
 * shows as selected. Getting it wrong does not break anything, it *lies* -
 * the strip highlights one value while the app draws another, and the user
 * presses right to fix it and lands two choices away from where they aimed.
 */
describe('selectedChoiceIndex', () => {
    it('finds the stored choice', () => {
        const theme = settingFor('theme');
        theme.choices.forEach((choice, index) => {
            expect(selectedChoiceIndex(theme, { theme: choice.key })).toBe(index);
        });
    });

    it('falls back to the default rather than to the first choice', () => {
        // These are different for channelNumbers: its default is `on`, which
        // is first, and for a setting whose default is not first the two
        // answers diverge. Asserted against every setting so that reordering a
        // choice list cannot quietly reintroduce the bug.
        APPEARANCE_SETTINGS.forEach((setting) => {
            const expected = setting.choices.findIndex((choice) => choice.key === setting.defaultKey);
            expect(selectedChoiceIndex(setting, {})).toBe(expected);
        });
    });

    it('falls back for an unrecognised stored key', () => {
        // must agree with resolveAppearance, which degrades the same way -
        // otherwise the strip shows one thing and the app draws another
        APPEARANCE_SETTINGS.forEach((setting) => {
            const expected = setting.choices.findIndex((choice) => choice.key === setting.defaultKey);
            expect(selectedChoiceIndex(setting, { [setting.id]: 'nonsense' })).toBe(expected);
        });
    });

    it('never returns an index outside the choice list', () => {
        // a defaultKey that stopped matching would make findIndex return -1,
        // and -1 as an array index highlights nothing at all
        APPEARANCE_SETTINGS.forEach((setting) => {
            [{}, { [setting.id]: 'nonsense' }, { [setting.id]: '' }].forEach((stored) => {
                const index = selectedChoiceIndex(setting, stored);
                expect(index).toBeGreaterThanOrEqual(0);
                expect(index).toBeLessThan(setting.choices.length);
            });
        });
    });

    it('reads only its own setting', () => {
        // one record holds all seven, so a lookup keyed on anything but
        // setting.id would show a neighbour's choice
        const density = settingFor('density');
        expect(selectedChoiceIndex(density, { theme: 'slate', density: 'compact' })).toBe(
            density.choices.findIndex((choice) => choice.key === 'compact')
        );
    });
});
