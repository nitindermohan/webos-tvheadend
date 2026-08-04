import EPGChannel from '../models/EPGChannel';

/**
 * Whether TV.tsx's stream needs to be (re)started for the channel now at
 * currentChannelPosition.
 *
 * currentChannelPosition is a 0-based index into the *filtered* channel view
 * and moves for reasons other than a zap - AppContext's setActiveFilter and
 * bumpFavoritesVersion both reconcile it when the active filter changes so
 * the still-playing channel keeps a valid index. EPGChannel.getChannelID()
 * is the 1-based *global* lineup position, assigned once at load and stable
 * under any filter - it can never legitimately be compared against a
 * filtered-view index (filteredIndex <= globalIndex always), so a prior
 * `channel.getChannelID() !== currentChannelPosition` guard was
 * unconditionally true and restarted the stream on every reconcile, not just
 * on an actual zap.
 *
 * The only thing that should trigger a restart is the channel *actually
 * playing* changing, which is a question of identity (uuid), not position.
 */
export const shouldSwitchStream = (channel: EPGChannel, playingUuid: string): boolean =>
    channel.getUUID() !== playingUuid;
