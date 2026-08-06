/**
 * A short label to stand in for a channel logo that is missing or has not
 * loaded yet.
 *
 * Without one, a channel with no logo draws nothing at all: the right ~120px
 * of the row is simply empty, which on a black background reads as a broken
 * row rather than a channel without artwork. TVheadend lineups routinely have
 * a handful of these - regional and radio services especially - so it is not
 * an edge case.
 *
 * Kept as a pure function so it can be tested against real channel names
 * without a canvas.
 */

/**
 * Words that carry no identity and would otherwise dominate the initials. `HD`
 * in particular is on the end of most German channel names, so keeping it
 * would make half a lineup read as something-H.
 */
const NOISE = ['hd', 'sd', 'uhd', '4k', 'fhd', 'tv', 'channel'];

/**
 * Word separators, listed explicitly rather than as `[^\p{L}\p{N}]`.
 *
 * Unicode property escapes need the `u` flag, and regex literals are *not*
 * transpiled - Babel ships them to the browser verbatim - so with tsconfig's
 * `target: es5` TypeScript rejects them outright. Chromium 87 would in fact
 * run them, but bumping the whole app's target to find out is not a trade
 * worth making for a fallback label. Listing separators inverts the problem:
 * anything not named here counts as a word character, so Cyrillic, Greek and
 * every other script pass through untouched.
 */
const SEPARATORS = /[\s\-_.,:;/\\|()[\]{}'"!?+*&#@~^%$]+/;

const splitWords = (name: string): string[] =>
    name
        .split(SEPARATORS)
        .filter((word) => word.length > 0)
        .filter((word) => NOISE.indexOf(word.toLowerCase()) < 0);

/**
 * Up to two characters identifying the channel: the initials of the first two
 * meaningful words, or the first two characters of a single-word name.
 *
 * Names that are already short acronyms - `ARD`, `ZDF`, `RTL` - come back as
 * the first two letters rather than the whole word, so every fallback is the
 * same width and the column of them stays even.
 *
 * Returns '' when there is nothing usable, and the caller draws nothing rather
 * than an empty box.
 */
export const channelInitials = (name: string): string => {
    const words = splitWords(name || '');

    if (words.length === 0) {
        // every word was noise ('HD') or the name had no letters at all - fall
        // back to the raw name so something identifying still shows
        const bare = (name || '').split(SEPARATORS).join('');
        return bare.slice(0, 2).toUpperCase();
    }

    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }

    return (words[0][0] + words[1][0]).toUpperCase();
};
