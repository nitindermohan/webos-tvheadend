/**
 * What the live-TV screen is currently showing. Lives here rather than in
 * TV.tsx so navigation rules can be unit tested without importing the
 * component, which would pull in the whole Enact component tree.
 *
 * The string values are the ones TV.tsx has always used, including the
 * "channleList" typo - they are compared as values in a few places, so they
 * are left alone deliberately.
 */
export enum State {
    TV = 'tv',
    EPG = 'epg',
    CHANNEL_LIST = 'channleList',
    CHANNEL_INFO = 'channelInfo',
    CHANNEL_SETTINGS = 'channelSettings'
}
