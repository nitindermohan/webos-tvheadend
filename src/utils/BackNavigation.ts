import { State } from '../models/TVState';

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
