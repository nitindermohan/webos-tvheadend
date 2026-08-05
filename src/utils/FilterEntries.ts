import ChannelTag from '../models/ChannelTag';
import ChannelFilter, { ALL_CHANNELS, FAVORITE_CHANNELS, tagFilter, isSameFilter } from '../models/ChannelFilter';

export const FAVORITES_LABEL = '★ Favorites';
export const ALL_LABEL = 'All';

export interface FilterEntry {
    label: string;
    filter: ChannelFilter;
}

/**
 * The category list: `All`, then the tags the user selected in the category
 * picker, in the order the server reported them. Selected uuids that no longer
 * exist on the server are dropped silently.
 *
 * Favorites is deliberately *not* in here. In the channel list it is a separate
 * one-press control beside the category dropdown, so putting it in the dropdown
 * as well would give the same filter two homes and make the dropdown's
 * highlighted row disagree with the favorites control.
 */
export const buildCategoryEntries = (tags: ChannelTag[], selectedTagUuids: string[]): FilterEntry[] => {
    const entries: FilterEntry[] = [{ label: ALL_LABEL, filter: ALL_CHANNELS }];

    tags.forEach((tag) => {
        if (selectedTagUuids.indexOf(tag.uuid) >= 0) {
            entries.push({ label: tag.name, filter: tagFilter(tag.uuid) });
        }
    });

    return entries;
};

/**
 * Every filter as one flat list, favorites first. Used by the EPG sidebar,
 * which has no separate favorites control - it is a single column, so
 * favorites has to be one of its rows.
 */
export const buildFilterEntries = (tags: ChannelTag[], selectedTagUuids: string[]): FilterEntry[] => [
    { label: FAVORITES_LABEL, filter: FAVORITE_CHANNELS },
    ...buildCategoryEntries(tags, selectedTagUuids)
];

/** Where a filter sits in the list, or -1 when it is not offered at all. */
export const indexOfFilter = (entries: FilterEntry[], filter: ChannelFilter): number =>
    entries.findIndex((entry) => isSameFilter(entry.filter, filter));

/**
 * What to print on the collapsed category control. Falls back to `All` rather
 * than an empty control: a tag filter can outlive the tag it names (persisted
 * across a restart, then deselected in the picker or removed on the server),
 * and an unlabelled control reads as broken.
 */
export const labelForFilter = (entries: FilterEntry[], filter: ChannelFilter): string => {
    const index = indexOfFilter(entries, filter);
    return index >= 0 ? entries[index].label : ALL_LABEL;
};
