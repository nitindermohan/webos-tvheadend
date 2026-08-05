import React, { useContext, useRef } from 'react';
import AppContext from '../AppContext';
import EPGChannel from '../models/EPGChannel';
import EPGEvent from '../models/EPGEvent';
import EPGUtils from '../utils/EPGUtils';
import FavoritesStore from '../utils/FavoritesStore';

const ChannelListDetails = (props: {
    isRecording: (event: EPGEvent) => boolean;
    currentEvent?: EPGEvent;
    epgChannel?: EPGChannel;
    nextEvents: EPGEvent[]; // next events in line
    nextSameEvents: EPGEvent[]; // next events with same title
    // optional: RecordingList (a second, older consumer of this component)
    // renders read-only recording details and does not pass these - the
    // action row only appears for callers that supply both callbacks
    focusedActionIndex?: number;
    onToggleFavorite?: () => void;
    onToggleRecording?: () => void;
}) => {
    const { locale } = useContext(AppContext);
    const channelListDetailsWrapper = useRef<HTMLDivElement>(null);

    const formatTime = (event: EPGEvent | undefined, date?: boolean): string | undefined => {
        if (!event) {
            return undefined;
        }
        const start = event.getStart();
        const end = event.getEnd();

        if (date) {
            return EPGUtils.toDateString(start, locale);
        } else {
            return EPGUtils.toTimeFrameString(start, end, locale);
        }
    };

    const getEventList = (events: EPGEvent[], withDate?: boolean) => {
        const itemList = [];

        for (let i = 0; i < events.length; i++) {
            itemList.push(
                <li key={i}>
                    {withDate && <div className="listItemDate">{formatTime(events[i], true)}</div>}
                    <div className="listItemTime">{formatTime(events[i])}</div>
                    <div className="listItemTitle">
                        {props.isRecording(events[i]) && <div className="rec"></div>}
                        {events[i].getTitle()}
                    </div>
                </li>
            );
        }

        return itemList;
    };

    return (
        <div
            id="channel-list-details"
            ref={channelListDetailsWrapper}
            tabIndex={-1}
            className="channelListDetails"
            style={{ display: 'block' }}
        >
            {props.epgChannel && props.onToggleFavorite && props.onToggleRecording && (
                <div className="detailsActions">
                    <div
                        className={props.focusedActionIndex === 0 ? 'detailsAction focused' : 'detailsAction'}
                        onClick={props.onToggleFavorite}
                    >
                        {/* Always the filled star, coloured rather than swapped
                            for U+2606 - '★' is the one symbol confirmed to
                            render on the C5 (the channel rows draw it too), so
                            state is carried by colour instead of a second
                            codepoint we have never seen render. */}
                        <span
                            className={
                                FavoritesStore.has(props.epgChannel.getUUID())
                                    ? 'detailsStar on'
                                    : 'detailsStar'
                            }
                        >
                            ★
                        </span>
                        {FavoritesStore.has(props.epgChannel.getUUID())
                            ? 'Remove from favorites'
                            : 'Add to favorites'}
                    </div>
                    <div
                        className={props.focusedActionIndex === 1 ? 'detailsAction focused' : 'detailsAction'}
                        onClick={props.onToggleRecording}
                    >
                        {/* Drawn dot, matching the `.rec` circle already used on
                            the title below - not the U+25CF glyph. */}
                        <span className="detailsDot" />
                        {props.currentEvent && props.isRecording(props.currentEvent)
                            ? 'Cancel recording'
                            : 'Record'}
                    </div>
                </div>
            )}
            <div>
                <div className="timeframe">
                    {props.currentEvent && formatTime(props.currentEvent, true) + ' ' + formatTime(props.currentEvent)}
                </div>
                <div className="now">{EPGUtils.toTimeString(EPGUtils.getNow(), locale)}</div>
            </div>
            <div className="title">
                {props.currentEvent && props.isRecording(props.currentEvent) && <div className="rec"></div>}
                {props.currentEvent?.getTitle() || 'No Information'}
            </div>
            <div className="subTitle">{props.currentEvent?.getSubTitle() || ''}</div>
            <div className="desc">{props.currentEvent?.getDescription() || ''}</div>
            <div className="next">
                <div className="separator"></div>
                <ul className="list">{getEventList(props.nextEvents)}</ul>
            </div>
            <div className="nextSameTitle">{getEventList(props.nextSameEvents, true)}</div>
        </div>
    );
};

export default ChannelListDetails;
