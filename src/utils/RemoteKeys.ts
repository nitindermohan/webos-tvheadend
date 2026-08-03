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
const RemoteKeys = {
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
};

export default RemoteKeys;
