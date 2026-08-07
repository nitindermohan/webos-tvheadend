export type ChannelFilterKind = 'all' | 'favorites' | 'tag' | 'search';

/** Which subset of the lineup is currently active. */
export default interface ChannelFilter {
    kind: ChannelFilterKind;
    /** Only set when kind is 'tag'. */
    tagUuid?: string;
    /** Only set when kind is 'search'. */
    query?: string;
}

export const ALL_CHANNELS: ChannelFilter = { kind: 'all' };

export const FAVORITE_CHANNELS: ChannelFilter = { kind: 'favorites' };

export const tagFilter = (tagUuid: string): ChannelFilter => ({ kind: 'tag', tagUuid: tagUuid });

/**
 * Search is a filter kind rather than a mechanism of its own, which is what
 * lets it inherit everything the others already got right: the playing channel
 * stays pinned into the view so its position index remains valid, positions
 * are reconciled on every re-filter, and an empty result is reported rather
 * than silently shown as an empty list.
 */
export const searchFilter = (query: string): ChannelFilter => ({ kind: 'search', query: query });

export const isSameFilter = (a: ChannelFilter, b: ChannelFilter): boolean =>
    a.kind === b.kind && a.tagUuid === b.tagUuid && a.query === b.query;
