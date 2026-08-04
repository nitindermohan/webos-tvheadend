// CategorySetup.tsx imports AppContext, which imports AppViewState from
// ../App. ../App transitively pulls in TV.tsx and the full @enact/moonstone
// component tree, which logs an unrelated React.createFactory deprecation
// warning as a load-time side effect of a third-party dependency.
// AppContext.test.tsx hit the same thing and stubs it the same way - keep
// this test's output pristine without touching production code.
jest.mock('../App', () => ({
    AppViewState: {
        TV: 0,
        SETTINGS: 1,
        RECORDINGS: 2,
        HELP: 3,
        CONTACT: 4,
        CATEGORIES: 5
    }
}));

// eslint-disable-next-line import/first
import { defaultTagSelection, findNewTagUuids } from './CategorySetup';
import ChannelTag from '../models/ChannelTag';

const tags: ChannelTag[] = [
    { uuid: 'tag-sdtv', name: 'SDTV', index: 0, channelCount: 1049 },
    { uuid: 'tag-all', name: 'TV channels', index: 0, channelCount: 1049 },
    { uuid: 'tag-news', name: 'News', index: 0, channelCount: 417 },
    { uuid: 'tag-shopping', name: 'Shopping', index: 0, channelCount: 3 }
];

describe('defaultTagSelection', () => {
    it('unticks tags covering 95% or more of the lineup', () => {
        expect(defaultTagSelection(tags, 1049)).toEqual(['tag-news', 'tag-shopping']);
    });

    it('keeps a tag that covers just under the threshold', () => {
        expect(defaultTagSelection([{ uuid: 'tag-x', name: 'X', index: 0, channelCount: 94 }], 100)).toEqual(['tag-x']);
    });

    it('unticks a tag exactly at the threshold', () => {
        expect(defaultTagSelection([{ uuid: 'tag-x', name: 'X', index: 0, channelCount: 95 }], 100)).toEqual([]);
    });

    it('selects nothing when there are no channels', () => {
        expect(defaultTagSelection(tags, 0)).toEqual([]);
    });
});

describe('findNewTagUuids', () => {
    it('reports tags never seen before', () => {
        expect(findNewTagUuids(tags, ['tag-sdtv', 'tag-all', 'tag-news'])).toEqual(['tag-shopping']);
    });

    it('reports nothing when everything is known', () => {
        expect(findNewTagUuids(tags, ['tag-sdtv', 'tag-all', 'tag-news', 'tag-shopping'])).toEqual([]);
    });
});
