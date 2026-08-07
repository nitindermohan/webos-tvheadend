import React, { useContext, useEffect, useState } from 'react';
import TVHDataService from './services/TVHDataService';
import TV from './components/TV';
import Player from './components/Player';
import TVHSettings from './components/TVHSettings';
import './styles/app.css';
import AppContext, { AppVisibilityState } from './AppContext';
import StorageHelper from './utils/StorageHelper';
import Menu, { MenuItem } from './components/Menu';
import FavoritesStore from './utils/FavoritesStore';
import CategoryStore from './utils/CategoryStore';
import CategorySetup from './components/CategorySetup';
import AppearanceSettings from './components/AppearanceSettings';
import RemoteKeys from './utils/RemoteKeys';

export enum AppViewState {
    TV,
    SETTINGS,
    RECORDINGS,
    HELP,
    CONTACT,
    CATEGORIES,
    APPEARANCE
}

const App = () => {
    const {
        menuState,
        setMenuState,
        appViewState,
        setAppViewState,
        setAppVisibilityState,
        setLocale,
        tvhDataService,
        setTvhDataService,
        epgData,
        setCurrentChannelPosition,
        setPersistentAuthToken,
        setAnimationsEnabled,
        setChannelTags,
        setActiveFilter
    } = useContext(AppContext);

    const [isChannelsRetrieved, setIsChannelsRetrieved] = useState(false);
    const [debugInfo, setDebugInfo] = useState("");
    const isWebKit = typeof document['hidden'] === 'undefined';

    const menu: MenuItem[] = [
        {
            icon: 'liveplayback',
            label: 'TV',
            action: () => updateAppViewState(AppViewState.TV),
            isActive: appViewState === AppViewState.TV
        },
        {
            icon: 'recordings',
            label: 'Recordings',
            action: () => updateAppViewState(AppViewState.RECORDINGS),
            isActive: appViewState === AppViewState.RECORDINGS
        },
        {
            icon: 'gear',
            label: 'Setup',
            action: () => updateAppViewState(AppViewState.SETTINGS),
            isActive: appViewState === AppViewState.SETTINGS
        },
        {
            icon: 'funnel',
            label: 'Categories',
            action: () => updateAppViewState(AppViewState.CATEGORIES),
            isActive: appViewState === AppViewState.CATEGORIES
        },
        {
            icon: 'brightness',
            label: 'Appearance',
            action: () => updateAppViewState(AppViewState.APPEARANCE),
            isActive: appViewState === AppViewState.APPEARANCE
        },
        {
            icon: 'denselist',
            label: 'Help',
            action: () => console.log('not yet available') /*action: () => updateAppViewState(AppViewState.HELP)*/,
            isActive: false
        },
        {
            icon: 'circle',
            label: 'Contact',
            action: () => console.log('not yet available') /*action: () => updateAppViewState(AppViewState.CONTACT)*/,
            isActive: false
        }
    ];

    const updateAppViewState = (appViewState: AppViewState) => {
        setMenuState(false);
        setAppViewState(appViewState);
    };

    const reloadData = async () => {
        if (!tvhDataService) {
            return;
        }
        setDebugInfo("Connecting...");
        // await readyness
        try {
            await tvhDataService.awaitReadyness();
        } catch (error) {
            setDebugInfo('Failed to connect to TVH: '+ + JSON.stringify(error));
            setAppViewState(AppViewState.SETTINGS);
            return;
        }
        
        // load locale
        setDebugInfo("Loading Locale...");
        await loadLocale(tvhDataService);
        
        // load animations enabled
        setDebugInfo("Check animations enabled...");
        await loadAnimationsEnabled(tvhDataService);
        setDebugInfo("Set retrieved channels to false...");
        // retrieve channel infos etc
        setIsChannelsRetrieved(false);

        try {
            setDebugInfo("Loading channels...");
            const channels = await tvhDataService.retrieveM3UChannels();
            setDebugInfo("Updating channels ("+channels.length+")...");
            epgData.updateChannels(channels);
            // restore favorites and the persisted filter before resolving position
            epgData.setFavoriteUuids(FavoritesStore.all());
            epgData.setFilter(CategoryStore.getActiveFilter());
            setCurrentChannelPosition(StorageHelper.resolveInitialChannelPosition(epgData.getChannels()));
            setDebugInfo("Channels retrieved true...");
            setIsChannelsRetrieved(true);

            // categories are additive - never block startup on them
            tvhDataService
                .retrieveChannelTags()
                .then((tags) => {
                    setChannelTags(tags);
                    // re-apply the filter now that channels carry their tags - routed
                    // through the context so the playing channel is pinned and the
                    // position reconciled, same as any other filter change
                    setActiveFilter(CategoryStore.getActiveFilter());
                    // first run (or a fresh install) - send the user to the picker
                    // once tags are actually available to choose from
                    if (tags.length > 0 && !CategoryStore.isConfigured()) {
                        setAppViewState(AppViewState.CATEGORIES);
                    }
                })
                .catch((error) => console.log('Failed to load channel tags:', error));

            // safe persistent token if available
            if (channels.length > 0) {
                setDebugInfo("Safe persistent auth token...");
                safePersistentAuthToken(channels[0].getStreamUrl());
            }
            // logos load on demand as rows are drawn - see LogoCache

            setDebugInfo("Retrieve EPG...");
            // retrieve epg and update channels
            tvhDataService.retrieveTVHEPG(0, (channels) => {
                // note: channels are already updated as we are working on references here
                epgData.updateChannels(channels);
            });

            setDebugInfo("Retrieve recordings...");
            // retrieve recordings and update channels
            tvhDataService.retrieveUpcomingRecordings((recordings) => {
                epgData.updateRecordings(recordings);
            });
        } catch (error) {
            setDebugInfo('Failed to retrieve channels: '+ JSON.stringify(error));
            setAppViewState(AppViewState.SETTINGS);
            return;
        }

        setDebugInfo("");
        setAppViewState(AppViewState.TV);
    };

    const loadLocale = async (tvhDataService: TVHDataService) => {
        try {
            // retrieve local info
            const localInfoResult = await tvhDataService.getLocaleInfo();
            const locale = localInfoResult.settings.localeInfo.locales.UI;
            setLocale(locale);
            console.log('Retrieved locale info:', locale);
        } catch (error) {
            console.log('Failed to retrieve locale info: ', error);
        }
    };

    const loadAnimationsEnabled = async (tvhDataService: TVHDataService) => {
        try {
            // retrieve local info
            const deviceInfoResult = await tvhDataService.getDeviceInfo();
            const majorVersion = deviceInfoResult.sdkVersion.split('.')[0];
            setAnimationsEnabled(Number(majorVersion) > 3);
            console.log('Retrieved Firmware Major Version:', majorVersion);
        } catch (error) {
            console.log('Failed to retrieve locale info: ', error);
        }
    };

    const safePersistentAuthToken = (url: URL) => {
        const authParam = url.searchParams.get('auth');
        if (authParam) {
            // put auth token to app context
            setPersistentAuthToken(authParam.trim());
        }
    };


    const handleKeyPress = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const keyCode = event.keyCode;

        switch (keyCode) {
            case RemoteKeys.GREEN:
            case RemoteKeys.KEY_G:
                // The settings screen owns the whole viewport and has its own
                // spotlight focus; opening the menu over it strands the user
                // with no way back to the form. (th0enix 88a0ddf)
                if (appViewState === AppViewState.SETTINGS) break;
                event.stopPropagation();
                setMenuState(!menuState);
                break;
            case RemoteKeys.BACK:
            case RemoteKeys.KEY_B:
                event.stopPropagation();
                if (menuState) {
                    setMenuState(false);
                }
                break;
            default:
                console.log('App-keyPressed:', keyCode);
        }
    };

    useEffect(() => {
        console.log('app component mounted');

        // add global event listeners for blur and focus of the app
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);

        // add global event listener for visibility change of the app
        document.addEventListener(isWebKit ? 'webkitvisibilitychange' : 'visibilitychange', handleVisibilityChange);

        // webOSLaunch event
        document.addEventListener('webOSLaunch', handleWebOSLaunch);

        // webOSRelaunch event
        document.addEventListener('webOSRelaunch', handleWebOSRelaunch);

        const tvhSettings = StorageHelper.getTvhSettings();
        if(tvhSettings !== undefined) {
            setTvhDataService(new TVHDataService(tvhSettings));
        } else {
            setAppViewState(AppViewState.SETTINGS);
        }
        
    }, []);

    const handleBlur = (event: FocusEvent) => {
        event.stopPropagation();
        console.log('app is blurred');
        setAppVisibilityState(AppVisibilityState.BLURRED);
    };

    const handleFocus = (event: FocusEvent) => {
        event.stopPropagation();
        console.log('app is focused');
        setAppVisibilityState(AppVisibilityState.FOCUSED);
    };

    const handleVisibilityChange = (event: Event) => {
        event.stopPropagation();

        if (isWebKit ? (document as never)['webkitHidden'] : document['hidden']) {
            console.log('app is in background');
            setAppVisibilityState(AppVisibilityState.BACKGROUND);
        } else {
            console.log('app is in foreground');
            setAppVisibilityState(AppVisibilityState.FOREGROUND);
        }
    };

    // for future use
    const handleWebOSLaunch = () => {
        console.log('app is launched');
    };

    // for future use
    const handleWebOSRelaunch = () => {
        console.log('app is relaunched');
    };

    useEffect(() => {
        reloadData();
    }, [tvhDataService]);

    return (
        <div className="app" onKeyDown={handleKeyPress}>
            {debugInfo && <div className="debug-info">{debugInfo}</div>}
            {menuState && <Menu items={menu} unmount={() => setAppViewState(AppViewState.TV)} />}
            {appViewState === AppViewState.SETTINGS && <TVHSettings unmount={() => setAppViewState(AppViewState.TV)} />}
            {appViewState === AppViewState.CATEGORIES && (
                <CategorySetup unmount={() => setAppViewState(AppViewState.TV)} />
            )}
            {appViewState === AppViewState.APPEARANCE && (
                <AppearanceSettings unmount={() => setAppViewState(AppViewState.TV)} />
            )}
            {appViewState === AppViewState.TV && isChannelsRetrieved && <TV />}
            {appViewState === AppViewState.RECORDINGS && (
                <Player unmount={() => setAppViewState(AppViewState.TV)} />
            )}
        </div>
    );
};

export default App;
