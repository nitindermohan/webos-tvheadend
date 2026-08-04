/**
 * State machine for the "hold a key for N ms to trigger the hold action,
 * otherwise a short press is a normal select" gesture (used by ChannelList
 * for hold-OK-to-favorite).
 *
 * Extracted as a plain class - no React, no DOM - so the down/up/repeat/
 * cancel logic can be unit tested with jest fake timers alone. This is the
 * one piece of ChannelList's OK handling not otherwise covered: canvas
 * drawing isn't unit-testable and key routing is thin dispatch, but this
 * state machine has real edge cases (key repeat, an up with no matching
 * down) worth verifying directly.
 */
export default class HoldGesture {
    private active = false;
    private fired = false;
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor(private holdMs: number, private onHold: () => void) {}

    /**
     * Call on every key-down for the tracked key, including webOS's repeated
     * key-down events while the key stays physically held. `active` guards
     * re-entry for the whole press (not just "is the timer still pending"),
     * so a repeat arriving *after* the timer has already fired cannot reset
     * `fired` and start a second 600ms timer - which would double-fire
     * `onHold` for one continuous hold if the user kept the key down past
     * the threshold.
     */
    down(): void {
        if (this.active) return;
        this.active = true;
        this.fired = false;
        this.timer = setTimeout(() => {
            this.fired = true;
            this.timer = null;
            this.onHold();
        }, this.holdMs);
    }

    /**
     * Call on key-up for the tracked key.
     *
     * Returns true when the release should be treated as a short press (the
     * caller's normal "select" action); false when the hold already fired
     * (swallow the release) or when this instance never saw a matching
     * down() for the press now ending - e.g. another handler consumed the
     * key-down before it reached down() (the filter rail intercepts OK while
     * it has focus). There is nothing to clean up in that case and
     * definitely nothing to select.
     */
    up(): boolean {
        if (!this.active) return false;
        this.active = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.fired) {
            this.fired = false;
            return false;
        }
        return true;
    }

    /** Call when the owning component unmounts while a hold may be pending. */
    cancel(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.active = false;
        this.fired = false;
    }
}
