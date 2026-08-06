/**
 * One frame of the channel list's scroll animation.
 *
 * The list eases toward a target by adding a fixed delta per frame. The
 * subtlety - and the bug that lived here for the life of the project - is how
 * it decides it has arrived: a fixed step almost never lands on the target
 * exactly, so the loop notices only on the frame *after* it has passed, and
 * whatever offset it happened to stop at is where the list stays.
 *
 * That was invisible at 90px rows. The delta is `distance / (rowHeight / 5)`,
 * which for 90 is `distance / 18` - exactly eighteen whole steps, landing on
 * the target by arithmetic accident. At 48px it is `distance / 9.6`, so ten
 * steps overshoot by four tenths of one, and the bottom of the list settles
 * ~140px past its own end with the last channel stranded mid-screen.
 *
 * Extracted so the arrival rule can be tested by running a whole animation to
 * completion and asserting on where it stops, which is the only way to catch a
 * drift that accumulates over frames.
 */
export interface ScrollStep {
    /** Where the list should be drawn this frame. */
    scrollY: number;
    /** True once it has arrived; the caller stops requesting frames. */
    done: boolean;
}

export const advanceScroll = (current: number, delta: number, target: number): ScrollStep => {
    // A zero delta satisfies neither direction's arrival test below, so
    // without this it would reschedule itself forever. The caller guards this
    // too - two guards because the cost of missing it is a permanent repaint
    // loop on a TV, and the symptom (a warm, slow box) never points here.
    if (delta === 0) {
        return { scrollY: target, done: true };
    }

    // Tested against the *next* offset, not the current one. Asking "have we
    // passed it yet?" means one frame is drawn beyond the target before being
    // snapped back - a visible 55px bounce at the end of every long scroll at
    // 48px rows. Asking "would this step pass it?" stops one frame earlier and
    // never draws an offset the list was not asked for.
    const next = current + delta;
    const wouldArrive = delta < 0 ? next <= target : next >= target;

    return wouldArrive ? { scrollY: target, done: true } : { scrollY: next, done: false };
};
