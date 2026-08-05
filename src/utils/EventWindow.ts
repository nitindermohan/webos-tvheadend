/**
 * A channel's EPG events arrive ordered by start time. Once a visible event has
 * been seen and a non-visible one follows, every later event is also outside
 * the window, so the walk can stop there.
 *
 * TVGuide expressed this with `return` inside a `forEach` callback, which only
 * skips the current item - the loop always ran to the end. With ~113 events per
 * channel and ~12 channels on screen that was ~1350 visibility checks per frame
 * to draw the ~30 events actually visible, repeated every animation frame.
 *
 * Kept generic and predicate-driven so it can be tested without a canvas, an
 * EPGEvent or a viewport, matching how ChannelListGeometry and StreamIdentity
 * are already factored.
 */
export const visibleEvents = <T>(events: T[], isVisible: (event: T) => boolean): T[] => {
    const visible: T[] = [];
    for (let i = 0; i < events.length; i++) {
        if (isVisible(events[i])) {
            visible.push(events[i]);
        } else if (visible.length > 0) {
            // ordered by time: the window has been passed
            break;
        }
    }
    return visible;
};
