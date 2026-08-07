import {
    APPEARANCE_SETTINGS,
    Appearance,
    DEFAULT_APPEARANCE,
    EPG_SPANS,
    FONT_SCALE_VARIABLE,
    TEXT_SCALES,
    publishAppearance,
    resolveAppearance,
    scaled
} from './Appearance';
import { COMPACT, LIST } from './Density';
import { GRAPHITE_VIOLET, OLED_BLACK, SLATE_CYAN, getTheme } from './Theme';

/**
 * Two failures matter here and neither is loud.
 *
 * A setting that the screen renders but `resolveAppearance` ignores is a
 * control that moves, persists, and changes nothing - the user concludes the
 * app is broken, and nothing in the code looks wrong. And a stored value that
 * fails to parse must land on the default rather than `undefined`, because
 * `undefined` reaches the canvas as a fillStyle or a row height and produces
 * an invisible or infinitely tall list rather than an error.
 */
describe('Appearance', () => {
    describe('the declared settings', () => {
        it('declares every option the plan calls for', () => {
            // A tripwire, deliberately brittle. Adding a setting has to be a
            // considered act: the generic tests below cover the mechanics, but
            // nothing else forces a new option to be wired to a consumer, and
            // an unconsumed setting is invisible in review.
            expect(APPEARANCE_SETTINGS.map((setting) => setting.id)).toEqual([
                'theme',
                'accent',
                'textSize',
                'density',
                'channelNumbers',
                'epgSpan',
                'gridLines'
            ]);
        });

        it('gives every setting a unique id, a label, and at least two choices', () => {
            const ids = APPEARANCE_SETTINGS.map((setting) => setting.id);
            expect(new Set(ids).size).toBe(ids.length);

            APPEARANCE_SETTINGS.forEach((setting) => {
                expect(setting.label).not.toBe('');
                // one choice is not a setting, it is a constant with a row
                expect(setting.choices.length).toBeGreaterThan(1);
            });
        });

        it('gives every choice a unique key and a label', () => {
            APPEARANCE_SETTINGS.forEach((setting) => {
                const keys = setting.choices.map((choice) => choice.key);
                // a duplicate key makes one of the two choices unreachable:
                // selecting it stores a key that resolves to the other
                expect(new Set(keys).size).toBe(keys.length);
                setting.choices.forEach((choice) => expect(choice.label).not.toBe(''));
            });
        });

        it('points every default at a choice that exists', () => {
            APPEARANCE_SETTINGS.forEach((setting) => {
                const keys = setting.choices.map((choice) => choice.key);
                // otherwise the screen opens with nothing highlighted and the
                // first left/right press jumps somewhere arbitrary
                expect(keys).toContain(setting.defaultKey);
            });
        });
    });

    describe('resolveAppearance', () => {
        it('resolves an empty record to the defaults', () => {
            // first launch, and every launch after a cleared cache
            expect(resolveAppearance({})).toEqual(DEFAULT_APPEARANCE);
            expect(DEFAULT_APPEARANCE.palette).toEqual(OLED_BLACK);
            expect(DEFAULT_APPEARANCE.density).toBe(LIST);
            expect(DEFAULT_APPEARANCE.textScale).toBe(1);
            expect(DEFAULT_APPEARANCE.showChannelNumbers).toBe(true);
            expect(DEFAULT_APPEARANCE.epgSpanHours).toBe(2);
            expect(DEFAULT_APPEARANCE.epgGridLines).toBe(true);
        });

        it('resolves each stored key to its value', () => {
            expect(resolveAppearance({ theme: 'slate' }).palette).toEqual(SLATE_CYAN);
            expect(resolveAppearance({ theme: 'graphite' }).palette).toEqual(GRAPHITE_VIOLET);
            expect(resolveAppearance({ density: 'compact' }).density).toBe(COMPACT);
            expect(resolveAppearance({ textSize: 'largest' }).textScale).toBe(TEXT_SCALES.largest);
            expect(resolveAppearance({ channelNumbers: 'off' }).showChannelNumbers).toBe(false);
            expect(resolveAppearance({ epgSpan: '12' }).epgSpanHours).toBe(12);
            expect(resolveAppearance({ gridLines: 'off' }).epgGridLines).toBe(false);
        });

        it('applies the accent on top of the chosen theme', () => {
            const resolved = resolveAppearance({ theme: 'slate', accent: 'rose' });

            expect(resolved.palette.surfaceBase).toBe(SLATE_CYAN.surfaceBase);
            expect(resolved.palette.accent).not.toBe(SLATE_CYAN.accent);
            // the cursor colour belongs to the app, not to the accent choice
            expect(resolved.palette.focus).toBe(SLATE_CYAN.focus);
        });

        it('leaves the theme accent alone when the accent is the default', () => {
            expect(resolveAppearance({ theme: 'graphite', accent: 'default' }).palette).toEqual(GRAPHITE_VIOLET);
        });

        it('wires every setting to a resolved value', () => {
            // The failure this exists for: a setting rendered by the screen
            // that resolveAppearance never reads. It stores fine, it shows the
            // choice back, and nothing on screen changes.
            //
            // `accent` is exempt because a choice may legitimately resolve to
            // the colour the theme already uses - picking Violet under the
            // graphite theme is a genuine no-op, so "changed something" is the
            // wrong question for it. It has its own tests above.
            APPEARANCE_SETTINGS.filter((setting) => setting.id !== 'accent').forEach((setting) => {
                setting.choices
                    .filter((choice) => choice.key !== setting.defaultKey)
                    .forEach((choice) => {
                        expect(resolveAppearance({ [setting.id]: choice.key })).not.toEqual(DEFAULT_APPEARANCE);
                    });
            });
        });

        it('degrades every unrecognised value to its default', () => {
            // a key from a newer version the user rolled back from, or a
            // hand-edited localStorage entry.
            //
            // DEFAULT_APPEARANCE is itself produced by resolveAppearance, so
            // this comparison cannot see a default that moved - both sides move
            // with it. The literal values are pinned in the first test of this
            // block, which is what anchors this one.
            const garbage = APPEARANCE_SETTINGS.reduce(
                (record, setting) => ({ ...record, [setting.id]: 'nonsense' }),
                {}
            );

            expect(resolveAppearance(garbage)).toEqual(DEFAULT_APPEARANCE);
        });

        it('degrades a half-written record without touching the rest', () => {
            const resolved = resolveAppearance({ theme: 'slate', density: 'nonsense', epgSpan: '' });

            expect(resolved.palette).toEqual(SLATE_CYAN);
            expect(resolved.density).toBe(LIST);
            expect(resolved.epgSpanHours).toBe(2);
        });

        it('never resolves a value to undefined', () => {
            // undefined is the dangerous outcome, not a wrong value: it reaches
            // canvas as a fillStyle (silently ignored, invisible text) or as a
            // row height (NaN geometry, a list that draws nothing)
            const resolved = resolveAppearance({ theme: '', accent: '', textSize: '', density: '', epgSpan: '' });

            (Object.keys(resolved) as (keyof Appearance)[]).forEach((role) => {
                expect(resolved[role]).toBeDefined();
            });
            expect(Number.isFinite(resolved.textScale)).toBe(true);
            expect(Number.isFinite(resolved.epgSpanHours)).toBe(true);
        });
    });

    describe('the scales themselves', () => {
        it('keeps normal at exactly 1', () => {
            // anything else silently rescales the whole app for a user who
            // never opened the settings screen
            expect(TEXT_SCALES.normal).toBe(1);
        });

        it('offers a scale for every text size choice', () => {
            const setting = APPEARANCE_SETTINGS.find((entry) => entry.id === 'textSize');
            setting?.choices.forEach((choice) => {
                expect(typeof TEXT_SCALES[choice.key]).toBe('number');
                expect(TEXT_SCALES[choice.key]).toBeGreaterThan(0);
            });
        });

        it('offers a span for every guide span choice', () => {
            const setting = APPEARANCE_SETTINGS.find((entry) => entry.id === 'epgSpan');
            setting?.choices.forEach((choice) => {
                expect(EPG_SPANS[choice.key]).toBeGreaterThan(0);
            });
        });
    });

    describe('publishAppearance', () => {
        afterEach(() => {
            document.documentElement.removeAttribute('style');
            publishAppearance(DEFAULT_APPEARANCE);
        });

        it('hands the palette to the module canvas reads', () => {
            // canvas cannot read CSS custom properties, so stamping alone
            // would theme the stylesheet and leave every canvas surface
            // painting the previous palette
            publishAppearance(resolveAppearance({ theme: 'graphite' }));

            expect(getTheme()).toEqual(GRAPHITE_VIOLET);
        });

        it('stamps the text scale for the stylesheet', () => {
            publishAppearance(resolveAppearance({ textSize: 'largest' }));

            expect(document.documentElement.style.getPropertyValue(FONT_SCALE_VARIABLE)).toBe(
                String(TEXT_SCALES.largest)
            );
        });

        it('publishes the accent, not just the theme', () => {
            publishAppearance(resolveAppearance({ theme: 'oled', accent: 'rose' }));

            expect(getTheme().accent).not.toBe(OLED_BLACK.accent);
            expect(document.documentElement.style.getPropertyValue('--accent')).toBe(getTheme().accent);
        });
    });

    describe('scaled', () => {
        it('returns whole pixels', () => {
            // a fractional row height accumulates down a long list until the
            // drawn row and the row the hit-test computes are different rows
            expect(scaled(75, 0.9)).toBe(68);
            expect(scaled(100, 1.152)).toBe(115);
            // Every combination, not a sampled few - a row height that is a
            // whole number at one scale and not at the next is the case that
            // would slip through. 90 x 1.15 deliberately is not asserted as a
            // value: it is 103.49999999999999 in binary floating point, so it
            // rounds *down*, and pinning either answer would be pinning IEEE
            // 754 rather than this function.
            [48, 75, 90, 114, 150].forEach((value) => {
                Object.values(TEXT_SCALES).forEach((scale) => {
                    expect(Number.isInteger(scaled(value, scale))).toBe(true);
                });
            });
        });

        it('is the identity at normal size', () => {
            [48, 75, 90, 114, 42].forEach((value) => {
                expect(scaled(value, TEXT_SCALES.normal)).toBe(value);
            });
        });
    });
});
