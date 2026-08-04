/** A TVHeadend channel tag, surfaced in the UI as a category. */
export default interface ChannelTag {
    uuid: string;
    name: string;
    /** TVHeadend's own ordering hint; all zero on many servers. */
    index: number;
    /** How many channels in the current lineup carry this tag. */
    channelCount: number;
}
