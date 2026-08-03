export type ChannelFilterKind = 'all' | 'favorites' | 'tag';

/** Which subset of the lineup is currently active. */
export default interface ChannelFilter {
    kind: ChannelFilterKind;
    /** Only set when kind is 'tag'. */
    tagUuid?: string;
}

export const ALL_CHANNELS: ChannelFilter = { kind: 'all' };

export const FAVORITE_CHANNELS: ChannelFilter = { kind: 'favorites' };

export const tagFilter = (tagUuid: string): ChannelFilter => ({ kind: 'tag', tagUuid: tagUuid });

export const isSameFilter = (a: ChannelFilter, b: ChannelFilter): boolean =>
    a.kind === b.kind && a.tagUuid === b.tagUuid;
