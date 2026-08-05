import fs from 'fs';
import path from 'path';

/**
 * Colour lives in Theme.ts and nowhere else.
 *
 * Not a style preference - it is what makes a second theme possible at all.
 * The palette has two consumers that cannot share a mechanism (CSS custom
 * properties for the stylesheet, plain strings for the canvas, which cannot
 * read them), so a literal left behind in either half is a colour that will
 * not change when the user picks a different theme. One such literal is
 * invisible in review and obvious on screen.
 *
 * This is the same shape as GlyphCoverage.test.ts, for the same reason: the
 * rule is easy to state, easy to break by accident, and cheap to check.
 */
const COLOUR_PATTERN = /#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/g;

/**
 * `rgba(var(--surface-raised-rgb), 0.92)` is the *tokenised* form, not a
 * literal - it is how the stylesheet gets a translucent role colour without
 * `color-mix()`, which webOS's Chromium 87 lacks. The `var(` is what makes it
 * theme-aware, so a match containing one is exactly what this guard wants to
 * see.
 */
const isTokenised = (literal: string) => literal.includes('var(');

/**
 * The two files allowed to name a colour.
 *
 * `Theme.ts` is the palette itself. `RemoteKeys.ts` holds the physical colours
 * of the legacy remote's colour buttons, which are hardware identity rather
 * than theme: a red button is red in every theme, and routing them through the
 * palette would let a theme switch relabel the legend the info bar draws.
 */
const ALLOWED_FILES = ['utils/Theme.ts', 'utils/RemoteKeys.ts'];

/**
 * Empty, and meant to stay that way.
 *
 * It briefly held the five canvas surfaces so the stylesheet's migration could
 * land green rather than waiting on the whole canvas sweep. Anything added
 * here is a colour that will not follow a theme switch, so a test below fails
 * on a non-empty list - the exemption has to be argued for in review rather
 * than slipped in.
 */
const PENDING_MIGRATION: string[] = [];

/**
 * Test files may name colours freely - they assert on them, and pinning an
 * expected value to a token would make the assertion tautological.
 */
const isTestFile = (file: string) => /\.test\.tsx?$/.test(file);

const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return sourceFiles(full);
        }
        return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
    });

interface Offender {
    location: string;
    literal: string;
}

const findOffenders = (root: string): Offender[] => {
    const offenders: Offender[] = [];

    sourceFiles(root).forEach((file) => {
        const relative = path.relative(root, file);
        if (
            isTestFile(relative) ||
            ALLOWED_FILES.indexOf(relative) >= 0 ||
            PENDING_MIGRATION.indexOf(relative) >= 0
        ) {
            return;
        }

        // A commented-out colour is dead text, not a painted pixel. Block
        // comments are blanked across the whole file rather than per line,
        // because a /* */ pair spanning several lines - which app.css has -
        // would otherwise leave its middle lines looking like live code.
        // Newlines are preserved so reported line numbers stay true.
        const source = fs
            .readFileSync(file, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));

        source.split('\n').forEach((line, index) => {
            const withoutLineComment = line.replace(/(\/\/).*$/, '');
            const matches = withoutLineComment.match(COLOUR_PATTERN);
            matches
                ?.filter((literal) => !isTokenised(literal))
                .forEach((literal) => offenders.push({ location: `${relative}:${index + 1}`, literal }));
        });
    });

    return offenders;
};

describe('theme guards', () => {
    const root = path.join(__dirname, '..');

    it('scans the source tree', () => {
        // without this, a walker that silently returned nothing would make
        // every assertion below pass while checking exactly zero files
        const files = sourceFiles(root);
        expect(files.length).toBeGreaterThan(20);
        expect(files.some((file) => file.endsWith('.css'))).toBe(true);
        expect(files.some((file) => file.endsWith('.tsx'))).toBe(true);
    });

    it('detects a colour literal when there is one', () => {
        // proves the pattern actually matches the shapes this codebase uses,
        // so a clean run below means "none present" rather than "none found"
        expect('color: #ffcc4d;'.match(COLOUR_PATTERN)).toEqual(['#ffcc4d']);
        expect('background: rgba(5, 8, 12, 0.93);'.match(COLOUR_PATTERN)).toEqual(['rgba(5, 8, 12, 0.93)']);
        expect('stroke = rgb(29,170,226)'.match(COLOUR_PATTERN)).toEqual(['rgb(29,170,226)']);
    });

    it('keeps every colour literal in Theme.ts', () => {
        const offenders = findOffenders(root);

        expect(
            offenders.map((offender) => `${offender.location} ${offender.literal}`)
        ).toEqual([]);
    });

    it('exempts nothing from the guard', () => {
        // The migration is finished, so the list is empty and must stay empty.
        // Anything on it is a colour that will not follow a theme switch;
        // failing here forces that exemption to be argued for in review rather
        // than slipped in alongside other work.
        expect(PENDING_MIGRATION).toEqual([]);
    });
});
