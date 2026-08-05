export interface LogoCacheOptions {
    /** How many logo requests may be in flight at once. */
    maxConcurrent?: number;
    /** Upper bound on cached pre-scaled bitmaps, evicted oldest-first. */
    maxScaledEntries?: number;
    createImage?: () => HTMLImageElement;
    createCanvas?: () => HTMLCanvasElement;
    /** Coalesces "something loaded" notifications into one per tick. */
    schedule?: (callback: () => void) => void;
}

const DEFAULT_MAX_CONCURRENT = 6;
const DEFAULT_MAX_SCALED = 240;

/**
 * Channel logos: loaded on demand with bounded concurrency, and cached at the
 * size they are actually drawn.
 *
 * Replaces a plain Map that App.preloadImages filled eagerly - on a 1060
 * channel lineup that was 1060 concurrent image requests the moment the
 * channel list loaded, and every one of those images was then rescaled from
 * full resolution by drawImage on every animation frame.
 *
 * Two things fix that:
 *
 * - get() schedules a load the first time a logo is asked for and returns
 *   undefined until it arrives, so only logos actually drawn are ever
 *   fetched, at most maxConcurrent at a time.
 * - getScaled() rasterises each logo once at its drawn size and hands back
 *   that bitmap, so the per-frame drawImage is a straight blit.
 *
 * Callers learn about arrivals through onReady, which is coalesced: a burst of
 * loads produces one notification, not one per image.
 *
 * Keyed on the url's string value rather than the URL object, so two equal URLs
 * share an entry - the old Map was keyed on the object and relied on
 * EPGChannel handing back the same instance every time.
 */
export default class LogoCache {
    private readonly maxConcurrent: number;
    private readonly maxScaledEntries: number;
    private readonly createImage: () => HTMLImageElement;
    private readonly createCanvas: () => HTMLCanvasElement;
    private readonly schedule: (callback: () => void) => void;

    private images: { [href: string]: HTMLImageElement } = {};
    private requested: { [href: string]: boolean } = {};
    private failed: { [href: string]: boolean } = {};
    private queue: string[] = [];
    private activeCount = 0;

    private scaled: { [key: string]: HTMLCanvasElement } = {};
    private scaledOrder: string[] = [];

    private listeners: Array<() => void> = [];
    private notifyScheduled = false;

    constructor(options: LogoCacheOptions = {}) {
        this.maxConcurrent = options.maxConcurrent || DEFAULT_MAX_CONCURRENT;
        this.maxScaledEntries = options.maxScaledEntries || DEFAULT_MAX_SCALED;
        this.createImage = options.createImage || (() => new Image());
        this.createCanvas = options.createCanvas || (() => document.createElement('canvas'));
        this.schedule =
            options.schedule ||
            ((callback: () => void) => {
                if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(callback);
                } else {
                    setTimeout(callback, 0);
                }
            });
    }

    /** Register a callback fired (coalesced) when logos finish loading. */
    onReady(callback: () => void): void {
        this.listeners.push(callback);
    }

    /**
     * The loaded image, or undefined if it is not here yet - in which case a
     * load is scheduled. Same call shape as the Map this replaced.
     */
    get(url?: URL | string): HTMLImageElement | undefined {
        if (!url) {
            return undefined;
        }
        const href = url.toString();
        const loaded = this.images[href];
        if (loaded) {
            return loaded;
        }
        if (!this.requested[href]) {
            this.requested[href] = true;
            this.queue.push(href);
            this.pump();
        }
        return undefined;
    }

    /**
     * The logo rasterised at exactly width x height, ready to blit with no
     * scaling. Returns undefined while the source image is still loading.
     *
     * Falls back to the raw image if a 2d context cannot be obtained, so a
     * surface never loses its logo just because the cache could not help.
     */
    getScaled(url: URL | string | undefined, width: number, height: number): CanvasImageSource | undefined {
        const image = this.get(url);
        if (!image || !url) {
            return undefined;
        }
        const drawWidth = Math.max(1, Math.round(width));
        const drawHeight = Math.max(1, Math.round(height));
        const key = url.toString() + '|' + drawWidth + 'x' + drawHeight;

        const cached = this.scaled[key];
        if (cached) {
            return cached;
        }

        const canvas = this.createCanvas();
        canvas.width = drawWidth;
        canvas.height = drawHeight;
        const context = canvas.getContext('2d');
        if (!context) {
            return image;
        }
        context.drawImage(image, 0, 0, drawWidth, drawHeight);

        this.scaled[key] = canvas;
        this.scaledOrder.push(key);
        while (this.scaledOrder.length > this.maxScaledEntries) {
            const evicted = this.scaledOrder.shift();
            if (evicted !== undefined) {
                delete this.scaled[evicted];
            }
        }
        return canvas;
    }

    /** Visible for tests and diagnostics. */
    stats() {
        return {
            loaded: Object.keys(this.images).length,
            inFlight: this.activeCount,
            queued: this.queue.length,
            failed: Object.keys(this.failed).length,
            scaled: this.scaledOrder.length
        };
    }

    private pump(): void {
        while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
            const href = this.queue.shift();
            if (href === undefined) {
                return;
            }
            this.start(href);
        }
    }

    private start(href: string): void {
        this.activeCount++;
        const image = this.createImage();
        image.onload = () => {
            this.images[href] = image;
            this.activeCount--;
            this.pump();
            this.notify();
        };
        image.onerror = () => {
            // remembered so a broken logo is not retried on every repaint
            this.failed[href] = true;
            this.activeCount--;
            this.pump();
        };
        image.src = href;
    }

    private notify(): void {
        if (this.notifyScheduled) {
            return;
        }
        this.notifyScheduled = true;
        this.schedule(() => {
            this.notifyScheduled = false;
            this.listeners.forEach((listener) => listener());
        });
    }
}
