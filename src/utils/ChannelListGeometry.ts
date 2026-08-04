/** The layout values a pointer click has to be resolved against. */
export interface ChannelListMetrics {
    /** Height of the filter rail overlay; rows start this far down. */
    railHeight: number;
    /** Height of one channel row. */
    rowHeight: number;
    /** How far the list is currently scrolled. */
    scrollY: number;
    /** Channels in the active (filtered) view. */
    channelCount: number;
}

/**
 * Which channel row sits at a canvas-relative y, or -1 when the point is not
 * on a row at all — above the first row (the filter rail's band) or past the
 * last channel.
 *
 * This is the exact inverse of ChannelList's getTopFrom(), which places a row
 * at `position * rowHeight + railHeight - scrollY`. The two must stay in step:
 * if the rail's height or the row height changes on one side only, clicks
 * silently select the wrong channel rather than failing loudly.
 */
export const channelPositionAt = (offsetY: number, metrics: ChannelListMetrics): number => {
    const y = offsetY + metrics.scrollY - metrics.railHeight;
    if (y < 0) {
        return -1;
    }
    const position = Math.floor(y / metrics.rowHeight);
    return position < metrics.channelCount ? position : -1;
};
