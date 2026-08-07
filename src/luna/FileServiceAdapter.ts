import '@procot/webostv/webOSTV';
import { PROXY_SERVICE_URI } from './AppIdentity';

export default class FileServiceAdapter implements FileServiceInterface {
    writeEpgCache(data: unknown): Promise<WebOSTV.OnCompleteSuccessResponse> {
        return new Promise<WebOSTV.OnCompleteSuccessResponse>((resolve, reject) => {
            console.log('lsa: write epg cache');
            global.webOS.service.request(PROXY_SERVICE_URI, {
                method: 'fileIO',
                parameters: { filename: 'epgcache.json', write: true, data: data },
                onSuccess: (res: WebOSTV.OnCompleteSuccessResponse) => resolve(res),
                onFailure: (res: ProxyErrorResponse) => reject(res),
                onComplete: () => {
                    console.log('lsa: write epg cache end');
                }
            });
        });
    }

    readEpgCache<T>(): Promise<EpgSuccessResponse<T>> {
        return new Promise<EpgSuccessResponse<T>>((resolve, reject) => {
            console.log('lsa: read epg cache');
            global.webOS.service.request(PROXY_SERVICE_URI, {
                method: 'fileIO',
                parameters: { filename: 'epgcache.json', read: true },
                onSuccess: (res: EpgSuccessResponse<T>) => resolve(res),
                onFailure: (res: ProxyErrorResponse) => reject(res),
                onComplete: () => {
                    console.log('lsa: read epg cache end');
                }
            });
        });
    }
}
