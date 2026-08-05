import CanvasUtils from './CanvasUtils';

/**
 * Minimal stand-in for CanvasRenderingContext2D that counts measureText calls.
 * Width is proportional to length and scales with the font, so a font change
 * produces a genuinely different measurement rather than a coincidence.
 */
const fakeCanvas = () => {
    const state = {
        font: '20px sans-serif',
        measureCalls: 0
    };
    const canvas = {
        get font() {
            return state.font;
        },
        set font(value: string) {
            state.font = value;
        },
        measureText(text: string) {
            state.measureCalls++;
            const size = parseInt(state.font, 10) || 10;
            return { width: text.length * size * 0.5 };
        }
    };
    return { canvas: (canvas as unknown) as CanvasRenderingContext2D, state };
};

describe('CanvasUtils.getWidthPerCharacter', () => {
    beforeEach(() => CanvasUtils.clearFontMetricsCache());

    it('measures once and reuses the result for the same font', () => {
        const { canvas, state } = fakeCanvas();

        const first = CanvasUtils.getWidthPerCharacter(canvas);
        for (let i = 0; i < 50; i++) {
            CanvasUtils.getWidthPerCharacter(canvas);
        }

        expect(state.measureCalls).toBe(1);
        expect(CanvasUtils.getWidthPerCharacter(canvas)).toBe(first);
    });

    it('re-measures when the font changes, and caches each font separately', () => {
        const { canvas, state } = fakeCanvas();

        const small = CanvasUtils.getWidthPerCharacter(canvas);
        canvas.font = '40px sans-serif';
        const large = CanvasUtils.getWidthPerCharacter(canvas);

        expect(state.measureCalls).toBe(2);
        expect(large).toBeGreaterThan(small);

        // both fonts now cached - going back and forth measures no more
        canvas.font = '20px sans-serif';
        expect(CanvasUtils.getWidthPerCharacter(canvas)).toBe(small);
        canvas.font = '40px sans-serif';
        expect(CanvasUtils.getWidthPerCharacter(canvas)).toBe(large);
        expect(state.measureCalls).toBe(2);
    });

    it('returns a per-character width, not the width of the probe string', () => {
        const { canvas } = fakeCanvas();
        // fake measures length * fontSize * 0.5, so per character is fontSize * 0.5
        expect(CanvasUtils.getWidthPerCharacter(canvas)).toBeCloseTo(10);
    });

    it('clearFontMetricsCache forces a fresh measurement', () => {
        const { canvas, state } = fakeCanvas();

        CanvasUtils.getWidthPerCharacter(canvas);
        expect(state.measureCalls).toBe(1);

        CanvasUtils.clearFontMetricsCache();
        CanvasUtils.getWidthPerCharacter(canvas);
        expect(state.measureCalls).toBe(2);
    });
});
