/**
 * What the recordings *list* is showing. Distinct from RecordingsState, which
 * is the screen around it: the list is one of that screen's states, and has
 * its own confirm dialogs on top.
 *
 * Extracted from RecordingList.tsx so the delete/cancel choice can be unit
 * tested without importing a component that wants a canvas.
 */
export enum State {
    NORMAL = 'normal',
    DETAILS = 'details',
    DELETE_DIALOG = 'deleteDialog',
    CANCEL_DIALOG = 'cancelDialog'
}
