import { channelPositionAt, ChannelListMetrics } from './ChannelListGeometry';

// the real values from ChannelList.tsx. topOffset is 0 since the category bar
// was replaced by a column beside the list rather than a band above it.
const metrics = (overrides?: Partial<ChannelListMetrics>): ChannelListMetrics => ({
    topOffset: 0,
    rowHeight: 90,
    scrollY: 0,
    channelCount: 50,
    ...overrides
});

/** Mirrors ChannelList's getTopFrom, so the two stay provably inverse. */
const topFrom = (position: number, m: ChannelListMetrics) => position * m.rowHeight + m.topOffset - m.scrollY;

describe('channelPositionAt', () => {
    it('resolves the first row at the very top of the canvas', () => {
        expect(channelPositionAt(0, metrics())).toBe(0);
        expect(channelPositionAt(89, metrics())).toBe(0);
    });

    it('resolves the second row one row height down', () => {
        expect(channelPositionAt(90, metrics())).toBe(1);
    });

    it('accounts for the current scroll offset', () => {
        expect(channelPositionAt(0, metrics({ scrollY: 900 }))).toBe(10);
    });

    it('returns -1 past the last channel', () => {
        expect(channelPositionAt(topFrom(49, metrics()), metrics())).toBe(49);
        expect(channelPositionAt(topFrom(50, metrics()), metrics())).toBe(-1);
    });

    it('returns -1 for an empty lineup', () => {
        expect(channelPositionAt(200, metrics({ channelCount: 0 }))).toBe(-1);
    });

    it('is the inverse of getTopFrom for every visible row', () => {
        const m = metrics({ scrollY: 450 });
        for (let position = 5; position < 20; position++) {
            const top = topFrom(position, m);
            expect(channelPositionAt(top, m)).toBe(position);
            expect(channelPositionAt(top + m.rowHeight - 1, m)).toBe(position);
        }
    });

    describe('with a non-zero topOffset', () => {
        // Nothing sets one today, but this parameter is the whole reason the
        // module exists: it is the number that has to agree with getTopFrom,
        // and the failure when it does not is silent - clicks land on a
        // neighbouring row rather than erroring. Phase 3's densities and any
        // future header will move it, so it stays covered at a non-default
        // value.
        const offset = metrics({ topOffset: 120 });

        it('ignores the band above the first row', () => {
            expect(channelPositionAt(0, offset)).toBe(-1);
            expect(channelPositionAt(119, offset)).toBe(-1);
        });

        it('resolves the first row at the boundary', () => {
            expect(channelPositionAt(120, offset)).toBe(0);
            expect(channelPositionAt(209, offset)).toBe(0);
        });

        it('stays the inverse of getTopFrom', () => {
            for (let position = 0; position < 10; position++) {
                expect(channelPositionAt(topFrom(position, offset), offset)).toBe(position);
            }
        });
    });
});
