import React, { useContext, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import EPGChannel from './models/EPGChannel';
import { tagFilter } from './models/ChannelFilter';

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

        const Harness = () => {
            const ctx = useContext(AppContext);
            useEffect(() => {
                // deps=[] => this body only ever runs once, closing over the
                // very first render's context - mirroring reloadData's closure.
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

        act(() => {
            ReactDOM.unmountComponentAtNode(container);
        });
        document.body.removeChild(container);
    });
});
