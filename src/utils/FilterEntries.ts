import ChannelTag from '../models/ChannelTag';
import ChannelFilter, { ALL_CHANNELS, FAVORITE_CHANNELS, tagFilter, isSameFilter, searchFilter } from '../models/ChannelFilter';

export const FAVORITES_LABEL = '★ Favorites';
export const ALL_LABEL = 'All';
export const SEARCH_LABEL = 'Search';

/**
 * The search row, for hosts that can actually collect a query.
 *
 * Not folded into buildFilterEntries, because that list is shared with the EPG
 * sidebar and only the channel list has the input to drive it. A row that
 * appears everywhere and works in one place is worse than a row in one place.
 *
 * Its filter carries an empty query, which matches every channel - so landing
 * on the row before typing leaves the lineup alone rather than blanking it.
 */
export const SEARCH_ENTRY: FilterEntry = { label: SEARCH_LABEL, filter: searchFilter('') };

/**
 * Whether a column row should read as the active one.
 *
 * Search needs its own rule: the active filter carries whatever has been typed
 * so far, so comparing it by value to the row's empty-query filter would make
 * the row stop looking active the moment the user typed a character - the one
 * moment they most need to see where they are.
 */
export const isEntryActive = (entry: FilterEntry, activeFilter: ChannelFilter): boolean =>
    entry.filter.kind === 'search' ? activeFilter.kind === 'search' : isSameFilter(entry.filter, activeFilter);

/**
 * Which row the "Categories" heading belongs above, or -1 for no heading.
 *
 * The column is not a list of categories. It leads with Search, which is an
 * action, then Favorites, which is a filter of its own and pointedly not a
 * category - and only then the categories themselves. A single heading over
 * the whole column labelled the first two rows as something they are not.
 *
 * Derived from the entries rather than hardcoded to an index, so adding or
 * removing a leading row moves the heading with it instead of silently
 * mislabelling one more thing.
 */
export const categoryHeadingIndex = (entries: FilterEntry[]): number =>
    entries.findIndex((entry) => entry.filter.kind === 'all' || entry.filter.kind === 'tag');

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
