import { nextStateOnBack } from './BackNavigation';
import { State } from '../models/TVState';

describe('nextStateOnBack', () => {
    // The reason this exists: there was no way back to the guide from live TV.
    it('opens the guide when watching with nothing else on screen', () => {
        expect(nextStateOnBack(State.TV)).toBe(State.EPG);
    });

    // After every zap the app sits in CHANNEL_INFO, not TV, so this is the
    // state a user is actually in most of the time while watching. Treating
    // only State.TV as "watching" would make BACK work only intermittently.
    it('opens the guide when the channel info bar is showing', () => {
        expect(nextStateOnBack(State.CHANNEL_INFO)).toBe(State.EPG);
    });

    it('returns to watching from the guide, so BACK is a toggle', () => {
        expect(nextStateOnBack(State.EPG)).toBe(State.TV);
        expect(nextStateOnBack(nextStateOnBack(State.TV))).toBe(State.TV);
    });

    it('still dismisses the channel list', () => {
        expect(nextStateOnBack(State.CHANNEL_LIST)).toBe(State.TV);
    });

    it('still dismisses the audio and subtitle panel', () => {
        expect(nextStateOnBack(State.CHANNEL_SETTINGS)).toBe(State.TV);
    });

    it('never returns the state it was given for an overlay, so BACK always escapes', () => {
        [State.CHANNEL_LIST, State.EPG, State.CHANNEL_SETTINGS].forEach((state) => {
            expect(nextStateOnBack(state)).not.toBe(state);
        });
    });
});
