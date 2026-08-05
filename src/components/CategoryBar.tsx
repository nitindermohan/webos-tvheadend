import React from 'react';
import ChannelFilter, { isSameFilter } from '../models/ChannelFilter';
import { FilterEntry, FAVORITES_LABEL, labelForFilter } from '../utils/FilterEntries';

/** Which of the bar's two controls holds D-pad focus. */
export type BarControl = 'favorites' | 'category';

/**
 * The channel list's header: a one-press `★ Favorites` control beside a
 * collapsed category control that expands into a vertical dropdown.
 *
 * This replaces the horizontal pill rail, which had three defects at once on a
 * real lineup (14 tags needed ~2282px of a 852px rail): it overflowed, it
 * painted over the channel rows, and focus could move past the visible edge
 * with nothing scrolling it back into view. A vertical list fixes all three -
 * the rows fit, and the one that does not is scrolled to by the browser.
 *
 * The bar's height is fixed at BAR_HEIGHT rather than derived from its padding
 * because ChannelList positions every canvas row from that number
 * (`getTopFrom`) *and* hit-tests pointer clicks against it
 * (`ChannelListGeometry`). A bar whose real height drifted from the constant
 * would put the drawn rows and the click targets out of step. The dropdown
 * overlays the rows rather than pushing them down for the same reason: nothing
 * about opening it may change the row geometry.
 */
export const BAR_HEIGHT = 86;

const CategoryBar = (props: {
    /** All + the selected tags. Favorites is the separate control, not a row. */
    categoryEntries: FilterEntry[];
    activeFilter: ChannelFilter;
    /** undefined while focus is down in the channel list. */
    focusedControl?: BarControl;
    isDropdownOpen: boolean;
    dropdownIndex: number;
    onSelectFavorites: () => void;
    onOpenDropdown: () => void;
    onSelectCategory: (index: number) => void;
}) => {
    const isFavoritesActive = props.activeFilter.kind === 'favorites';

    const controlClass = (name: BarControl, isActive: boolean) => {
        const names = ['categoryControl'];
        if (isActive) names.push('active');
        if (props.focusedControl === name) names.push('focused');
        return names.join(' ');
    };

    // Every control stops propagation: the bar renders inside ChannelList's
    // wrapper, whose onClick zaps to the clicked row and closes the list. The
    // Magic Remote has a real pointer, so without this, pointing at a category
    // would change channel instead of filtering.
    const handle = (action: () => void) => (event: React.MouseEvent) => {
        event.stopPropagation();
        action();
    };

    return (
        <>
            <div className="categoryBar" style={{ height: BAR_HEIGHT }}>
                <div
                    className={controlClass('favorites', isFavoritesActive)}
                    onClick={handle(props.onSelectFavorites)}
                >
                    {FAVORITES_LABEL}
                </div>
                <div
                    className={controlClass('category', !isFavoritesActive)}
                    onClick={handle(props.onOpenDropdown)}
                >
                    {labelForFilter(props.categoryEntries, props.activeFilter)}
                    <span className="categoryCaret">{props.isDropdownOpen ? '▴' : '▾'}</span>
                </div>
            </div>

            {props.isDropdownOpen && (
                <div className="categoryDropdown" style={{ top: BAR_HEIGHT }} onClick={handle(() => undefined)}>
                    {props.categoryEntries.map((entry, index) => {
                        const isFocused = index === props.dropdownIndex;
                        const names = ['categoryDropdownItem'];
                        if (!isFavoritesActive && isSameFilter(entry.filter, props.activeFilter)) {
                            names.push('active');
                        }
                        if (isFocused) names.push('focused');
                        return (
                            <div
                                className={names.join(' ')}
                                key={index}
                                // the focused row is scrolled into view by the
                                // browser rather than by our own scroll model -
                                // the rail's worst defect was focus moving with
                                // nothing following it
                                ref={(element) => isFocused && element?.scrollIntoView({ block: 'nearest' })}
                                onClick={handle(() => props.onSelectCategory(index))}
                            >
                                {entry.label}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
};

export default CategoryBar;
