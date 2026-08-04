import EPGChannel from '../models/EPGChannel';
import ChannelTag from '../models/ChannelTag';

/** An entry from TVHeadend's api/channeltag/grid. */
export interface TVHChannelTagEntry {
    uuid: string;
    name: string;
    index?: number;
}

/** An entry from TVHeadend's api/channel/grid. */
export interface TVHChannelEntry {
    uuid: string;
    tags?: string[];
}

/**
 * Join TVHeadend tag data onto channels loaded from the M3U playlist. The join
 * key is the channel uuid, which the playlist carries as tvg-id. Channels the
 * join misses are simply left untagged and appear under "All" only.
 *
 * Mutates the channels, and returns the tags that actually have channels,
 * ordered by TVHeadend's index then alphabetically.
 */
export const applyChannelTags = (
    channels: EPGChannel[],
    tagEntries: TVHChannelTagEntry[],
    channelEntries: TVHChannelEntry[]
): ChannelTag[] => {
    const tagsByChannelUuid: { [uuid: string]: string[] } = {};
    channelEntries.forEach((entry) => {
        tagsByChannelUuid[entry.uuid] = entry.tags || [];
    });

    const counts: { [tagUuid: string]: number } = {};
    channels.forEach((channel) => {
        const tagUuids = tagsByChannelUuid[channel.getUUID()] || [];
        channel.setTagUuids(tagUuids);
        tagUuids.forEach((tagUuid) => {
            counts[tagUuid] = (counts[tagUuid] || 0) + 1;
        });
    });

    return tagEntries
        .map((entry) => ({
            uuid: entry.uuid,
            name: entry.name,
            index: entry.index || 0,
            channelCount: counts[entry.uuid] || 0
        }))
        .filter((tag) => tag.channelCount > 0)
        .sort((a, b) => (a.index !== b.index ? a.index - b.index : a.name.localeCompare(b.name)));
};
