/** The layout values a pointer click has to be resolved against. */
export interface ChannelListMetrics {
    /**
     * How far below the canvas top the first row begins.
     *
     * Zero since the category bar became a column beside the list rather than
     * a band above it - but kept as a parameter rather than dropped, because
     * it is precisely the number that has to agree with ChannelList's
     * getTopFrom, and any header or density change moves it again.
     */
    topOffset: number;
    /** Height of one channel row. */
    rowHeight: number;
    /** How far the list is currently scrolled. */
    scrollY: number;
    /** Channels in the active (filtered) view. */
    channelCount: number;
}

/**
 * Which channel row sits at a canvas-relative y, or -1 when the point is not
 * on a row at all — above the first row or past the last channel.
 *
 * This is the exact inverse of ChannelList's getTopFrom(), which places a row
 * at `position * rowHeight + topOffset - scrollY`. The two must stay in step:
 * if the offset or the row height changes on one side only, clicks silently
 * select the wrong channel rather than failing loudly. That is why they move
 * in the same commit, and why this module exists at all.
 *
 * Horizontal bounds are not this function's concern. Both callers hit-test
 * against the canvas element's own rect, so a click in the groups column
 * beside the list never reaches here.
 */
export const channelPositionAt = (offsetY: number, metrics: ChannelListMetrics): number => {
    const y = offsetY + metrics.scrollY - metrics.topOffset;
    if (y < 0) {
        return -1;
    }
    const position = Math.floor(y / metrics.rowHeight);
    return position < metrics.channelCount ? position : -1;
};

/** What a scroll needs to know to place a cursor row on screen. */
export interface ScrollTargetMetrics {
    rowHeight: number;
    /** Channels in the active (filtered) view. */
    channelCount: number;
    /** Height of the visible window onto the list. */
    viewportHeight: number;
    /** Rows kept above the cursor once the list is scrolling at all. */
    topPadding: number;
}

/**
 * How far the list should be scrolled to show `position` as the cursor row.
 *
 * The cursor sits `topPadding` rows below the top of the screen, except at
 * both ends of the list where the content runs out and the cursor walks the
 * remaining rows instead.
 *
 * This replaces a three-branch version in ChannelList that clamped the bottom
 * to `rowHeight * (channelCount - 2 * topPadding)` - a bound that never
 * consults the viewport and so cannot be right for two different row heights.
 * It was wrong in both directions:
 *
 * - **Too far at the bottom.** At 90px rows the last screen showed two rows of
 *   empty canvas below the final channel; at 48px, where more rows fit, twelve.
 * - **Negative for short lists.** With 8 channels it computed
 *   `rowHeight * (8 - 10)`, pushing every row *down* the canvas and leaving a
 *   band of nothing above the first one. Small categories hit this every time.
 *
 * Clamping to `[0, contentHeight - viewportHeight]` subsumes all three of the
 * old branches and both bugs.
 */
export const scrollTargetFor = (position: number, metrics: ScrollTargetMetrics): number => {
    const contentHeight = metrics.channelCount * metrics.rowHeight;
    const maxScroll = Math.max(0, contentHeight - metrics.viewportHeight);
    const desired = (position - metrics.topPadding) * metrics.rowHeight;

    return Math.min(Math.max(desired, 0), maxScroll);
};
