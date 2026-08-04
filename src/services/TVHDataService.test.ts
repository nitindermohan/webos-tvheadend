jest.mock('../config/Config', () => ({
    __esModule: true,
    default: {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        lunaServiceAdapter: new (require('../mock/MockLunaServiceAdapter').default)(),
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        httpProxyServiceAdapter: new (require('../mock/MockHttpProxyServiceAdapter').default)(),
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        fileServiceAdapter: new (require('../mock/MockFileServiceAdapter').default)()
    }
}));

import TVHDataService from './TVHDataService';
import Config from '../config/Config';

const settings = {
    tvhUrl: 'http://tvh.local:9981/',
    user: '',
    password: '',
    dvrUuid: 0
};

describe('TVHDataService.retrieveChannelTags', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        jest.restoreAllMocks();
    });

    it('joins the mock channel and tag fixtures into a non-empty, sensible tag list', async () => {
        const service = new TVHDataService(settings);
        // channel tags are joined against the already-loaded M3U channel lineup
        await service.retrieveM3UChannels();

        const tags = await service.retrieveChannelTags();

        expect(tags.length).toBeGreaterThan(0);
        tags.forEach((tag) => {
            expect(typeof tag.uuid).toBe('string');
            expect(tag.uuid.length).toBeGreaterThan(0);
            expect(typeof tag.name).toBe('string');
            expect(tag.name.length).toBeGreaterThan(0);
            expect(tag.channelCount).toBeGreaterThan(0);
        });

        // the mock fixtures carry a known "TV channels" tag with real matches
        const tvTag = tags.find((tag) => tag.name === 'TV channels');
        expect(tvTag).toBeDefined();
        expect(tvTag?.channelCount).toBeGreaterThan(0);
    });

    it('never rejects - resolves to an empty list when the underlying call fails', async () => {
        jest.spyOn(Config.httpProxyServiceAdapter, 'call').mockRejectedValue(new Error('network down'));

        const service = new TVHDataService(settings);
        await expect(service.retrieveChannelTags()).resolves.toEqual([]);
    });
});
