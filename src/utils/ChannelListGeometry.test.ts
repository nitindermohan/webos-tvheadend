import {
    channelPositionAt,
    ChannelListMetrics,
    scrollTargetFor,
    ScrollTargetMetrics
} from './ChannelListGeometry';
import { COMPACT, LIST } from './Density';

/**
 * Every case runs at both densities.
 *
 * This is not thoroughness for its own sake. The failure this module exists to
 * prevent is silent: if the row height used to *draw* and the row height used
 * to *hit-test* disagree, clicks land on a neighbouring row and nothing errors.
 * A suite pinned to 90px would pass while COMPACT was completely wrong.
 */
const DENSITIES = [
    { name: 'LIST', rowHeight: LIST.rowHeight },
    { name: 'COMPACT', rowHeight: COMPACT.rowHeight }
];

/** Mirrors ChannelList's getTopFrom, so the two stay provably inverse. */
const topFrom = (position: number, m: ChannelListMetrics) => position * m.rowHeight + m.topOffset - m.scrollY;

describe.each(DENSITIES)('channelPositionAt at $name density', ({ rowHeight }) => {
    const metrics = (overrides?: Partial<ChannelListMetrics>): ChannelListMetrics => ({
        topOffset: 0,
        rowHeight,
        scrollY: 0,
        channelCount: 50,
        ...overrides
    });

    it('resolves the first row at the very top of the canvas', () => {
        expect(channelPositionAt(0, metrics())).toBe(0);
        expect(channelPositionAt(rowHeight - 1, metrics())).toBe(0);
    });

    it('resolves the second row one row height down', () => {
        expect(channelPositionAt(rowHeight, metrics())).toBe(1);
    });

    it('accounts for the current scroll offset', () => {
        expect(channelPositionAt(0, metrics({ scrollY: rowHeight * 10 }))).toBe(10);
    });

    it('returns -1 past the last channel', () => {
        expect(channelPositionAt(topFrom(49, metrics()), metrics())).toBe(49);
        expect(channelPositionAt(topFrom(50, metrics()), metrics())).toBe(-1);
    });

    it('returns -1 for an empty lineup', () => {
        expect(channelPositionAt(200, metrics({ channelCount: 0 }))).toBe(-1);
    });

    it('is the inverse of getTopFrom for every visible row', () => {
        const m = metrics({ scrollY: rowHeight * 5 });
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
        // neighbouring row rather than erroring.
        const offset = metrics({ topOffset: 120 });

        it('ignores the band above the first row', () => {
            expect(channelPositionAt(0, offset)).toBe(-1);
            expect(channelPositionAt(119, offset)).toBe(-1);
        });

        it('resolves the first row at the boundary', () => {
            expect(channelPositionAt(120, offset)).toBe(0);
            expect(channelPositionAt(120 + rowHeight - 1, offset)).toBe(0);
        });

        it('stays the inverse of getTopFrom', () => {
            for (let position = 0; position < 10; position++) {
                expect(channelPositionAt(topFrom(position, offset), offset)).toBe(position);
            }
        });
    });
});

describe.each(DENSITIES)('scrollTargetFor at $name density', ({ rowHeight }) => {
    const VIEWPORT = 1080;
    const visibleRows = Math.floor(VIEWPORT / rowHeight);

    const metrics = (overrides?: Partial<ScrollTargetMetrics>): ScrollTargetMetrics => ({
        rowHeight,
        channelCount: 500,
        viewportHeight: VIEWPORT,
        topPadding: 5,
        ...overrides
    });

    it('does not scroll while the cursor is still inside the top padding', () => {
        expect(scrollTargetFor(0, metrics())).toBe(0);
        expect(scrollTargetFor(4, metrics())).toBe(0);
        expect(scrollTargetFor(5, metrics())).toBe(0);
    });

    it('pins the cursor topPadding rows below the top once it is scrolling', () => {
        expect(scrollTargetFor(6, metrics())).toBe(rowHeight);
        expect(scrollTargetFor(20, metrics())).toBe(15 * rowHeight);
    });

    it('never scrolls past the end of the content', () => {
        // The defect this replaces clamped to `rowHeight * (count - 2 *
        // topPadding)`, which is independent of the viewport and overshoots it.
        // At LIST density that left two rows of dead canvas below the last
        // channel; at COMPACT, where more rows fit, it is twelve.
        const m = metrics();
        const contentHeight = m.channelCount * rowHeight;

        expect(scrollTargetFor(m.channelCount - 1, m)).toBe(contentHeight - VIEWPORT);
    });

    it('keeps the last channel on screen at the bottom of the list', () => {
        const m = metrics();
        const target = scrollTargetFor(m.channelCount - 1, m);
        const lastRowTop = (m.channelCount - 1) * rowHeight - target;

        expect(lastRowTop).toBeGreaterThanOrEqual(0);
        expect(lastRowTop + rowHeight).toBeLessThanOrEqual(VIEWPORT);
    });

    it('never scrolls a list that already fits', () => {
        // The old clamp went *negative* here - for 8 channels it computed
        // `rowHeight * (8 - 10)`, pushing every row down the canvas and
        // leaving a band of empty space above the first one. Small categories
        // (UHDTV, Radio) are exactly this case.
        const short = metrics({ channelCount: 8 });

        expect(scrollTargetFor(0, short)).toBe(0);
        expect(scrollTargetFor(7, short)).toBe(0);
    });

    it('never scrolls a list that exactly fills the viewport', () => {
        const exact = metrics({ channelCount: visibleRows });

        expect(scrollTargetFor(visibleRows - 1, exact)).toBe(0);
    });

    it('starts scrolling as soon as the content exceeds the viewport', () => {
        const oneOver = metrics({ channelCount: visibleRows + 1 });

        expect(scrollTargetFor(visibleRows, oneOver)).toBe((visibleRows + 1) * rowHeight - VIEWPORT);
    });

    it('handles an empty lineup without producing a negative offset', () => {
        expect(scrollTargetFor(0, metrics({ channelCount: 0 }))).toBe(0);
    });

    it('agrees with channelPositionAt about where the cursor row landed', () => {
        // the two halves of the module have to describe the same list: after
        // scrolling to a position, hit-testing that row's drawn top must give
        // the position back
        const m = metrics();
        [0, 5, 6, 40, 499].forEach((position) => {
            const scrollY = scrollTargetFor(position, m);
            const top = position * rowHeight - scrollY;
            expect(channelPositionAt(top, { topOffset: 0, rowHeight, scrollY, channelCount: m.channelCount })).toBe(
                position
            );
        });
    });
});
