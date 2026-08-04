import RemoteKeys from './RemoteKeys';

describe('RemoteKeys', () => {
    it('maps the navigation keys to their webOS key codes', () => {
        expect(RemoteKeys.OK).toBe(13);
        expect(RemoteKeys.BACK).toBe(461);
        expect(RemoteKeys.ARROW_LEFT).toBe(37);
        expect(RemoteKeys.ARROW_UP).toBe(38);
        expect(RemoteKeys.ARROW_RIGHT).toBe(39);
        expect(RemoteKeys.ARROW_DOWN).toBe(40);
        expect(RemoteKeys.CHANNEL_UP).toBe(33);
        expect(RemoteKeys.CHANNEL_DOWN).toBe(34);
        expect(RemoteKeys.GUIDE).toBe(458);
    });

    it('assigns every key code to exactly one name', () => {
        const codes = Object.keys(RemoteKeys).map((name) => (RemoteKeys as { [k: string]: number })[name]);
        const unique: number[] = [];
        codes.forEach((code) => {
            if (unique.indexOf(code) < 0) {
                unique.push(code);
            }
        });
        expect(unique.length).toBe(codes.length);
    });

    it('is frozen, so reassigning a key code has no effect', () => {
        const original = RemoteKeys.OK;
        try {
            // In non-strict mode this assignment fails silently; in strict
            // mode (as ES modules always are) it throws a TypeError. Either
            // way the object must be left unchanged, so the throw is caught
            // rather than asserted on.
            (RemoteKeys as { [k: string]: number }).OK = 999;
        } catch (error) {
            // expected in strict mode - fall through to the assertion below
        }
        expect(RemoteKeys.OK).toBe(original);
    });
});
