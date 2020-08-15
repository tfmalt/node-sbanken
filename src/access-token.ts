import * as fetch from 'node-fetch';
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
  DEBUG && console.log('access-token.isFresh: ', JSON.stringify(info));
  if (typeof info === 'undefined') return false;
  if (!(info as AccessTokenInfo).access_token) return false;
  if (!(info as AccessTokenInfo).date) return false;
  if (info.date !== 'string') info.date = new Date('1971-26-08').toJSON();

  const then = new Date(info.date);
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
    DEBUG && console.log('access-token get');
    if (isFresh()) {
      DEBUG && console.log('access-token fresh:', true);
      return ACCESS_TOKEN_DATA;
    }

    const params = new URLSearchParams([['grant_type', 'client_credentials']]);

    // only load btoa if not defined (available in browsers and web workers)
    const __btoa = typeof btoa === 'undefined' ? require('btoa') : btoa;
    const auth = __btoa(encodeURIComponent(creds.clientId) + ':' + encodeURIComponent(creds.secret));

    const init: fetch.RequestInit = {
      method: 'post',
      body: params,
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
        customerId: creds.userId,
      },
    };

    DEBUG && console.log('access-token get init:', JSON.stringify(init));

    return fetch
      .default(urls.auth, init)
      .then((res: fetch.Response) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((json) => {
        json.date = new Date().toJSON();

        ACCESS_TOKEN_DATA.info = json;

        if (DEBUG) {
          if (typeof ACCESS_TOKEN_DATA.debug === 'undefined') ACCESS_TOKEN_DATA.debug = {};
          ACCESS_TOKEN_DATA.debug.version = version;
        }

        DEBUG && console.log('access-token get data: ', ACCESS_TOKEN_DATA);
        return ACCESS_TOKEN_DATA;
      })
      .catch((err) => {
        throw err;
      });
  },
};

export default access;
