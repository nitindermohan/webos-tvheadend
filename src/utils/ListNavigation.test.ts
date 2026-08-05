import { wrapIndex, NO_INDEX } from './ListNavigation';

describe('wrapIndex', () => {
    it('steps forward and back', () => {
        expect(wrapIndex(2, 5, 1)).toBe(3);
        expect(wrapIndex(2, 5, -1)).toBe(1);
    });

    it('wraps off the bottom onto the top', () => {
        expect(wrapIndex(4, 5, 1)).toBe(0);
    });

    it('wraps off the top onto the bottom', () => {
        expect(wrapIndex(0, 5, -1)).toBe(4);
    });

    it('the two directions are inverses of each other, wrap included', () => {
        expect(wrapIndex(wrapIndex(0, 5, -1), 5, 1)).toBe(0);
        expect(wrapIndex(wrapIndex(4, 5, 1), 5, -1)).toBe(4);
    });

    it('stays put on a single-row list', () => {
        expect(wrapIndex(0, 1, 1)).toBe(0);
        expect(wrapIndex(0, 1, -1)).toBe(0);
    });

    it('reports no index for an empty list', () => {
        expect(wrapIndex(0, 0, 1)).toBe(NO_INDEX);
        expect(wrapIndex(-1, 0, -1)).toBe(NO_INDEX);
    });

    // The active filter can be one the list no longer offers - a persisted tag
    // whose category was deselected in the picker - and indexOfFilter reports
    // -1 for it. Pressing a direction must still land somewhere.
    it('treats an out-of-range cursor as the top of the list', () => {
        expect(wrapIndex(NO_INDEX, 5, -1)).toBe(4);
        expect(wrapIndex(99, 5, 1)).toBe(1);
    });
});
