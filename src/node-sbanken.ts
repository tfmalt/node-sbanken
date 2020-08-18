import log from './log';
import __fetch from './myFetch';
import urls from './sbanken-urls.json';
import accessToken, { AccessTokenData } from './access-token';
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
  TransferCreateRequest,
} from './node-sbanken.types';

export * from './node-sbanken.types';

/**
 * A SDK Wrapper for the sbanken APIs
 */
export class Sbanken {
  credentials: Credentials;
  opts: Options;
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
   *   customerId: 'Your customer id - norwegian personnummer'
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

    accessToken.debug(options.verbose);
    // log.debug('Credentials');
    // console.log(this.credentials);

    this.credentials.clientId = typeof credentials.clientId === 'string' ? credentials.clientId : '';
    this.credentials.secret = typeof credentials.secret === 'string' ? credentials.secret : '';
    this.credentials.customerId = typeof credentials.customerId === 'string' ? credentials.customerId : '';

    this.urls = urls;
    this.version = version;
    this.author = author;
    this.description = description;

    this.cache = {
      dir: `${__dirname}/.cache`,
      file: `${__dirname}/.cache/accesstoken.json`,
    };
  }

  private options(opts = {}) {
    // console.log('Sbanken.options called:', opts);
    this.opts = Object.assign(this.opts, opts);
    accessToken.debug(this.opts.verbose);
  }

  /**
   * Fetching customer data
   *
   * @param {string} version
   */
  async customers(version: string = 'v1'): Promise<CustomerItemResult> {
    if (this.opts.verbose) {
      log.info('Fetching:', this.urls.customers[version]);
    }
    const res = await this.__doRequest(this.urls.customers[version]);

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
  async transfer(options: TransferOptions): Promise<Response> {
    const msg = options.message || `From ${options.from.name} to ${options.to.name}`.slice(0, 30);
    const body: TransferCreateRequest = {
      fromAccountId: options.from.accountId,
      toAccountId: options.to.accountId,
      message: msg,
      amount: parseFloat(options.amount),
    };

    if (this.opts.verbose) log.info('Fetching:', this.urls.transfer.v1);
    if (this.opts.verbose) log.debug('body:', JSON.stringify(body));

    const res = await this.__doRequest(this.urls.transfer.v1, body);

    if (res.ok) return res;
    if (res.status === 400) return res;

    const json = await res.json();
    throw new Error(`${res.status} ${res.statusText} ${JSON.stringify(json)}`);
  }

  /**
   * List payments for account
   *
   * @param accountId
   */
  async payments(accountId: string) {
    const url = `${this.urls.payments.v1}/${accountId}`;

    if (this.opts.verbose) {
      console.log('Fetching Payments:', { accountId, url });
    }

    const res = await this.__doRequest(url);
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
    const V = this.opts.verbose;
    const { accountId, from, to, limit } = options;

    V && log.debug('Fetching transactions. Options:', JSON.stringify(options));

    const url = new URL(`${this.urls.transactions.v1}/${accountId}`);
    V && log.debug('  url:', url.href);
    url.searchParams.append('length', String(limit || 1000));

    if (from instanceof Date) {
      url.searchParams.append('startDate', from.toISOString().slice(0, 10));
    }

    if (to instanceof Date) {
      url.searchParams.append('endDate', to.toISOString().slice(0, 10));
    }

    if (this.opts.verbose) {
      log.info('Fetching transactions:', url.href);
    }

    const res = await this.__doRequest(url.href);
    return res.json();
  }

  /**
   * Private function doing the actual web requests on behalf of url.
   *
   * @param {string} url The URI of the rest service
   * @param {object=} body An optional body to be submitted.
   * @returns {Promise<Response>}
   */
  async __doRequest(url: string, body?: TransferCreateRequest): Promise<Response> {
    const method = typeof body === 'undefined' ? 'GET' : 'POST';
    const data = typeof body === 'undefined' ? undefined : JSON.stringify(body);

    const token: AccessTokenInfo = await accessToken.get(this.credentials);

    if (this.opts.verbose) {
      log.info('Doing request:', method);
    }

    const res: Response = await __fetch(url, {
      method: method,
      body: data,
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: 'application/json',
        customerId: this.credentials.customerId,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) return res;

    const json = await res.json();
    throw new Error(`${res.status} ${res.statusText} - url - ${json}`);
  }

  __testCredentials(c: Credentials): boolean {
    if (typeof c.clientId === 'string' && typeof c.secret === 'string' && typeof c.customerId === 'string') {
      return true;
    }
    return false;
  }

  hello(): void {
    console.log('hello world');
  }
}
