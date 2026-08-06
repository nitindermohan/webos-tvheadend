/**
 * Where to draw the scroll thumb beside a long list.
 *
 * A 908-channel lineup shows twelve rows at a time, and until now nothing on
 * screen said whether those twelve were near the top, the middle or the end.
 * The channel numbers hint at it, but they are the *server's* numbering, not a
 * position in the filtered view - switch to a category and they stop
 * corresponding to anything.
 *
 * Pure arithmetic, kept out of ChannelList so the two clamps below can be
 * tested without a canvas. Both of them fire in normal use, not just at
 * pathological inputs - see the tests.
 */
export interface ScrollIndicatorMetrics {
    /** Total height of every row in the filtered view. */
    contentHeight: number;
    /** Height of the visible window onto that content. */
    viewportHeight: number;
    /** Current scroll offset, which the caller is allowed to overshoot. */
    scrollY: number;
    /** Height of the track the thumb runs in. */
    trackHeight: number;
    /** Floor on the thumb, so a very long list still leaves something visible. */
    minThumbHeight: number;
}

export interface ScrollThumb {
    top: number;
    height: number;
}

const clamp = (value: number, low: number, high: number): number => Math.min(Math.max(value, low), high);

/**
 * The thumb's position and size, or `undefined` when there is nothing to
 * indicate - the content fits, or the geometry is not known yet.
 *
 * Returning `undefined` rather than a full-height thumb is deliberate: a bar
 * that is always there and always full is a permanent line down the edge of
 * the list carrying no information.
 */
export const scrollThumb = (metrics: ScrollIndicatorMetrics): ScrollThumb | undefined => {
    const { contentHeight, viewportHeight, trackHeight } = metrics;

    if (viewportHeight <= 0 || trackHeight <= 0 || contentHeight <= viewportHeight) {
        return undefined;
    }

    const height = clamp((viewportHeight / contentHeight) * trackHeight, metrics.minThumbHeight, trackHeight);
    const progress = clamp(metrics.scrollY / (contentHeight - viewportHeight), 0, 1);

    // travel is `trackHeight - height`, not `trackHeight`. Scaling by the
    // track alone leaves the thumb short of the bottom by its own height,
    // which is most visible exactly when the thumb has been floored at
    // minThumbHeight and the user has reached the last channel.
    return { top: progress * (trackHeight - height), height };
};
