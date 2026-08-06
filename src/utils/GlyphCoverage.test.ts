import fs from 'fs';
import path from 'path';

/**
 * Symbols are a bet on the font, and this app never places that bet
 * deliberately: it declares no `font-family` for the DOM and asks the canvas
 * for `Moonstone`, so on the TV every glyph resolves against whatever webOS
 * falls back to. That font has no U+25B4/U+25BE (the small triangles the
 * category caret used to use) and Chromium drew the .notdef box on a real C5.
 *
 * So the rule is: UI chrome is drawn in CSS, and the only characters allowed
 * outside ASCII are ones observed rendering on the device. This test is the
 * enforcement - it fails on any new codepoint, which is the prompt to either
 * draw it instead or confirm it on hardware and add it here with a note.
 */
const ALLOWED: { [glyph: string]: string } = {
    // U+2605. Confirmed on the C5: the channel rows draw it as the favourite
    // marker and the category bar carries it in its label.
    '★': 'BLACK STAR',
    // U+2014. General Punctuation, present in every Latin text font.
    '—': 'EM DASH'
};

/**
 * Test files are exempt, because the risk this guard covers - a character the
 * TV's font cannot draw - only exists for characters the app actually renders,
 * and tests render nothing. The exemption is load-bearing rather than
 * convenient: ChannelInitials.test.ts deliberately feeds Cyrillic and Greek
 * channel names in to prove the initials logic degrades instead of throwing,
 * which is precisely the robustness this app needs and precisely what the
 * guard would otherwise forbid writing a test for.
 */
const isTestFile = (file: string) => /\.test\.tsx?$/.test(file);

const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return sourceFiles(full);
        }
        return /\.tsx?$/.test(entry.name) && !isTestFile(entry.name) ? [full] : [];
    });

describe('glyph coverage', () => {
    const root = path.join(__dirname, '..');

    it('scans the source tree', () => {
        // guards the walker itself - an empty list would make every other
        // assertion below pass without looking at anything
        expect(sourceFiles(root).length).toBeGreaterThan(20);
    });

    it('uses no character outside the set confirmed to render on webOS', () => {
        const offenders: string[] = [];

        sourceFiles(root).forEach((file) => {
            fs.readFileSync(file, 'utf8')
                .split('\n')
                .forEach((line, index) => {
                    Array.from(line).forEach((character) => {
                        if (character.charCodeAt(0) < 128 || ALLOWED[character]) {
                            return;
                        }
                        const code = character.codePointAt(0)!.toString(16).toUpperCase();
                        offenders.push(
                            `${path.relative(root, file)}:${index + 1} U+${code} '${character}'`
                        );
                    });
                });
        });

        expect(offenders).toEqual([]);
    });
});
