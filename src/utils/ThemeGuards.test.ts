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

/** Theme.ts is where the literals are supposed to be. */
const ALLOWED_FILES = ['utils/Theme.ts'];

/**
 * Canvas surfaces not yet migrated. This list only ever shrinks - it exists so
 * the stylesheet's migration could land green rather than sitting behind the
 * whole canvas sweep, and a test below fails if it is still non-empty once the
 * sweep is done. Adding a file here would be a way to silence the guard, so
 * treat any growth as a mistake.
 */
const PENDING_MIGRATION = [
    'components/ChannelInfo.tsx',
    'components/TVGuide.tsx',
    'components/RecordingList.tsx',
    'components/ChannelList.tsx',
    'components/ChannelHeader.tsx',
    'utils/CanvasUtils.ts'
];

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

    it('still has every file on the pending list', () => {
        // A pending file that no longer exists, or has been renamed, would sit
        // in the list forever exempting nothing while looking like real work
        // outstanding. Delete it from the list when its migration lands.
        PENDING_MIGRATION.forEach((relative) => {
            expect(fs.existsSync(path.join(root, relative))).toBe(true);
        });
    });
});
