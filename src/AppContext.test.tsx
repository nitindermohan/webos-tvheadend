import React, { useContext, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import EPGChannel from './models/EPGChannel';
import { tagFilter, FAVORITE_CHANNELS } from './models/ChannelFilter';
import FavoritesStore from './utils/FavoritesStore';

// AppContext.tsx imports AppViewState from ./App for its enum value
// (useState(AppViewState.TV)). ./App transitively pulls in TV.tsx and the
// full @enact/moonstone component tree, which logs an unrelated
// React.createFactory deprecation warning as a load-time side effect of a
// third-party dependency. Stub the tiny bit AppContext.tsx actually needs so
// this test only exercises the context wiring under test.
jest.mock('./App', () => ({
    AppViewState: {
        TV: 0,
        SETTINGS: 1,
        RECORDINGS: 2,
        HELP: 3,
        CONTACT: 4
    }
}));

// eslint-disable-next-line import/first
import AppContext, { AppContextProvider } from './AppContext';

const channel = (id: number, uuid: string, tagUuids: string[]): EPGChannel => {
    const result = new EPGChannel(undefined, 'Channel ' + id, id, uuid, new URL('http://tvh/' + id));
    result.setTagUuids(tagUuids);
    return result;
};

describe('AppContext setActiveFilter wiring', () => {
    /**
     * Reproduces App.tsx's reloadData flow: a routine that is captured once via
     * useEffect(() => { reloadData() }, [tvhDataService]) - which fires a single
     * time - and therefore closes over whatever context value existed at that
     * render, including setActiveFilter. It then keeps running asynchronously
     * (a later `.then()`, exactly like the background tag-load callback) even
     * after subsequent renders have replaced that context value with a fresh one.
     */
    it('reconciles the playing position using the live position, not the value frozen in a stale render closure', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        let resolveDone: () => void = () => undefined;
        const done = new Promise<void>((resolve) => {
            resolveDone = resolve;
        });

        const observedPositions: number[] = [];
        let epgDataRef: import('./models/EPGData').default | undefined;

        const Harness = () => {
            const ctx = useContext(AppContext);
            useEffect(() => {
                // deps=[] => this body only ever runs once, closing over the
                // very first render's context - mirroring reloadData's closure.
                // epgData itself is a stable object reference for the whole
                // provider lifetime (created once via useState), so capturing
                // it here and reading it later (after the state updates below
                // have flowed through re-renders) is safe.
                epgDataRef = ctx.epgData;
                (async () => {
                    ctx.epgData.updateChannels([
                        channel(1, 'uuid-a', ['tag-a']),
                        channel(2, 'uuid-b', ['tag-news']),
                        channel(3, 'uuid-c', ['tag-a'])
                    ]);
                    // simulate resolveInitialChannelPosition restoring a
                    // non-zero position for a returning user
                    ctx.setCurrentChannelPosition(2);
                    // yield a couple of turns, mirroring the real gap between
                    // reloadData's synchronous setup and its later
                    // retrieveChannelTags().then(...) callback
                    await Promise.resolve();
                    await Promise.resolve();
                    // the stale closure (captured at mount, position 0) fires
                    // here - same as the background tag-load .then() call
                    ctx.setActiveFilter(tagFilter('tag-news'));
                    resolveDone();
                })();
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return null;
        };

        const Reader = () => {
            const ctx = useContext(AppContext);
            observedPositions.push(ctx.currentChannelPosition);
            return null;
        };

        await act(async () => {
            ReactDOM.render(
                <AppContextProvider>
                    <>
                        <Harness />
                        <Reader />
                    </>
                </AppContextProvider>,
                container
            );
            await done;
        });

        // uuid-c was playing at position 2 when the filter reconciliation ran.
        // Under the tag-news filter it should resolve to its new (still valid)
        // position - never snap to 0, which would mean the wrong channel
        // (uuid-a) got pinned and playback silently changed.
        const finalPosition = observedPositions[observedPositions.length - 1];
        expect(finalPosition).toBe(1);

        // Fix 1 in TV.tsx (src/components/TV.tsx) only avoids restarting the
        // stream on a reconcile like this one if currentChannelPosition keeps
        // pointing at the *same channel*, not merely at *some valid channel*.
        // This is the invariant that makes Fix 1 safe to key off channel
        // identity: assert the channel actually found at the reconciled
        // position is still uuid-c, the one that was playing before the
        // filter changed.
        expect(epgDataRef?.getChannel(finalPosition)?.getUUID()).toBe('uuid-c');

        act(() => {
            ReactDOM.unmountComponentAtNode(container);
        });
        document.body.removeChild(container);
    });
});

describe('AppContext bumpFavoritesVersion wiring', () => {
    beforeEach(() => localStorage.clear());

    /**
     * Reproduces the Fix 3 failure scenario: favorites A/B/C shown under the
     * favorites filter, C is playing at index 2, then A is un-favorited (e.g.
     * a hold-OK in the channel list calling FavoritesStore.remove +
     * bumpFavoritesVersion). The favorites view shrinks to [B, C] - C is now
     * index 1 - but nothing reconciled currentChannelPosition (still 2),
     * unlike setActiveFilter's sibling code path just above.
     *
     * setActiveFilter is called first, before any channels exist
     * (epgData.getChannel(0) is null at that point), specifically so it does
     * NOT pin a channel here - this test is isolated to bumpFavoritesVersion's
     * own reconcile, not setActiveFilter's.
     */
    it('reconciles the playing position when the favorites filter shrinks around it', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        let resolveDone: () => void = () => undefined;
        const done = new Promise<void>((resolve) => {
            resolveDone = resolve;
        });

        const observedPositions: number[] = [];
        let epgDataRef: import('./models/EPGData').default | undefined;

        const Harness = () => {
            const ctx = useContext(AppContext);
            useEffect(() => {
                // epgData is a stable object reference for the provider's
                // lifetime - safe to read later, after the state updates
                // below have flowed through re-renders (see observedPositions
                // below, which is what actually observes the reconciled
                // currentChannelPosition; ctx.currentChannelPosition itself
                // stays frozen at this effect's initial-render value).
                epgDataRef = ctx.epgData;

                FavoritesStore.add('uuid-a');
                FavoritesStore.add('uuid-b');
                FavoritesStore.add('uuid-c');

                // no channels loaded yet - getChannel(0) is null, so this does
                // not pin anything (see block comment above)
                ctx.setActiveFilter(FAVORITE_CHANNELS);

                ctx.epgData.updateChannels([
                    channel(1, 'uuid-a', []),
                    channel(2, 'uuid-b', []),
                    channel(3, 'uuid-c', [])
                ]);

                // sync epgData's favorite set with the store so the favorites
                // filter is matching for real, not falling back to the
                // full lineup because nothing matched yet
                ctx.bumpFavoritesVersion();

                // browse to C, which is now playing at index 2
                ctx.setCurrentChannelPosition(2);

                // un-favorite A - the favorites view should shrink to [B, C]
                FavoritesStore.remove('uuid-a');
                ctx.bumpFavoritesVersion();

                resolveDone();
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            return null;
        };

        const Reader = () => {
            const ctx = useContext(AppContext);
            observedPositions.push(ctx.currentChannelPosition);
            return null;
        };

        await act(async () => {
            ReactDOM.render(
                <AppContextProvider>
                    <>
                        <Harness />
                        <Reader />
                    </>
                </AppContextProvider>,
                container
            );
            await done;
        });

        // C must still be the channel found at currentChannelPosition after
        // the reconcile - not null (a stale index into the shrunk array) and
        // not some other channel.
        const finalPosition = observedPositions[observedPositions.length - 1];
        expect(epgDataRef?.getChannel(finalPosition)?.getUUID()).toBe('uuid-c');

        act(() => {
            ReactDOM.unmountComponentAtNode(container);
        });
        document.body.removeChild(container);
    });
});
