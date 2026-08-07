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

    /**
     * Text and icons drawn *on top of* an accent or focus fill - a focused
     * dropdown row, a selected control.
     *
     * A distinct role rather than reusing `surfaceBase`, even though the two
     * are both near-black here. They diverge the moment a light theme exists:
     * `surfaceBase` becomes white while this must stay dark, because the fills
     * it sits on are amber and blue in every theme.
     */
    textOnAccent: string;

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
    textOnAccent: '#0A0E13',

    danger: '#E0483D',
    favorite: '#FFC53D'
};

/**
 * Cooler and a shade lighter than OLED black, for LCD panels where a true
 * black backlight-bleeds to charcoal anyway and the surfaces need a visible
 * step between them to read as layers at all.
 */
export const SLATE_CYAN: Palette = {
    surfaceBase: '#0B0F14',
    surfaceRaised: '#141B23',
    surfaceCard: '#212C38',

    textPrimary: '#F2F5F8',
    textSecondary: '#93A1B0',
    textMuted: '#5E6C7A',

    accent: '#22D3EE',
    focus: '#FFC53D',
    textOnAccent: '#06131A',

    danger: '#F05252',
    favorite: '#FFC53D'
};

/**
 * Neutral greys with a violet selection - the warmest of the three, and the
 * one that does not tint the video playing behind a translucent overlay.
 */
export const GRAPHITE_VIOLET: Palette = {
    surfaceBase: '#121214',
    surfaceRaised: '#1B1B1F',
    surfaceCard: '#27272E',

    textPrimary: '#F5F5F7',
    textSecondary: '#9B9BA5',
    textMuted: '#6A6A74',

    accent: '#A78BFA',
    focus: '#FFC53D',
    textOnAccent: '#15101F',

    danger: '#E5484D',
    favorite: '#FFC53D'
};

export interface ThemeChoice {
    /** Stable identifier. AppearanceStore persists this string, not the palette. */
    key: string;
    label: string;
    palette: Palette;
}

/**
 * `focus` is amber in all three deliberately. It means "the D-pad cursor is
 * here" and nothing else, so keeping it constant across themes means the one
 * colour the user must be able to find instantly never moves - a theme change
 * restyles the app without relearning where the cursor is.
 */
export const THEMES: ThemeChoice[] = [
    { key: 'oled', label: 'OLED black', palette: OLED_BLACK },
    { key: 'slate', label: 'Slate', palette: SLATE_CYAN },
    { key: 'graphite', label: 'Graphite', palette: GRAPHITE_VIOLET }
];

/**
 * Resolve a persisted key back to its palette, falling back to the first theme
 * for anything unrecognised. Returning undefined instead would stamp every
 * custom property with the empty string - a black-on-black app with no error.
 */
export const themeForKey = (key: string | null | undefined): Palette =>
    (THEMES.find((theme) => theme.key === key) || THEMES[0]).palette;

export interface AccentChoice {
    key: string;
    label: string;
    /** Absent means "whatever the chosen theme uses" - see DEFAULT_ACCENT. */
    color?: string;
}

/**
 * The absence of an override rather than a colour of its own.
 *
 * Storing OLED black's blue as the default would pin that blue into the slate
 * and graphite themes the moment the user switched, so a "default" accent has
 * to mean "ask the palette", not "this particular blue".
 */
export const DEFAULT_ACCENT: AccentChoice = { key: 'default', label: 'Theme default' };

/**
 * Deliberately no amber. `focus` is amber in every theme, and an accent set to
 * match it would make a focused row and a selected row indistinguishable -
 * exactly the confusion the two roles exist to prevent.
 */
export const ACCENTS: AccentChoice[] = [
    DEFAULT_ACCENT,
    { key: 'blue', label: 'Blue', color: '#3EA6FF' },
    { key: 'cyan', label: 'Cyan', color: '#22D3EE' },
    { key: 'violet', label: 'Violet', color: '#A78BFA' },
    { key: 'green', label: 'Green', color: '#4ADE80' },
    { key: 'rose', label: 'Rose', color: '#FB7185' }
];

export const accentForKey = (key: string | null | undefined): AccentChoice =>
    ACCENTS.find((accent) => accent.key === key) || DEFAULT_ACCENT;

/**
 * A palette with its SELECTION colour overridden.
 *
 * `focus` is untouched on purpose: it is the D-pad cursor and belongs to the
 * app's navigation language, not to the user's taste. Letting an accent choice
 * move it would allow the two roles to collide.
 */
export const withAccent = (palette: Palette, color?: string): Palette =>
    color ? { ...palette, accent: color } : { ...palette };

/**
 * `surfaceBase` -> `--surface-base`. Derived rather than listed so that a role
 * added to `Palette` cannot be missed by the stamping loop below.
 */
export const cssVariableName = (role: keyof Palette): string =>
    '--' + role.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());

/** `surfaceBase` -> `--surface-base-rgb`. See `applyTheme`. */
export const rgbVariableName = (role: keyof Palette): string => cssVariableName(role) + '-rgb';

/** `#0E0E11` -> `14, 14, 17`. */
const toRgbChannels = (hex: string): string => {
    const value = hex.replace('#', '');
    const full =
        value.length === 3
            ? value
                  .split('')
                  .map((character) => character + character)
                  .join('')
            : value;
    const number = parseInt(full.slice(0, 6), 16);
    // eslint-disable-next-line no-bitwise
    return [(number >> 16) & 255, (number >> 8) & 255, number & 255].join(', ');
};

/**
 * A role at partial opacity, for canvas.
 *
 * The overlays in this app sit on top of playing video, so translucency is
 * structural rather than decorative - an opaque channel list would hide the
 * thing the user is watching. Canvas needs a complete colour string, so this
 * builds one. `color-mix()` would be the modern answer and is unavailable:
 * webOS runs Chromium 87 and it landed in 111.
 */
export const withAlpha = (color: string, alpha: number): string =>
    `rgba(${toRgbChannels(color)}, ${alpha})`;

let current: Palette = OLED_BLACK;

/**
 * Publish a palette to both consumers. Call once at startup, and again
 * whenever the user picks a different theme.
 *
 * Each role is stamped twice: `--surface-raised` for ordinary use, and
 * `--surface-raised-rgb` holding bare `R, G, B` channels so the stylesheet can
 * write `rgba(var(--surface-raised-rgb), 0.93)`. That indirection is what
 * gives CSS translucency without `color-mix()`, which webOS's Chromium 87
 * does not have.
 */
export const applyTheme = (palette: Palette): void => {
    current = { ...palette };

    const root = document.documentElement;
    (Object.keys(current) as (keyof Palette)[]).forEach((role) => {
        root.style.setProperty(cssVariableName(role), current[role]);
        root.style.setProperty(rgbVariableName(role), toRgbChannels(current[role]));
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

const Theme = {
    OLED_BLACK,
    SLATE_CYAN,
    GRAPHITE_VIOLET,
    THEMES,
    themeForKey,
    ACCENTS,
    DEFAULT_ACCENT,
    accentForKey,
    withAccent,
    applyTheme,
    getTheme,
    cssVariableName,
    rgbVariableName,
    withAlpha
};

export default Theme;
