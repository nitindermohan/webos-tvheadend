/**
 * Re-anchors the EPG fixture onto today.
 *
 * The fixture was captured on 2020-12-08 and its timestamps were served
 * verbatim, so every programme in it sat five and a half years in the past.
 * The guide's viewport is a couple of hours wide around now, which meant the
 * harness drew a correct grid containing nothing at all - and an empty guide
 * looks exactly like a broken one, so the surface most worth inspecting was
 * the one the harness could not show. That is the bug this fixes.
 *
 * Shifted by whole days rather than onto an exact instant, so a programme
 * captured at 20:15 still starts at 20:15. Times of day are half of what a
 * guide is for: an EPG whose evening film begins at 04:22 is a different kind
 * of wrong from an empty one, but it is still wrong.
 *
 * The offset is computed per call rather than frozen at module load, so a
 * session left open across midnight keeps working and the start and stop of a
 * single event cannot end up shifted by different amounts.
 */

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const SECONDS_PER_DAY = 24 * 60 * 60;

/** The day the fixture was captured, as a whole-day count since the epoch. */
const FIXTURE_DAY = Math.floor(Date.UTC(2020, 11, 8) / MILLIS_PER_DAY);

/** Whole days from the fixture's capture date to `now`. */
export const fixtureDayOffset = (now: number): number => Math.floor(now / MILLIS_PER_DAY) - FIXTURE_DAY;

/**
 * Shift one fixture timestamp forward by that many whole days. Seconds since
 * the epoch, which is how TVheadend reports event times.
 */
export const shiftFixtureSeconds = (seconds: number, now: number): number =>
    seconds + fixtureDayOffset(now) * SECONDS_PER_DAY;
