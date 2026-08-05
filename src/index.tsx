import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import kind from '@enact/core/kind';
import MoonstoneDecorator from '@enact/moonstone/MoonstoneDecorator';
import { AppContextProvider } from './AppContext';
import { applyTheme, OLED_BLACK } from './utils/Theme';

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

// Before the first render, so no surface ever paints with unstamped
// custom properties. Phase 4 will read the user's choice here instead of
// hardcoding the palette; everything downstream already goes through
// getTheme(), so that stays a one-line change.
applyTheme(OLED_BLACK);

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
