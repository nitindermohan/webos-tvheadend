import CanvasUtils from './CanvasUtils';

/**
 * Makes the canvas surfaces wait for the bundled webfont, and repaint once it
 * lands.
 *
 * The DOM handles this by itself - a `@font-face` rule reflows the text when
 * the file arrives. **Canvas does not.** `ctx.font = '32px Inter'` before
 * Inter has loaded silently resolves to the fallback family, draws with it,
 * and nothing tells the canvas to try again.
 *
 * That alone would be a brief flash of the wrong font. What makes it
 * permanent is CanvasUtils.getWidthPerCharacter, which memoises a measured
 * character width **keyed on the `canvas.font` string**. A measurement taken
 * while the fallback was in force gets stored under the key `32px Inter` and
 * reused for the life of the app - so every channel name and event title is
 * truncated against a font that is no longer being drawn. The symptom is
 * subtle (names cut slightly early or late, ellipses in odd places) and there
 * is nothing to point at, which is precisely why it is worth this module.
 *
 * Hence the order below: load, *then* flush the cache, *then* repaint.
 */

/**
 * One spec per weight the canvas draws with. A font face is identified by
 * (family, weight, style) - the size in the shorthand is required for it to
 * parse but plays no part in which file loads, so these two specs cover every
 * call site whatever size it passes. 700 is needed because
 * CanvasUtils.writeText prefixes `bold ` when `isBold` is set.
 */
export const CANVAS_FONT_SPECS = [`400 16px ${CanvasUtils.DEFAULT_FONT_FACE}`, `700 16px ${CanvasUtils.DEFAULT_FONT_FACE}`];

/**
 * Resolves once the canvas may safely measure text, having flushed the stale
 * metrics and invoked `onReady` so the caller can repaint.
 *
 * Never rejects. A font that fails to load is a cosmetic problem - the system
 * fallback is perfectly readable - but a repaint that never fires leaves
 * whatever was drawn during startup frozen on screen, which is a broken
 * display. So every path ends in flush-and-notify.
 */
export const whenFontsReady = async (fonts: FontFaceSet | undefined, onReady: () => void): Promise<void> => {
    if (fonts) {
        try {
            await Promise.all(CANVAS_FONT_SPECS.map((spec) => fonts.load(spec)));
            await fonts.ready;
        } catch (error) {
            console.warn('font loading failed, falling back to the system font', error);
        }
    }

    // Must come after the await. Flushing while the load is still outstanding
    // would clear nothing useful and leave the *next* measurement - still
    // taken against the fallback - to become the permanently cached one.
    CanvasUtils.clearFontMetricsCache();
    onReady();
};

export default whenFontsReady;
