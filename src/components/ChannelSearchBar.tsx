import React, { useEffect, useRef } from 'react';
import RemoteKeys from '../utils/RemoteKeys';

/**
 * The bar's height, applied to the element inline so the rendered height *is*
 * the number each host offsets its canvas by. Same arrangement the old category
 * rail used, and for the reason that one earned: a CSS height and a drawing
 * constant that are merely supposed to agree eventually do not.
 */
export const SEARCH_BAR_HEIGHT = 86;

/**
 * How the user left the field. The hosts differ in where "the content" is - a
 * channel list in one, an EPG grid in the other - so they map these; the rules
 * for which key means which are here, once.
 */
export type SearchExit =
    /** BACK: abandon the search and put the lineup back. */
    | 'cancel'
    /** OK or DOWN: keep the query, move into the results. */
    | 'accept'
    /** LEFT: keep the query, return to the column it was opened from. */
    | 'column';

/**
 * The channel search field, shared by the channel list and the guide.
 *
 * Shared rather than copied because the two screens are the same interaction
 * with a different grid behind it, and the parts worth getting right - which
 * key leaves and how, that typing must not reach the host's own handler, that
 * focus lands on the input rather than its wrapper - are exactly the parts that
 * would drift apart in two copies.
 */
const ChannelSearchBar = (props: {
    query: string;
    onQueryChange: (query: string) => void;
    /** Genuine matches, or null to show nothing (an empty query). */
    matchCount: number | null;
    /**
     * The query matched nothing.
     *
     * Reported separately rather than as a count of zero because it is not a
     * count - both hosts fall back to showing the whole lineup when a filter
     * matches nothing, so without saying so the screen looks like a search that
     * found everything. The guide has no empty banner of its own, which is why
     * this lives in the bar: it is the one element guaranteed to be on screen
     * whenever a search is applied.
     */
    noMatches: boolean;
    isFocused: boolean;
    onExit: (exit: SearchExit) => void;
}) => {
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // The input itself, not its wrapper: focus on a real input is what
        // raises the TV's on-screen keyboard, and without it the field would be
        // visible and uncollectable - the user would type into the grid behind.
        if (props.isFocused) {
            input.current?.focus();
        }
    }, [props.isFocused]);

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        switch (event.keyCode) {
            case RemoteKeys.BACK:
            case RemoteKeys.KEY_B:
                event.stopPropagation();
                props.onExit('cancel');
                break;
            case RemoteKeys.OK:
            case RemoteKeys.ARROW_DOWN:
                event.stopPropagation();
                props.onExit('accept');
                break;
            case RemoteKeys.ARROW_LEFT:
                event.stopPropagation();
                props.onExit('column');
                break;
            default:
                // Stop the bubble but do not preventDefault: the keystroke still
                // reaches the input and becomes a character, while the host's
                // handler on the ancestor never sees it. Without this, typing a
                // channel number would zap channels as it went.
                event.stopPropagation();
                break;
        }
    };

    return (
        <div
            className={props.isFocused ? 'channelSearch focused' : 'channelSearch'}
            style={{ height: SEARCH_BAR_HEIGHT }}
            // a click that lands on the bar must not reach the host, whose own
            // click handler zaps to the focused channel and closes the screen
            onClick={(event) => event.stopPropagation()}
        >
            <input
                ref={input}
                className="channelSearchInput"
                type="text"
                value={props.query}
                placeholder="Channel name or number"
                // A plain input rather than Enact's: it is what raises the TV's
                // on-screen keyboard, and Moonstone's widgets carry their own
                // styling and ignore the theme.
                onChange={(event) => props.onQueryChange(event.target.value)}
                onKeyDown={handleKeyPress}
            />
            <span className={props.noMatches ? 'channelSearchCount empty' : 'channelSearchCount'}>
                {props.noMatches ? 'No matches — showing all channels' : ''}
                {!props.noMatches && props.matchCount !== null ? props.matchCount + ' found' : ''}
            </span>
        </div>
    );
};

export default ChannelSearchBar;
