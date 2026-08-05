/** No row can be focused - the list is empty. */
export const NO_INDEX = -1;

/**
 * Move a focus cursor through a vertical list, wrapping at both ends.
 *
 * Wrapping is right for these lists and wrong for the channel lineup: a
 * category dropdown or the EPG's category sidebar holds a handful of rows that
 * all fit on screen, so falling off the bottom onto the top is obvious and
 * saves a long walk back. `nextChannelPosition` deliberately does not wrap for
 * the opposite reason - jumping between the ends of a 1000-channel lineup is a
 * lost place, not a shortcut.
 *
 * An out-of-range `current` (a filter that is no longer offered, so its index
 * came back as -1) is treated as position 0, so the first press lands somewhere
 * sensible rather than nowhere.
 */
export const wrapIndex = (current: number, count: number, delta: number): number => {
    if (count <= 0) {
        return NO_INDEX;
    }
    const start = current >= 0 && current < count ? current : 0;
    return (((start + delta) % count) + count) % count;
};
