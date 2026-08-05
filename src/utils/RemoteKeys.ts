/**
 * webOS remote control key codes.
 *
 * Modern LG Magic Remotes have no colour buttons, so navigation is built on
 * directions, OK, Back and Guide. The colour codes are retained as hidden
 * aliases so older remotes continue to work.
 *
 * GUIDE (458) and INFO (457) are the documented webOS values but have not yet
 * been confirmed on device. TV.tsx logs unhandled codes as "TV-keyPressed:",
 * so pressing Guide with ares-inspect attached reports the real value. If it
 * differs, correcting it here is the only change required.
 */
const RemoteKeys = Object.freeze({
    OK: 13,
    CHANNEL_UP: 33,
    CHANNEL_DOWN: 34,
    ARROW_LEFT: 37,
    ARROW_UP: 38,
    ARROW_RIGHT: 39,
    ARROW_DOWN: 40,
    DIGIT_0: 48,
    DIGIT_9: 57,
    GUIDE: 458,
    INFO: 457,
    BACK: 461,

    // legacy colour buttons - kept so older remotes keep working
    RED: 403,
    GREEN: 404,
    YELLOW: 405,
    BLUE: 406,

    // keyboard aliases used when running in a desktop browser
    KEY_B: 66,
    KEY_C: 67,
    KEY_G: 71,
    KEY_R: 82,
    KEY_Y: 89
} as const);

/**
 * The physical colours of the legacy remote's colour buttons, for the legend
 * the info bar draws.
 *
 * Deliberately *not* theme roles, and deliberately exempt from ThemeGuards.
 * These identify hardware: a red button is red on every TV and in every
 * theme, and routing them through the palette would let a theme switch
 * relabel the buttons - a legend that no longer matches the remote in the
 * user's hand is worse than one that clashes slightly with the surface.
 *
 * Note the legend is drawn unconditionally, while modern Magic Remotes have
 * no colour buttons at all (see the file header). Recorded in
 * docs/ui-redesign-backlog.md; not changed here, because what to draw instead
 * is a behaviour decision rather than a colour one.
 */
export const REMOTE_KEY_COLORS = Object.freeze({
    RED: '#EF3343',
    GREEN: '#46BB3E',
    YELLOW: '#FBC821',
    BLUE: '#4065B8'
} as const);

export default RemoteKeys;
