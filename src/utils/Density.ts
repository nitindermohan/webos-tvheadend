/**
 * How tall a channel row is, and what fits in it.
 *
 * The channel list drew every row at a hardcoded 90px with a logo and a
 * programme line. That is the right shape for browsing a curated lineup and
 * the wrong one for finding a channel in 908 of them, where twelve rows on
 * screen means seventy-six pages of scrolling.
 *
 * Kept as a descriptor rather than a single `rowHeight` number because the
 * text sizes and what gets drawn are not independent choices - a 90px row's
 * 32px name in a 48px row leaves four pixels of breathing room, and a logo
 * scaled to a 48px row is too small to recognise, which is the whole reason
 * COMPACT drops it rather than shrinking it.
 *
 * Horizontal geometry is deliberately *not* in here. Both densities share the
 * same column positions, so switching between them changes the rhythm of the
 * list without reshuffling it sideways - the channel numbers and names stay
 * exactly where the eye left them.
 */
export type DensityKey = 'list' | 'compact';

export interface Density {
    /** Stable identifier. Phase 4 persists this string, not the object. */
    key: DensityKey;
    /** For the appearance settings screen. */
    label: string;
    rowHeight: number;
    nameTextSize: number;
    numberTextSize: number;
    /**
     * Compact rows are channel number and name only.
     *
     * One flag rather than separate showLogo/showEventLine switches: they are
     * not independently meaningful. A row with a logo but no programme line
     * would leave the logo floating against empty space, and a programme line
     * with no logo wastes the vertical room the line needs. The two travel
     * together, so they are one decision.
     */
    isCompact: boolean;
}

/** The original shape: logo, channel name, and the programme now showing. */
export const LIST: Density = {
    key: 'list',
    label: 'List',
    rowHeight: 90,
    nameTextSize: 32,
    numberTextSize: 38,
    isCompact: false
};

/**
 * Number and name only, at roughly half the height - 22 rows on a 1080 screen
 * against LIST's 12.
 */
export const COMPACT: Density = {
    key: 'compact',
    label: 'Compact',
    rowHeight: 48,
    nameTextSize: 26,
    numberTextSize: 28,
    isCompact: true
};

export const DENSITIES: Density[] = [LIST, COMPACT];

export const DEFAULT_DENSITY = LIST;

/**
 * Resolve a persisted key back to a descriptor, falling back to the default
 * for anything unrecognised - an old key, a hand-edited localStorage value, or
 * a key from a future version the user has rolled back from.
 */
export const densityForKey = (key: string | null | undefined): Density =>
    DENSITIES.find((density) => density.key === key) || DEFAULT_DENSITY;
