import React from 'react';
import ChannelFilter from '../models/ChannelFilter';
import { FilterEntry, isEntryActive } from '../utils/FilterEntries';

/**
 * How much of the screen the column occupies.
 *
 * Both consumers subtract this from their own canvas width and shift the
 * canvas right by the same amount, so each grid keeps drawing into a
 * coordinate space that starts at 0 and the column never overlaps it. Every
 * x-coordinate in those files derives from their `getWidth()`, which is why
 * one constant is enough for both.
 */
export const GROUPS_WIDTH = 280;

/**
 * The persistent category column, shared by the channel list and the EPG.
 *
 * This replaces two divergent implementations: the channel list's collapsed
 * control plus dropdown, and the EPG's own sidebar. They had different
 * gestures, different focus models and different ideas about where favourites
 * lived, which meant learning the app twice. TiviMate's arrangement - a column
 * of groups always visible beside the content it filters - is one idiom, and
 * left/right between columns is the D-pad's natural gesture.
 *
 * Losing the dropdown also removes a whole open/closed state from the channel
 * list, and with it the class of bug where focus sat somewhere the user could
 * not see.
 *
 * Favourites is the first row rather than a control of its own. In a single
 * column there is no second control for it to be, and every filter being
 * visible at once is the point.
 */
const GroupsColumn = (props: {
    entries: FilterEntry[];
    activeFilter: ChannelFilter;
    focusedIndex: number;
    isFocused: boolean;
    onSelect: (index: number) => void;
    /**
     * The pointer moved onto a row.
     *
     * Kept separate from onSelect because hovering must not apply a filter -
     * it only moves the cursor, and only if the host decides the column owns
     * focus. Leaving the cursor where the D-pad last put it while the pointer
     * sits somewhere else means the next direction press jumps from a position
     * the user is no longer looking at.
     */
    onHover?: (index: number) => void;
    /** Extra classes on the container, for per-screen positioning. */
    className?: string;
}) => (
    <div
        className={['groupsColumn', props.isFocused ? 'focused' : '', props.className || ''].join(' ').trim()}
        style={{ width: GROUPS_WIDTH }}
        // Both hosts wrap this in an element whose own onClick zaps to the
        // focused channel and closes the screen. A click that lands in the
        // column but misses a row must do nothing rather than dismiss
        // everything - and the Magic Remote has a real pointer, so this is a
        // gesture users will actually make.
        onClick={(event) => event.stopPropagation()}
    >
        <div className="groupsColumnTitle">Categories</div>
        {props.entries.map((entry, index) => {
            const names = ['groupsColumnItem'];
            if (isEntryActive(entry, props.activeFilter)) names.push('active');
            if (props.isFocused && index === props.focusedIndex) names.push('focused');
            return (
                <div
                    className={names.join(' ')}
                    key={index}
                    // the browser scrolls the focused row into view rather than
                    // our own scroll model. The pill rail's worst defect was
                    // focus moving with nothing following it.
                    ref={(element) =>
                        props.isFocused && index === props.focusedIndex && element?.scrollIntoView({ block: 'nearest' })
                    }
                    onClick={(event) => {
                        event.stopPropagation();
                        props.onSelect(index);
                    }}
                    // onMouseMove rather than onMouseEnter, which only fires on
                    // crossing the row's boundary: a pointer already parked on
                    // a row when the column *gains* focus would never correct
                    // the cursor, and the next direction press would move from
                    // somewhere the user is not looking. Unthrottled because
                    // the browser does the hit-testing and React bails out of
                    // re-rendering when the index is unchanged - unlike the
                    // canvas list, where every mousemove would repaint
                    // everything.
                    onMouseMove={() => props.onHover && props.onHover(index)}
                >
                    {entry.label}
                </div>
            );
        })}
    </div>
);

export default GroupsColumn;
