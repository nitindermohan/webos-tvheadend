import React, { useContext, useEffect, useRef, useState } from 'react';
import Rect from '../models/Rect';
import CanvasUtils from '../utils/CanvasUtils';
import AppContext from '../AppContext';
import ChannelListDetails from './ChannelListDetails';
import EPGEvent from '../models/EPGEvent';
import '../styles/app.css';
import { scaled } from '../utils/Appearance';
import { getTheme, withAlpha } from '../utils/Theme';
import DialogPopup from './DialogPopup';
import EPGChannelRecording from '../models/EPGChannelRecording';
import EPGUtils from '../utils/EPGUtils';
import RemoteKeys from '../utils/RemoteKeys';
import HoldGesture from '../utils/HoldGesture';
import { State } from '../models/RecordingListState';
import { dialogForKind, RECORDING_UPCOMING } from '../utils/RecordingDialog';

const VERTICAL_SCROLL_TOP_PADDING_ITEM = 5;
const IS_DEBUG = false;

interface DetailsState {
    focusedChannelRecording?: EPGChannelRecording;
    focusedEvent?: EPGEvent;
}

const RecordingList = (props: {
    deleteRecording: (event: EPGEvent) => void;
    cancelRecording: (event: EPGEvent) => void;
    unmount: () => void;
    recordings: EPGChannelRecording[];
}) => {
    const { imageCache, logoVersion, fontVersion, currentRecordingPosition, setCurrentRecordingPosition, isAnimationsEnabled, appearance } = useContext(
        AppContext
    );
    const { textScale } = appearance;

    const canvas = useRef<HTMLCanvasElement>(null);
    const listWrapper = useRef<HTMLDivElement>(null);
    const scrollAnimationId = useRef(0);
    const scrollY = useRef(0);
    const recordPosition = useRef(currentRecordingPosition);

    // hold-OK-to-delete. The gesture instance outlives any single render, so it
    // calls through a ref rather than capturing the closure it was built with.
    const openRecordingDialogRef = useRef<() => void>(() => undefined);
    const holdGesture = useRef(new HoldGesture(600, () => openRecordingDialogRef.current()));

    // The text scale, but not the density: a recordings list is a handful of
    // rows the user reads once, not 900 they scan, so the compact row that
    // earns its place in the channel list would only make this harder to read.
    const mChannelLayoutTextSize = scaled(32, textScale);
    const mChannelLayoutEventTextSize = scaled(26, textScale);
    const mChannelLayoutNumberTextSize = scaled(38, textScale);
    const mChannelLayoutTextColor = getTheme().textPrimary;
    const mChannelLayoutTitleTextColor = getTheme().textSecondary;
    const mChannelLayoutMargin = 3;
    const mChannelLayoutPadding = 7;
    const mChannelLayoutHeight = scaled(90, textScale);
    const mChannelLayoutWidth = 900;
    // same treatment as the channel list: a card fill plus an accent bar,
    // rather than flooding the row and leaving its text hard to read
    const mChannelLayoutBackgroundFocus = withAlpha(getTheme().surfaceCard, 0.96);

    const [state, setState] = useState<State>(State.DETAILS);
    const [detailsState, setDetailsState] = useState<DetailsState>();

    const getTopFrom = (position: number) => {
        const y = position * mChannelLayoutHeight; //+ this.mChannelLayoutMargin;
        return y - scrollY.current;
    };

    const scrollToChannelPosition = (channelPosition: number, withAnimation: boolean) => {
        // start scrolling after padding position top
        if (
            channelPosition < VERTICAL_SCROLL_TOP_PADDING_ITEM ||
            props.recordings.length <= getLastVisibleChannelPosition() - getFirstVisibleChannelPosition()
        ) {
            scrollY.current = 0;
            updateCanvas();
            return;
        }

        // stop scrolling before top padding position
        const maxPosition = props.recordings.length - VERTICAL_SCROLL_TOP_PADDING_ITEM;
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
    };

    const drawChannelItem = (canvas: CanvasRenderingContext2D, position: number) => {
        const isSelectedChannel = position === recordPosition.current;
        const channel = props.recordings[position];
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
        const currentEvent = channel.getEvents()[0];
        const channelIconWidth = mChannelLayoutHeight * 1.3;
        const channelNameWidth = mChannelLayoutWidth - channelIconWidth - 90;
        const leftBeforeRecMark = drawingRect.left;

        let fillStyle = mChannelLayoutTextColor;
        switch (channel.getKind()) {
            case 'REC_FAILED':
                fillStyle = getTheme().danger;
                break;
            case 'REC_UPCOMING':
                fillStyle = getTheme().textMuted;
                break;
        }

        // channel event
        if (currentEvent) {
            // recording mark
            if (currentEvent && channel.getKind() === 'REC_UPCOMING' && currentEvent.getStart() < EPGUtils.getNow()) {
                const radius = 10;
                canvas.fillStyle = getTheme().danger;
                canvas.beginPath();
                canvas.arc(drawingRect.left + 90 + radius, drawingRect.middle - radius, radius, 0, 2 * Math.PI);
                canvas.fill();
                drawingRect.left += 2 * radius + mChannelLayoutPadding;
            }

            // channel name
            CanvasUtils.writeText(
                canvas,
                currentEvent.getTitle(),
                drawingRect.left + 90,
                drawingRect.top + mChannelLayoutHeight * 0.33,
                {
                    fontSize: mChannelLayoutTextSize,
                    fillStyle: fillStyle,
                    isBold: true,
                    maxWidth: channelNameWidth
                }
            );

            drawingRect.left = leftBeforeRecMark;
            // channel event progress bar
            const channelEventProgressRect = new Rect();
            channelEventProgressRect.left = drawingRect.left + 90;
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
            const channelEventWidth = mChannelLayoutWidth - channelIconWidth - 90 - channelEventProgressRect.width;
            CanvasUtils.writeText(
                canvas,
                currentEvent.getSubTitle(),
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
            const scaled = imageCache.getScaled(imageURL, channelImageRect.width, channelImageRect.height);
            scaled && canvas.drawImage(scaled, channelImageRect.left, channelImageRect.top);
            IS_DEBUG && CanvasUtils.drawDebugRect(canvas, channelImageRect);
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
        const screenHeight = getHeight();
        let position = Math.floor((y + screenHeight) / mChannelLayoutHeight);

        const channelCount = props.recordings.length;
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
        if (props.recordings !== null && props.recordings.length > 0) {
            // calculateMaxVerticalScroll();
            scrollToChannelPosition(recordPosition.current, withAnimation);
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

        if (state === State.DELETE_DIALOG || state === State.CANCEL_DIALOG) {
            return event;
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
            // GREEN is deliberately absent here. It used to unmount the list,
            // which meant the one key that opens the menu was swallowed by the
            // only view with no other way out - pressing menu closed the list
            // instead of opening the menu. It now falls through to App.
            case RemoteKeys.KEY_C:
            case RemoteKeys.BACK:
            case RemoteKeys.KEY_B:
                event.stopPropagation();
                props.unmount();
                break;
            case RemoteKeys.OK:
                // Down only. The select fires on key-up, so that holding OK can
                // mean something different from tapping it - see handleOkUp.
                event.stopPropagation();
                holdGesture.current.down();
                break;
            case RemoteKeys.KEY_R:
            case RemoteKeys.RED:
                event.stopPropagation();
                openRecordingDialog();
                break;
            default:
                console.log('RecordingList-keyPressed:', keyCode);
        }

        // pass unhandled events to parent
        if (!event.isPropagationStopped) return event;
    };

    /**
     * Open the confirm dialog for the focused recording - delete for one that
     * exists, cancel for one still upcoming.
     *
     * Reachable two ways on purpose. RED is how it has always worked and stays
     * for older remotes, but modern Magic Remotes have no colour buttons at
     * all, which made deleting a recording literally impossible on current
     * hardware: the dialogs, the handlers and the service calls were all
     * present and simply had no reachable trigger. Holding OK is the app's own
     * idiom for "the second thing this row can do" (ChannelList uses it for
     * favourites), and OK is a button every remote has.
     */
    const openRecordingDialog = () => {
        if (!detailsState?.focusedEvent) {
            return;
        }
        setState(dialogForKind(detailsState?.focusedChannelRecording?.getKind()));
    };
    // keep the trampoline on the latest closure, so the long-lived HoldGesture
    // never fires against a stale detailsState - same arrangement, and the same
    // reason, as ChannelList's onToggleFavoriteRef
    openRecordingDialogRef.current = openRecordingDialog;

    const handleOkUp = () => {
        // up() reports true only for a genuine short press: false when the hold
        // already fired (the dialog is open - selecting underneath it would
        // start playing the very recording being deleted), and false when this
        // instance never saw the matching down()
        if (holdGesture.current.up()) {
            setCurrentRecordingPosition(recordPosition.current);
            props.unmount();
        }
    };

    const deleteRecording = (event: EPGEvent | undefined) => {
        if (!event) {
            return;
        }
        props.deleteRecording(event);
        setState(State.DETAILS);
        focus();
    };

    const cancelRecording = (event: EPGEvent | undefined) => {
        if (!event) {
            return;
        }
        props.cancelRecording(event);
        setState(State.DETAILS);
        focus();
    };

    const setDetailsData = () => {
        const channel = props.recordings[recordPosition.current];
        // get current event
        const currentEvent = channel.getEvents()[0];
        // trigger rerender
        setDetailsState({
            focusedEvent: currentEvent,
            focusedChannelRecording: channel
        });
    };

    const handleScrollWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        event.deltaY < 0 ? scrollUp() : scrollDown();
        focus();
    };

    const handleClick = () => {
        setCurrentRecordingPosition(recordPosition.current);
        props.unmount();
    };

    const scrollUp = () => {
        // if we reached 0 we scroll to end of list
        if (recordPosition.current === 0) {
            setChannelPosition(props.recordings.length - 1);
        } else {
            // channel down
            setChannelPosition(recordPosition.current - 1);
        }
    };

    const scrollDown = () => {
        // when channel position increased channelcount we scroll to beginning
        if (recordPosition.current === props.recordings.length - 1) {
            setChannelPosition(0);
        } else {
            // channel up
            setChannelPosition(recordPosition.current + 1);
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
        if (props.recordings && props.recordings.length > 0) {
            drawChannelListItems(canvas);
        }
    };

    const setChannelPosition = (channelPos: number) => {
        recordPosition.current = channelPos;
        if (state === State.DETAILS) {
            setDetailsData();
        }
        scrollToChannelPosition(channelPos, isAnimationsEnabled);
    };

    useEffect(() => {
        // callback: update canvas after recordings have been reloaded
        updateCanvas();
    }, [props.recordings]);

    useEffect(() => {
        // logos load on demand; without this the list only repaints when the
        // recordings reload, so a logo arriving would never be drawn
        updateCanvas();
    }, [logoVersion, fontVersion, appearance]);

    useEffect(() => {
        recalculateAndRedraw(false);
        if (currentRecordingPosition > -1) {
            setChannelPosition(currentRecordingPosition);
        }
        focus();

        return () => {
            // stop animation when unmounting
            cancelAnimationFrame(scrollAnimationId.current);
            // and drop any hold still counting down, so it cannot fire a
            // dialog into a component that is already gone
            holdGesture.current.cancel();
        };
    }, []);

    return (
        <div
            id="recordinglist-wrapper"
            ref={listWrapper}
            tabIndex={-1}
            onKeyDown={handleKeyPress}
            onKeyUp={(event) => event.keyCode === RemoteKeys.OK && handleOkUp()}
            onWheel={handleScrollWheel}
            onClick={handleClick}
            className="channelList"
        >
            <canvas ref={canvas} width={getWidth()} height={getHeight()} style={{ display: 'block' }} />

            <ChannelListDetails
                isRecording={() => {
                    return false;
                }}
                epgChannel={detailsState?.focusedChannelRecording}
                currentEvent={detailsState?.focusedEvent}
                nextEvents={[]}
                nextSameEvents={[]}
                hint={
                    detailsState?.focusedChannelRecording?.getKind() === RECORDING_UPCOMING
                        ? 'OK to play — hold OK to cancel this recording'
                        : 'OK to play — hold OK to delete'
                }
            />

            {state === State.DELETE_DIALOG && detailsState?.focusedEvent && (
                <DialogPopup
                    title={detailsState.focusedEvent.getTitle()}
                    subtitle={detailsState.focusedEvent.getTitle() + ' - ' + detailsState.focusedEvent.getSubTitle()}
                    confirmText="Delete"
                    abortText="Abort"
                    confirmAction={() => deleteRecording(detailsState.focusedEvent)}
                    abortAcion={() => {
                        setState(State.DETAILS);
                        focus();
                    }}
                ></DialogPopup>
            )}

            {state === State.CANCEL_DIALOG && detailsState?.focusedEvent && (
                <DialogPopup
                    title={detailsState.focusedEvent.getTitle()}
                    subtitle={detailsState.focusedEvent.getTitle() + ' - ' + detailsState.focusedEvent.getSubTitle()}
                    confirmText="Cancel"
                    abortText="Abort"
                    confirmAction={() => cancelRecording(detailsState.focusedEvent)}
                    abortAcion={() => {
                        setState(State.DETAILS);
                        focus();
                    }}
                ></DialogPopup>
            )}
        </div>
    );
};

export default RecordingList;
