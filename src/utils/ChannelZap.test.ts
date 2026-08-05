import { nextChannelPosition, NO_ZAP } from './ChannelZap';

describe('nextChannelPosition', () => {
    // The regression this exists for. The channel list draws position 0 at the
    // top and increases downward, so "up" must decrease the position. Task 13
    // mapped ARROW_UP onto the CHANNEL_UP body, so pressing up moved down.
    it('treats previous as the channel drawn above, i.e. a lower position', () => {
        expect(nextChannelPosition(5, 100, 'previous')).toBe(4);
    });

    it('treats next as the channel drawn below, i.e. a higher position', () => {
        expect(nextChannelPosition(5, 100, 'next')).toBe(6);
    });

    it('the two directions are inverses of each other', () => {
        const up = nextChannelPosition(5, 100, 'previous');
        expect(nextChannelPosition(up, 100, 'next')).toBe(5);
    });

    it('does not move past the top of the lineup', () => {
        expect(nextChannelPosition(0, 100, 'previous')).toBe(NO_ZAP);
    });

    it('does not move past the bottom of the lineup', () => {
        expect(nextChannelPosition(99, 100, 'next')).toBe(NO_ZAP);
    });

    it('still moves off the first and last positions in the allowed direction', () => {
        expect(nextChannelPosition(0, 100, 'next')).toBe(1);
        expect(nextChannelPosition(99, 100, 'previous')).toBe(98);
    });

    it('does not wrap around either end', () => {
        expect(nextChannelPosition(0, 3, 'previous')).not.toBe(2);
        expect(nextChannelPosition(2, 3, 'next')).not.toBe(0);
    });

    it('refuses to move when there are no channels', () => {
        expect(nextChannelPosition(0, 0, 'next')).toBe(NO_ZAP);
        expect(nextChannelPosition(0, 0, 'previous')).toBe(NO_ZAP);
    });

    it('handles a single-channel lineup', () => {
        expect(nextChannelPosition(0, 1, 'next')).toBe(NO_ZAP);
        expect(nextChannelPosition(0, 1, 'previous')).toBe(NO_ZAP);
    });
});
