import React from 'react';
import ChannelTag from '../models/ChannelTag';
import ChannelFilter, { ALL_CHANNELS, FAVORITE_CHANNELS, tagFilter, isSameFilter } from '../models/ChannelFilter';

export interface RailEntry {
    label: string;
    filter: ChannelFilter;
}

/**
 * The rail always offers Favorites and All, then the tags the user selected in
 * the category picker, in the order the server reported them. Selected uuids
 * that no longer exist on the server are dropped silently.
 */
export const buildRailFilters = (tags: ChannelTag[], selectedTagUuids: string[]): RailEntry[] => {
    const entries: RailEntry[] = [
        { label: '★ Favorites', filter: FAVORITE_CHANNELS },
        { label: 'All', filter: ALL_CHANNELS }
    ];

    tags.forEach((tag) => {
        if (selectedTagUuids.indexOf(tag.uuid) >= 0) {
            entries.push({ label: tag.name, filter: tagFilter(tag.uuid) });
        }
    });

    return entries;
};

const FilterRail = (props: {
    entries: RailEntry[];
    activeFilter: ChannelFilter;
    focusedIndex: number;
    isFocused: boolean;
    onSelect: (index: number) => void;
}) => (
    <div className={props.isFocused ? 'filterRail focused' : 'filterRail'}>
        {props.entries.map((entry, index) => {
            const classNames = ['filterPill'];
            if (isSameFilter(entry.filter, props.activeFilter)) {
                classNames.push('active');
            }
            if (props.isFocused && index === props.focusedIndex) {
                classNames.push('focused');
            }
            return (
                <div
                    className={classNames.join(' ')}
                    key={index}
                    onClick={(event) => {
                        // the rail renders inside ChannelList's wrapper, whose
                        // onClick selects the focused channel and closes the
                        // list - without stopping propagation, clicking a pill
                        // would zap and dismiss instead of filtering. The LG
                        // Magic Remote has a pointer, so this is a real remote
                        // path, not just a desktop-browser one.
                        event.stopPropagation();
                        props.onSelect(index);
                    }}
                >
                    {entry.label}
                </div>
            );
        })}
    </div>
);

export default FilterRail;
