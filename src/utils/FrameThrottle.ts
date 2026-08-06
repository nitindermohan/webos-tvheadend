/**
 * Collapses a burst of events into at most one call per animation frame,
 * always carrying the newest value.
 *
 * The motivating case is pointer hover over the channel list. A `mousemove`
 * fires far more often than the display refreshes, and each one would repaint
 * a 900x1080 canvas - roughly a megapixel of fill, text and image blitting -
 * on a TV SoC that has to do this while decoding video. Coalescing to one
 * repaint per frame makes the cost independent of how fast the Magic Remote's
 * pointer is moving.
 *
 * "Newest value" rather than "first value" is the load-bearing half: keeping
 * the value that opened the frame would highlight a row the pointer has
 * already moved past, which is worse than no highlight at all.
 *
 * Extracted as a pure function so the coalescing can be tested against a fake
 * scheduler. Testing it through a real rAF would make every assertion a race.
 */

/** The scheduling primitives, injectable so tests can drive frames by hand. */
export interface FrameScheduler {
    request: (callback: FrameRequestCallback) => number;
    cancel: (handle: number) => void;
}

export interface FrameThrottle<T> {
    /** Record a value, scheduling a run on the next frame if none is pending. */
    push: (value: T) => void;
    /** Drop any pending run. Safe to call when nothing is scheduled. */
    cancel: () => void;
}

/**
 * Wrapped rather than passed by reference: `requestAnimationFrame` detached
 * from `window` throws "Illegal invocation" in Chromium.
 */
const browserScheduler: FrameScheduler = {
    request: (callback) => requestAnimationFrame(callback),
    cancel: (handle) => cancelAnimationFrame(handle)
};

export const createFrameThrottle = <T>(
    run: (value: T) => void,
    scheduler: FrameScheduler = browserScheduler
): FrameThrottle<T> => {
    // `undefined` is the "nothing scheduled" state rather than 0, because 0 is
    // a handle a scheduler is entitled to hand out.
    let handle: number | undefined;
    let pending: T | undefined;

    return {
        push: (value: T) => {
            pending = value;
            if (handle !== undefined) {
                return;
            }
            handle = scheduler.request(() => {
                // cleared *before* run() so that a push made from inside the
                // callback schedules the next frame instead of being swallowed
                handle = undefined;
                const value = pending as T;
                pending = undefined;
                run(value);
            });
        },
        cancel: () => {
            if (handle === undefined) {
                return;
            }
            scheduler.cancel(handle);
            handle = undefined;
            pending = undefined;
        }
    };
};
