import urls from './sbanken-urls.json';
import { AccessTokenInfo, Credentials } from './node-sbanken';

export interface AccessTokenData {
  debug?: { [key: string]: any };
  info: AccessTokenInfo;
}

let __ACCESS_TOKEN_DATA: AccessTokenData = {
  info: {
    expires_in: 0,
    access_token: '',
    token_type: 'Bearer',
    scope: '',
    date: new Date('1971-08-26').toJSON(),
  },
};

const tokenStore = {
  info: (info?: AccessTokenInfo): AccessTokenInfo => {
    if (typeof info !== 'undefined') __ACCESS_TOKEN_DATA.info = info;
    return __ACCESS_TOKEN_DATA.info;
  },

  debug: (debug?: { [key: string]: any }): { [key: string]: any } | undefined => {
    if (typeof debug !== 'undefined') {
      const newDebug = { ...__ACCESS_TOKEN_DATA.debug, ...debug };
      __ACCESS_TOKEN_DATA.debug = newDebug;
    }
    return __ACCESS_TOKEN_DATA.debug;
  },
  isFresh: (): boolean => {
    const info = tokenStore.info();
    const then = new Date(info.date as string);
    const now = new Date();

    return then.getTime() + (info.expires_in - 300) * 1000 > now.getTime();
  },
};

let DEBUG = false;

const access = {
  debug: (flag?: boolean) => {
    if (typeof flag === 'boolean') {
      DEBUG = flag;
    }
    DEBUG && console.log('Debug output is turned on.');
    return DEBUG;
  },

  get: async (creds: Credentials): Promise<AccessTokenInfo> => {
    // DEBUG && console.log('access-token DEBUG get', JSON.stringify(creds));
    const fresh = tokenStore.isFresh();
    DEBUG && console.log('access-token fresh:', fresh);

    if (fresh) return tokenStore.info();

    DEBUG && console.log('access-token not fresh. fetching...');

    const __btoa = typeof btoa === 'undefined' ? require('btoa') : btoa;
    const __fetch = typeof fetch === 'undefined' ? require('node-fetch') : fetch;

    const params = new URLSearchParams({ grant_type: 'client_credentials' });

    DEBUG && console.log('url params:', params.toString());

    const auth = __btoa(`${encodeURIComponent(creds.clientId)}:${encodeURIComponent(creds.secret)}`);
    const init = {
      method: 'post',
      body: params,
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
      },
    };

    DEBUG && console.log('access-token get init:', JSON.stringify(init));
    // DEBUG && console.log('  params:', init.body.toString());

    const res = await __fetch(urls.auth, init);
    DEBUG && console.log('access-token fetch:', res.status, res.statusText);

    const json = await res.json();

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText} - ${urls.auth} - ${JSON.stringify(json)}`);
    }

    json.date = new Date().toJSON();
    tokenStore.info(json);

    return tokenStore.info();
  },
};

export default access;
