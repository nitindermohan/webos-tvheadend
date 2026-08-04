import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Rect from '../models/Rect';
import CanvasUtils from '../utils/CanvasUtils';
import AppContext from '../AppContext';
import '../styles/app.css';
import ChannelListDetails from './ChannelListDetails';
import EPGEvent from '../models/EPGEvent';
import EPGChannel from '../models/EPGChannel';
import EPGUtils from '../utils/EPGUtils';
import FilterRail, { buildRailFilters, RailEntry } from './FilterRail';
import CategoryStore from '../utils/CategoryStore';
import RemoteKeys from '../utils/RemoteKeys';
import { isSameFilter } from '../models/ChannelFilter';
import FavoritesStore from '../utils/FavoritesStore';
import HoldGesture from '../utils/HoldGesture';

const VERTICAL_SCROLL_TOP_PADDING_ITEM = 5;
const IS_DEBUG = false;

enum State {
    NORMAL = 'normal',
    DETAILS = 'details',
    RAIL = 'rail'
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
        currentChannelPosition,
        setCurrentChannelPosition,
        isAnimationsEnabled,
        channelTags,
        activeFilter,
        setActiveFilter,
        favoritesVersion,
        bumpFavoritesVersion
    } = useContext(AppContext);
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

    const mChannelLayoutTextSize = 32;
    const mChannelLayoutEventTextSize = 26;
    const mChannelLayoutNumberTextSize = 38;
    const mChannelLayoutTextColor = '#cccccc';
    const mChannelLayoutTitleTextColor = '#969696';
    const mChannelLayoutMargin = 3;
    const mChannelLayoutPadding = 7;
    const mChannelLayoutHeight = 90;
    const mChannelLayoutWidth = 900;
    const mChannelLayoutBackgroundFocus = 'rgba(29,170,226,1)';
    const mFilterRailHeight = 86;
    // x-offset of the name column (channel name, recording mark, event
    // progress bar + text) from the row's left edge. Was a bare 90 in three
    // places (plus the two derived width calculations below) until the
    // favorite star needed room to its left - see the favorite marker
    // comment in drawChannelItem for why this moved from 90 to 114.
    const mChannelLayoutNameLeft = 114;

    const [state, setState] = useState<State>(State.NORMAL);
    const [detailsState, setDetailsState] = useState<DetailsState>();

    const railEntries: RailEntry[] = buildRailFilters(channelTags, CategoryStore.getSelectedTagUuids());
    const [railFocusedIndex, setRailFocusedIndex] = useState(() => {
        const index = railEntries.findIndex((entry) => isSameFilter(entry.filter, activeFilter));
        return index >= 0 ? index : 1;
    });

    const getTopFrom = (position: number) => {
        const y = position * mChannelLayoutHeight + mFilterRailHeight;
        return y - scrollY.current;
    };

    const scrollToChannelPosition = (channelPosition: number, withAnimation: boolean) => {
        // start scrolling after padding position top
        if (channelPosition < VERTICAL_SCROLL_TOP_PADDING_ITEM) {
            scrollY.current = 0;
            updateCanvas();
            return;
        }

        // stop scrolling before top padding position
        const maxPosition = epgData.getChannelCount() - VERTICAL_SCROLL_TOP_PADDING_ITEM;
        if (channelPosition >= maxPosition) {
            // fix scroll to channel in case it is within bottom padding
            if (scrollY.current === 0) {
                scrollY.current = mChannelLayoutHeight * (maxPosition - VERTICAL_SCROLL_TOP_PADDING_ITEM);
            }
            updateCanvas();
            return;
        }

        // scroll to channel position
        const scrollTarget = mChannelLayoutHeight * (channelPosition - VERTICAL_SCROLL_TOP_PADDING_ITEM);
        if (!withAnimation) {
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
        if (scrollDelta < 0 && scrollY.current <= scrollTarget) {
            //this.scrollY = scrollTarget;
            cancelAnimationFrame(scrollAnimationId.current);
            return;
        }
        if (scrollDelta > 0 && scrollY.current >= scrollTarget) {
            //this.scrollY = scrollTarget;
            cancelAnimationFrame(scrollAnimationId.current);
            return;
        }
        //console.log("scrolldelta=%d, scrolltarget=%d, scrollY=%d", scrollDelta, scrollTarget, this.scrollY);
        scrollY.current = scrollY.current + scrollDelta;
        scrollAnimationId.current = requestAnimationFrame(() => {
            animateScroll(scrollDelta, scrollTarget);
        });
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
        // Important bit here is to use rgba()
        grd.addColorStop(0, 'rgba(11, 39, 58, 0.7)');
        grd.addColorStop(0.2, 'rgba(35, 64, 84, 0.9)');
        grd.addColorStop(0.8, 'rgba(35, 64, 84, 0.9)');
        grd.addColorStop(1, 'rgba(11, 39, 58, 0.7)');

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
        }

        // channel number
        CanvasUtils.writeText(canvas, channel.getChannelID().toString(), drawingRect.left + 70, drawingRect.middle, {
            fontSize: mChannelLayoutNumberTextSize,
            textAlign: 'right',
            fillStyle: mChannelLayoutTextColor,
            isBold: true
        });

        // channel line
        const currentEvent = epgData.getEventAtTimestamp(position, EPGUtils.getNow());
        const channelIconWidth = mChannelLayoutHeight * 1.3;
        const channelNameWidth = mChannelLayoutWidth - channelIconWidth - mChannelLayoutNameLeft;

        const leftBeforeRecMark = drawingRect.left;
        // recording mark
        if (currentEvent && epgData.isRecording(currentEvent)) {
            const radius = 10;
            canvas.fillStyle = '#FF0000';
            canvas.beginPath();
            canvas.arc(drawingRect.left + mChannelLayoutNameLeft + radius, drawingRect.middle - radius, radius, 0, 2 * Math.PI);
            canvas.fill();
            drawingRect.left += 2 * radius + mChannelLayoutPadding;
        }
        // channel name
        CanvasUtils.writeText(
            canvas,
            channel.getName(),
            drawingRect.left + mChannelLayoutNameLeft,
            drawingRect.top + mChannelLayoutHeight * 0.33,
            {
                fontSize: mChannelLayoutTextSize,
                fillStyle: mChannelLayoutTextColor,
                isBold: true,
                maxWidth: channelNameWidth
            }
        );
        drawingRect.left = leftBeforeRecMark;

        // channel event
        if (currentEvent) {
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
                mChannelLayoutWidth - channelIconWidth - mChannelLayoutNameLeft - channelEventProgressRect.width;
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

        // channel logo
        const imageURL = channel.getImageURL();
        const image = imageURL && imageCache.get(imageURL);
        if (image !== undefined) {
            const channelImageRect = getDrawingRectForChannelImage(position, image);
            canvas.drawImage(
                image,
                channelImageRect.left,
                channelImageRect.top,
                channelImageRect.width,
                channelImageRect.height
            );
            IS_DEBUG && CanvasUtils.drawDebugRect(canvas, channelImageRect);
        }

        // favorite marker - placed in the gap between the right-aligned channel
        // number (right edge pinned at left+70, fontSize 38) and the name
        // column (now left+mChannelLayoutNameLeft=114, fontSize 32). A 32px
        // '★' glyph is roughly 1em (~32px) wide, so centering it in the
        // original 70-90 gap (at left+80, spanning ~64-96) still overlapped
        // both the number and the name column by a few px on each side - the
        // gap was only 20px wide, too narrow for a 32px glyph regardless of
        // where within it the glyph was centered. The name column (and the
        // recording mark and both width calculations that must stay in step
        // with it) moved right by 24px instead of shrinking the star, opening
        // a 70-114 gap; the star now centers at left+92, spanning ~76-108 -
        // clear of the number (70) by ~6px and the name column (114) by ~6px.
        // The channel logo remains on the row's *right* edge (see
        // getDrawingRectForChannelImage: right = width - margin, left = right
        // - height * 1.3, i.e. x 780-897 of the 900-wide row) and is
        // unaffected by any of this.
        if (FavoritesStore.has(channel.getUUID())) {
            CanvasUtils.writeText(canvas, '★', drawingRect.left + 92, drawingRect.middle, {
                fontSize: mChannelLayoutTextSize,
                textAlign: 'center',
                fillStyle: '#ffcc4d',
                isBold: true
            });
        }
    };

    const getDrawingRectForChannelImage = (position: number, image: HTMLImageElement) => {
        const drawingRect = new Rect();
        drawingRect.right = mChannelLayoutWidth - mChannelLayoutMargin;
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
        // rows start mFilterRailHeight lower than the canvas top, so that much
        // less vertical space is actually available for them to render into
        const screenHeight = getHeight() - mFilterRailHeight;
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

    const handleKeyPress = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const keyCode = event.keyCode;

        if (state === State.RAIL) {
            switch (keyCode) {
                case RemoteKeys.ARROW_LEFT:
                    event.stopPropagation();
                    setRailFocusedIndex(railFocusedIndex > 0 ? railFocusedIndex - 1 : railEntries.length - 1);
                    return;
                case RemoteKeys.ARROW_RIGHT:
                    event.stopPropagation();
                    setRailFocusedIndex(railFocusedIndex < railEntries.length - 1 ? railFocusedIndex + 1 : 0);
                    return;
                case RemoteKeys.ARROW_DOWN:
                case RemoteKeys.OK:
                    event.stopPropagation();
                    applyFocusedFilter();
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

        switch (keyCode) {
            case 33: // programm up
            case 38: // arrow up
                event.stopPropagation();
                scrollUp();
                break;
            case 34: // programm down
            case 40: // arrow down
                event.stopPropagation();
                scrollDown();
                break;
            case 67: // keyboard 'c'
            case 461: // back button
                event.stopPropagation();
                props.unmount();
                break;
            case RemoteKeys.OK:
                event.stopPropagation();
                handleOkDown();
                break;
            case 82: // keyboard 'r'
            case 403: {
                // red button trigger recording
                event.stopPropagation();
                toggleRecording();
                break;
            }
            case 39: // right arrow
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
            case 37: // left arrow
                event.stopPropagation();
                if (state === State.DETAILS && focusedEventOffset.current > 0) {
                    // switch to previous event details
                    focusedEventOffset.current -= 1;
                    setDetailsData();
                } else {
                    // hide channelListDetails
                    setState(State.NORMAL);
                }
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

    const handleClick = () => {
        setCurrentChannelPosition(channelPosition.current);
        props.unmount();
    };

    const scrollUp = () => {
        if (channelPosition.current === 0) {
            // at the top row, move focus into the filter rail
            setState(State.RAIL);
        } else {
            setChannelPosition(channelPosition.current - 1);
        }
    };

    const applyFocusedFilter = () => {
        const entry = railEntries[railFocusedIndex];
        if (entry) {
            setActiveFilter(entry.filter);
            // the filtered view has changed - restart at the top of it
            setChannelPosition(0);
        }
        setState(State.NORMAL);
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
        };
    }, []);

    useLayoutEffect(() => {
        if (state === State.DETAILS) {
            setDetailsData();
        }
    }, [state]);

    useEffect(() => {
        // the filtered view or the favorite markers changed - repaint
        recalculateAndRedraw(false);
    }, [activeFilter, favoritesVersion]);

    useEffect(() => {
        // activeFilter can change from outside this component (the background
        // tag load re-applying the persisted filter, the first-run picker) -
        // keep the rail's keyboard focus following the pill that is actually
        // active rather than the one it happened to start on. Left/Right
        // navigation while the rail is open never touches activeFilter, so
        // this cannot fight with the user moving between pills.
        const index = railEntries.findIndex((entry) => isSameFilter(entry.filter, activeFilter));
        if (index >= 0) {
            setRailFocusedIndex(index);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <FilterRail
                entries={railEntries}
                activeFilter={activeFilter}
                focusedIndex={railFocusedIndex}
                isFocused={state === State.RAIL}
            />

            {epgData.isFilterEmpty() && (
                <div className="channelListEmptyBanner">No favorites yet &mdash; hold OK on a channel to add it</div>
            )}

            <canvas ref={canvas} width={getWidth()} height={getHeight()} style={{ display: 'block' }} />

            {state === State.DETAILS && (
                <ChannelListDetails
                    isRecording={(event: EPGEvent) => {
                        return epgData.isRecording(event);
                    }}
                    epgChannel={detailsState?.focusedChannel}
                    currentEvent={detailsState?.focusedEvent}
                    nextEvents={nextEvents.current}
                    nextSameEvents={nextSameEvents.current}
                />
            )}
        </div>
    );
};

export default ChannelList;
