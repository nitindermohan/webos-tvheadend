import EPGChannel from './EPGChannel';
import EPGEvent from './EPGEvent';
import ChannelFilter, { ALL_CHANNELS } from './ChannelFilter';
import { channelMatchesQuery } from '../utils/ChannelSearch';

/**
 * Created by satadru on 3/30/17.
 */
export default class EPGData {
    /** The complete lineup, never filtered. */
    private allChannels: EPGChannel[] = [];
    /** The active view - what every consumer sees through getChannels(). */
    private channels: EPGChannel[] = [];
    private recordings: EPGEvent[] = [];
    private filter: ChannelFilter = ALL_CHANNELS;
    private favoriteUuids: string[] = [];
    private filterEmpty = false;
    /** Genuine matches for the active filter, excluding the pinned channel. */
    private matchCount = 0;
    /** Index in the active view of the first genuine match. */
    private firstMatchPosition = 0;
    /** The channel currently playing. Kept visible under every filter so the
     *  position index stays valid and filtering never interrupts playback. */
    private pinnedChannelUuid = '';

    //constructor() {
    //new MockDataService().getChannels(this.channels);
    //if (this.data) {
    /*this.data.forEach((values, key) => {
                this.channels.push(key);
                values.forEach((value) => {
                    this.events.push(value);
                });
            });*/
    //this.channels = this.data;
    //this.events = Array.from(this.data.values());
    //}
    //}

    getChannels(): EPGChannel[] {
        return this.channels;
    }

    getChannel(channelPosition: number): EPGChannel | null {
        const channel = this.channels[channelPosition];
        return channel || null;
    }

    getEvents(channelPosition: number): EPGEvent[] {
        const channel = this.getChannel(channelPosition);
        const events = channel?.getEvents();
        return events || [];
    }

    getEventCount(channelPosition: number): number {
        return this.getEvents(channelPosition).length;
    }

    getEvent(channelPosition: number, eventPosition: number) {
        const channel = this.channels[channelPosition];
        const events = channel.getEvents();
        return events[eventPosition];
    }

    getEventBeforeTimestamp(channelPosition: number, timestamp: number) {
        const channel = this.channels[channelPosition];
        const events = channel.getEvents();

        // find the first event before the timestamp
        return events
            .filter((event) => event.getEnd() <= timestamp)
            .reduce((prev, current) => (prev.getEnd() > current.getEnd() ? prev : current));
    }

    getEventAtTimestamp(channelPosition: number, timestamp: number) {
        const channel = this.channels[channelPosition];
        const events = channel.getEvents();

        // find the event at the timestamp
        return events.find((event) => event.getStart() <= timestamp && timestamp <= event.getEnd());
    }

    getEventAfterTimestamp(channelPosition: number, timestamp: number) {
        const channel = this.channels[channelPosition];
        const events = channel.getEvents();

        // find the first event after the timestamp
        return events
            .filter((event) => event.getStart() >= timestamp)
            .reduce((prev, current) => (prev.getStart() < current.getStart() ? prev : current));
    }

    isRecording(epgEvent: EPGEvent) {
        return !!this.getRecording(epgEvent);
    }

    getRecording(epgEvent: EPGEvent) {
        return this.recordings.find((recEvent) => epgEvent.isMatchingRecording(recEvent));
    }

    getEventPosition(channelPosition: number, eventToFind: EPGEvent) {
        return this.channels[channelPosition].getEvents().findIndex((event) => this.isEventSame(event, eventToFind));
    }

    getChannelCount(): number {
        if (this.channels == null) {
            return 0;
        }
        return this.channels.length;
    }

    isEventSame(event1: EPGEvent, event2: EPGEvent): boolean {
        return event1.getId() === event2.getId();
    }

    hasData(): boolean {
        return this.getChannelCount() > 0;
    }

    updateChannels(channels: EPGChannel[]): void {
        this.allChannels = channels;
        this.applyFilter();
    }

    getAllChannels(): EPGChannel[] {
        return this.allChannels;
    }

    getFilter(): ChannelFilter {
        return this.filter;
    }

    setFilter(filter: ChannelFilter): void {
        this.filter = filter;
        this.applyFilter();
    }

    setFavoriteUuids(uuids: string[]): void {
        this.favoriteUuids = uuids;
        this.applyFilter();
    }

