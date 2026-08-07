import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import kind from '@enact/core/kind';
import MoonstoneDecorator from '@enact/moonstone/MoonstoneDecorator';
import { AppContextProvider } from './AppContext';
import { publishAppearance } from './utils/Appearance';
import AppearanceStore from './utils/AppearanceStore';
import { GROUPS_WIDTH } from './components/GroupsColumn';

// Bundled in the ipk rather than relying on a system font, so metrics and
// glyph coverage are ours and not the TV's.
//
// Only 400 and 700: those are the two weights app.css and the canvas actually
// ask for (writeText prefixes `bold `, which resolves to 700). 600 was
// imported speculatively at first and cost 60KB for nothing.
//
// latin-ext is kept deliberately, at ~71KB. German needs only latin, but
// European lineups routinely carry Polish, Czech and Croatian channel names,
// and without the subset those would render in the system font beside Inter -
// visibly mismatched mid-list. This is a one-time install cost on a TV, not a
// per-visit download, which is what makes the trade worth taking.
// Scripts outside both subsets still fall back per glyph, which Chromium
// handles without drawing boxes.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-ext-700.css';

// Before the first render, so no surface ever paints with unstamped custom
// properties - and before AppContextProvider reads the same record into state,
// so the palette the canvas draws with and the one the stylesheet holds cannot
// disagree at startup. A corrupt or absent record resolves to the defaults
// here rather than throwing, which matters because this line runs before
// anything is on screen to show an error with.
publishAppearance(AppearanceStore.resolved());

// The groups column has the same two-consumer problem as the palette: the
// components size themselves from the constant, while the stylesheet needs the
// number to lay out everything sitting to its right. Publishing it once here
// keeps the two from drifting - a hardcoded 280px in app.css would silently
// stop matching the moment the constant moved.
document.documentElement.style.setProperty('--groups-width', GROUPS_WIDTH + 'px');

const AppBase = kind({
    name: 'App',
    render: () => (
        <AppContextProvider>
            <App />
        </AppContextProvider>
    )
});

const DecoratedApp = MoonstoneDecorator(AppBase);

ReactDOM.render(
    <React.StrictMode>
        <DecoratedApp />
    </React.StrictMode>,
    document.getElementById('root')
);
