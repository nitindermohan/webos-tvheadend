import { createFrameThrottle, FrameScheduler } from './FrameThrottle';

/**
 * A scheduler that never runs anything on its own, so a test can decide
 * exactly when a frame happens. Real rAF would make every assertion below a
 * race.
 */
const fakeScheduler = () => {
    let nextHandle = 1;
    const pending = new Map<number, () => void>();

    const scheduler: FrameScheduler = {
        request: (callback) => {
            const handle = nextHandle++;
            pending.set(handle, () => callback(0));
            return handle;
        },
        cancel: (handle) => {
            pending.delete(handle);
        }
    };

    return {
        scheduler,
        /** Run every frame currently queued. */
        tick: () => {
            const due = Array.from(pending.values());
            pending.clear();
            due.forEach((callback) => callback());
        },
        queued: () => pending.size
    };
};

describe('createFrameThrottle', () => {
    it('does not run the callback synchronously', () => {
        const { scheduler } = fakeScheduler();
        const run = jest.fn();

        createFrameThrottle(run, scheduler).push(1);

        expect(run).not.toHaveBeenCalled();
    });

    it('coalesces several pushes in one frame into a single run', () => {
        const { scheduler, tick, queued } = fakeScheduler();
        const run = jest.fn();
        const throttle = createFrameThrottle(run, scheduler);

        throttle.push(1);
        throttle.push(2);
        throttle.push(3);

        // one frame requested, not three - the whole point on a TV SoC, where
        // a mousemove burst would otherwise repaint a 900x1080 canvas dozens
        // of times between two displayed frames
        expect(queued()).toBe(1);
        tick();
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('runs with the newest value, not the one that opened the frame', () => {
        const { scheduler, tick } = fakeScheduler();
        const run = jest.fn();
        const throttle = createFrameThrottle(run, scheduler);

        throttle.push('first');
        throttle.push('last');
        tick();

        // keeping the first value would leave the highlight on a row the
        // pointer has already left, which is worse than not highlighting at all
        expect(run).toHaveBeenCalledWith('last');
    });

    it('schedules a fresh frame for a push after the previous one ran', () => {
        const { scheduler, tick } = fakeScheduler();
        const run = jest.fn();
        const throttle = createFrameThrottle(run, scheduler);

        throttle.push('a');
        tick();
        throttle.push('b');
        tick();

        expect(run.mock.calls).toEqual([['a'], ['b']]);
    });

    it('drops a pending run when cancelled', () => {
        const { scheduler, tick } = fakeScheduler();
        const run = jest.fn();
        const throttle = createFrameThrottle(run, scheduler);

        throttle.push(1);
        throttle.cancel();
        tick();

        expect(run).not.toHaveBeenCalled();
    });

    it('accepts pushes again after a cancel', () => {
        const { scheduler, tick } = fakeScheduler();
        const run = jest.fn();
        const throttle = createFrameThrottle(run, scheduler);

        throttle.push(1);
        throttle.cancel();
        throttle.push(2);
        tick();

        // cancel must clear the "a frame is already requested" flag as well as
        // the frame itself, or the throttle goes permanently deaf
        expect(run).toHaveBeenCalledWith(2);
    });

    it('accepts a push made from inside the callback', () => {
        const { scheduler, tick } = fakeScheduler();
        const seen: number[] = [];
        let throttle: ReturnType<typeof createFrameThrottle<number>>;
        // eslint-disable-next-line prefer-const
        throttle = createFrameThrottle<number>((value) => {
            seen.push(value);
            if (value === 1) throttle.push(2);
        }, scheduler);

        throttle.push(1);
        tick();
        tick();

        // the "a frame is already requested" flag has to be cleared before the
        // callback runs, not after, or a re-entrant push is swallowed and the
        // throttle silently drops the value
        expect(seen).toEqual([1, 2]);
    });

    it('cancels only its own frame', () => {
        const { scheduler } = fakeScheduler();
        const cancel = jest.fn();
        const throttle = createFrameThrottle(jest.fn(), { ...scheduler, cancel });

        throttle.cancel();

        // nothing was scheduled, so there is no handle to cancel. Calling
        // cancelAnimationFrame(0) is harmless in a browser but would be a lie
        // about what this owns, and unmount calls cancel unconditionally.
        expect(cancel).not.toHaveBeenCalled();
    });
});
