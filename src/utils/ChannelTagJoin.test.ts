import { applyChannelTags } from './ChannelTagJoin';
import EPGChannel from '../models/EPGChannel';

const channels = (): EPGChannel[] => [
    new EPGChannel(undefined, 'One', 1, 'uuid-a', new URL('http://tvh/1')),
    new EPGChannel(undefined, 'Two', 2, 'uuid-b', new URL('http://tvh/2')),
    new EPGChannel(undefined, 'Three', 3, 'uuid-c', new URL('http://tvh/3'))
];

const tagEntries = [
    { uuid: 'tag-news', name: 'News', index: 0 },
    { uuid: 'tag-movies', name: 'Movies', index: 0 },
    { uuid: 'tag-unused', name: 'Shopping', index: 0 }
];

describe('applyChannelTags', () => {
    it('assigns tag uuids to the matching channels', () => {
        const list = channels();
        applyChannelTags(list, tagEntries, [
            { uuid: 'uuid-a', tags: ['tag-movies'] },
            { uuid: 'uuid-b', tags: ['tag-news', 'tag-movies'] }
        ]);
        expect(list[0].getTagUuids()).toEqual(['tag-movies']);
        expect(list[1].getTagUuids()).toEqual(['tag-news', 'tag-movies']);
    });

    it('leaves channels missing from the tag map untagged', () => {
        const list = channels();
        applyChannelTags(list, tagEntries, [{ uuid: 'uuid-a', tags: ['tag-movies'] }]);
        expect(list[2].getTagUuids()).toEqual([]);
    });

    it('counts channels per tag and drops empty tags', () => {
        const result = applyChannelTags(channels(), tagEntries, [
            { uuid: 'uuid-a', tags: ['tag-movies'] },
            { uuid: 'uuid-b', tags: ['tag-news', 'tag-movies'] }
        ]);
        expect(result.map((tag) => tag.name)).toEqual(['Movies', 'News']);
        expect(result[0].channelCount).toBe(2);
        expect(result[1].channelCount).toBe(1);
    });

    it('sorts by index first and name second', () => {
        const result = applyChannelTags(
            channels(),
            [
                { uuid: 'tag-z', name: 'Zebra', index: 1 },
                { uuid: 'tag-b', name: 'Beta', index: 5 },
                { uuid: 'tag-a', name: 'Alpha', index: 1 }
            ],
            [{ uuid: 'uuid-a', tags: ['tag-z', 'tag-b', 'tag-a'] }]
        );
        expect(result.map((tag) => tag.name)).toEqual(['Alpha', 'Zebra', 'Beta']);
    });

    it('treats a missing tags array as untagged', () => {
        const list = channels();
        const result = applyChannelTags(list, tagEntries, [{ uuid: 'uuid-a' }]);
        expect(list[0].getTagUuids()).toEqual([]);
        expect(result).toEqual([]);
    });
});
