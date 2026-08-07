/**
 * What the recordings screen is currently showing. Lives here rather than in
 * Player.tsx for the same reason TVState does: so the navigation rules can be
 * unit tested without importing the component and, with it, the video element
 * and the whole Enact tree.
 *
 * The string values are the ones Player.tsx has always used.
 */
export enum State {
    PLAYER = 'player',
    PLAYER_INFO = 'playerInfo',
    RECORDINGS_LIST = 'recordingsList',
    RECORDINGS_SETTINGS = 'recordingSettings'
}
