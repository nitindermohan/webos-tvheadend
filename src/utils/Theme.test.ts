import Theme, { OLED_BLACK, Palette, applyTheme, cssVariableName, getTheme } from './Theme';

/**
 * The palette has two consumers with nothing in common: the stylesheet, which
 * reads CSS custom properties, and the canvas draw code, which cannot read
 * them at all and needs plain strings. These tests pin both halves, because a
 * change that serves one and silently drops the other is exactly the failure
 * this module exists to prevent.
 */
describe('Theme', () => {
    afterEach(() => {
        // applyTheme mutates real module state and the real document - leaking
        // either would make the next test depend on execution order
        document.documentElement.removeAttribute('style');
        applyTheme(OLED_BLACK);
    });

    describe('the palette itself', () => {
        it('gives every role a value', () => {
            Object.entries(OLED_BLACK).forEach(([role, value]) => {
                expect(typeof value).toBe('string');
                expect(value).not.toBe('');
                // catches a role stubbed with a placeholder during editing
                expect(value).toMatch(/^(#|rgb|hsl)/);
            });
            expect(Object.keys(OLED_BLACK).length).toBeGreaterThan(0);
        });

        it('keeps selection and focus distinguishable', () => {
            // the whole point of the amber discipline: `focus` means "the
            // cursor is here" and `accent` means "this is chosen". If they
            // are ever set to the same colour, a focused row and a selected
            // row become indistinguishable and the discipline is lost.
            expect(OLED_BLACK.accent).not.toBe(OLED_BLACK.focus);
        });

        it('names roles, not colours', () => {
            // a future light theme must not be described by tokens that lie
            const roleNames = Object.keys(OLED_BLACK).join(' ').toLowerCase();
            ['black', 'white', 'blue', 'amber', 'yellow', 'grey', 'gray'].forEach((colourWord) => {
                expect(roleNames).not.toContain(colourWord);
            });
        });
    });

    describe('cssVariableName', () => {
        it('derives the variable name from the role key', () => {
            expect(cssVariableName('surfaceBase')).toBe('--surface-base');
            expect(cssVariableName('accent')).toBe('--accent');
            expect(cssVariableName('textSecondary')).toBe('--text-secondary');
        });
    });

    describe('applyTheme', () => {
        it('stamps every role onto the document root', () => {
            applyTheme(OLED_BLACK);

            const root = document.documentElement;
            // iterating the palette rather than listing names is deliberate:
            // adding a role to the type and forgetting to stamp it must fail
            // here without anyone remembering to extend this test
            (Object.keys(OLED_BLACK) as (keyof Palette)[]).forEach((role) => {
                expect(root.style.getPropertyValue(cssVariableName(role))).toBe(OLED_BLACK[role]);
            });
        });

        it('replaces the previous palette rather than merging with it', () => {
            const other: Palette = { ...OLED_BLACK, accent: '#123456' };

            applyTheme(OLED_BLACK);
            applyTheme(other);

            expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#123456');
            expect(getTheme().accent).toBe('#123456');
        });

        it('does not let a role from the previous palette survive into the next', () => {
            // Phase 4 persists the chosen theme to localStorage, so a palette
            // can arrive back deserialised and incomplete - an older stored
            // theme written before a role existed, or a truncated write. If
            // applyTheme merged, the missing role would silently keep the
            // *previous theme's* value, giving a palette that is neither of
            // the two and is very hard to reason about on a TV. Replacing
            // makes the gap visible instead.
            const partial = { ...OLED_BLACK } as Partial<Palette>;
            delete partial.accent;

            applyTheme(OLED_BLACK);
            applyTheme(partial as Palette);

            expect(getTheme().accent).toBeUndefined();
        });
    });

    describe('getTheme', () => {
        it('returns the applied palette', () => {
            applyTheme(OLED_BLACK);
            expect(getTheme()).toEqual(OLED_BLACK);
        });

        it('returns a usable palette before applyTheme has ever run', () => {
            // a canvas surface can paint before index.tsx finishes wiring up.
            // Returning undefined here would mean drawing with `undefined` as
            // a fillStyle, which canvas silently ignores - invisible text
            // rather than a loud failure.
            jest.resetModules();
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const fresh = require('./Theme');
            expect(fresh.getTheme()).toEqual(fresh.OLED_BLACK);
        });

        it('does not hand out a reference callers can mutate', () => {
            applyTheme(OLED_BLACK);
            getTheme().accent = '#000000';
            expect(getTheme().accent).toBe(OLED_BLACK.accent);
        });
    });

    it('exports the theme object as default for convenience', () => {
        expect(Theme.getTheme).toBe(getTheme);
    });
});
