import { TestResults } from './TVHSettingsTest';

/**
 * Whether the entered settings are good enough to save.
 *
 * Deliberately requires only serverInfo and playlist. The stream check used to
 * gate this as well, but it verifies something the app does not control: it
 * asks TVHeadend to start a live subscription, which fails whenever no input
 * slot is free - EPG grabbing, other clients, or an IPTV network already at its
 * max_streams cap. TVHeadend answers that by closing the connection with no
 * HTTP response at all, which Node surfaces as "socket hang up". Gating Save on
 * it meant perfectly good settings could not be saved for a reason outside the
 * app, with an error message that explained nothing.
 *
 * serverInfo and playlist are the two results that actually prove the settings
 * work: the server is reachable and authentication is accepted, and channels
 * can be listed. The stream result is still run and still shown - failing, it
 * renders as an orange warning - it just no longer blocks.
 */
export const isSetupValid = (results?: TestResults): boolean =>
    Boolean(results && results.serverInfo.accessible && results.playlist.accessible);
