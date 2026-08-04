import { shouldSwitchStream } from './StreamIdentity';
import EPGChannel from '../models/EPGChannel';

const channel = (uuid: string): EPGChannel => new EPGChannel(undefined, 'Channel', 1, uuid, new URL('http://tvh/1'));

describe('shouldSwitchStream', () => {
    // Fix 1 regression coverage (src/components/TV.tsx): currentChannelPosition
    // is a filtered-view index and getChannelID() is the 1-based global
    // position - the two can never legitimately be compared. The pre-fix
    // guard (`currentChannel.getChannelID() !== currentChannelPosition`) was
    // unconditionally true, so every write to currentChannelPosition -
    // including setActiveFilter's and bumpFavoritesVersion's *reconciles*,
    // which move the index without changing the channel - restarted the
    // stream. shouldSwitchStream replaces that with a comparison on channel
    // identity (uuid), which is stable across a reconcile.

    it('is false when the channel actually playing has not changed', () => {
        expect(shouldSwitchStream(channel('uuid-c'), 'uuid-c')).toBe(false);
    });

    it('is true the first time, before anything has played yet', () => {
        expect(shouldSwitchStream(channel('uuid-a'), '')).toBe(true);
    });

    it('is true when a genuinely different channel now occupies this position', () => {
        expect(shouldSwitchStream(channel('uuid-b'), 'uuid-a')).toBe(true);
    });

    it('is driven by uuid, not by getChannelID() (the 1-based global position)', () => {
        // Same global id (1, from the channel() helper above) on both sides
        // would have satisfied the old, broken comparison basis; only uuid
        // identity should matter here.
        expect(shouldSwitchStream(channel('uuid-x'), 'uuid-y')).toBe(true);
    });
});
