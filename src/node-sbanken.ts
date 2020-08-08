import log from './log';
import btoa from 'btoa';
import * as fetch from 'node-fetch';
import { URLSearchParams } from 'url';
import fs from 'fs';
import urls from './sbanken-urls.json';
// import { stringify } from 'querystring';
const fsp = fs.promises;
import { version, author, description } from '../package.json';

import {
  Credentials,
  Options,
  Urls,
  CacheInfo,
  CustomerItemResult,
  AccountListResult,
  TransactionsOptions,
  TransferOptions,
  AccessTokenInfo,
  TransactionList,
} from './node-sbanken.types';

export * from './node-sbanken.types';

/**
 * A SDK Wrapper for the sbanken APIs
 */
export class Sbanken {
  credentials: Credentials;
  opts: Options;
  clientCredentials: string;
  urls: Urls;
  version: string;
  description: string;
  author: string;
  cache: CacheInfo;

  /**
   * Create a new sbanken object. an object with credentials must be provided.
   * {
   *   clientId: 'the clientid of your sbanken app'
   *   secret: 'the current secret of your app'
   *   userId: 'Your userid'
   * }
   *
   * @param {*} credentials
   * @param {*} options
   */
  constructor(credentials: Credentials, options: Options = { verbose: false }) {
    if (!this.__testCredentials(credentials)) {
      throw new Error('Credentials must be provided.');
    }

    this.credentials = credentials;
    this.opts = options;

    this.credentials.clientId =
      typeof credentials.clientId === 'string' ? credentials.clientId : '';
    this.credentials.secret =
      typeof credentials.secret === 'string' ? credentials.secret : '';
    this.credentials.userId =
      typeof credentials.userId === 'string' ? credentials.userId : '';

    this.clientCredentials = btoa(
      encodeURIComponent(this.credentials.clientId) +
        ':' +
        encodeURIComponent(this.credentials.secret)
    );

    this.urls = urls;
    this.version = version;
    this.author = author;
    this.description = description;

    this.cache = {
      dir: `${__dirname}/.cache`,
      file: `${__dirname}/.cache/accesstoken.json`,
    };
  }

  options(opts = {}) {
    this.opts = Object.assign(this.opts, opts);
  }

  /**
   * Fetching customer data
   *
   * @param {string} version
   */
  async customers(version: string = 'v1'): Promise<CustomerItemResult> {
    const data = await this.getAccessToken();
    if (this.opts.verbose) {
      log.info('Fetching:', this.urls.customers[version]);
    }
    // const headers: Headers = new Headers();
    // headers.append('Authorization', `Bearer ${data.access_token}`);
    // headers.append('Accept', 'application/json');
    // headers.append('customerId', this.credentials.userId);

    const res = await fetch.default(this.urls.customers[version], {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
        Accept: 'application/json',
        customerId: this.credentials.userId,
      },
    });

