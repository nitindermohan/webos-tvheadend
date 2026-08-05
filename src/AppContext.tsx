import React, { createContext, useEffect, useRef, useState } from 'react';
import LogoCache from './utils/LogoCache';
import { AppViewState } from './App';
import EPGData from './models/EPGData';
import TVHDataService from './services/TVHDataService';
import ChannelTag from './models/ChannelTag';
import ChannelFilter from './models/ChannelFilter';
import CategoryStore from './utils/CategoryStore';
import FavoritesStore from './utils/FavoritesStore';
import { whenFontsReady } from './utils/FontReadiness';

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
    imageCache: LogoCache;
    /** Bumped when logos finish loading, so canvas surfaces repaint. */
    logoVersion: number;
    /**
     * Bumped once the bundled webfont is ready. Canvas does not participate in
     * CSS font loading, so without this every surface would keep whatever it
     * drew during startup - in the fallback font, measured against the wrong
     * metrics. See FontReadiness.
     */
    fontVersion: number;
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
    const [imageCache] = useState(() => new LogoCache());
    const [logoVersion, setLogoVersion] = useState(0);

    // Logos now load on demand rather than all at once, so a canvas surface can
    // draw a row before its logo exists. LogoCache coalesces a burst of loads
    // into one notification, so this is a handful of renders during a scroll,
    // not one per image.
    useEffect(() => {
        imageCache.onReady(() => setLogoVersion((version) => version + 1));
    }, [imageCache]);

    const [fontVersion, setFontVersion] = useState(0);

    // Same shape as logoVersion, for the same reason: a canvas surface can
    // paint before the resource it needs exists, and nothing else will tell it
    // to try again. whenFontsReady flushes CanvasUtils' memoised character
    // widths before this fires, so the repaint measures against the real font
    // rather than reusing numbers taken from the fallback.
    useEffect(() => {
        whenFontsReady(typeof document !== 'undefined' ? document.fonts : undefined, () =>
            setFontVersion((version) => version + 1)
        );
    }, []);
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
        logoVersion: logoVersion,
        fontVersion: fontVersion,
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
            // mirror setActiveFilter's reconcile just above in full: pin the
            // playing channel *and* reconcile, not just the reconcile.
            // setFavoriteUuids re-runs applyFilter and can shrink the
            // filtered view - most pointedly when the channel un-favorited is
            // the one currently playing, which drops it out of its own
            // filtered view entirely unless it is pinned first. Capture who
            // is playing before the filter re-applies, then re-resolve their
            // position afterwards - using the ref, not the closed-over state
            // value, for the same stale-closure reason setActiveFilter does
            // (Task 8a)
            const playingChannel = epgData.getChannel(currentChannelPositionRef.current);
            if (playingChannel) {
                epgData.setPinnedChannelUuid(playingChannel.getUUID());
            }

            epgData.setFavoriteUuids(FavoritesStore.all());

            // guard -1 defensively - resetting to 0 would change what is playing
            if (playingChannel) {
                const position = epgData.getChannelPositionByUuid(playingChannel.getUUID());
                if (position >= 0) {
                    setCurrentChannelPosition(position);
                }
            }

            // bump last: the hold-to-favorite gesture reaches this from a
            // setTimeout, which React 16 does not batch, so committing the
            // version before the reconcile above would leave a render where
            // epgData is already re-filtered but currentChannelPosition is
            // still stale
            setFavoritesVersion((version) => version + 1);
        }
    };

    return <AppContext.Provider value={appContext}>{children}</AppContext.Provider>;
};

export default AppContext;
