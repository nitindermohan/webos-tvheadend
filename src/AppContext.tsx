import React, { createContext, useRef, useState } from 'react';
import { AppViewState } from './App';
import EPGData from './models/EPGData';
import TVHDataService from './services/TVHDataService';
import ChannelTag from './models/ChannelTag';
import ChannelFilter from './models/ChannelFilter';
import CategoryStore from './utils/CategoryStore';
import FavoritesStore from './utils/FavoritesStore';

export enum AppVisibilityState {
    FOCUSED = 'focused',
    BLURRED = 'blurred',
    BACKGROUND = 'background',
    FOREGROUND = 'foreground'
}

type AppContext = {
    menuState: boolean;
    setMenuState: (value: boolean) => void;
    appViewState: AppViewState;
    setAppViewState: (value: AppViewState) => void;
    locale: string;
    setLocale: (value: string) => void;
    tvhDataService?: TVHDataService;
    setTvhDataService: (value?: TVHDataService) => void;
    epgData: EPGData;
    imageCache: Map<URL, HTMLImageElement>;
    currentChannelPosition: number;
    setCurrentChannelPosition: (value: number) => void;
    currentRecordingPosition: number;
    setCurrentRecordingPosition: (value: number) => void;
    appVisibilityState: AppVisibilityState;
    setAppVisibilityState: (value: AppVisibilityState) => void;
    persistentAuthToken?: string; // safe persistent auth token to be used for recording stream url
    setPersistentAuthToken: (value: string) => void;
    isAnimationsEnabled: boolean;
    setAnimationsEnabled: (value: boolean) => void;
    channelTags: ChannelTag[];
    setChannelTags: (value: ChannelTag[]) => void;
    activeFilter: ChannelFilter;
    setActiveFilter: (value: ChannelFilter) => void;
    favoritesVersion: number;
    bumpFavoritesVersion: () => void;
};

const AppContext = createContext({} as AppContext);

export const AppContextProvider = ({ children }: { children: JSX.Element }) => {
    const [menuState, setMenuState] = useState(false);
    const [appViewState, setAppViewState] = useState(AppViewState.TV);
    const [locale, setLocale] = useState('en-US');
    const [tvhDataService, setTvhDataService] = useState<TVHDataService>();
    const [epgData] = useState(new EPGData());
    const [imageCache] = useState(new Map<URL, HTMLImageElement>());
    const [currentChannelPosition, setCurrentChannelPositionState] = useState(0);
    // Callers of setActiveFilter can be several renders removed from the one
    // that produced their closure (App.tsx's reloadData is captured once by a
    // useEffect with an empty-ish dependency array and keeps running
    // asynchronously afterwards). Reading currentChannelPosition as a plain
    // closed-over value would then read a value frozen at that earlier render.
    // A ref updated synchronously at every write stays current regardless of
    // which render's closure performs the write.
    const currentChannelPositionRef = useRef(currentChannelPosition);
    const setCurrentChannelPosition = (value: number) => {
        currentChannelPositionRef.current = value;
        setCurrentChannelPositionState(value);
    };
    const [currentRecordingPosition, setCurrentRecordingPosition] = useState(-1);
    const [appVisibilityState, setAppVisibilityState] = useState(AppVisibilityState.FOCUSED);
    const [persistentAuthToken, setPersistentAuthToken] = useState<string>();
    const [isAnimationsEnabled, setAnimationsEnabled] = useState<boolean>(true);
    const [channelTags, setChannelTags] = useState<ChannelTag[]>([]);
    const [activeFilter, setActiveFilterState] = useState<ChannelFilter>(CategoryStore.getActiveFilter());
    const [favoritesVersion, setFavoritesVersion] = useState(0);

    const appContext: AppContext = {
        menuState: menuState,
        setMenuState: (value: boolean) => setMenuState(value),
        appViewState: appViewState,
        setAppViewState: (value: AppViewState) => setAppViewState(value),
        locale: locale,
        setLocale: (value: string) => setLocale(value),
        tvhDataService: tvhDataService,
        setTvhDataService: (value?: TVHDataService) => setTvhDataService(value),
        epgData: epgData,
        imageCache: imageCache,
        currentChannelPosition: currentChannelPosition,
        setCurrentChannelPosition: (value: number) => setCurrentChannelPosition(value),
        currentRecordingPosition: currentRecordingPosition,
        setCurrentRecordingPosition: (value: number) => setCurrentRecordingPosition(value),
        appVisibilityState: appVisibilityState,
        setAppVisibilityState: (value: AppVisibilityState) => setAppVisibilityState(value),
        persistentAuthToken: persistentAuthToken,
        setPersistentAuthToken: (value: string) => setPersistentAuthToken(value),
        isAnimationsEnabled: isAnimationsEnabled,
        setAnimationsEnabled: (value: boolean) => setAnimationsEnabled(value),
        channelTags: channelTags,
        setChannelTags: (value: ChannelTag[]) => setChannelTags(value),
        activeFilter: activeFilter,
        setActiveFilter: (value: ChannelFilter) => {
            // pin the playing channel before the filter changes so its index
            // stays valid in the new filtered view - filtering must never
            // interrupt playback
            const playingChannel = epgData.getChannel(currentChannelPositionRef.current);
            if (playingChannel) {
                epgData.setPinnedChannelUuid(playingChannel.getUUID());
            }

            CategoryStore.setActiveFilter(value);
            epgData.setFilter(value);
            setActiveFilterState(value);

            // the pin guarantees the channel is present, but guard -1 defensively -
            // resetting to 0 would change what is playing
            if (playingChannel) {
                const position = epgData.getChannelPositionByUuid(playingChannel.getUUID());
                if (position >= 0) {
                    setCurrentChannelPosition(position);
                }
            }
        },
        favoritesVersion: favoritesVersion,
        bumpFavoritesVersion: () => {
            // mirror setActiveFilter's reconcile just above: setFavoriteUuids
            // re-runs applyFilter and can shrink the filtered view (e.g. the
            // channel playing gets un-favorited while the favorites filter is
            // active), which can leave currentChannelPosition pointing past
            // the end of the new, shorter array. Capture who is playing
            // before the filter re-applies, then re-resolve their position
            // afterwards - using the ref, not the closed-over state value,
            // for the same stale-closure reason setActiveFilter does (Task 8a)
            const playingChannel = epgData.getChannel(currentChannelPositionRef.current);

            epgData.setFavoriteUuids(FavoritesStore.all());
            setFavoritesVersion((version) => version + 1);

            // guard -1 defensively - resetting to 0 would change what is playing
            if (playingChannel) {
                const position = epgData.getChannelPositionByUuid(playingChannel.getUUID());
                if (position >= 0) {
                    setCurrentChannelPosition(position);
                }
            }
        }
    };

    return <AppContext.Provider value={appContext}>{children}</AppContext.Provider>;
};

export default AppContext;