    /** Pin a channel into every filtered view regardless of whether it matches -
     *  used to keep the playing channel's position valid across filter changes. */
    setPinnedChannelUuid(uuid: string): void {
        this.pinnedChannelUuid = uuid;
        this.applyFilter();
    }

    /** True when the active filter matched nothing and we fell back to the full lineup. */
    isFilterEmpty(): boolean {
        return this.filterEmpty;
    }

    /**
     * How many channels genuinely matched the active filter.
     *
     * Deliberately not getChannelCount(), which counts the pinned playing
     * channel too. For a category that hardly shows, but a search reporting
     * "2 found" beside a single result is a plain contradiction - and the
     * extra one is a channel that does not match what was typed.
     */
    getFilterMatchCount(): number {
        return this.filter.kind === 'all' ? this.allChannels.length : this.matchCount;
    }

    /**
     * Where the cursor should land after a re-filter: the first channel that
     * genuinely matched, not position 0.
     *
     * The two differ because of the pin. The playing channel is folded in at
     * its natural lineup position, so it is usually *first* - and landing on it
     * means a search for "neo" opens with an unrelated channel highlighted,
     * which reads as the search having failed. Falls back to 0 when nothing
     * matched, where the view is the whole lineup anyway.
     */
    getFirstMatchPosition(): number {
        return this.firstMatchPosition;
    }

    getChannelPositionByUuid(uuid: string): number {
        return this.channels.findIndex((channel) => channel.getUUID() === uuid);
    }

    private matchesFilter(channel: EPGChannel): boolean {
        switch (this.filter.kind) {
            case 'favorites':
                return this.favoriteUuids.indexOf(channel.getUUID()) >= 0;
            case 'tag':
                return !!this.filter.tagUuid && channel.getTagUuids().indexOf(this.filter.tagUuid) >= 0;
            case 'search':
                // Note the playing channel is still pinned into the result by
                // applyFilter even when it does not match the query. That looks
                // odd for a search - one unrelated channel among the hits - but
                // the pin is what keeps currentChannelPosition pointing at the
                // right row, and a stale position indexes a *different*
                // channel rather than none. A visible extra row beats zapping
                // to the wrong channel.
                return channelMatchesQuery(channel.getName(), channel.getChannelID(), this.filter.query || '');
            default:
                return true;
        }
    }

    /**
     * Recompute the active view. When a filter matches nothing we fall back to
     * the full lineup so channel zapping never dead-ends, and flag it so the UI
     * can explain what happened. The pinned channel (the one currently playing)
     * is folded into the view at its natural lineup position so its index stays
     * valid even when the filter does not match it - but it is never counted as
     * a genuine match, so it cannot mask an otherwise-empty filter.
     */
    private applyFilter(): void {
        if (this.filter.kind === 'all') {
            this.filterEmpty = false;
            this.matchCount = this.allChannels.length;
            this.firstMatchPosition = 0;
            this.channels = this.allChannels;
            return;
        }

        const filtered: EPGChannel[] = [];
        let matchCount = 0;
        let firstMatchPosition = 0;
        for (const channel of this.allChannels) {
            const matches = this.matchesFilter(channel);
            if (matches) {
                // recorded against the array that becomes the view, so the
                // index is directly usable as a cursor position
                if (matchCount === 0) {
                    firstMatchPosition = filtered.length;
                }
                matchCount++;
            }
            const isPinned = this.pinnedChannelUuid !== '' && channel.getUUID() === this.pinnedChannelUuid;
            if (matches || isPinned) {
                filtered.push(channel);
            }
        }

        this.matchCount = matchCount;
        this.firstMatchPosition = matchCount === 0 ? 0 : firstMatchPosition;
        this.filterEmpty = matchCount === 0;
        this.channels = this.filterEmpty ? this.allChannels : filtered;
    }

    updateStreamUrl(channels: EPGChannel[]): void {
        for (let i = 0; i < channels.length; i++) {
            for (let k = 0; k < this.allChannels.length; k++) {
                if (channels[i].getUUID() == this.allChannels[k].getUUID()) {
                    this.allChannels[k].setStreamUrl(channels[i].getStreamUrl());
                    break;
                }
            }
        }
        this.applyFilter();
    }

    updateRecordings(recordings: EPGEvent[]): void {
        this.recordings = recordings;
    }
}
