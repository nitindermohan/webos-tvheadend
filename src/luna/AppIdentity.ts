/**
 * The app's identity, in the one place TypeScript can see it.
 *
 * webOS requires a JS service's id to be prefixed by its app id, so these
 * strings are not independent - and the pair is repeated across six files in
 * three languages: `public/appinfo.json`, `service/services.json`,
 * `service/package.json`, `service/service.js`, and both luna adapters.
 *
 * A disagreement is invisible to every gate we have. tsc, jest and the build
 * all pass; the luna request simply never resolves, so the app launches, looks
 * completely normal, and no data ever arrives. It has already happened once:
 * the th0enix merge renamed five of the six and left `isAvailable()` pointing
 * at the old id, because that method exists only in our lineage and so was not
 * part of their rename.
 *
 * Two things follow. The adapters take the URI from here rather than spelling
 * it out at four call sites, and `AppIdentity.test.ts` reads the other files
 * and asserts they match - which is what turns the silent runtime failure into
 * a failing test.
 */
export const APP_ID = 'com.tvh.next';

/** Must stay prefixed by APP_ID; webOS will not route it otherwise. */
export const PROXY_SERVICE_ID = `${APP_ID}.proxy`;

export const PROXY_SERVICE_URI = `luna://${PROXY_SERVICE_ID}`;
