import { advanceScroll } from './ScrollAnimation';

/** Run the animation to completion, returning every offset it settled on. */
const runToCompletion = (from: number, to: number, rowHeight: number): number[] => {
    const delta = (to - from) / (rowHeight / 5);
    const seen: number[] = [];
    let current = from;

    for (let frame = 0; frame < 1000; frame++) {
        const step = advanceScroll(current, delta, to);
        current = step.scrollY;
        seen.push(current);
        if (step.done) {
            return seen;
        }
    }
    throw new Error('animation did not terminate');
};

describe('advanceScroll', () => {
    it('steps toward the target while it is still short of it', () => {
        expect(advanceScroll(0, 100, 500)).toEqual({ scrollY: 100, done: false });
    });

    it('steps toward the target when scrolling backwards', () => {
        expect(advanceScroll(500, -100, 0)).toEqual({ scrollY: 400, done: false });
    });

    it('lands exactly on the target rather than wherever the last step left it', () => {
        // the defect: the loop steps by a fixed delta and only notices it has
        // arrived on the frame *after* it passed, so it settled up to one whole
        // delta beyond where it was asked to go
        expect(advanceScroll(540, 100, 500)).toEqual({ scrollY: 500, done: true });
        expect(advanceScroll(460, -100, 500)).toEqual({ scrollY: 500, done: true });
    });

    it('is done when it is exactly on the target', () => {
        expect(advanceScroll(500, 100, 500)).toEqual({ scrollY: 500, done: true });
    });

    it('is done immediately when there is no distance to cover', () => {
        // A zero delta satisfies neither direction's arrival test, so without
        // this it would reschedule itself forever, repainting the whole list
        // every frame. The clamped scroll model produces exactly this whenever
        // two neighbouring positions resolve to the same offset.
        expect(advanceScroll(300, 0, 900)).toEqual({ scrollY: 900, done: true });
    });

    it('settles exactly on the target at 48px rows', () => {
        // 1320 / (48 / 5) is 137.5 - ten steps overshoot by four tenths of one.
        // This is the case that stranded the last channel mid-screen with
        // ~140px of empty canvas below it.
        const offsets = runToCompletion(0, 1320, 48);

        expect(offsets[offsets.length - 1]).toBe(1320);
    });

    it('settles exactly on the target at 90px rows', () => {
        // 90 / 5 is 18, so the distance always divides into 18 whole steps and
        // the old code landed on the target by accident. Pinned so a future
        // change to the step count cannot quietly reintroduce the drift here.
        const offsets = runToCompletion(0, 3420, 90);

        expect(offsets[offsets.length - 1]).toBe(3420);
    });

    it('never steps past the target and back', () => {
        const offsets = runToCompletion(0, 1320, 48);

        offsets.forEach((offset) => {
            expect(offset).toBeLessThanOrEqual(1320);
            expect(offset).toBeGreaterThanOrEqual(0);
        });
    });

    it('terminates when scrolling backwards too', () => {
        const offsets = runToCompletion(1320, 0, 48);

        expect(offsets[offsets.length - 1]).toBe(0);
    });
});
