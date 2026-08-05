import CanvasUtils from './CanvasUtils';
import { CANVAS_FONT_SPECS, whenFontsReady } from './FontReadiness';

/**
 * The bug this module exists to prevent is silent and permanent, so these
 * tests are mostly about *ordering*. Canvas does not participate in CSS font
 * loading: `ctx.font = '32px Inter'` before Inter has arrived draws in the
 * fallback and nothing repaints when the real font lands. Worse,
 * CanvasUtils memoises character widths keyed on the `canvas.font` string, so
 * a fallback measurement gets cached under `32px Inter` and reused forever -
 * every channel name and event title truncated against the wrong metrics for
 * the life of the app.
 */
const fakeFontSet = () => {
    const loaded: string[] = [];
    let resolveReady: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => {
        resolveReady = resolve;
    });

    return {
        loaded,
        settle: () => {
            resolveReady();
            return ready;
        },
        set: {
            load: (spec: string) => {
                loaded.push(spec);
                return Promise.resolve([]);
            },
            ready
        } as unknown as FontFaceSet
    };
};

describe('FontReadiness', () => {
    beforeEach(() => {
        CanvasUtils.clearFontMetricsCache();
    });

    describe('CANVAS_FONT_SPECS', () => {
        it('covers every weight the canvas draws with', () => {
            // A font face is (family, weight, style) - size plays no part in
            // which file loads, so one spec per weight covers every call site
            // whatever size it asks for. Both weights are needed: writeText
            // prefixes 'bold ' when isBold is set.
            expect(CANVAS_FONT_SPECS.some((spec) => spec.includes('400'))).toBe(true);
            expect(CANVAS_FONT_SPECS.some((spec) => spec.includes('700'))).toBe(true);
        });

        it('names the family the canvas actually asks for', () => {
            CANVAS_FONT_SPECS.forEach((spec) => {
                expect(spec).toContain(CanvasUtils.DEFAULT_FONT_FACE);
                // a spec without a size is not a valid font shorthand and
                // document.fonts.load rejects it
                expect(spec).toMatch(/\d+px/);
            });
        });
    });

    describe('whenFontsReady', () => {
        it('asks for every spec', async () => {
            const fake = fakeFontSet();
            const pending = whenFontsReady(fake.set, () => undefined);
            await fake.settle();
            await pending;

            expect(fake.loaded).toEqual(CANVAS_FONT_SPECS);
        });

        it('flushes the metrics cache only after the fonts have resolved', async () => {
            const fake = fakeFontSet();
            const order: string[] = [];

            const spy = jest.spyOn(CanvasUtils, 'clearFontMetricsCache').mockImplementation(() => {
                order.push('flush');
            });

            const pending = whenFontsReady(fake.set, () => order.push('notify'));

            // the load is outstanding: flushing here would cache-bust nothing
            // and let the *next* measurement - still against the fallback -
            // become the permanent one
            expect(order).toEqual([]);

            await fake.settle();
            await pending;

            expect(order).toEqual(['flush', 'notify']);
            spy.mockRestore();
        });

        it('notifies exactly once', async () => {
            const fake = fakeFontSet();
            const onReady = jest.fn();

            const pending = whenFontsReady(fake.set, onReady);
            await fake.settle();
            await pending;

            expect(onReady).toHaveBeenCalledTimes(1);
        });

        it('still flushes and notifies when a font fails to load', async () => {
            // webOS could refuse the file, or the subset could be missing. The
            // app must not be left waiting forever for a repaint that never
            // comes - falling back to a system font is a cosmetic problem, a
            // canvas that never redraws is a broken screen.
            const failing = {
                load: () => Promise.reject(new Error('no such font')),
                ready: Promise.resolve()
            } as unknown as FontFaceSet;
            const onReady = jest.fn();

            await whenFontsReady(failing, onReady);

            expect(onReady).toHaveBeenCalledTimes(1);
        });

        it('does nothing but notify when the browser has no font loading API', async () => {
            // Chromium 87 on webOS has document.fonts, but a jsdom test
            // environment or an older engine may not. Guarding here keeps the
            // caller from having to.
            const onReady = jest.fn();

            await whenFontsReady(undefined, onReady);

            expect(onReady).toHaveBeenCalledTimes(1);
        });
    });
});
