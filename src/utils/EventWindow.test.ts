import { visibleEvents } from './EventWindow';

/** Events as [start, end] pairs; the window is [10, 20]. */
const inWindow = (event: number[]) => event[0] <= 20 && event[1] >= 10;

describe('visibleEvents', () => {
    it('returns the contiguous run of visible events', () => {
        const events = [
            [0, 5], // before
            [12, 14], // visible
            [15, 18], // visible
            [30, 40], // after
            [50, 60] // after
        ];
        expect(visibleEvents(events, inWindow)).toEqual([
            [12, 14],
            [15, 18]
        ]);
    });

    it('skips leading non-visible events without stopping', () => {
        const events = [
            [0, 1],
            [2, 3],
            [12, 14]
        ];
        expect(visibleEvents(events, inWindow)).toEqual([[12, 14]]);
    });

    // The regression this exists for. `return` inside forEach only skips one
    // item, so the old code walked every event of every channel every frame.
    it('stops walking once the window has been passed', () => {
        const events = [[12, 14], [30, 40], [50, 60], [70, 80], [90, 100]];
        let calls = 0;
        const counting = (event: number[]) => {
            calls++;
            return inWindow(event);
        };

        expect(visibleEvents(events, counting)).toEqual([[12, 14]]);
        // one visible, one that ends the run - never the trailing three
        expect(calls).toBe(2);
    });

    it('walks the whole list when nothing is visible, since the run never started', () => {
        const events = [[0, 1], [2, 3], [4, 5]];
        let calls = 0;
        const counting = (event: number[]) => {
            calls++;
            return inWindow(event);
        };

        expect(visibleEvents(events, counting)).toEqual([]);
        expect(calls).toBe(3);
    });

    it('handles an empty list', () => {
        expect(visibleEvents([], inWindow)).toEqual([]);
    });

    it('returns every event when all are visible', () => {
        const events = [[10, 11], [12, 13], [14, 15]];
        expect(visibleEvents(events, inWindow)).toEqual(events);
    });

    it('does not mutate the input', () => {
        const events = [[12, 14], [30, 40]];
        const copy = [[12, 14], [30, 40]];
        visibleEvents(events, inWindow);
        expect(events).toEqual(copy);
    });
});
