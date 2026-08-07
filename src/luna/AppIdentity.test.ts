import fs from 'fs';
import path from 'path';
import { APP_ID, PROXY_SERVICE_ID, PROXY_SERVICE_URI } from './AppIdentity';

const root = path.resolve(__dirname, '../..');
const readText = (relative: string): string => fs.readFileSync(path.join(root, relative), 'utf8');
const readJson = (relative: string) => JSON.parse(readText(relative));

/**
 * The one check that catches an app-id rename done four fifths of the way.
 *
 * Everything here is a runtime-only failure: the ids disagree, webOS declines
 * to route the luna call, and the app launches looking perfectly healthy while
 * no request ever completes. There is no type to violate and no import to
 * break, so without this test the first signal is a TV showing an empty guide.
 */
describe('app identity', () => {
    it('is what public/appinfo.json declares', () => {
        expect(readJson('public/appinfo.json').id).toBe(APP_ID);
    });

    it('is what the service package declares', () => {
        expect(readJson('service/package.json').name).toBe(APP_ID);
    });

    it('names the same proxy service in services.json, both times', () => {
        // `id` and `services[].name` are separate fields that both have to be
        // the service id - webOS matches on the latter, so a rename that
        // updates only the visible one at the top fails silently
        const services = readJson('service/services.json');
        expect(services.id).toBe(PROXY_SERVICE_ID);
        services.services.forEach((service: { name: string }) => {
            expect(service.name).toBe(PROXY_SERVICE_ID);
        });
    });

    it('is the id service.js registers itself under', () => {
        // plain JS, no imports across the app/service boundary, so this is a
        // text match by necessity
        expect(readText('service/service.js')).toContain(`new Service('${PROXY_SERVICE_ID}')`);
    });

    it('keeps the service id prefixed by the app id', () => {
        // webOS's own rule. Breaking it makes every luna call unroutable, and
        // it is easy to break by renaming the app id alone.
        expect(PROXY_SERVICE_ID.startsWith(`${APP_ID}.`)).toBe(true);
        expect(PROXY_SERVICE_URI).toBe(`luna://${PROXY_SERVICE_ID}`);
    });

    it('is not spelled out in any other source file', () => {
        // The original failure was a second, forgotten copy of the URI, so one
        // constant only helps if nothing re-hardcodes it. Scans production
        // sources for a bare `luna://com.tvh...`; AppIdentity.ts is where the
        // literal belongs, and tests are exempt because asserting on the
        // string is the whole point of this file. LunaServiceAdapter's
        // `luna://com.webos.*` calls are webOS's own services, not ours, and
        // are deliberately not matched.
        const offenders: string[] = [];
        const walk = (dir: string) => {
            fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(full);
                    return;
                }
                const isSource = /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name);
                if (!isSource || entry.name === 'AppIdentity.ts') {
                    return;
                }
                if (/luna:\/\/com\.tvh/.test(readText(path.relative(root, full)))) {
                    offenders.push(path.relative(root, full));
                }
            });
        };
        walk(path.join(root, 'src'));
        expect(offenders).toEqual([]);
    });
});
