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
