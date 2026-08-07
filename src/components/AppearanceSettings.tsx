import React, { useContext, useEffect, useRef, useState } from 'react';
import AppContext from '../AppContext';
import RemoteKeys from '../utils/RemoteKeys';
import { APPEARANCE_SETTINGS, AppearanceSetting, StoredAppearance } from '../utils/Appearance';
import { wrapIndex } from '../utils/ListNavigation';

/**
 * Which choice a setting is currently on.
 *
 * Falls back to the setting's own default rather than to index 0, because the
 * two are not the same thing: `channelNumbers` defaults to `on`, which is not
 * first in its list, and resolving a missing key to the first choice would
 * show the user "Off" while the app was drawing the numbers.
 */
export const selectedChoiceIndex = (setting: AppearanceSetting, stored: StoredAppearance): number => {
    const storedIndex = setting.choices.findIndex((choice) => choice.key === stored[setting.id]);
    if (storedIndex >= 0) {
        return storedIndex;
    }
    return Math.max(
        0,
        setting.choices.findIndex((choice) => choice.key === setting.defaultKey)
    );
};

/**
 * Appearance settings, applied as they change rather than on a Save button.
 *
 * Live application is the point: every one of these is a visual choice, and
 * the app is drawn behind this panel. Making the user commit blind and then
 * come back to judge the result is how a settings screen ends up being visited
 * three times per decision.
 *
 * Left/right cycles a setting's choices rather than opening a submenu. A
 * submenu costs two presses to reach the alternatives and hides the fact that
 * alternatives exist; the strip shows all of them and each press moves one
 * along, which on a remote is the whole interaction.
 */
const AppearanceSettings = (props: { unmount: () => void }) => {
    const { storedAppearance, setAppearanceChoice } = useContext(AppContext);
    const wrapper = useRef<HTMLDivElement>(null);
    const [focusedIndex, setFocusedIndex] = useState(0);

    const cycle = (setting: AppearanceSetting, delta: number) => {
        const next = wrapIndex(selectedChoiceIndex(setting, storedAppearance), setting.choices.length, delta);
        setAppearanceChoice(setting.id, setting.choices[next].key);
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLDivElement>) => {
        switch (event.keyCode) {
            case RemoteKeys.ARROW_UP:
                event.stopPropagation();
                setFocusedIndex(wrapIndex(focusedIndex, APPEARANCE_SETTINGS.length, -1));
                break;
            case RemoteKeys.ARROW_DOWN:
                event.stopPropagation();
                setFocusedIndex(wrapIndex(focusedIndex, APPEARANCE_SETTINGS.length, 1));
                break;
            case RemoteKeys.ARROW_LEFT:
                event.stopPropagation();
                cycle(APPEARANCE_SETTINGS[focusedIndex], -1);
                break;
            // OK advances rather than opening anything, so the one button a
            // user reaches for by reflex does what the strip already suggests
            case RemoteKeys.ARROW_RIGHT:
            case RemoteKeys.OK:
                event.stopPropagation();
                cycle(APPEARANCE_SETTINGS[focusedIndex], 1);
                break;
            case RemoteKeys.BACK:
                event.stopPropagation();
                // No save step - every change is already applied and stored,
                // so back is simply leaving
                props.unmount();
                break;
            default:
                break;
        }
    };

    useEffect(() => {
        wrapper.current?.focus();
    }, []);

    return (
        <div
            id="appearance-settings"
            className="appearanceSettings"
            ref={wrapper}
            tabIndex={-1}
            onKeyDown={handleKeyPress}
        >
            <h2>Appearance</h2>
            <p className="categoryHint">
                Changes apply as you make them. Left and right change a setting, back returns to the guide.
            </p>

            {APPEARANCE_SETTINGS.map((setting, index) => (
                <div
                    className={index === focusedIndex ? 'settingRow focused' : 'settingRow'}
                    key={setting.id}
                    onMouseMove={() => setFocusedIndex(index)}
                >
                    <div className="settingLabel">
                        {setting.label}
                        {setting.hint && <span className="settingHint">{setting.hint}</span>}
                    </div>
                    <div className="settingChoices">
                        {setting.choices.map((choice, choiceIndex) => (
                            <span
                                className={
                                    choiceIndex === selectedChoiceIndex(setting, storedAppearance)
                                        ? 'settingChoice selected'
                                        : 'settingChoice'
                                }
                                key={choice.key}
                                onClick={() => {
                                    setFocusedIndex(index);
                                    setAppearanceChoice(setting.id, choice.key);
                                }}
                            >
                                {choice.label}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default AppearanceSettings;
