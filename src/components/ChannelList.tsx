import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Rect from '../models/Rect';
import CanvasUtils from '../utils/CanvasUtils';
import AppContext from '../AppContext';
import '../styles/app.css';
import { getTheme, withAlpha } from '../utils/Theme';
import ChannelListDetails from './ChannelListDetails';
import EPGEvent from '../models/EPGEvent';
import EPGChannel from '../models/EPGChannel';
import EPGUtils from '../utils/EPGUtils';
import GroupsColumn, { GROUPS_WIDTH } from './GroupsColumn';
import ChannelSearchBar, { SEARCH_BAR_HEIGHT, SearchExit } from './ChannelSearchBar';
import {
    buildFilterEntries,
    FilterEntry,
    indexOfFilter,
    labelForFilter,
    SEARCH_ENTRY
} from '../utils/FilterEntries';
import { wrapIndex } from '../utils/ListNavigation';
import CategoryStore from '../utils/CategoryStore';
import RemoteKeys from '../utils/RemoteKeys';
import ChannelFilter, { ALL_CHANNELS, searchFilter } from '../models/ChannelFilter';
import FavoritesStore from '../utils/FavoritesStore';
import HoldGesture from '../utils/HoldGesture';
import { channelPositionAt, scrollTargetFor } from '../utils/ChannelListGeometry';
import { channelInitials } from '../utils/ChannelInitials';
import { createFrameThrottle } from '../utils/FrameThrottle';
import { scrollThumb } from '../utils/ScrollIndicator';
import { advanceScroll } from '../utils/ScrollAnimation';
import { scaled } from '../utils/Appearance';

const VERTICAL_SCROLL_TOP_PADDING_ITEM = 5;
const IS_DEBUG = false;

enum State {
    NORMAL = 'normal',
    DETAILS = 'details',
    /** Focus is in the category column beside the list, which owns up/down. */
    GROUPS = 'groups',
    /** The search field has focus and is collecting a query. */
    SEARCH = 'search'
}

interface DetailsState {
    focusedChannel?: EPGChannel;
    focusedEvent?: EPGEvent;
}

