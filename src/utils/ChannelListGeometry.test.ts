import { channelPositionAt, ChannelListMetrics } from './ChannelListGeometry';

// the real values from ChannelList.tsx
const metrics = (overrides?: Partial<ChannelListMetrics>): ChannelListMetrics => ({
    railHeight: 86,
    rowHeight: 90,
    scrollY: 0,
    channelCount: 50,
    ...overrides
});

/** Mirrors ChannelList's getTopFrom, so the two stay provably inverse. */
const topFrom = (position: number, m: ChannelListMetrics) => position * m.rowHeight + m.railHeight - m.scrollY;

describe('channelPositionAt', () => {
    it('ignores the band the filter rail occupies', () => {
        expect(channelPositionAt(0, metrics())).toBe(-1);
        expect(channelPositionAt(85, metrics())).toBe(-1);
    });

    it('resolves the first row at the rail boundary', () => {
        expect(channelPositionAt(86, metrics())).toBe(0);
        expect(channelPositionAt(175, metrics())).toBe(0);
    });

    it('resolves the second row one row height down', () => {
        expect(channelPositionAt(176, metrics())).toBe(1);
    });

    it('accounts for the current scroll offset', () => {
        expect(channelPositionAt(86, metrics({ scrollY: 900 }))).toBe(10);
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
});
