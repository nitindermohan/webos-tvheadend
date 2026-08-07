import { State } from '../models/RecordingListState';

/**
 * Which confirm dialog a recording needs.
 *
 * An upcoming recording has not happened yet, so the destructive act is
 * *cancelling the schedule*; anything else already exists on disk and the act
 * is *deleting the file*. Getting this backwards would put "Delete" on a
 * recording that does not exist yet, and offer to "Cancel" one that has
 * already finished - so the wording, and what the confirm button then calls,
 * both hang off this one comparison.
 */
export const RECORDING_UPCOMING = 'REC_UPCOMING';

export type RecordingDialogState = State.DELETE_DIALOG | State.CANCEL_DIALOG;

export const dialogForKind = (kind: string | undefined): RecordingDialogState =>
    kind === RECORDING_UPCOMING ? State.CANCEL_DIALOG : State.DELETE_DIALOG;
