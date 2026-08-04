import StorageHelper from './StorageHelper';
import EPGChannel from '../models/EPGChannel';

const channels = (): EPGChannel[] => [
    new EPGChannel(undefined, 'One', 1, 'uuid-a', new URL('http://tvh/1')),
    new EPGChannel(undefined, 'Two', 2, 'uuid-b', new URL('http://tvh/2')),
    new EPGChannel(undefined, 'Three', 3, 'uuid-c', new URL('http://tvh/3'))
];

describe('StorageHelper.resolveInitialChannelPosition', () => {
    beforeEach(() => localStorage.clear());

    it('returns 0 when nothing is stored', () => {
        expect(StorageHelper.resolveInitialChannelPosition(channels())).toBe(0);
    });

    it('resolves a stored uuid to its position', () => {
        StorageHelper.setLastChannelUuid('uuid-c');
        expect(StorageHelper.resolveInitialChannelPosition(channels())).toBe(2);
    });

    it('returns 0 when the stored uuid is no longer in the lineup', () => {
        StorageHelper.setLastChannelUuid('uuid-gone');
        expect(StorageHelper.resolveInitialChannelPosition(channels())).toBe(0);
    });

    it('migrates a legacy index to a uuid and clears the old key', () => {
        localStorage.setItem('lastChannel', '1');
        expect(StorageHelper.resolveInitialChannelPosition(channels())).toBe(1);
        expect(localStorage.getItem('lastChannel')).toBeNull();
        expect(StorageHelper.resolveInitialChannelPosition(channels())).toBe(1);
    });

    it('ignores a legacy index that is out of range', () => {
        localStorage.setItem('lastChannel', '99');
        expect(StorageHelper.resolveInitialChannelPosition(channels())).toBe(0);
        expect(localStorage.getItem('lastChannel')).toBeNull();
    });

    it('returns 0 for an empty lineup', () => {
        StorageHelper.setLastChannelUuid('uuid-a');
        expect(StorageHelper.resolveInitialChannelPosition([])).toBe(0);
    });
});
