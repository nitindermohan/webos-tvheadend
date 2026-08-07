import { DEFAULT_DENSITY, Density, DENSITIES, densityForKey } from './Density';
import { ACCENTS, accentForKey, applyTheme, Palette, THEMES, themeForKey, withAccent } from './Theme';

/**
 * Everything the user can change about how the app looks, in two halves: the
 * *declared* settings, which the settings screen renders without knowing what
 * any of them mean, and `resolveAppearance`, which turns the stored keys into
 * the values the surfaces actually draw with.
 *
 * The split is what keeps the screen from growing a switch statement per
 * option. A setting is a label and a list of choices; adding one is a data
 * change here plus a line in `resolveAppearance` plus a consumer - and the
 * tests fail if the middle step is missed, which is the failure worth
 * guarding: a control that moves, persists, and does nothing.
 *
 * Only keys are persisted, never resolved values. A stored `#3EA6FF` would
 * survive a palette revision and leave one colour from the old theme stranded
 * in the new one; a stored `blue` cannot.
 */
export interface AppearanceChoice {
    /** Persisted. Stable across releases. */
    key: string;
    label: string;
}

export interface AppearanceSetting {
    id: string;
    label: string;
    /** One line under the label. Omitted where the choices speak for themselves. */
    hint?: string;
    choices: AppearanceChoice[];
    defaultKey: string;
}

const ON_OFF: AppearanceChoice[] = [
    { key: 'on', label: 'On' },
    { key: 'off', label: 'Off' }
];

/**
 * Scales text *and* the boxes that hold it, so a larger size gives taller rows
 * rather than text that outgrows its row. That is also why the range stops at
 * 1.3: beyond it a channel row is tall enough that the list shows fewer
 * channels than the compact density was introduced to fix.
 */
export const TEXT_SCALES: { [key: string]: number } = {
    small: 0.9,
    normal: 1,
    large: 1.15,
    largest: 1.3
};

const TEXT_SIZE_CHOICES: AppearanceChoice[] = [
    { key: 'small', label: 'Small' },
    { key: 'normal', label: 'Normal' },
    { key: 'large', label: 'Large' },
    { key: 'largest', label: 'Largest' }
];

/** Hours of programming visible in the guide at once. */
export const EPG_SPANS: { [key: string]: number } = {
    '2': 2,
    '4': 4,
    '6': 6,
    '12': 12
};

const EPG_SPAN_CHOICES: AppearanceChoice[] = [
    { key: '2', label: '2 hours' },
    { key: '4', label: '4 hours' },
    { key: '6', label: '6 hours' },
    { key: '12', label: '12 hours' }
];

export const APPEARANCE_SETTINGS: AppearanceSetting[] = [
    {
        id: 'theme',
        label: 'Theme',
        hint: 'Surfaces and text. OLED black switches those pixels off entirely.',
        choices: THEMES.map((theme) => ({ key: theme.key, label: theme.label })),
        defaultKey: THEMES[0].key
    },
    {
        id: 'accent',
        label: 'Accent colour',
        hint: 'Marks the playing channel and the active category. Never the cursor.',
        choices: ACCENTS.map((accent) => ({ key: accent.key, label: accent.label })),
        defaultKey: 'default'
    },
    {
        id: 'textSize',
        label: 'Text size',
        hint: 'Scales the channel list and the guide, rows included.',
        choices: TEXT_SIZE_CHOICES,
        defaultKey: 'normal'
    },
    {
        id: 'density',
        label: 'Row density',
        hint: 'Compact drops the logo and the programme line to fit twice as many channels.',
        choices: DENSITIES.map((density) => ({ key: density.key, label: density.label })),
        defaultKey: DEFAULT_DENSITY.key
    },
    {
        id: 'channelNumbers',
        label: 'Channel numbers',
        hint: 'Off gives the gutter back to the channel name.',
        choices: ON_OFF,
        defaultKey: 'on'
    },
    {
        id: 'epgSpan',
        label: 'Guide time span',
        hint: 'How much of the evening fits on screen at once.',
        choices: EPG_SPAN_CHOICES,
        defaultKey: '2'
    },
    {
        id: 'gridLines',
        label: 'Guide grid lines',
        choices: ON_OFF,
        defaultKey: 'on'
    }
];

/** settingId -> choice key. What actually goes to localStorage. */
export interface StoredAppearance {
    [settingId: string]: string;
}

/** The resolved values, as the drawing code wants them. */
export interface Appearance {
    /** The chosen theme with the chosen accent already applied. */
    palette: Palette;
    /** Unscaled - `textScale` is applied by each surface. See `scaled`. */
    density: Density;
    textScale: number;
    showChannelNumbers: boolean;
    epgSpanHours: number;
    epgGridLines: boolean;
}

const storedKey = (stored: StoredAppearance, id: string): string | undefined => stored[id];

/**
 * A design-time pixel value at the user's text size.
 *
 * Rounded because a fractional row height accumulates: at 0.9 a 75px guide row
 * becomes 67.5, and thirteen of those put the last row half a pixel out of
 * step with the hit-test that divides by the same number.
 */
export const scaled = (value: number, textScale: number): number => Math.round(value * textScale);

/**
 * Turn stored keys into drawable values, degrading to the default for anything
 * unrecognised - a key from a version the user rolled back from, a
 * hand-edited localStorage entry, or a half-written record.
 */
export const resolveAppearance = (stored: StoredAppearance): Appearance => ({
    palette: withAccent(themeForKey(storedKey(stored, 'theme')), accentForKey(storedKey(stored, 'accent')).color),
    density: densityForKey(storedKey(stored, 'density')),
    textScale: TEXT_SCALES[storedKey(stored, 'textSize') || ''] || TEXT_SCALES.normal,
    // `!== 'off'` rather than `=== 'on'`: an unreadable value should leave the
    // channel numbers on screen, since a user who cannot see them has no way
    // to guess that a setting is what removed them.
    showChannelNumbers: storedKey(stored, 'channelNumbers') !== 'off',
    epgSpanHours: EPG_SPANS[storedKey(stored, 'epgSpan') || ''] || EPG_SPANS['2'],
    epgGridLines: storedKey(stored, 'gridLines') !== 'off'
});

export const DEFAULT_APPEARANCE: Appearance = resolveAppearance({});

/** `--font-scale`, for the stylesheet. See `publishAppearance`. */
export const FONT_SCALE_VARIABLE = '--font-scale';

/**
 * Push an appearance to the two consumers that cannot be handed props.
 *
 * The palette module, because canvas cannot read CSS custom properties and so
 * needs plain strings (see Theme.ts), and the document root, because the
 * stylesheet has no other way to learn the text scale - the DOM rows in the
 * groups column and the settings screen size themselves from it.
 *
 * Called synchronously from the setter rather than from an effect. Effects run
 * child-first, so a provider-level effect would fire *after* every canvas
 * surface had already repainted - once, with the previous palette, and then
 * never again.
 *
 * Notably absent: a CanvasUtils.clearFontMetricsCache() call. The Phase 0
 * flush exists because a measurement taken in the fallback font was cached
 * under the key `32px Inter` and then reused for the real one - same key,
 * wrong answer. A text-size change produces a *different* key (`42px Inter`),
 * so the old entries stay correct for the sizes they describe and the new ones
 * measure themselves. Flushing here would throw away good measurements and
 * make every size change cost a fresh measureText on every visible row.
 */
export const publishAppearance = (appearance: Appearance): void => {
    applyTheme(appearance.palette);
    document.documentElement.style.setProperty(FONT_SCALE_VARIABLE, String(appearance.textScale));
};
