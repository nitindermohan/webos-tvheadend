/**
 * The single source of truth for colour.
 *
 * This is a module rather than a block of `:root` custom properties in
 * app.css because the palette has two consumers that share nothing: the
 * stylesheet, and the canvas draw code in ChannelList / TVGuide / ChannelInfo
 * / RecordingList / ChannelHeader. **Canvas cannot read CSS custom
 * properties** - `ctx.fillStyle = 'var(--accent)'` is silently ignored, not an
 * error - so a stylesheet-only approach would tokenise half the app and leave
 * the other half hardcoded. `applyTheme` therefore does both jobs: it stamps
 * the properties for CSS *and* keeps the plain strings for canvas.
 *
 * Roles are named for what they mean, never for what colour they are. A
 * future light theme has to be able to set `surfaceBase` to white without the
 * token becoming a lie - which is also why nothing outside `index.tsx` and
 * the tests imports a palette constant directly. Everything else calls
 * `getTheme()`, so adding a second theme stays a data change.
 */
export interface Palette {
    /** The page itself. `#000` on OLED means those pixels are physically off. */
    surfaceBase: string;
    /** Lifted off the base: groups column, info bar, panels. */
    surfaceRaised: string;
    /** Lifted again: the focused or selected row's fill. */
    surfaceCard: string;

    textPrimary: string;
    textSecondary: string;
    /** Disabled and placeholder text. */
    textMuted: string;

    /**
     * SELECTION - the active filter, the playing channel. Never used for the
     * cursor.
     */
    accent: string;
    /**
     * FOCUS - where the D-pad cursor is, and nothing else. Before this module
     * existed the same amber also marked favourites, the "new" badge and the
     * empty-list banner; four meanings for one colour is the main reason the
     * UI read as busy rather than deliberate.
     */
    focus: string;

    /** Recording markers and the record dot. */
    danger: string;
    /**
     * The favourite star. Deliberately the same hue as `focus` - it is the
     * one exception, and it earns it by being a persistent state marker
     * rather than a transient cursor, so the two never compete for the same
     * pixel.
     */
    favorite: string;
}

export const OLED_BLACK: Palette = {
    surfaceBase: '#000000',
    surfaceRaised: '#0E0E11',
    surfaceCard: '#1C1C21',

    textPrimary: '#FFFFFF',
    textSecondary: '#8A8F98',
    textMuted: '#5A5F68',

    accent: '#3EA6FF',
    focus: '#FFC53D',

    danger: '#E0483D',
    favorite: '#FFC53D'
};

/**
 * `surfaceBase` -> `--surface-base`. Derived rather than listed so that a role
 * added to `Palette` cannot be missed by the stamping loop below.
 */
export const cssVariableName = (role: keyof Palette): string =>
    '--' + role.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());

let current: Palette = OLED_BLACK;

/**
 * Publish a palette to both consumers. Call once at startup, and again
 * whenever the user picks a different theme.
 */
export const applyTheme = (palette: Palette): void => {
    current = { ...palette };

    const root = document.documentElement;
    (Object.keys(current) as (keyof Palette)[]).forEach((role) => {
        root.style.setProperty(cssVariableName(role), current[role]);
    });
};

/**
 * The palette in force. Canvas code must call this *inside* its draw call
 * rather than caching the result at module scope, or a theme switch will keep
 * painting the old colours until the page reloads.
 *
 * Returns a copy: a caller that mutated the result would silently corrupt the
 * palette for everything drawn afterwards, and canvas ignores an invalid
 * fillStyle rather than throwing, so the damage would show up as missing text
 * rather than an error.
 */
export const getTheme = (): Palette => ({ ...current });

const Theme = { OLED_BLACK, applyTheme, getTheme, cssVariableName };

export default Theme;
