import HoldGesture from './HoldGesture';

describe('HoldGesture', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('treats a short press (up before the threshold) as a select and does not fire the hold', () => {
        const onHold = jest.fn();
        const gesture = new HoldGesture(600, onHold);

        gesture.down();
        jest.advanceTimersByTime(300);
        const wasShortPress = gesture.up();

        expect(wasShortPress).toBe(true);
        expect(onHold).not.toHaveBeenCalled();
    });

    it('fires the hold action once the threshold elapses while still down', () => {
        const onHold = jest.fn();
        const gesture = new HoldGesture(600, onHold);

        gesture.down();
        jest.advanceTimersByTime(600);

        expect(onHold).toHaveBeenCalledTimes(1);
    });

    it('swallows the release after the hold has fired instead of reporting a select', () => {
        const onHold = jest.fn();
        const gesture = new HoldGesture(600, onHold);

        gesture.down();
        jest.advanceTimersByTime(600);
        const wasShortPress = gesture.up();

        expect(wasShortPress).toBe(false);
        expect(onHold).toHaveBeenCalledTimes(1);
    });

    it('ignores key-repeat down events while the original press is still active, without restarting the timer', () => {
        const onHold = jest.fn();
        const gesture = new HoldGesture(600, onHold);

        gesture.down();
        jest.advanceTimersByTime(400);
        // a repeat key-down arrives while the key is still physically held
        gesture.down();
        jest.advanceTimersByTime(400);

        // if the repeat had restarted the timer this would still be pending
        expect(onHold).toHaveBeenCalledTimes(1);
    });

    it('does not double-fire when key-repeat continues to arrive after the hold has already fired', () => {
        const onHold = jest.fn();
        const gesture = new HoldGesture(600, onHold);

        gesture.down();
        jest.advanceTimersByTime(600); // fires once
        // the remote keeps emitting repeat key-downs for as long as OK stays held
        gesture.down();
        jest.advanceTimersByTime(600);
        gesture.down();
        jest.advanceTimersByTime(600);

        expect(onHold).toHaveBeenCalledTimes(1);
    });

    it('reports no select for an up() with no matching down() (key-down consumed elsewhere)', () => {
        const onHold = jest.fn();
        const gesture = new HoldGesture(600, onHold);

        const wasShortPress = gesture.up();

        expect(wasShortPress).toBe(false);
        expect(onHold).not.toHaveBeenCalled();
    });

    it('starts a fresh gesture correctly after a prior short press completed', () => {
        const onHold = jest.fn();
        const gesture = new HoldGesture(600, onHold);

        gesture.down();
        jest.advanceTimersByTime(200);
        expect(gesture.up()).toBe(true);

        gesture.down();
        jest.advanceTimersByTime(600);
        expect(onHold).toHaveBeenCalledTimes(1);
        expect(gesture.up()).toBe(false);
    });

    it('cancel() clears a pending timer so it cannot fire after unmount', () => {
        const onHold = jest.fn();
        const gesture = new HoldGesture(600, onHold);

        gesture.down();
        gesture.cancel();
        jest.advanceTimersByTime(600);

        expect(onHold).not.toHaveBeenCalled();
    });

    it('cancel() leaves the gesture ready for a new down()/up() cycle', () => {
        const onHold = jest.fn();
        const gesture = new HoldGesture(600, onHold);

        gesture.down();
        gesture.cancel();

        gesture.down();
        expect(gesture.up()).toBe(true);
    });
});
