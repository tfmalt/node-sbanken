// import * as nodeFetch from 'node-fetch';
import { version } from '../package.json';
import urls from './sbanken-urls.json';
import { AccessTokenInfo, Credentials } from './node-sbanken';

export interface AccessTokenData {
  debug?: { [key: string]: any };
  info: AccessTokenInfo;
}

let ACCESS_TOKEN_DATA: AccessTokenData = {
  info: {
    expires_in: 0,
    access_token: '',
    token_type: 'Bearer',
    scope: '',
  },
};

let DEBUG = false;

function isFresh(): boolean {
  const info = ACCESS_TOKEN_DATA.info;
  let infoDate = info.date;

  if (typeof info === 'undefined') return false;
  if (!info.access_token) return false;
  if (!infoDate) return false;
  if (infoDate !== 'string') {
    infoDate = new Date('1971-26-08').toJSON();
  }

  const then = new Date(infoDate as string);
  const now = new Date();

  if (then.getTime() + (info.expires_in - 300) * 1000 > now.getTime()) {
    if (DEBUG) ACCESS_TOKEN_DATA.debug = { fresh: true };
    return true;
  }
  if (DEBUG) ACCESS_TOKEN_DATA.debug = { fresh: false };

  return false;
}

const access = {
  debug: (flag?: boolean) => {
    if (typeof flag === 'boolean') {
      DEBUG = flag;
    }
    DEBUG && console.log('Debug output is turned on.');
    return DEBUG;
  },

  get: async (creds: Credentials): Promise<AccessTokenData> => {
    // DEBUG && console.log('access-token DEBUG get', JSON.stringify(creds));
    if (isFresh()) {
      DEBUG && console.log('access-token fresh:', true);
      return ACCESS_TOKEN_DATA;
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    // only load btoa if not defined (available in browsers and web workers)
    const __btoa = typeof btoa === 'undefined' ? require('btoa') : btoa;
    const __fetch = typeof fetch === 'undefined' ? require('node-fetch') : fetch;

    const auth = __btoa(encodeURIComponent(creds.clientId) + ':' + encodeURIComponent(creds.secret));
    const init = {
      method: 'post',
      body: params,
      headers: {
        Accept: 'application/json',
        Authorization: 'Basic ' + auth,
        'Content-Type': 'application/x-www-form-urlencoded',
        customerId: creds.userId,
      },
    };

    DEBUG && console.log('access-token get init:', JSON.stringify(init));
    DEBUG && console.log('  params:', init.body.toString());
    DEBUG && console.log('  URL:', urls.auth);
    DEBUG && console.log('  typeof fetch:', typeof __fetch);

    try {
      const res = await __fetch(urls.auth, init);
      DEBUG && console.log('access-token fetch:', res.status, res.statusText);
      // if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      json.date = new Date().toJSON();

      ACCESS_TOKEN_DATA.info = json;

      if (DEBUG) {
        if (typeof ACCESS_TOKEN_DATA.debug === 'undefined') ACCESS_TOKEN_DATA.debug = {};
        ACCESS_TOKEN_DATA.debug.version = version;
      }

      DEBUG && console.log('access-token get data: ', ACCESS_TOKEN_DATA);
      return ACCESS_TOKEN_DATA;
    } catch (e) {
      console.log('Got error in access token fetch.', e);
    }

    return ACCESS_TOKEN_DATA;
  },
};

export default access;
