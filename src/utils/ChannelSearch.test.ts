import { channelMatchesQuery, foldForSearch, isNumericQuery } from './ChannelSearch';

describe('foldForSearch', () => {
    it('lower-cases and trims', () => {
        expect(foldForSearch('  ZDF Neo  ')).toBe('zdf neo');
    });

    it('strips diacritics, so an unaccented query reaches an accented name', () => {
        // The reason this exists: an on-screen keyboard makes accented letters
        // expensive or impossible to type, and this app deliberately ships the
        // latin-ext subset because such names are common in its lineups.
        expect(foldForSearch('Südwest')).toBe('sudwest');
        expect(foldForSearch('TVP Kraków')).toBe('tvp krakow');
        expect(foldForSearch('Česká')).toBe('ceska');
    });

    it('leaves a name with no diacritics untouched apart from case', () => {
        expect(foldForSearch('BBC One HD')).toBe('bbc one hd');
    });
});

describe('isNumericQuery', () => {
    it('accepts digits only', () => {
        expect(isNumericQuery('105')).toBe(true);
        expect(isNumericQuery(' 7 ')).toBe(true);
    });

    it('rejects anything else, so a name query never gets number treatment', () => {
        ['', '10a', 'a10', '1 0', '-1', '1.5'].forEach((query) => {
            expect(isNumericQuery(query)).toBe(false);
        });
    });
});

describe('channelMatchesQuery', () => {
    it('matches everything while the query is empty', () => {
        // A search filter with nothing typed must not empty the lineup - the
        // user has just opened the field and would see the app blank out.
        ['', '   '].forEach((query) => {
            expect(channelMatchesQuery('BBC One', 1, query)).toBe(true);
        });
    });

    it('matches a name anywhere, not only at the start', () => {
        // Broadcasters put the distinguishing word last.
        expect(channelMatchesQuery('ZDF neo', 8, 'neo')).toBe(true);
        expect(channelMatchesQuery('SWR BW HD', 12, 'bw')).toBe(true);
    });

    it('ignores case and accents in both directions', () => {
        expect(channelMatchesQuery('Südwest', 3, 'sudwest')).toBe(true);
        expect(channelMatchesQuery('Sudwest', 3, 'SÜD')).toBe(true);
    });

    it('matches a channel number by prefix', () => {
        // Prefix, so the list narrows as digits arrive instead of emptying
        // between keystrokes: typing 1 -> 0 -> 5 on the way to 105 keeps 105
        // visible the whole time.
        expect(channelMatchesQuery('Some Channel', 105, '1')).toBe(true);
        expect(channelMatchesQuery('Some Channel', 105, '10')).toBe(true);
        expect(channelMatchesQuery('Some Channel', 105, '105')).toBe(true);
    });

    it('does not match a number the query is not a prefix of', () => {
        expect(channelMatchesQuery('Some Channel', 105, '5')).toBe(false);
        expect(channelMatchesQuery('Some Channel', 105, '106')).toBe(false);
        expect(channelMatchesQuery('Some Channel', 7, '70')).toBe(false);
    });

    it('still searches names for a numeric query', () => {
        // '4' should find 'Channel 4' even though its number is 22.
        expect(channelMatchesQuery('Channel 4', 22, '4')).toBe(true);
    });

    it('does not let a name query match a number', () => {
        // guards the branch order: a non-numeric query must never reach the
        // number comparison, where String(105).startsWith would throw nothing
        // but quietly answer for the wrong field
        expect(channelMatchesQuery('BBC One', 105, 'zdf')).toBe(false);
    });

    it('is not confused by a name that contains the query only after folding', () => {
        expect(channelMatchesQuery('Kraków TV', 44, 'krakow')).toBe(true);
        expect(channelMatchesQuery('Kraków TV', 44, 'krakov')).toBe(false);
    });
});
