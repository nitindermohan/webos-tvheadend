import { fixtureDayOffset, shiftFixtureSeconds } from './FixtureClock';

const DAY = 24 * 60 * 60;
const at = (iso: string) => Date.parse(iso);

/**
 * The harness's guide was empty for as long as this fixture went unshifted,
 * and an empty guide is indistinguishable from a broken one - so the surface
 * most worth looking at was the one that could not be looked at.
 */
describe('FixtureClock', () => {
    it('is a whole number of days, so times of day survive the shift', () => {
        // 20:15 must still be 20:15 after shifting, or the guide is populated
        // with programmes at implausible hours - wrong in a quieter way.
        const start = Date.UTC(2020, 11, 8, 20, 15) / 1000;
        const shifted = shiftFixtureSeconds(start, at('2026-08-08T09:00:00Z'));
        expect((shifted - start) % DAY).toBe(0);
        expect(new Date(shifted * 1000).getUTCHours()).toBe(20);
        expect(new Date(shifted * 1000).getUTCMinutes()).toBe(15);
    });

    it('lands the fixture day on today', () => {
        const noon = Date.UTC(2020, 11, 8, 12, 0) / 1000;
        const shifted = shiftFixtureSeconds(noon, at('2026-08-08T09:00:00Z'));
        expect(new Date(shifted * 1000).toISOString().slice(0, 10)).toBe('2026-08-08');
    });

    it('keeps the fixture second day one day after the first', () => {
        // the fixture spans two days; the gap has to survive, or programmes
        // from the far side collapse onto the near one
        const now = at('2026-08-08T09:00:00Z');
        const first = shiftFixtureSeconds(Date.UTC(2020, 11, 8, 22, 0) / 1000, now);
        const second = shiftFixtureSeconds(Date.UTC(2020, 11, 9, 22, 0) / 1000, now);
        expect(second - first).toBe(DAY);
    });

    it('shifts start and stop of one event by the same amount', () => {
        // computed per call, so a call straddling midnight must not stretch or
        // collapse an event - a stop before its start draws a negative-width box
        const now = at('2026-08-08T23:59:59.999Z');
        const start = Date.UTC(2020, 11, 8, 20, 0) / 1000;
        const stop = Date.UTC(2020, 11, 8, 21, 30) / 1000;
        expect(shiftFixtureSeconds(stop, now) - shiftFixtureSeconds(start, now)).toBe(stop - start);
    });

    it('advances by one more day once the clock passes midnight UTC', () => {
        expect(fixtureDayOffset(at('2026-08-09T00:00:00Z')) - fixtureDayOffset(at('2026-08-08T23:59:59Z'))).toBe(1);
    });

    it('is zero on the fixture capture date itself', () => {
        expect(fixtureDayOffset(at('2020-12-08T12:00:00Z'))).toBe(0);
    });
});
