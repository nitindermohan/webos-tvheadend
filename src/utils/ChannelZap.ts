export type ZapDirection = 'previous' | 'next';

/** No move is possible - already at the end of the lineup, or there is none. */
export const NO_ZAP = -1;

/**
 * The next channel position for a zap, or NO_ZAP if the edge of the lineup has
 * been reached.
 *
 * Direction is defined against the channel list's own layout, which is the
 * only thing the user can actually see:
 * `getTopFrom(position) = position * rowHeight + railHeight`, so position 0 is
 * the top row and positions increase *downward*. 'previous' is therefore the
 * channel drawn above, position - 1.
 *
 * This matters because arrow up/down and CH+/CH- disagree by design. CH+ means
 * the next channel number, which is further *down* the list - the normal TV
 * convention, and pre-existing behaviour. Arrow up must instead follow what is
 * on screen. Task 13 mapped ARROW_UP onto the CHANNEL_UP body, which made
 * pressing up move down the list.
 *
 * Deliberately does not wrap: it preserves the existing bounds behaviour on
 * live TV, where hitting either end does nothing rather than jumping to the
 * far end of a 1000-channel lineup.
 */
export const nextChannelPosition = (current: number, channelCount: number, direction: ZapDirection): number => {
    if (channelCount <= 0) {
        return NO_ZAP;
    }
    const next = direction === 'next' ? current + 1 : current - 1;
    if (next < 0 || next > channelCount - 1) {
        return NO_ZAP;
    }
    return next;
};
