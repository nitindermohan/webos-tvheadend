import { nextStateOnBack, nextStateOnRecordingsBack } from './BackNavigation';
import { State } from '../models/TVState';
import { State as RecordingsState } from '../models/RecordingsState';

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

describe('nextStateOnRecordingsBack', () => {
    // The reason this exists: the recordings screen had no exit at all. BACK
    // from the player set the state it was already in, and the only other way
    // out was the menu - on GREEN, a button modern Magic Remotes do not have,
    // and which the recordings list swallowed before it could reach App.
    it('leaves the recordings view from the player, the bottom rung', () => {
        expect(nextStateOnRecordingsBack(RecordingsState.PLAYER)).toBeNull();
    });

    it('drops a sub-state back to the player rather than out of the app', () => {
        [RecordingsState.RECORDINGS_LIST, RecordingsState.RECORDINGS_SETTINGS, RecordingsState.PLAYER_INFO].forEach(
            (state) => {
                expect(nextStateOnRecordingsBack(state)).toBe(RecordingsState.PLAYER);
            }
        );
    });

    it('never returns the state it was given, so BACK always changes something', () => {
        // The whole defect in one assertion: a self-transition is a dead end,
        // and on a TV a dead end means killing the app from the launcher.
        Object.values(RecordingsState).forEach((state) => {
            expect(nextStateOnRecordingsBack(state)).not.toBe(state);
        });
    });

    it('reaches the exit from every state in at most two presses', () => {
        // Guards the ladder itself, not just one rung: if a future state
        // pointed at another sub-state instead of the player, BACK would walk
        // sideways forever without this.
        Object.values(RecordingsState).forEach((state) => {
            const once = nextStateOnRecordingsBack(state);
            expect(once === null || nextStateOnRecordingsBack(once) === null).toBe(true);
        });
    });
});
