import { State } from '../models/TVState';
import { State as RecordingsState } from '../models/RecordingsState';

/**
 * Where BACK goes from the live-TV screen.
 *
 * With something open - the channel list, the guide, the audio panel - BACK
 * dismisses it and returns to plain TV, which is what it has always done.
 *
 * While simply watching a channel it now opens the guide instead of doing
 * nothing. That covers CHANNEL_INFO as well as TV: the info bar is the state
 * the app lands in after every zap (TV.tsx sets it in updateStreamSource, and
 * it is the initial state), so "watching a channel" is usually CHANNEL_INFO
 * rather than TV. Treating only TV as watching would make BACK appear to work
 * only sometimes, depending on whether the info bar happened to be showing.
 *
 * The result is a symmetric toggle: BACK from watching opens the guide, BACK
 * from the guide returns to watching. Nothing is lost - OK already toggles the
 * info bar, and BACK never exited the app anyway, because TV.tsx stops
 * propagation on it and appinfo.json sets disableBackHistoryAPI.
 */
export const nextStateOnBack = (state: State): State =>
    state === State.TV || state === State.CHANNEL_INFO ? State.EPG : State.TV;

/**
 * Where BACK goes from the recordings screen. `null` means "leave the
 * recordings view entirely" - the caller's unmount.
 *
 * The rule is a ladder, and the null rung is the whole point. Every sub-state
 * drops one level to the player; from the player, the bottom, BACK leaves.
 * Before this, BACK from the player set the state it was already in, so the
 * view had no exit: the only way out was the menu, on GREEN, a button modern
 * Magic Remotes do not have - and which the recordings list consumed anyway.
 * A screen that cannot be left is indistinguishable from a crashed app, and on
 * a TV the user's only recourse is to kill it from the launcher.
 */
export const nextStateOnRecordingsBack = (state: RecordingsState): RecordingsState | null =>
    state === RecordingsState.PLAYER ? null : RecordingsState.PLAYER;
