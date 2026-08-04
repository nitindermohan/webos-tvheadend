/**
 * Reads a JSON-encoded array of strings from localStorage, degrading
 * gracefully to an empty array on any missing, corrupt, or malformed data
 * rather than throwing. Shared by FavoritesStore and CategoryStore so the
 * parsing/validation rule lives in exactly one place.
 */
export const readStoredStringArray = (key: string): string[] => {
    const raw = localStorage.getItem(key);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter((entry) => typeof entry === 'string');
    } catch (error) {
        console.log('Failed to parse stored string array for key', key, error);
        return [];
    }
};
