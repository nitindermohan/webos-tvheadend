import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import kind from '@enact/core/kind';
import MoonstoneDecorator from '@enact/moonstone/MoonstoneDecorator';
import { AppContextProvider } from './AppContext';
import { applyTheme, OLED_BLACK } from './utils/Theme';

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
