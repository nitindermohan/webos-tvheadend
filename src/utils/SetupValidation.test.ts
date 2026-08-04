import { isSetupValid } from './SetupValidation';
import { ResultItem, TestResults } from './TVHSettingsTest';

const item = (accessible: boolean): ResultItem => ({
    label: 'x',
    accessible: accessible,
    result: accessible ? 'ok' : 'socket hang up',
    payload: undefined
});

const results = (serverInfo: boolean, playlist: boolean, stream: boolean): TestResults => ({
    firmwareInfo: item(true),
    serverInfo: item(serverInfo),
    playlist: item(playlist),
    stream: item(stream),
    epg: item(true),
    dvr: item(true)
});

describe('isSetupValid', () => {
    it('accepts settings when the server and the playlist are both reachable', () => {
        expect(isSetupValid(results(true, true, true))).toBe(true);
    });

    // The regression this function exists for: TVHeadend closes the connection
    // with no HTTP response when it cannot start a subscription, so the stream
    // check fails for reasons the app does not control. Save must still work.
    it('accepts settings when only the stream check failed', () => {
        expect(isSetupValid(results(true, true, false))).toBe(true);
    });

    it('rejects settings when the server is unreachable', () => {
        expect(isSetupValid(results(false, true, true))).toBe(false);
    });

    it('rejects settings when the playlist cannot be loaded', () => {
        expect(isSetupValid(results(true, false, true))).toBe(false);
    });

    it('rejects settings when nothing worked', () => {
        expect(isSetupValid(results(false, false, false))).toBe(false);
    });

    it('rejects before any test has run', () => {
        expect(isSetupValid(undefined)).toBe(false);
    });

    it('returns a boolean, never undefined, so the Button disabled prop stays defined', () => {
        expect(typeof isSetupValid(undefined)).toBe('boolean');
        expect(typeof isSetupValid(results(true, true, false))).toBe('boolean');
    });
});
