import { dialogForKind, RECORDING_UPCOMING } from './RecordingDialog';
import { State } from '../models/RecordingListState';

/**
 * Which dialog a recording gets. The two are not interchangeable: one cancels
 * a schedule, the other deletes a file, and they call different service
 * methods behind different wording. Offering the wrong one is destructive in
 * the wrong direction.
 */
describe('dialogForKind', () => {
    it('offers to cancel a recording that has not happened yet', () => {
        expect(dialogForKind(RECORDING_UPCOMING)).toBe(State.CANCEL_DIALOG);
    });

    it('offers to delete anything already recorded', () => {
        ['REC_RECORDED', 'REC_FAILED', 'REC_RECORDING'].forEach((kind) => {
            expect(dialogForKind(kind)).toBe(State.DELETE_DIALOG);
        });
    });

    it('falls back to delete when the kind is missing or unrecognised', () => {
        // Delete is the safe fallback only because it is the one guarded by a
        // confirm dialog naming the recording. It never runs unprompted.
        [undefined, '', 'something new from the server'].forEach((kind) => {
            expect(dialogForKind(kind)).toBe(State.DELETE_DIALOG);
        });
    });
});
