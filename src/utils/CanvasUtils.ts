import Rect from "../models/Rect";

export interface WriteTextOptions {
    fontSize?: number;
    fillStyle?: string | CanvasGradient | CanvasPattern;
    fontFace?: string;
    textAlign?: CanvasTextAlign;
    textBaseline?: CanvasTextBaseline;
    isBold?: boolean;
    maxWidth?: number;
}

export default class CanvasUtils {
    static MEASURE_STRING = 'One interesting Measure String';

    /**
     * The family every canvas surface draws with, and the one FontReadiness
     * preloads.
     *
     * This used to be the literal 'Moonstone' - an Enact *theme* name, not a
     * family the app ever shipped, so what actually got drawn was whatever
     * webOS fell back to. That was invisible until a missing glyph made it
     * visible: the category caret rendered as a .notdef box on a real C5
     * (fixed in ee48c60). Inter is bundled in the ipk, so both the metrics
     * and the glyph coverage are now ours rather than the TV's.
     *
     * The fallbacks after it matter for one case: a channel name in a script
     * outside Inter's latin/latin-ext subsets. Chromium falls back per glyph,
     * so such a name renders in the system font rather than as boxes.
     */
    static DEFAULT_FONT_FACE = 'Inter';

    /**
     * Memoised per font. The approximation depends only on the font, but it was
     * being recomputed inside getShortenedText - so every truncated label cost
     * two measureText calls (the probe string and the text itself) on every
     * animation frame. measureText is one of the more expensive canvas calls on
     * a TV SoC, and the channel list and EPG both truncate on every visible row.
     *
     * Keyed on canvas.font, so switching font size or family measures once more
     * and then reuses that. The set of fonts this app draws with is tiny and
     * fixed, so the map cannot grow unbounded.
     */
    private static widthPerCharacterByFont: { [font: string]: number } = {};

    /**
     * Return character width approximation of current font
     */
    static getWidthPerCharacter(canvas: CanvasRenderingContext2D) {
        const font = canvas.font;
        const cached = CanvasUtils.widthPerCharacterByFont[font];
        if (cached !== undefined) {
            return cached;
        }
        const width = canvas.measureText(CanvasUtils.MEASURE_STRING).width / CanvasUtils.MEASURE_STRING.length;
        CanvasUtils.widthPerCharacterByFont[font] = width;
        return width;
    }

    /** Test seam: drop the memoised font measurements. */
    static clearFontMetricsCache() {
        CanvasUtils.widthPerCharacterByFont = {};
    }

    /**
     * Faster shortened function with a complexity of 2
     */
    static getShortenedText(canvas: CanvasRenderingContext2D, text: string, maxWidth: number) {
        let result = text;
        // use test character to measure width per character
        const widthPerCharacter = this.getWidthPerCharacter(canvas);
        const textLength = canvas.measureText(result).width;
        if (textLength > maxWidth) {
            const overLength = textLength - maxWidth;
            // if(text.startsWith('Hitler und Luden')) {
            //     console.log('text: "%s" maxWidth: %d, textWidth: %d, deltaWidth: %d, widthPerCharacter: %d, textLength: %d, textOverLength: %d', text, maxWidth, textLength, overLength, widthPerCharacter, result.length, overLength/widthPerCharacter);
            // }
            result = result.substring(0, result.length - 1 - overLength / widthPerCharacter);
            if (result.length <= 3) {
                return '...'.substring(0, result.length);
            }
            result = result.substring(0, result.length - 3) + '...';
        }
        return result;
    }

    /**
     * Wraps a text inside a given area
     */
    static wrapText(
        canvas: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        lineHeight: number
    ) {
        let line = '';
        const widthPerCharacter = this.getWidthPerCharacter(canvas);
        const maxCharactersPerLine = maxWidth / widthPerCharacter - 1;
        let index = 0;
        let newIndex = 0;
        while (index < text.length - 1) {
            newIndex = index + maxCharactersPerLine > text.length ? text.length : index + maxCharactersPerLine;
            line = text.substring(index, newIndex);
            index = newIndex;
            // cutoff leading space
            if (line.startsWith(' ')) {
                line = line.substring(1, line.length - 1);
            }
            // if we reached the end print out the line
            if (index === text.length) {
                canvas.fillText(line, x, y);
                break;
            }
            // lucky we sliced at a space
            if (line.endsWith(' ')) {
                canvas.fillText(line, x, y);
                y += lineHeight;
                continue;
            }
            // go back to find space first space
            for (let i = line.length - 1; i >= 0; i--) {
                if (line[i] === ' ') {
                    canvas.fillText(line.substring(0, i), x, y);
                    y += lineHeight;
                    break;
                }
                index -= 1;
            }
        }
    }

    /**
     * Writes a text to a specific position without changing the canvas context
     */
    static writeText(
        canvas: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        options: WriteTextOptions = {}
    ) {
        // set default options
        options.fontFace = options.fontFace || CanvasUtils.DEFAULT_FONT_FACE;
        options.textAlign = options.textAlign || 'left';
        options.textBaseline = options.textBaseline || 'middle';
        options.fillStyle = options.fillStyle || '#cccccc';
        options.fontSize = options.fontSize || 20;
        options.isBold = options.isBold !== undefined || false;
        options.maxWidth = options.maxWidth || undefined;

        // remember old text style
        const oldFont = canvas.font;
        const oldFillStyle = canvas.fillStyle;
        const oldTextAlign = canvas.textAlign;
        const oldTextBaseline = canvas.textBaseline;

        // set new text style
        canvas.font = options.fontSize + 'px ' + options.fontFace;
        if (options.isBold) {
            canvas.font = 'bold ' + canvas.font;
        }
        canvas.fillStyle = options.fillStyle;
        canvas.textAlign = options.textAlign;
        canvas.textBaseline = options.textBaseline;

        if (options.maxWidth) {
            // fix negative width
            if (options.maxWidth <= 0) {
                options.maxWidth = 0;
                text = '';
            } else {
                text = this.getShortenedText(canvas, text, options.maxWidth);
            }
        }
        canvas.fillText(text, x, y);

        // reset text style
        canvas.font = oldFont;
        canvas.fillStyle = oldFillStyle;
        canvas.textAlign = oldTextAlign;
        canvas.textBaseline = oldTextBaseline;
    }

    static drawDebugRect(canvas: CanvasRenderingContext2D, drawingRect: Rect) {
        canvas.strokeStyle = '#FF0000';
        canvas.strokeRect(drawingRect.left, drawingRect.top, drawingRect.width, drawingRect.height);
    }
}
