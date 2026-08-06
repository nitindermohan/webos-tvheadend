import { scrollThumb } from './ScrollIndicator';

/**
 * The numbers below are the real ones: 90px rows, a 1080 viewport, and the
 * 908-channel lineup this runs against.
 */
const ROW = 90;
const VIEWPORT = 1080;
const base = {
    viewportHeight: VIEWPORT,
    trackHeight: VIEWPORT,
    scrollY: 0,
    minThumbHeight: 40
};

describe('scrollThumb', () => {
    it('shows nothing when every row is already visible', () => {
        expect(scrollThumb({ ...base, contentHeight: 8 * ROW })).toBeUndefined();
    });

    it('shows nothing when the content exactly fills the viewport', () => {
        // a full-height thumb carries no information - it would just be a bar
        // permanently down the edge of the list
        expect(scrollThumb({ ...base, contentHeight: VIEWPORT })).toBeUndefined();
    });

    it('sizes the thumb to the visible fraction', () => {
        // 24 rows of content, 12 visible - half
        const thumb = scrollThumb({ ...base, contentHeight: 24 * ROW });
        expect(thumb).toEqual({ top: 0, height: VIEWPORT / 2 });
    });

    it('puts the thumb at the top when unscrolled', () => {
        expect(scrollThumb({ ...base, contentHeight: 100 * ROW })?.top).toBe(0);
    });

    it('lands the thumb flush with the bottom of the track at full scroll', () => {
        const contentHeight = 100 * ROW;
        const thumb = scrollThumb({
            ...base,
            contentHeight,
            scrollY: contentHeight - VIEWPORT
        })!;

        expect(thumb.top + thumb.height).toBe(VIEWPORT);
    });

    it('clamps a scrollY past the end of the content', () => {
        // not defensive: ChannelList's scrollToChannelPosition stops at
        // rowHeight * (channelCount - 10), which for a 1080 viewport of 90px
        // rows is two rows *past* the true bottom. Without the clamp the thumb
        // walks off the end of the track on every long list.
        const contentHeight = 100 * ROW;
        const overshot = scrollThumb({ ...base, contentHeight, scrollY: contentHeight })!;
        const atEnd = scrollThumb({ ...base, contentHeight, scrollY: contentHeight - VIEWPORT })!;

        expect(overshot).toEqual(atEnd);
    });

    it('clamps a negative scrollY', () => {
        // animateScroll steps by a fixed delta and only checks whether it has
        // arrived on the *next* frame, so it transiently overshoots both ways
        expect(scrollThumb({ ...base, contentHeight: 100 * ROW, scrollY: -500 })?.top).toBe(0);
    });

    it('never shrinks the thumb below the minimum', () => {
        // 908 channels puts the proportional height at ~14px, which is a
        // smear at three metres from a sofa
        const thumb = scrollThumb({ ...base, contentHeight: 908 * ROW })!;

        expect(thumb.height).toBe(40);
    });

    it('still reaches the bottom when the thumb is at its minimum', () => {
        // the classic scrollbar bug: positioning by `progress * trackHeight`
        // rather than `progress * (trackHeight - height)` leaves a floored
        // thumb hanging 40px short of the end, so the list looks unfinished
        // exactly when the user has reached the last channel
        const contentHeight = 908 * ROW;
        const thumb = scrollThumb({ ...base, contentHeight, scrollY: contentHeight - VIEWPORT })!;

        expect(thumb.top + thumb.height).toBe(VIEWPORT);
    });

    it('positions proportionally in between', () => {
        const contentHeight = 24 * ROW;
        // halfway down the scrollable range
        const thumb = scrollThumb({ ...base, contentHeight, scrollY: (contentHeight - VIEWPORT) / 2 })!;

        expect(thumb.top).toBe((VIEWPORT - thumb.height) / 2);
    });

    it('shows nothing rather than NaN when the viewport has no height yet', () => {
        // the first paint can happen before layout has settled
        expect(scrollThumb({ ...base, viewportHeight: 0, contentHeight: 100 * ROW })).toBeUndefined();
        expect(scrollThumb({ ...base, trackHeight: 0, contentHeight: 100 * ROW })).toBeUndefined();
        expect(scrollThumb({ ...base, contentHeight: 0 })).toBeUndefined();
    });
});
