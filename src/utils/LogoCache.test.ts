import LogoCache from './LogoCache';

/** A stand-in for HTMLImageElement whose load can be driven by the test. */
interface FakeImage {
    src: string;
    width: number;
    height: number;
    onload: (() => void) | null;
    onerror: (() => void) | null;
}

const harness = (options: { maxConcurrent?: number; maxScaledEntries?: number } = {}) => {
    const images: FakeImage[] = [];
    const drawCalls: Array<{ width: number; height: number }> = [];
    const scheduled: Array<() => void> = [];

    const cache = new LogoCache({
        maxConcurrent: options.maxConcurrent,
        maxScaledEntries: options.maxScaledEntries,
        createImage: () => {
            const image: FakeImage = { src: '', width: 200, height: 100, onload: null, onerror: null };
            images.push(image);
            return (image as unknown) as HTMLImageElement;
        },
        createCanvas: () => {
            const canvas = {
                width: 0,
                height: 0,
                getContext: () => ({
                    drawImage: (_img: unknown, _x: number, _y: number, w: number, h: number) => {
                        drawCalls.push({ width: w, height: h });
                    }
                })
            };
            return (canvas as unknown) as HTMLCanvasElement;
        },
        schedule: (callback: () => void) => scheduled.push(callback)
    });

    return {
        cache,
        images,
        drawCalls,
        flushNotifications: () => {
            const pending = scheduled.splice(0, scheduled.length);
            pending.forEach((callback) => callback());
        },
        settle: (image: FakeImage) => image.onload && image.onload(),
        fail: (image: FakeImage) => image.onerror && image.onerror(),
        scheduledCount: () => scheduled.length
    };
};

describe('LogoCache loading', () => {
    it('returns undefined on first ask and schedules the load', () => {
        const h = harness();
        expect(h.cache.get('http://x/a.png')).toBeUndefined();
        expect(h.images.length).toBe(1);
        expect(h.images[0].src).toBe('http://x/a.png');
    });

    it('returns the image once it has loaded', () => {
        const h = harness();
        h.cache.get('http://x/a.png');
        h.settle(h.images[0]);
        expect(h.cache.get('http://x/a.png')).toBeDefined();
    });

    it('requests each url only once, however many times it is drawn', () => {
        const h = harness();
        for (let i = 0; i < 50; i++) {
            h.cache.get('http://x/a.png');
        }
        expect(h.images.length).toBe(1);
    });

    // The regression this exists for: preloadImages fired one request per
    // channel - 1060 at once on a real lineup.
    it('never exceeds maxConcurrent requests in flight', () => {
        const h = harness({ maxConcurrent: 6 });
        for (let i = 0; i < 100; i++) {
            h.cache.get('http://x/' + i + '.png');
        }
        expect(h.images.length).toBe(6);
        expect(h.cache.stats().queued).toBe(94);
    });

    it('starts queued work as requests complete', () => {
        const h = harness({ maxConcurrent: 2 });
        for (let i = 0; i < 5; i++) {
            h.cache.get('http://x/' + i + '.png');
        }
        expect(h.images.length).toBe(2);

        h.settle(h.images[0]);
        expect(h.images.length).toBe(3);

        h.settle(h.images[1]);
        h.settle(h.images[2]);
        expect(h.images.length).toBe(5);
    });

    it('does not retry a logo that failed to load', () => {
        const h = harness();
        h.cache.get('http://x/broken.png');
        h.fail(h.images[0]);

        h.cache.get('http://x/broken.png');
        h.cache.get('http://x/broken.png');
        expect(h.images.length).toBe(1);
        expect(h.cache.stats().failed).toBe(1);
    });

    it('a failure frees its slot so the queue keeps moving', () => {
        const h = harness({ maxConcurrent: 1 });
        h.cache.get('http://x/a.png');
        h.cache.get('http://x/b.png');
        expect(h.images.length).toBe(1);

        h.fail(h.images[0]);
        expect(h.images.length).toBe(2);
    });

    it('ignores an undefined url', () => {
        const h = harness();
        expect(h.cache.get(undefined)).toBeUndefined();
        expect(h.images.length).toBe(0);
    });
});