const ChannelList = (props: {
    toggleRecording: (event: EPGEvent, callback: () => unknown) => void;
    unmount: () => void;
}) => {
    const {
        epgData,
        imageCache,
        logoVersion,
        fontVersion,
        currentChannelPosition,
        setCurrentChannelPosition,
        isAnimationsEnabled,
        channelTags,
        activeFilter,
        setActiveFilter,
        favoritesVersion,
        bumpFavoritesVersion,
        appearance
    } = useContext(AppContext);
    const { density, textScale, showChannelNumbers } = appearance;
    const canvas = useRef<HTMLCanvasElement>(null);
    const listWrapper = useRef<HTMLDivElement>(null);
    const scrollAnimationId = useRef(0);
    const scrollY = useRef(0);
    const channelPosition = useRef(currentChannelPosition);

    const focusedEventOffset = useRef(0);
    const nextEvents = useRef<EPGEvent[]>([]);
    const nextSameEvents = useRef<EPGEvent[]>([]);

    // hold-to-favorite state for the OK button. The gesture instance is
    // created once and is stable for the component's lifetime; onToggleFavoriteRef
    // is a trampoline updated every render so the gesture always invokes the
    // *current* render's toggleFavorite closure (which itself closes over
    // channelPosition and epgData) without HoldGesture needing to be
    // recreated - see HoldGesture.ts for why this state machine is a
    // separate, independently tested class rather than inline refs.
    const onToggleFavoriteRef = useRef<() => void>(() => undefined);
    const holdGesture = useRef(new HoldGesture(600, () => onToggleFavoriteRef.current()));

    // pointer hover, coalesced to one repaint per frame. Same trampoline
    // arrangement as the hold gesture above and for the same reason: the
    // throttle is created once and must always call the *current* render's
    // handler, which closes over `state` and the epg data.
    const onHoverPointRef = useRef<(point: { x: number; y: number }) => void>(() => undefined);
    const hoverThrottle = useRef(
        createFrameThrottle<{ x: number; y: number }>((point) => onHoverPointRef.current(point))
    );

    // Row height and text sizes come from the density descriptor; everything
    // horizontal below is shared, so switching density changes the rhythm of
    // the list without moving a single column sideways.
    //
    // The text scale then multiplies *both* the text and the boxes around it.
    // Scaling only the text is the tempting version and it is wrong: at
    // Largest a 32px name becomes 42px inside an unchanged 48px compact row,
    // and the 38px channel number becomes 49px, wide enough that a three-digit
    // number right-aligned at x+70 starts at x-11 and is clipped by the edge
    // of the canvas. Row height and the left gutter scale with it instead.
    const mChannelLayoutTextSize = scaled(density.nameTextSize, textScale);
    const mChannelLayoutEventTextSize = scaled(26, textScale);
    const mChannelLayoutNumberTextSize = scaled(density.numberTextSize, textScale);
    const mChannelLayoutTextColor = getTheme().textPrimary;
    const mChannelLayoutTitleTextColor = getTheme().textSecondary;
    const mChannelLayoutMargin = 3;
    const mChannelLayoutPadding = 7;
    const mChannelLayoutHeight = scaled(density.rowHeight, textScale);
    const mChannelLayoutWidth = 900;
    // The selected row used to be flooded with solid cyan, which put the
    // #cccccc row text at poor contrast against it - the single most obvious
    // thing wrong with the list. It is now a card fill with an accent bar down
    // the left edge, so "this is the channel playing" is carried by the marker
    // rather than by drowning the row.
    const mChannelLayoutBackgroundFocus = withAlpha(getTheme().surfaceCard, 0.96);
    const mChannelLayoutSelectionMarker = getTheme().accent;
    const mChannelLayoutSelectionMarkerWidth = 6;
    // The y-origin of row 0. Zero with the categories in a column beside the
    // list, and the search bar's height while a search is active - the bar is
    // an overlay at the top of the list area, so without this it covers row 0,
    // which is exactly where the cursor starts. The first result being the one
    // result you cannot see is not a subtle failure.
    //
    // Kept named and threaded through rather than inlined, because getTopFrom
    // and ChannelListGeometry's pointer hit-test must both use it - the two
    // drifting apart puts drawn rows and click targets out of step, silently.
    const mChannelListTopOffset = activeFilter.kind === 'search' ? SEARCH_BAR_HEIGHT : 0;
    // The left gutter, as three offsets that must stay in step: the channel
    // number's right edge, the favourite star's centre, and the left edge of
    // the name column (channel name, recording mark, event progress bar and
    // text).
    //
    // Derived rather than three literals, because they have to move together
    // twice over. The star's slot was too narrow for its own glyph until the
    // name column moved from 90 to 114 to open it - see the favorite marker
    // comment in drawChannelItem - and now the whole gutter also scales with
    // the text, and collapses when the channel numbers are switched off.
    // Turning the numbers off without reclaiming their column would leave 70px
    // of empty black where a number used to be, which reads as a rendering
    // fault rather than as a setting.
    //
    // At Normal with numbers on these are 70, 92 and 114 - the values they
    // have always had.
    const mChannelNumberRight = showChannelNumbers ? scaled(70, textScale) : 0;
    const mFavoriteMarkerCenter = mChannelNumberRight + scaled(22, textScale);
    const mChannelLayoutNameLeft = mFavoriteMarkerCenter + scaled(22, textScale);
    // The scroll indicator's track runs down the right edge of the list, and
    // the artwork column gives up mScrollIndicatorGutter to make room for it.
    // mChannelArtRight is the single right edge every art-column calculation
    // reads - the logo rect, the initials plate, and the name's maxWidth all
    // derived it separately before, which is exactly how a long channel name
    // ends up running underneath a logo.
    const mScrollIndicatorWidth = 4;
    const mScrollIndicatorGutter = 12;
    const mChannelArtRight = mChannelLayoutWidth - mChannelLayoutMargin - mScrollIndicatorGutter;

    const [state, setState] = useState<State>(State.NORMAL);
    const [detailsState, setDetailsState] = useState<DetailsState>();

    // Favourites is a row here now, not a control of its own - the single
    // column has nowhere else to put it, and it means the channel list and the
    // EPG offer exactly the same list in the same order.
    // Search leads, because it is the row you want when the list is long
    // enough to need the column at all - and because a lineup of 900 channels
    // is exactly where scrolling to find one stops being reasonable.
    const groupEntries: FilterEntry[] = [
        SEARCH_ENTRY,
        ...buildFilterEntries(channelTags, CategoryStore.getSelectedTagUuids())
    ];
    const [groupsIndex, setGroupsIndex] = useState(() => Math.max(0, indexOfFilter(groupEntries, activeFilter)));
    const [searchQuery, setSearchQuery] = useState('');
    // The unmount cleanup runs with the closure from the render that mounted
    // this component, where activeFilter was whatever it was then. A ref kept
    // current is the only way for it to see the filter as it stands at unmount.
    const activeFilterRef = useRef(activeFilter);
    activeFilterRef.current = activeFilter;
    const [detailsActionIndex, setDetailsActionIndex] = useState(0);

    const getTopFrom = (position: number) => {
        const y = position * mChannelLayoutHeight + mChannelListTopOffset;
        return y - scrollY.current;
    };

    const scrollToChannelPosition = (channelPosition: number, withAnimation: boolean) => {
        // All three of the old branches here - "still in the top padding",
        // "into the bottom padding", "somewhere in the middle" - collapse into
        // one clamp, which is also what fixes the two bugs they carried. See
        // scrollTargetFor for both.
        const scrollTarget = scrollTargetFor(channelPosition, {
            rowHeight: mChannelLayoutHeight,
            channelCount: epgData.getChannelCount(),
            viewportHeight: getHeight() - mChannelListTopOffset,
            topPadding: VERTICAL_SCROLL_TOP_PADDING_ITEM
        });

        if (!withAnimation || scrollTarget === scrollY.current) {
            // The equality half is not an optimisation. animateScroll only
            // stops when the delta's sign says it has passed the target, so a
            // zero delta satisfies neither guard: it would reschedule itself
            // and repaint the whole list every frame, forever. The old
            // three-branch version returned early in exactly these cases, so
            // it never produced a zero distance; the clamp does, whenever two
            // neighbouring positions resolve to the same scroll offset - which
            // is every step through the last screenful of channels.
            scrollY.current = scrollTarget;
            updateCanvas();
            return;
        }

        const scrollDistance = scrollTarget - scrollY.current;
        const scrollDelta = scrollDistance / (mChannelLayoutHeight / 5);
        // stop existing animation if we have a new request
        cancelAnimationFrame(scrollAnimationId.current);
        scrollAnimationId.current = requestAnimationFrame(() => {
            animateScroll(scrollDelta, scrollTarget);
        });
    };

    const animateScroll = (scrollDelta: number, scrollTarget: number) => {
        // The arrival rule lives in ScrollAnimation so it can be tested by
        // running a whole animation to completion - the defect it fixes is a
        // drift that only shows up in where the last frame lands. Both of the
        // old branches carried `scrollY = scrollTarget` commented out;
        // presumably it read as a no-op, because correcting the offset without
        // a repaint changes nothing on screen.
        const step = advanceScroll(scrollY.current, scrollDelta, scrollTarget);
        scrollY.current = step.scrollY;

        if (step.done) {
            cancelAnimationFrame(scrollAnimationId.current);
        } else {
            scrollAnimationId.current = requestAnimationFrame(() => {
                animateScroll(scrollDelta, scrollTarget);
            });
        }
        updateCanvas();
    };

    const drawChannelListItems = (canvas: CanvasRenderingContext2D) => {
        // Background
        const drawingRect = new Rect();
        drawingRect.left = 0;
        drawingRect.top = 0;
        drawingRect.right = drawingRect.left + mChannelLayoutWidth;
        drawingRect.bottom = drawingRect.top + getHeight();
        canvas.globalAlpha = 1.0;
        // put stroke color to transparent
        //canvas.strokeStyle = "transparent";
        canvas.strokeStyle = 'gradient';
        //mPaint.setColor(mChannelLayoutBackground);
        // canvas.fillStyle = this.mChannelLayoutBackground;
        // Create gradient
        const grd = canvas.createLinearGradient(
            drawingRect.bottom,
            drawingRect.top,
            drawingRect.bottom,
            drawingRect.bottom
        );
        // Translucent so the video keeps showing through, and fading at both
        // ends so the list dissolves into the picture rather than ending on a
        // hard edge. Alpha matches the DOM panels' 0.92 in app.css.
        grd.addColorStop(0, withAlpha(getTheme().surfaceRaised, 0.75));
        grd.addColorStop(0.2, withAlpha(getTheme().surfaceRaised, 0.92));
        grd.addColorStop(0.8, withAlpha(getTheme().surfaceRaised, 0.92));
        grd.addColorStop(1, withAlpha(getTheme().surfaceRaised, 0.75));

        // Fill with gradient
        canvas.fillStyle = grd;
        canvas.fillRect(drawingRect.left, drawingRect.top, drawingRect.width, drawingRect.height);

        const firstPos = getFirstVisibleChannelPosition();
        const lastPos = getLastVisibleChannelPosition();

        //console.log("Channel: First: " + firstPos + " Last: " + lastPos);
        //let transparentTop = firstPos + 3;
        //let transparentBottom = lastPos - 3;
        canvas.globalAlpha = 1.0;
        for (let pos = firstPos; pos < lastPos; pos++) {
            // if (pos <= transparentTop) {
            //     canvas.globalAlpha += 0.25;
            // } else if (pos >= transparentBottom) {
            //     canvas.globalAlpha -= 0.25;
            // } else {
            //     canvas.globalAlpha = 1;
            // }
            drawChannelItem(canvas, pos);
        }

        drawScrollIndicator(canvas);
    };

    /**
     * The thumb down the right edge saying where these twelve rows sit in the
     * lineup.
     *
     * The channel numbers do not answer that. They are the server's numbering,
     * so they are neither contiguous nor tied to the filtered view - pick a
     * category and they stop corresponding to a position at all.
     *
     * Drawn after the rows so it is never covered by artwork, and skipped
     * entirely when everything fits, which is the common case once a small
     * category is selected.
     */
    const drawScrollIndicator = (canvas: CanvasRenderingContext2D) => {
        const thumb = scrollThumb({
            contentHeight: epgData.getChannelCount() * mChannelLayoutHeight,
            viewportHeight: getHeight() - mChannelListTopOffset,
            scrollY: scrollY.current,
            trackHeight: getHeight() - mChannelListTopOffset,
            // ~14px at 908 channels without a floor, which is a smear from a
            // sofa three metres away
            minThumbHeight: 48
        });
        if (!thumb) {
            return;
        }

        const left = mChannelLayoutWidth - mChannelLayoutMargin - mScrollIndicatorWidth;

        // the track is drawn too: a thumb alone gives the position but not the
        // scale, so there is no way to tell a third of the way down a short
        // list from a third of the way down a very long one
        canvas.fillStyle = withAlpha(getTheme().textSecondary, 0.14);
        canvas.fillRect(left, mChannelListTopOffset, mScrollIndicatorWidth, getHeight() - mChannelListTopOffset);

        canvas.fillStyle = withAlpha(getTheme().textSecondary, 0.6);
        canvas.fillRect(left, mChannelListTopOffset + thumb.top, mScrollIndicatorWidth, thumb.height);
    };

    const drawChannelItem = (canvas: CanvasRenderingContext2D, position: number) => {
        const isSelectedChannel = position === channelPosition.current;
        const channel = epgData.getChannel(position);
        const drawingRect = new Rect();

        // should not happen, but better check it
        if (!channel) return;

        drawingRect.left = 0;
        drawingRect.top = getTopFrom(position);
        drawingRect.right = mChannelLayoutWidth;
        drawingRect.bottom = drawingRect.top + mChannelLayoutHeight;
        IS_DEBUG && CanvasUtils.drawDebugRect(canvas, drawingRect);

        // highlight selected channel
        if (isSelectedChannel) {
            canvas.fillStyle = mChannelLayoutBackgroundFocus;
            canvas.fillRect(drawingRect.left, drawingRect.top, drawingRect.width, drawingRect.height);

            canvas.fillStyle = mChannelLayoutSelectionMarker;
            canvas.fillRect(
                drawingRect.left,
                drawingRect.top,
                mChannelLayoutSelectionMarkerWidth,
                drawingRect.height
            );
        }

        // channel number
        if (showChannelNumbers) {
            CanvasUtils.writeText(
                canvas,
                channel.getChannelID().toString(),
                drawingRect.left + mChannelNumberRight,
                drawingRect.middle,
                {
                    fontSize: mChannelLayoutNumberTextSize,
                    textAlign: 'right',
                    fillStyle: mChannelLayoutTextColor,
                    isBold: true
                }
            );
        }

        // channel line
        const currentEvent = epgData.getEventAtTimestamp(position, EPGUtils.getNow());
        const channelIconWidth = mChannelLayoutHeight * 1.3;
        // a compact row carries no logo, so the name gets the artwork column's
        // width back rather than being truncated around a box that is not there
        const channelNameWidth =
            mChannelArtRight - (density.isCompact ? 0 : channelIconWidth) - mChannelLayoutNameLeft;
        // In a two-line row the name sits on the upper line, above the
        // programme. A compact row has only the one line, so it centres.
        const nameY = density.isCompact ? drawingRect.middle : drawingRect.top + mChannelLayoutHeight * 0.33;

        const leftBeforeRecMark = drawingRect.left;
        // recording mark
        if (currentEvent && epgData.isRecording(currentEvent)) {
            const radius = 10;
            canvas.fillStyle = getTheme().danger;
            canvas.beginPath();
            // centred on the name's own line rather than the row's, so it stays
            // beside the text it qualifies at either density
            canvas.arc(drawingRect.left + mChannelLayoutNameLeft + radius, nameY, radius, 0, 2 * Math.PI);
            canvas.fill();
            drawingRect.left += 2 * radius + mChannelLayoutPadding;
        }
        // channel name
        CanvasUtils.writeText(canvas, channel.getName(), drawingRect.left + mChannelLayoutNameLeft, nameY, {
            fontSize: mChannelLayoutTextSize,
            fillStyle: mChannelLayoutTextColor,
            isBold: true,
            maxWidth: channelNameWidth
        });
        drawingRect.left = leftBeforeRecMark;

        // channel event - the second line, and so absent from a compact row
        if (currentEvent && !density.isCompact) {
            // channel event progress bar
            const channelEventProgressRect = new Rect();
            // shares the name column's left edge (mChannelLayoutNameLeft) so
            // the progress bar/event-text row stays aligned under the
            // channel name above it rather than the two rows drifting apart
            channelEventProgressRect.left = drawingRect.left + mChannelLayoutNameLeft;
            channelEventProgressRect.right = channelEventProgressRect.left + 80;
            channelEventProgressRect.top = drawingRect.top + mChannelLayoutHeight * 0.66;
            channelEventProgressRect.bottom = channelEventProgressRect.top + mChannelLayoutEventTextSize * 0.5;
            canvas.strokeStyle = mChannelLayoutTextColor;
            canvas.strokeRect(
                channelEventProgressRect.left,
                channelEventProgressRect.top,
                channelEventProgressRect.width,
                channelEventProgressRect.height
            );
            canvas.fillStyle = isSelectedChannel ? mChannelLayoutTextColor : mChannelLayoutTitleTextColor;
            canvas.fillRect(
                channelEventProgressRect.left + 2,
                channelEventProgressRect.top + 2,
                (channelEventProgressRect.width - 4) * currentEvent.getDoneFactor(),
                channelEventProgressRect.height - 4
            );

            // channel event text
            const channelEventWidth =
                mChannelArtRight - channelIconWidth - mChannelLayoutNameLeft - channelEventProgressRect.width;
            CanvasUtils.writeText(
                canvas,
                currentEvent.getTitle(),
                channelEventProgressRect.right + mChannelLayoutPadding,
                channelEventProgressRect.middle,
                {
                    fontSize: mChannelLayoutEventTextSize,
                    fillStyle: canvas.fillStyle,
                    maxWidth: channelEventWidth
                }
            );
        }

        // channel logo, or initials standing in for one. A compact row shows
        // neither: at 48px the logo box is 62px wide, which is too small to
        // recognise a broadcaster by - and the point of the density is to scan
        // 908 names quickly, which artwork at that size hinders rather than
        // helps. Dropping it also gives the name back the full row width.
        if (!density.isCompact) {
            const imageURL = channel.getImageURL();
            const image = imageURL && imageCache.get(imageURL);
            if (imageURL && image !== undefined) {
                const channelImageRect = getDrawingRectForChannelImage(position, image);
                // blit a bitmap already rasterised at this size rather than making
                // drawImage rescale the full-resolution logo on every frame
                const scaled = imageCache.getScaled(imageURL, channelImageRect.width, channelImageRect.height);
                scaled && canvas.drawImage(scaled, channelImageRect.left, channelImageRect.top);
                IS_DEBUG && CanvasUtils.drawDebugRect(canvas, channelImageRect);
            } else {
                // Without this the right ~120px of the row is simply empty, which
                // on black reads as a broken row rather than a channel without
                // artwork. Covers both "this channel has no logo" and "the logo has
                // not arrived yet" - LogoCache bumps logoVersion when one does, and
                // the row redraws with the real image.
                drawChannelInitials(canvas, position, channel.getName());
            }
        }

        // favorite marker - in the gap between the right-aligned channel number
        // and the name column. A 32px '★' glyph is roughly 1em (~32px) wide, so
        // centering it in the original 70-90 gap (at left+80, spanning ~64-96)
        // overlapped both the number and the name column by a few px on each
        // side - the gap was only 20px wide, too narrow for a 32px glyph
        // regardless of where within it the glyph was centered. The name column
        // moved right by 24px instead of shrinking the star, opening a 70-114
        // gap; at Normal the star centers at left+92, spanning ~76-108 - clear
        // of the number by ~6px on each side. That 22px-either-side rule is
        // what mFavoriteMarkerCenter and mChannelLayoutNameLeft encode, so it
        // survives both the text scale and the numbers being switched off.
        // The channel logo remains on the row's *right* edge (see
        // getDrawingRectForChannelImage: right = width - margin, left = right
        // - height * 1.3, i.e. x 780-897 of the 900-wide row) and is
        // unaffected by any of this.
        if (FavoritesStore.has(channel.getUUID())) {
            CanvasUtils.writeText(canvas, '★', drawingRect.left + mFavoriteMarkerCenter, drawingRect.middle, {
                fontSize: mChannelLayoutTextSize,
                textAlign: 'center',
                fillStyle: getTheme().favorite,
                isBold: true
            });
        }
    };

    /**
     * The stand-in for a missing logo: the channel's initials on a muted plate,
     * occupying the same box the logo would have.
     *
     * A plate rather than bare text because the initials must not be mistaken
     * for content - they sit where artwork belongs, and a flat rectangle reads
     * as "nothing here yet" in a way floating letters do not.
     */
    const drawChannelInitials = (canvas: CanvasRenderingContext2D, position: number, name: string) => {
        const initials = channelInitials(name);
        if (!initials) {
            return;
        }

        const size = mChannelLayoutHeight * 0.52;
        const right = mChannelArtRight - (mChannelLayoutHeight * 1.3 - size) / 2;
        const left = right - size;
        const top = getTopFrom(position) + (mChannelLayoutHeight - size) / 2;

        canvas.fillStyle = withAlpha(getTheme().textSecondary, 0.14);
        canvas.fillRect(left, top, size, size);

        CanvasUtils.writeText(canvas, initials, left + size / 2, top + size / 2, {
            fontSize: mChannelLayoutEventTextSize,
            textAlign: 'center',
            fillStyle: getTheme().textSecondary,
            isBold: true
        });
    };

    const getDrawingRectForChannelImage = (position: number, image: HTMLImageElement) => {
        const drawingRect = new Rect();
        drawingRect.right = mChannelArtRight;
        drawingRect.left = drawingRect.right - mChannelLayoutHeight * 1.3;
        drawingRect.top = getTopFrom(position);
        drawingRect.bottom = drawingRect.top + mChannelLayoutHeight;

        const imageWidth = image.width;
        const imageHeight = image.height;
        const imageRatio = imageHeight / imageWidth;

        const rectWidth = drawingRect.right - drawingRect.left;
        const rectHeight = drawingRect.bottom - drawingRect.top;

        // Keep aspect ratio.
        if (imageWidth > imageHeight) {
            const padding = (rectHeight - rectWidth * imageRatio) / 2;
            drawingRect.top += padding;
            drawingRect.bottom -= padding;
        } else if (imageWidth <= imageHeight) {
            const padding = (rectWidth - rectHeight / imageRatio) / 2;
            drawingRect.left += padding;
            drawingRect.right -= padding;
        }

        return drawingRect;
    };

    /**
     * get first visible channel position
     */
    const getFirstVisibleChannelPosition = () => {
        const y = scrollY.current;
        let position = Math.floor(y / mChannelLayoutHeight);

        if (position < 0) {
            position = 0;
        }
        //console.log("First visible item: ", position);
        return position;
    };

    const getLastVisibleChannelPosition = () => {
        const y = scrollY.current;
        const screenHeight = getHeight() - mChannelListTopOffset;
        let position = Math.floor((y + screenHeight) / mChannelLayoutHeight);

        const channelCount = epgData.getChannelCount();
        // this will fade the bottom channel in while scrolling
        if (position < channelCount) {
            position += 1;
        }
        // this is the max channel available
        if (position > channelCount) {
            position = channelCount;
        }
        //console.log("Last visible item: ", position);
        return position;
    };

    const recalculateAndRedraw = (withAnimation: boolean) => {
        if (epgData !== null && epgData.hasData()) {
            // calculateMaxVerticalScroll();
            scrollToChannelPosition(channelPosition.current, withAnimation);
        }
    };

    const getWidth = () => {
        return mChannelLayoutWidth;
    };

    const getHeight = () => {
        return window.innerHeight;
    };

    const focus = () => {
        listWrapper.current?.focus();
    };

    /** Where each way out of the search field lands in this screen. */
    const handleSearchExit = (exit: SearchExit) => {
        if (exit === 'cancel') {
            // to the column rather than the list, so BACK retraces the way in
            // instead of dropping the user somewhere they did not come from
            closeSearch(State.GROUPS);
            return;
        }
        // 'accept' keeps the query and moves into the results; 'column' keeps it
        // and steps back to the filter list. Neither clears - only BACK does.
        setState(exit === 'accept' ? State.NORMAL : State.GROUPS);
        listWrapper.current?.focus();
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const keyCode = event.keyCode;

        // the input owns its keys entirely; handleSearchKeyPress decides what
        // escapes back to the list
        if (state === State.SEARCH) {
            return;
        }

        if (state === State.GROUPS) {
            switch (keyCode) {
                case RemoteKeys.ARROW_UP:
                    event.stopPropagation();
                    setGroupsIndex(wrapIndex(groupsIndex, groupEntries.length, -1));
                    return;
                case RemoteKeys.ARROW_DOWN:
                    event.stopPropagation();
                    setGroupsIndex(wrapIndex(groupsIndex, groupEntries.length, 1));
                    return;
                case RemoteKeys.OK:
                case RemoteKeys.ARROW_RIGHT:
                    // right doubles as "apply and get back to the channels", so
                    // the whole gesture is left-pick-right without ever
                    // reaching for OK
                    event.stopPropagation();
                    applyGroupAt(groupsIndex);
                    return;
                case RemoteKeys.ARROW_LEFT:
                    // already the leftmost column - swallow rather than let the
                    // list handler act on it
                    event.stopPropagation();
                    return;
                case RemoteKeys.BACK:
                    event.stopPropagation();
                    setState(State.NORMAL);
                    return;
                case RemoteKeys.CHANNEL_UP:
                case RemoteKeys.CHANNEL_DOWN:
                    // fall through to the normal handler so zapping always works
                    break;
                default:
                    break;
            }
        }

        if (state === State.DETAILS) {
            switch (keyCode) {
                case RemoteKeys.ARROW_UP:
                    event.stopPropagation();
                    setDetailsActionIndex(detailsActionIndex === 0 ? 1 : 0);
                    return;
                case RemoteKeys.ARROW_DOWN:
                    event.stopPropagation();
                    setDetailsActionIndex(detailsActionIndex === 1 ? 0 : 1);
                    return;
                case RemoteKeys.OK:
                    event.stopPropagation();
                    detailsActionIndex === 0 ? toggleFavorite() : toggleRecording();
                    return;
                case RemoteKeys.CHANNEL_UP:
                case RemoteKeys.CHANNEL_DOWN:
                    // fall through to the normal handler so zapping always works
                    break;
                default:
                    break;
            }
        }

        switch (keyCode) {
            case RemoteKeys.ARROW_UP:
                event.stopPropagation();
                scrollUp();
                break;
            case RemoteKeys.ARROW_DOWN:
                event.stopPropagation();
                scrollDown();
                break;
            case RemoteKeys.CHANNEL_UP:
                event.stopPropagation();
                if (currentChannelPosition < epgData.getChannelCount() - 1) {
                    setCurrentChannelPosition(currentChannelPosition + 1);
                    setChannelPosition(currentChannelPosition + 1);
                }
                break;
            case RemoteKeys.CHANNEL_DOWN:
                event.stopPropagation();
                if (currentChannelPosition > 0) {
                    setCurrentChannelPosition(currentChannelPosition - 1);
                    setChannelPosition(currentChannelPosition - 1);
                }
                break;
            case RemoteKeys.KEY_C:
            case RemoteKeys.BACK:
                event.stopPropagation();
                props.unmount();
                break;
            case RemoteKeys.OK:
                event.stopPropagation();
                handleOkDown();
                break;
            case RemoteKeys.KEY_R:
            case RemoteKeys.RED: {
                // red button trigger recording
                event.stopPropagation();
                toggleRecording();
                break;
            }
            case RemoteKeys.ARROW_RIGHT:
                event.stopPropagation();
                if (state === State.DETAILS) {
                    // switch to next event details
                    focusedEventOffset.current += 1;
                    setDetailsData();
                } else {
                    // show channelListDetails
                    setState(State.DETAILS);
                }
                break;
            case RemoteKeys.ARROW_LEFT:
                event.stopPropagation();
                if (state === State.DETAILS && focusedEventOffset.current > 0) {
                    // switch to previous event details
                    focusedEventOffset.current -= 1;
                    setDetailsData();
                } else if (state === State.DETAILS) {
                    // hide channelListDetails
                    setState(State.NORMAL);
                } else {
                    // one continuous leftward axis: details -> channels ->
                    // categories, so left always means "step out one level"
                    enterGroups();
                }
                break;
            case RemoteKeys.GUIDE:
                // let it bubble to TV so it can switch to the EPG
                break;
            default:
                console.log('ChannelList-keyPressed:', keyCode);
        }

        // pass unhandled events to parent
        if (!event.isPropagationStopped) return event;
    };

    const handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.keyCode === RemoteKeys.OK) {
            event.stopPropagation();
            handleOkUp();
        }
    };

    const toggleFavorite = () => {
        const channel = epgData.getChannel(channelPosition.current);
        if (!channel) return;
        FavoritesStore.toggle(channel.getUUID());
        // the favorites-filtered view depends on epgData's cached favorite set,
        // so it must be refreshed before the canvas redraws or a channel
        // removed from favorites while "Favorites" is the active filter would
        // still be positioned as if it were present
        bumpFavoritesVersion();
        // bumpFavoritesVersion schedules a React state update, and the effect
        // watching favoritesVersion (Task 10) will repaint on the next render -
        // but that is at least a frame away. Redraw immediately here too so the
        // star appears the instant the hold fires rather than one frame later.
        updateCanvas();
    };
    // keep the trampoline pointed at the latest closure every render, so the
    // long-lived HoldGesture instance never invokes a stale toggleFavorite
    onToggleFavoriteRef.current = toggleFavorite;

    const handleOkDown = () => {
        holdGesture.current.down();
    };

    const handleOkUp = () => {
        // up() itself distinguishes "hold already fired" from "this press's
        // key-down was consumed elsewhere before it ever reached down()" -
        // e.g. the filter rail intercepts OK and calls applyFocusedFilter()
        // before the main switch (and handleOkDown) ever runs. Either way it
        // reports no select; only a genuine short press reports true.
        if (holdGesture.current.up()) {
            setCurrentChannelPosition(channelPosition.current);
            props.unmount();
        }
    };

    const toggleRecording = () => {
        const epgEvent =
            detailsState?.focusedEvent ||
            epgData
                .getChannel(channelPosition.current)
                ?.getEvents()
                .find((e) => e.isCurrent());
        if (epgEvent) {
            // call passed toggle recording function
            props.toggleRecording(epgEvent, () => {
                updateCanvas();
                // trigger rerender
                setDetailsState({ ...detailsState });
            });
        }
    };

    const handleScrollWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        event.deltaY < 0 ? scrollUp() : scrollDown();
        focus();
    };

    /**
     * Which channel row a pointer click landed on, or -1 when it is not on a
     * row. The row arithmetic lives in ChannelListGeometry so it can be tested
     * against getTopFrom without a canvas; here we only turn a client point
     * into a canvas-relative one and reject anything outside the list column.
     * The canvas is mChannelLayoutWidth wide with no CSS scaling, so client
     * pixels map 1:1 onto canvas pixels.
     */
    const channelPositionAtPoint = (clientX: number, clientY: number): number => {
        const canvasElement = canvas.current;
        if (!canvasElement) {
            return -1;
        }
        const bounds = canvasElement.getBoundingClientRect();
        const x = clientX - bounds.left;
        if (x < 0 || x > mChannelLayoutWidth) {
            return -1;
        }
        return channelPositionAt(clientY - bounds.top, {
            topOffset: mChannelListTopOffset,
            rowHeight: mChannelLayoutHeight,
            scrollY: scrollY.current,
            channelCount: epgData.getChannelCount()
        });
    };

    /**
     * The pointer moved over the list: put the cursor on the row under it.
     *
     * Hover and the D-pad cursor are the same thing here rather than two
     * highlights. Drawing a separate hover fill would mean two marks on screen
     * that must always agree about which row OK will act on - and when they
     * disagree, the next direction press moves from a row the user is no
     * longer looking at. One mark, one meaning.
     *
     * Deliberately does *not* scroll. `scrollToChannelPosition` pins the
     * cursor to the sixth visible row, so re-pinning here would yank the list
     * out from under the pointer, putting a different row beneath it, which on
     * the next mousemove yanks it again. The accepted consequence is that the
     * next direction press re-pins and the list jumps once - bounded, and
     * visibly a response to the key rather than to the pointer.
     */
    const handleHoverAt = (point: { x: number; y: number }) => {
        const position = channelPositionAtPoint(point.x, point.y);

        // the cursor shape is the only affordance available before the pointer
        // stops moving, and it costs nothing
        if (canvas.current) {
            canvas.current.style.cursor = position < 0 ? 'default' : 'pointer';
        }

        if (position < 0 || position === channelPosition.current) {
            return;
        }
        channelPosition.current = position;
        if (state === State.DETAILS) {
            setDetailsData();
        }
        updateCanvas();
    };
    // keep the throttle pointed at this render's closure - see the ref above
    onHoverPointRef.current = handleHoverAt;

    const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
        hoverThrottle.current.push({ x: event.clientX, y: event.clientY });
    };

    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        // the rail, the empty banner and the details panel's action rows all
        // stop propagation, so anything arriving here is a click on the list
        // itself - but it can still miss every row (the gap beside the rail,
        // below the last channel, or the details panel's own area)
        const position = channelPositionAtPoint(event.clientX, event.clientY);
        if (position < 0) {
            return;
        }
        setCurrentChannelPosition(position);
        props.unmount();
    };

    const scrollUp = () => {
        // Up at the top row wraps to the bottom, mirroring scrollDown. It used
        // to move focus into the category bar; the categories now live in a
        // column reached with left, so the vertical axis belongs entirely to
        // the channels.
        if (channelPosition.current === 0) {
            setChannelPosition(epgData.getChannelCount() - 1);
        } else {
            setChannelPosition(channelPosition.current - 1);
        }
    };

    const applyFilter = (filter: ChannelFilter) => {
        setActiveFilter(filter);
        // the filtered view has changed - restart at the top of it. The channel
        // that is *playing* is unaffected: AppContext pins it across the filter
        // change and re-resolves its position.
        setChannelPosition(0);
        setState(State.NORMAL);
    };

    const applyGroupAt = (index: number) => {
        const entry = groupEntries[index];
        if (!entry) {
            setState(State.NORMAL);
            return;
        }
        if (entry.filter.kind === 'search') {
            openSearch();
            return;
        }
        applyFilter(entry.filter);
    };

    /**
     * Enter the search field, keeping whatever was typed before.
     *
     * Re-entering with the previous query intact is the point: on a TV, text
     * costs enough to enter that discarding it because the user glanced at a
     * category and came back would be its own small disaster.
     */
    const openSearch = () => {
        setActiveFilter(searchFilter(searchQuery));
        setState(State.SEARCH);
    };

    /**
     * Leave search and put the lineup back.
     *
     * Clearing the query as well as the filter, because a search that is no
     * longer applied but still shows its text in the field is a control that
     * lies about what the list is showing.
     */
    const closeSearch = (nextState: State) => {
        setSearchQuery('');
        setActiveFilter(ALL_CHANNELS);
        setChannelPosition(0);
        setState(nextState);
        listWrapper.current?.focus();
    };

    const updateSearchQuery = (query: string) => {
        setSearchQuery(query);
        setActiveFilter(searchFilter(query));
        // onto the first genuine match, not row 0 - the old position indexed a
        // different list, and row 0 is usually the pinned playing channel,
        // which is not what was searched for
        setChannelPosition(epgData.getFirstMatchPosition());
    };

    const enterGroups = () => {
        // land on the row describing what is currently on screen rather than
        // wherever the cursor was left, so the column always opens oriented
        setGroupsIndex(Math.max(0, indexOfFilter(groupEntries, activeFilter)));
        setState(State.GROUPS);
    };

    /** Pointer path: the Magic Remote has a cursor, so the rows are clickable. */
    const selectGroupAt = (index: number) => {
        setGroupsIndex(index);
        applyGroupAt(index);
    };

    const scrollDown = () => {
        // when channel position increased channelcount we scroll to beginning
        if (channelPosition.current === epgData.getChannelCount() - 1) {
            setChannelPosition(0);
        } else {
            // channel up
            setChannelPosition(channelPosition.current + 1);
        }
    };

    const updateCanvas = () => {
        if (canvas.current) {
            const ctx = canvas.current.getContext('2d');
            // clear
            ctx && ctx.clearRect(0, 0, getWidth(), getHeight());

            // draw child elements
            ctx && onDraw(ctx);
        }
    };

    const onDraw = (canvas: CanvasRenderingContext2D) => {
        if (epgData && epgData.hasData()) {
            drawChannelListItems(canvas);
        }
    };

    const setChannelPosition = (channelPos: number) => {
        channelPosition.current = channelPos;
        if (state === State.DETAILS) {
            setDetailsData();
        }
        scrollToChannelPosition(channelPos, isAnimationsEnabled);
    };

    const setDetailsData = () => {
        const channel = epgData.getChannel(channelPosition.current);
        // in case channel changed
        if (channel?.getChannelID() !== detailsState?.focusedChannel?.getChannelID()) {
            focusedEventOffset.current = 0;
        }
        // get current event
        const currentEvent = epgData.getEventAtTimestamp(channelPosition.current, EPGUtils.getNow()) || undefined;
        let newFocusedEvent;
        if (currentEvent) {
            // get next event position with offset
            const eventPos =
                epgData.getEventPosition(channelPosition.current, currentEvent) + focusedEventOffset.current;
            const nextEventsArray: EPGEvent[] = [];
            for (let i = eventPos; i < eventPos + 5; i++) {
                const nextEvent = epgData.getEvent(channelPosition.current, i + 1);
                nextEvent && nextEventsArray.push(nextEvent);
            }
            nextEvents.current = nextEventsArray;
            // get same

            // set event with offset
            newFocusedEvent = epgData.getEvent(channelPosition.current, eventPos);
        } else {
            nextEvents.current = [];
            nextSameEvents.current = [];
        }

        // trigger rerender
        setDetailsState({
            focusedEvent: newFocusedEvent || undefined,
            focusedChannel: channel || undefined
        });
    };

    useEffect(() => {
        recalculateAndRedraw(false);
        focus();

        return () => {
            // stop animation when unmounting
            cancelAnimationFrame(scrollAnimationId.current);
            holdGesture.current.cancel();
            // a queued hover would otherwise repaint a canvas that no longer
            // exists on the frame after this component goes away
            hoverThrottle.current.cancel();
        };
    }, []);

    useLayoutEffect(() => {
        if (state === State.DETAILS) {
            setDetailsActionIndex(0);
            setDetailsData();
        }
    }, [state]);

    useEffect(() => {
        // the filtered view or the favorite markers changed - repaint
        recalculateAndRedraw(false);
    }, [activeFilter, favoritesVersion]);

    useEffect(() => {
        // Row height may have changed - by density, or by text scale - so the
        // existing scrollY points at a different channel than it did a moment
        // ago. Recalculating rather than merely repainting re-derives it from
        // the cursor position, which is what keeps the channel the user was
        // looking at under their eyes across the switch. Without animation:
        // this is a layout change, not a move.
        //
        // The whole appearance object is the dependency, not density alone. It
        // is replaced wholesale on any change, so this also covers the palette
        // and the channel-number gutter - a repaint they need anyway, and one
        // recalculation is cheaper than reasoning about which fields moved.
        recalculateAndRedraw(false);
    }, [appearance]);

    useEffect(() => {
        // logos load on demand now, so a row can be drawn before its logo
        // exists; LogoCache bumps logoVersion (coalesced) when one arrives
        updateCanvas();
    }, [logoVersion, fontVersion]);

    useEffect(
        () => () => {
            // A search lasts exactly as long as this screen. The query lives in
            // component state and the filter lives in context, so without this
            // the two survive differently: leaving and reopening the list would
            // show an empty search box above a still-filtered lineup, with
            // nothing on screen explaining why most of the channels are gone.
            //
            // Safe to do on the way out even when the user just picked a
            // channel: setActiveFilter pins the playing channel and re-resolves
            // its position, and handleOkUp has already made the chosen channel
            // the playing one - synchronously, through a ref - by the time this
            // runs. Without that pin the stored position would index a
            // different channel in the unfiltered lineup.
            if (activeFilterRef.current.kind === 'search') {
                setActiveFilter(ALL_CHANNELS);
            }
        },
        []
    );

    useEffect(() => {
        // activeFilter can change from outside this component (the background
        // tag load re-applying the persisted filter, the first-run picker) -
        // keep the column's cursor on the row that is actually active rather
        // than the one it happened to start on. Up/Down inside the column never
        // touch activeFilter, so this cannot fight with the user moving between
        // rows.
        const index = indexOfFilter(groupEntries, activeFilter);
        if (index >= 0) {
            setGroupsIndex(index);
        }
    }, [activeFilter, channelTags]);

    return (
        <div
            id="channellist-wrapper"
            ref={listWrapper}
            tabIndex={-1}
            onKeyDown={handleKeyPress}
            onKeyUp={handleKeyUp}
            onWheel={handleScrollWheel}
            onClick={handleClick}
            className="channelList"
        >
            <GroupsColumn
                entries={groupEntries}
                activeFilter={activeFilter}
                focusedIndex={groupsIndex}
                isFocused={state === State.GROUPS}
                onSelect={selectGroupAt}
                // only while the column already owns focus. A pointer drifting
                // across it must not silently take the cursor away from the
                // channel list behind it - the user would press DOWN expecting
                // a channel and get a category.
                onHover={(index) => state === State.GROUPS && setGroupsIndex(index)}
            />

            {/* Visible for as long as the search is applied, not just while the
                field has focus: stepping down into the results must not hide
                what produced them, or the list becomes an unexplained subset of
                the lineup. */}
            {activeFilter.kind === 'search' && (
                <ChannelSearchBar
                    query={searchQuery}
                    onQueryChange={updateSearchQuery}
                    matchCount={searchQuery && !epgData.isFilterEmpty() ? epgData.getFilterMatchCount() : null}
                    noMatches={!!searchQuery && epgData.isFilterEmpty()}
                    isFocused={state === State.SEARCH}
                    onExit={handleSearchExit}
                />
            )}

            {/* search is deliberately absent: the bar reports its own empty
                result, is always on screen while a search is applied, and sits
                exactly where this banner would - two messages in one place. */}
            {epgData.isFilterEmpty() && activeFilter.kind !== 'search' && (
                <div className="channelListEmptyBanner" onClick={(event) => event.stopPropagation()}>
                    {activeFilter.kind === 'favorites'
                        ? 'No favorites yet — hold OK on a channel to add it'
                        : 'No channels in ' + labelForFilter(groupEntries, activeFilter)}
                </div>
            )}

            <canvas
                ref={canvas}
                width={getWidth()}
                height={getHeight()}
                // shifted right by exactly the column's width, so the grid's own
                // coordinate space still starts at 0 and nothing in the draw
                // code has to know the column exists
                style={{ display: 'block', marginLeft: GROUPS_WIDTH }}
                // on the canvas rather than the wrapper: the wrapper covers the
                // whole screen, so moving the pointer over the groups column or
                // the details panel would fire a hit-test that can only ever
                // miss
                onMouseMove={handleMouseMove}
            />

            {state === State.DETAILS && (
                <ChannelListDetails
                    isRecording={(event: EPGEvent) => {
                        return epgData.isRecording(event);
                    }}
                    epgChannel={detailsState?.focusedChannel}
                    currentEvent={detailsState?.focusedEvent}
                    nextEvents={nextEvents.current}
                    nextSameEvents={nextSameEvents.current}
                    focusedActionIndex={detailsActionIndex}
                    onToggleFavorite={toggleFavorite}
                    onToggleRecording={toggleRecording}
                />
            )}
        </div>
    );
};

export default ChannelList;
