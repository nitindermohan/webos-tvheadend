import { Appearance, StoredAppearance, resolveAppearance } from './Appearance';

export const STORAGE_KEY_APPEARANCE = 'appearance';

/**
 * The user's appearance choices, as one record under one key.
 *
 * One key rather than a key per setting, unlike CategoryStore's four. The
 * settings screen holds the whole record and writes it whole, so splitting it
 * would buy nothing and cost the guarantee that a half-finished write leaves
 * the app on a consistent set rather than a mixture of two.
 *
 * Only choice keys are stored - never a palette, a row height, or a scale
 * factor. A stored `#3EA6FF` would outlive the palette revision that changed
 * it and strand one colour from the old theme inside the new one.
 *
 * Degrades the same way StoredStringArray does, and for the same reason: this
 * runs on a TV with no console and no way to clear a corrupt value, so a
 * settings record that fails to parse must cost the user their preferences,
 * never the app its startup.
 */
export default class AppearanceStore {
    static read(): StoredAppearance {
        const raw = localStorage.getItem(STORAGE_KEY_APPEARANCE);
        if (!raw) {
            return {};
        }
        try {
            const parsed = JSON.parse(raw);
            // `typeof null` is 'object' and an array is one too, so both are
            // ruled out explicitly - either would reach resolveAppearance as a
            // record whose every lookup is undefined
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return {};
            }
            // One malformed entry costs that one setting, not the record. A
            // non-string value would reach the choice lookups as an object and
            // resolve to a default anyway, but dropping it here keeps the
            // stored shape honest for the next write.
            return Object.keys(parsed).reduce<StoredAppearance>((record, key) => {
                if (typeof parsed[key] === 'string') {
                    record[key] = parsed[key];
                }
                return record;
            }, {});
        } catch (error) {
            console.log('Failed to parse stored appearance, using defaults:', error);
            return {};
        }
    }

    /** Replaces the record. The caller always holds all of it. */
    static write(appearance: StoredAppearance): void {
        try {
            localStorage.setItem(STORAGE_KEY_APPEARANCE, JSON.stringify(appearance));
        } catch (error) {
            // webOS clears localStorage under memory pressure and can report a
            // quota error on the way. Losing the setting is a nuisance;
            // throwing out of the settings screen mid-change is a dead end the
            // user cannot back out of with a remote.
            console.log('Failed to persist appearance:', error);
        }
    }

    static resolved(): Appearance {
        return resolveAppearance(AppearanceStore.read());
    }
}