    if (this.opts.verbose) {
      log.info(`Got response from server: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    if (!res.ok) {
      throw new Error(res.status + ' ' + res.statusText + JSON.stringify(json));
    }

    return json;
  }

  /**
   * Fetch the list of accounts for user from server
   *
   * @returns {Promise<AccountListResult>}
   */
  async accounts(): Promise<AccountListResult> {
    if (this.opts.verbose) {
      log.info('Fetching accounts:', this.urls.accounts.v1);
    }

    const res = await this.__doRequest(this.urls.accounts.v1);

    if (this.opts.verbose) {
      log.info('  Status code:', res.status, res.statusText);
    }

    return res.json();
  }

  /**
   * Transfer money between accounts
   *
   * @param {TransferOptions} options
   * @returns {Promise<fetch.Response>}
   */
  async transfer(options: TransferOptions): Promise<fetch.Response> {
    const token: AccessTokenInfo = await this.getAccessToken();

    const msg =
      options.message ||
      `From ${options.from.name} to ${options.to.name}`.slice(0, 30);

    const body = {
      fromAccountId: options.from.accountId,
      toAccountId: options.to.accountId,
      message: msg,
      amount: parseFloat(options.amount),
    };

    if (this.opts.verbose) log.info('Fetching:', this.urls.transfer.v1);
    if (this.opts.verbose) log.debug('body:', JSON.stringify(body));

    const res = await fetch.default(this.urls.transfer.v1, {
      method: 'post',
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: 'application/json',
        customerId: this.credentials.userId,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) return res;
    if (res.status === 400) return res;

    const json = await res.json();
    throw new Error(`${res.status} ${res.statusText} ${JSON.stringify(json)}`);
  }

  /**
   * Private function doing the actual web requests on behalf of url.
   *
   * @param {string} url The URI of the rest service
   * @param {object=} body An optional body to be submitted.
   * @returns {Promise<Response>}
   */
  async __doRequest(url: string, body?: object): Promise<fetch.Response> {
    const token: AccessTokenInfo = await this.getAccessToken();

    const res: fetch.Response = await fetch.default(url, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: 'application/json',
        customerId: this.credentials.userId,
      },
    });

    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);

    return res;
  }

  async payments(accountId: string) {
    const token: AccessTokenInfo = await this.getAccessToken();
    const url = `${this.urls.payments.v1}/${accountId}`;

    if (this.opts.verbose) {
      console.log('Fetching Payments:', { accountId, url });
    }

    const res = await fetch
      .default(url, {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          Accept: 'application/json',
          customerId: this.credentials.userId,
        },
      })
      .catch((e) => {
        console.log('got exception error:', e);
        process.exit();
      });

    if (res.ok) return res.json();
    console.log('Status:', res.status, 'msg:', res.statusText);
    throw new Error(`${res.status} ${res.statusText}`);
  }

  /**
   * Fetches all transactions for an account for the defined interval, or
   * the last 30 days.
   * @param {TransactionsOptions} options
   * @param {string} options.accountId
   * @param {string} options.from
   * @param {string} options.to
   * @param {integer} options.limit
   */
  async transactions(options: TransactionsOptions): Promise<TransactionList> {
    const token = await this.getAccessToken();
    const { accountId, from, to, limit } = options;

    if (this.opts.verbose) {
      log.debug('Fetching transactions. Options:', JSON.stringify(options));
    }
    let url = `${this.urls.transactions.v1}/${accountId}`;

    url += `?length=${limit || 1000}`;
    if (from instanceof Date) {
      url += `&startDate=${from.toISOString().slice(0, 10)}`;
    }
    if (to instanceof Date) {
      url += `&endDate=${to.toISOString().slice(0, 10)}`;
    }

    if (this.opts.verbose) {
      log.info('Fetching transactions:', url);
    }

    const res = await fetch.default(url, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: 'application/json',
        customerId: this.credentials.userId,
      },
    });

    const json = await res.json();

    if (res.ok) return json;

    console.debug(res.status, res.statusText);
    console.debug(json.errorType, ':', json.errorMessage);
    throw new Error(
      `${res.status} ${res.statusText} - ${json.errorType} ${json.errorMessage}`
    );
  }

  /**
   * Fetches a valid accessToken.
   * If an existing valid access token exists that is returned
   *
   * @returns {Promise<AccessTokenInfo>}
   */
  async getAccessToken(): Promise<AccessTokenInfo> {
    if (this.opts.verbose) {
      log.info('Fetching access token');
    }

    if (!fs.existsSync(this.cache.file)) {
      return this.refreshAccessToken();
    }

    return fsp
      .access(this.cache.file, fs.constants.R_OK)
      .then(() => {
        if (this.opts.verbose) {
          log.info('Found cached access token:');
          log.info('  ', this.cache.file);
        }
        return fsp.readFile(this.cache.file);
      })
      .then((data: Buffer) => JSON.parse(data.toString()))
      .then((data: AccessTokenInfo) => {
        if (this.__isAccessTokenFresh(data)) {
          return data;
        } else {
          if (this.opts.verbose) {
            log.info('Current access token stale.');
          }

          return this.refreshAccessToken();
        }
      })
      .catch((err) => {
        log.error(err.message);
        process.exit(1);
      });
  }

  /**
   * Get a new access token from the sbanken service
   */
  async refreshAccessToken(): Promise<AccessTokenInfo> {
    if (this.opts.verbose) {
      log.info('Fetching new access token.');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    try {
      const res: fetch.Response = await fetch.default(this.urls.auth, {
        method: 'post',
        body: params,
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${this.clientCredentials}`,
          customerId: this.credentials.userId,
        },
      });

      const json = await this.__handleAccessTokenResponse(res);
      return json;
    } catch (err) {
      log.error('Received error from Sbanken:', err.message);
    } finally {
      process.exit(1);
    }
  }

  async __handleAccessTokenResponse(res: fetch.Response) {
    if (this.opts.verbose) {
      log.info('Got response from server:', res.status, res.statusText);
    }

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    json.date = new Date().toJSON();

    try {
      if (this.opts.verbose) {
        log.info('Storing access token in cache.');
      }
      if (!fs.existsSync(`${__dirname}/.cache`)) {
        fs.mkdirSync(`${__dirname}/.cache`);
      }

      fs.writeFileSync(
        `${__dirname}/.cache/accesstoken.json`,
        JSON.stringify(json),
        {
          mode: 0o600,
        }
      );
    } catch (err) {
      throw err;
    }

    return json;
  }

  __isAccessTokenFresh(data: AccessTokenInfo): boolean {
    const then: Date = new Date(data.date);
    const now: Date = new Date();

    if (then.getTime() + (data.expires_in - 300) * 1000 > now.getTime()) {
      if (this.opts.verbose) {
        log.info('Token is still fresh.');
      }
      return true;
    }
    if (this.opts.verbose) {
      log.info('Token is stale.');
    }
    return false;
  }

  __testCredentials(c: Credentials): boolean {
    if (
      typeof c.clientId === 'string' &&
      typeof c.secret === 'string' &&
      typeof c.userId === 'string'
    ) {
      return true;
    }
    return false;
  }

  hello(): void {
    console.log('hello world');
  }
}
