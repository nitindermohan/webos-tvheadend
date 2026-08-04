import { TVHDataServiceParms } from "../services/TVHDataService";
import EPGChannel from '../models/EPGChannel';

const STORAGE_TVH_SETTING_KEY = 'TVH_SETTINGS';
const STORAGE_KEY_LAST_CHANNEL_UUID = 'lastChannelUuid';
const STORAGE_KEY_LAST_CHANNEL_LEGACY = 'lastChannel';

export default class StorageHelper {
    static getTvhSettings = () => {
        const settingsStr = localStorage.getItem(STORAGE_TVH_SETTING_KEY);
        console.log(settingsStr);
        return settingsStr ? JSON.parse(settingsStr) as TVHDataServiceParms : undefined;
    };

    static setTvhSettings = (settings: TVHDataServiceParms) => {
        localStorage.setItem(STORAGE_TVH_SETTING_KEY, JSON.stringify(settings));
    };

    static setLastChannelUuid = (uuid: string) => {
        localStorage.setItem(STORAGE_KEY_LAST_CHANNEL_UUID, uuid);
    };

    /**
     * Resolve the channel to start on. Prefers the stored uuid; falls back once
     * to the legacy stored index, migrating it to a uuid so a later filter
     * change cannot make it point at a different channel.
     */
    static resolveInitialChannelPosition = (channels: EPGChannel[]): number => {
        if (channels.length === 0) {
            return 0;
        }

        const uuid = localStorage.getItem(STORAGE_KEY_LAST_CHANNEL_UUID);
        if (uuid) {
            const position = channels.findIndex((channel) => channel.getUUID() === uuid);
            return position >= 0 ? position : 0;
        }

        const legacyIndex = localStorage.getItem(STORAGE_KEY_LAST_CHANNEL_LEGACY);
        localStorage.removeItem(STORAGE_KEY_LAST_CHANNEL_LEGACY);
        if (legacyIndex) {
            const position = parseInt(legacyIndex);
            if (!isNaN(position) && position >= 0 && position < channels.length) {
                StorageHelper.setLastChannelUuid(channels[position].getUUID());
                return position;
            }
        }

        return 0;
    };

    static getLastAudioTrackIndex = (channelName: string): number => {
        const indexStr = localStorage.getItem(channelName);
        return (indexStr && parseInt(indexStr)) || 0;
    };

    static setLastAudioTrackIndex = (channelName: string, index: number) => {
        localStorage.setItem(channelName, index.toString());
    };
}
