import Theme, {
    ACCENTS,
    DEFAULT_ACCENT,
    OLED_BLACK,
    Palette,
    THEMES,
    accentForKey,
    applyTheme,
    cssVariableName,
    getTheme,
    rgbVariableName,
    themeForKey,
    withAccent,
    withAlpha
} from './Theme';

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

    describe('the set of themes', () => {
        it('holds more than one', () => {
            // guards the walkers below: every assertion in this block iterates
            // THEMES, so a list that shrank to one would pass them all while
            // checking nothing about a second palette
            expect(THEMES.length).toBeGreaterThan(1);
        });

        it('gives every theme every role', () => {
            // OLED_BLACK is the reference rather than a hardcoded list, so a
            // role added to Palette is automatically demanded of every theme.
            // A missing role does not fail to compile when a palette is built
            // by spreading another one, and applyTheme would stamp `undefined`
            // - which canvas ignores silently, drawing invisible text.
            const roles = Object.keys(OLED_BLACK) as (keyof Palette)[];

            THEMES.forEach((theme) => {
                roles.forEach((role) => {
                    expect(typeof theme.palette[role]).toBe('string');
                    expect(theme.palette[role]).toMatch(/^(#|rgb|hsl)/);
                });
                expect(Object.keys(theme.palette).length).toBe(roles.length);
            });
        });

        it('keeps selection and focus distinguishable in every theme', () => {
            THEMES.forEach((theme) => {
                expect(theme.palette.accent).not.toBe(theme.palette.focus);
            });
        });

        it('gives every theme a distinct key and a label', () => {
            const keys = THEMES.map((theme) => theme.key);
            // duplicate keys make themeForKey silently resolve to the first,
            // so a theme becomes unreachable from the settings screen
            expect(new Set(keys).size).toBe(keys.length);
            THEMES.forEach((theme) => expect(theme.label).not.toBe(''));
        });
    });

    describe('themeForKey', () => {
        it('resolves a stored key to its palette', () => {
            THEMES.forEach((theme) => {
                expect(themeForKey(theme.key)).toEqual(theme.palette);
            });
        });

        it('falls back for anything unrecognised', () => {
            // an old key, a hand-edited localStorage value, or a key from a
            // version the user has rolled back from. Returning undefined here
            // would paint the whole app with unstamped properties.
            expect(themeForKey('nonsense')).toEqual(THEMES[0].palette);
            expect(themeForKey(null)).toEqual(THEMES[0].palette);
            expect(themeForKey(undefined)).toEqual(THEMES[0].palette);
        });
    });

    describe('accents', () => {
        it('offers the theme default plus alternatives', () => {
            expect(ACCENTS.length).toBeGreaterThan(1);
            const keys = ACCENTS.map((accent) => accent.key);
            expect(new Set(keys).size).toBe(keys.length);
            expect(keys).toContain(DEFAULT_ACCENT.key);
        });

        it('leaves the palette alone for the theme default', () => {
            // the default is the absence of an override, not a colour that
            // happens to match one theme - otherwise picking "default" under
            // OLED black would pin that blue into the slate theme too
            expect(DEFAULT_ACCENT.color).toBeUndefined();
            expect(withAccent(OLED_BLACK, DEFAULT_ACCENT.color)).toEqual(OLED_BLACK);
        });

        it('names a real colour for every alternative', () => {
            ACCENTS.filter((accent) => accent !== DEFAULT_ACCENT).forEach((accent) => {
                expect(accent.color).toMatch(/^#[0-9a-fA-F]{6}$/);
                expect(accent.label).not.toBe('');
            });
        });

        it('resolves a stored key, falling back to the default', () => {
            const cyan = ACCENTS.find((accent) => accent.color !== undefined);
            expect(accentForKey(cyan?.key)).toBe(cyan);
            expect(accentForKey('nonsense')).toBe(DEFAULT_ACCENT);
            expect(accentForKey(null)).toBe(DEFAULT_ACCENT);
        });
    });

    describe('withAccent', () => {
        it('replaces only the accent role', () => {
            const result = withAccent(OLED_BLACK, '#112233');

            expect(result.accent).toBe('#112233');
            // every other role must survive verbatim. Written as a whole-object
            // comparison rather than a handful of spot checks so a future role
            // cannot be clobbered without this failing.
            expect(result).toEqual({ ...OLED_BLACK, accent: '#112233' });
        });

        it('leaves focus alone', () => {
            // accent is SELECTION and focus is the D-pad cursor. A custom
            // accent that also moved focus would let the user set the two to
            // the same colour and lose the distinction the palette is built on.
            expect(withAccent(OLED_BLACK, OLED_BLACK.focus).focus).toBe(OLED_BLACK.focus);
        });

        it('does not mutate the palette it was given', () => {
            const original = { ...OLED_BLACK };
            withAccent(OLED_BLACK, '#112233');
            expect(OLED_BLACK).toEqual(original);
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

    describe('translucency', () => {
        // Every overlay in this app sits on top of playing video, so alpha is
        // structural, not decorative. Chromium 87 has no color-mix(), so both
        // consumers get an explicit route to a partial-opacity colour.
        it('stamps bare rgb channels alongside each role', () => {
            applyTheme(OLED_BLACK);

            expect(rgbVariableName('surfaceRaised')).toBe('--surface-raised-rgb');
            // '#0E0E11' -> 14, 14, 17. Bare channels, not an rgb() call, so
            // the stylesheet can wrap them: rgba(var(--surface-raised-rgb), .9)
            expect(document.documentElement.style.getPropertyValue('--surface-raised-rgb')).toBe('14, 14, 17');
            expect(document.documentElement.style.getPropertyValue('--surface-base-rgb')).toBe('0, 0, 0');
        });

        it('builds a complete colour string for canvas', () => {
            expect(withAlpha('#000000', 0.9)).toBe('rgba(0, 0, 0, 0.9)');
            expect(withAlpha('#3EA6FF', 0.15)).toBe('rgba(62, 166, 255, 0.15)');
        });

        it('accepts the three-digit hex form', () => {
            expect(withAlpha('#fff', 1)).toBe('rgba(255, 255, 255, 1)');
        });
    });

    it('exports the theme object as default for convenience', () => {
        expect(Theme.getTheme).toBe(getTheme);
    });
});
