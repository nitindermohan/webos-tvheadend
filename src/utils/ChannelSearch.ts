/**
 * Matching a typed query against a channel, by name or by number.
 *
 * Kept as plain functions so the rules can be tested directly. Every one of
 * them is a decision about a person standing across a room holding a remote,
 * not a general-purpose search: entering text on a TV is slow enough that each
 * keystroke has to earn its place, so the matching is deliberately forgiving
 * in the directions users are wrong and strict in the ones they are not.
 */

/**
 * The Unicode combining diacritical marks block. NFD splits an accented letter
 * into its base letter followed by one of these, so dropping the range is what
 * turns an accented letter into its unaccented base.
 *
 * Filtered by codepoint rather than matched with a regex range so this file
 * stays pure ASCII. The literal characters render as marks stacked onto
 * whatever precedes them in an editor, which makes the range unreadable in
 * source and one stray keystroke away from silently changing meaning.
 */
const COMBINING_MARKS_FIRST = 0x0300;
const COMBINING_MARKS_LAST = 0x036f;

const isCombiningMark = (character: string): boolean => {
    const code = character.charCodeAt(0);
    return code >= COMBINING_MARKS_FIRST && code <= COMBINING_MARKS_LAST;
};

/**
 * Lower-case and strip diacritics, so `sudwest` finds the channel spelled with
 * a u-umlaut. (Spelled out rather than written: the glyph guard scans whole
 * files, comments included, and holding that line costs less than the parsing
 * an exemption would need.)
 *
 * This is not a nicety for this app. It bundles the latin-ext subset precisely
 * because European lineups carry Polish, Czech and Croatian channel names, and
 * an on-screen keyboard puts `u` with an umlaut several presses further away
 * than `u` - if it offers it at all. Matching without folding would put the
 * channels most in need of search the furthest out of reach.
 */
export const foldForSearch = (value: string): string =>
    Array.from(value.normalize('NFD'))
        .filter((character) => !isCombiningMark(character))
        .join('')
        .toLowerCase()
        .trim();

/** A query of digits only, which is how the user asks for a channel number. */
export const isNumericQuery = (query: string): boolean => /^[0-9]+$/.test(query.trim());

/**
 * Does this channel match the query?
 *
 * An empty query matches everything, so a search filter with nothing typed yet
 * is inert rather than showing an empty lineup.
 *
 * A name matches on substring, not prefix: broadcasters put the distinguishing
 * word last (`SWR BW HD`, `ZDF neo`), and a user hunting for `neo` should not
 * have to know what precedes it.
 *
 * A numeric query matches the channel number by *prefix*, and the name by
 * substring, both. Prefix rather than exact because typing `10` on the way to
 * `105` should keep 105 on screen - an exact match would empty the list at
 * every keystroke but the last. Names are still searched for digits, since `4`
 * should find `Channel 4`.
 */
export const channelMatchesQuery = (name: string, channelNumber: number, query: string): boolean => {
    const folded = foldForSearch(query);
    if (!folded) {
        return true;
    }
    if (foldForSearch(name).indexOf(folded) >= 0) {
        return true;
    }
    return isNumericQuery(folded) && String(channelNumber).startsWith(folded);
};
