import FileServiceAdapter from '../luna/FileServiceAdapter';
import HttpProxyServiceAdapter from '../luna/HttpProxyServiceAdapter';
import LunaServiceAdapter from '../luna/LunaServiceAdapter';

/**
 * `npm run start:mock` swaps the three service adapters for the fixtures in
 * src/mock - 908 channels, real EPG data, tags and recordings - so the UI can
 * be run and inspected in a desktop browser with no TVheadend server and no
 * TV. This replaces the old routine of hand-editing the commented block that
 * used to live here, which was easy to commit by accident and easy to
 * mistake for dead code.
 *
 * CRA replaces `process.env.REACT_APP_USE_MOCKS` with a literal at build
 * time, so a production build folds the condition to `false` and webpack
 * never walks the require() below - the fixtures do not reach the ipk.
 * That claim is checked, not assumed: `Config.test.ts` asserts the flag is
 * off by default, and the production bundle size is the backstop, since
 * 900KB of leaked EPG fixtures would be impossible to miss.
 */
let Config: Configuration;

if (process.env.NODE_ENV !== 'production' && process.env.REACT_APP_USE_MOCKS === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Config = require('../mock/MockConfig').default;
} else {
    Config = {
        lunaServiceAdapter: new LunaServiceAdapter(),
        httpProxyServiceAdapter: new HttpProxyServiceAdapter(),
        fileServiceAdapter: new FileServiceAdapter()
    };
}

export default Config;