describe('LogoCache notifications', () => {
    it('notifies listeners after a load, so surfaces can repaint', () => {
        const h = harness();
        let notified = 0;
        h.cache.onReady(() => notified++);

        h.cache.get('http://x/a.png');
        h.settle(h.images[0]);
        h.flushNotifications();

        expect(notified).toBe(1);
    });

    // Without coalescing, 1060 loads would mean 1060 React renders.
    it('coalesces a burst of loads into a single notification', () => {
        const h = harness({ maxConcurrent: 10 });
        let notified = 0;
        h.cache.onReady(() => notified++);

        for (let i = 0; i < 10; i++) {
            h.cache.get('http://x/' + i + '.png');
        }
        h.images.forEach((image) => h.settle(image));
        expect(h.scheduledCount()).toBe(1);

        h.flushNotifications();
        expect(notified).toBe(1);
    });

    it('does not notify for failures', () => {
        const h = harness();
        let notified = 0;
        h.cache.onReady(() => notified++);

        h.cache.get('http://x/broken.png');
        h.fail(h.images[0]);
        h.flushNotifications();

        expect(notified).toBe(0);
    });
});

describe('LogoCache scaling', () => {
    it('returns undefined while the source image is still loading', () => {
        const h = harness();
        expect(h.cache.getScaled('http://x/a.png', 117, 90)).toBeUndefined();
    });

    it('rasterises once at the requested size and reuses it', () => {
        const h = harness();
        h.cache.get('http://x/a.png');
        h.settle(h.images[0]);

        const first = h.cache.getScaled('http://x/a.png', 117, 90);
        for (let i = 0; i < 60; i++) {
            h.cache.getScaled('http://x/a.png', 117, 90);
        }

        expect(first).toBeDefined();
        // scaled exactly once despite 61 asks - this is the per-frame rescale
        expect(h.drawCalls.length).toBe(1);
        expect(h.drawCalls[0]).toEqual({ width: 117, height: 90 });
        expect(h.cache.getScaled('http://x/a.png', 117, 90)).toBe(first);
    });

    it('keeps separate bitmaps per drawn size', () => {
        const h = harness();
        h.cache.get('http://x/a.png');
        h.settle(h.images[0]);

        const small = h.cache.getScaled('http://x/a.png', 117, 90);
        const large = h.cache.getScaled('http://x/a.png', 234, 180);

        expect(h.drawCalls.length).toBe(2);
        expect(small).not.toBe(large);
    });

    it('rounds sizes so fractional rects do not multiply cache entries', () => {
        const h = harness();
        h.cache.get('http://x/a.png');
        h.settle(h.images[0]);

        h.cache.getScaled('http://x/a.png', 117.2, 90.4);
        h.cache.getScaled('http://x/a.png', 117.4, 90.1);

        expect(h.drawCalls.length).toBe(1);
        expect(h.cache.stats().scaled).toBe(1);
    });

    it('evicts oldest bitmaps beyond the cap, so a long lineup cannot grow without bound', () => {
        const h = harness({ maxScaledEntries: 3, maxConcurrent: 100 });
        for (let i = 0; i < 5; i++) {
            h.cache.get('http://x/' + i + '.png');
        }
        h.images.forEach((image) => h.settle(image));
        for (let i = 0; i < 5; i++) {
            h.cache.getScaled('http://x/' + i + '.png', 117, 90);
        }

        expect(h.cache.stats().scaled).toBe(3);
    });

    it('never returns a bitmap for a url that has not loaded', () => {
        const h = harness({ maxConcurrent: 1 });
        h.cache.get('http://x/a.png');
        h.cache.get('http://x/b.png');
        h.settle(h.images[0]);

        expect(h.cache.getScaled('http://x/a.png', 117, 90)).toBeDefined();
        expect(h.cache.getScaled('http://x/b.png', 117, 90)).toBeUndefined();
    });
});
