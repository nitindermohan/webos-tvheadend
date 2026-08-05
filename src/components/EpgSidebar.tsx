import React from 'react';
import ChannelFilter, { isSameFilter } from '../models/ChannelFilter';
import { FilterEntry } from '../utils/FilterEntries';

/**
 * How much of the screen the sidebar occupies. TVGuide subtracts this from its
 * own `getWidth()` and shifts the canvas right by the same amount, so the grid
 * keeps drawing into a coordinate space that starts at 0 and the sidebar never
 * overlaps it. Every x-coordinate in that file derives from `getWidth()`, which
 * is why one constant is enough.
 */
export const SIDEBAR_WIDTH = 260;

/**
 * The EPG's category column. Unlike the channel list's dropdown this is one
 * flat list with favorites as its first row - there is no second control beside
 * it to own favorites, and the whole point of the column is that every filter
 * is visible at once without opening anything.
 */
const EpgSidebar = (props: {
    entries: FilterEntry[];
    activeFilter: ChannelFilter;
    focusedIndex: number;
    isFocused: boolean;
    onSelect: (index: number) => void;
}) => (
    <div
        className={props.isFocused ? 'epgSidebar focused' : 'epgSidebar'}
        style={{ width: SIDEBAR_WIDTH }}
        // the sidebar sits inside the EPG wrapper, whose onClick zaps to the
        // focused channel and closes the guide - a click that misses a row
        // must do nothing rather than dismiss the screen
        onClick={(event) => event.stopPropagation()}
    >
        <div className="epgSidebarTitle">Categories</div>
        {props.entries.map((entry, index) => {
            const names = ['epgSidebarItem'];
            if (isSameFilter(entry.filter, props.activeFilter)) names.push('active');
            if (props.isFocused && index === props.focusedIndex) names.push('focused');
            return (
                <div
                    className={names.join(' ')}
                    key={index}
                    ref={(element) =>
                        props.isFocused && index === props.focusedIndex && element?.scrollIntoView({ block: 'nearest' })
                    }
                    onClick={(event) => {
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

export default EpgSidebar;
