import MockFileServiceAdapter from './MockFileServiceAdapter';
import MockHttpProxyServiceAdapter from './MockHttpProxyServiceAdapter';
import MockLunaServiceAdapter from './MockLunaServiceAdapter';

/**
 * The fixture-backed service adapters, kept in their own module so that
 * `Config.ts` can reach them through a single `require()` that webpack can
 * discard wholesale in a production build. Importing them from `Config.ts`
 * directly would pull the ~900KB of fixtures into the ipk whether or not the
 * mock flag was set.
 */
const MockConfig: Configuration = {
    lunaServiceAdapter: new MockLunaServiceAdapter(),
    httpProxyServiceAdapter: new MockHttpProxyServiceAdapter(),
    fileServiceAdapter: new MockFileServiceAdapter()
};

export default MockConfig;
