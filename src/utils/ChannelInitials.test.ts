import { channelInitials } from './ChannelInitials';

/**
 * The cases below are real channel names from src/mock/channels.json, so the
 * behaviour is pinned against the lineup this actually runs on rather than
 * invented examples.
 */
describe('channelInitials', () => {
    it('takes the first two letters of an acronym name', () => {
        expect(channelInitials('ARD')).toBe('AR');
        expect(channelInitials('RTL')).toBe('RT');
    });

    it('ignores the quality suffix that most names carry', () => {
        // 'HD' is on the end of most of this lineup - keeping it would make
        // half the channels read as something-H
        expect(channelInitials('ZDF HD')).toBe('ZD');
        expect(channelInitials('RTL HD')).toBe('RT');
        expect(channelInitials('3sat HD')).toBe('3S');
    });

    it('treats a dot as a word break', () => {
        // 'SAT.1' comes out as S1 rather than SA. That follows from the single
        // rule the whole function applies - initials of the first two tokens -
        // and SA would need a special case for dots-inside-names that would
        // then have to be argued for against underscores ('zdf_neo') and
        // hyphens ('hr-fernsehen'), both of which do want splitting. S1 is
        // still recognisably derived from the name, so the uniform rule wins.
        expect(channelInitials('SAT.1 HD')).toBe('S1');
    });

    it('uses the initials of the first two meaningful words', () => {
        expect(channelInitials('Das Erste HD')).toBe('DE');
        expect(channelInitials('hr-fernsehen HD')).toBe('HF');
        expect(channelInitials('Pro7 MAXX HD')).toBe('PM');
    });

    it('handles names that are entirely noise words', () => {
        expect(channelInitials('HD')).toBe('HD');
        expect(channelInitials('TV')).toBe('TV');
    });

    it('handles punctuation and digits', () => {
        expect(channelInitials('zdf_neo HD')).toBe('ZN');
        expect(channelInitials('13th Street')).toBe('1S');
    });

    it('returns an empty string when there is nothing to show', () => {
        // the caller draws nothing at all rather than an empty plate
        expect(channelInitials('')).toBe('');
        expect(channelInitials('   ')).toBe('');
        expect(channelInitials('---')).toBe('');
    });

    it('handles non-latin names without throwing', () => {
        // European lineups carry Cyrillic and Greek names; the point is that
        // it degrades to something rather than crashing the draw loop
        expect(channelInitials('Первый канал')).toBe('ПК');
        expect(channelInitials('ΕΡΤ1')).toBe('ΕΡ');
    });

    it('never returns more than two characters', () => {
        ['Das Erste HD', 'ARD', 'a', 'Some Very Long Channel Name Here'].forEach((name) => {
            expect(channelInitials(name).length).toBeLessThanOrEqual(2);
        });
    });
});
