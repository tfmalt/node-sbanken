const log = require('./log');
const btoa = require('btoa');
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const fs = require('fs');
const fsp = fs.promises;
const urls = require('./sbanken-urls');
const { version, author, description } = require('../package');

class Sbanken {
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
  constructor(credentials = {}, options = { verbose: false }) {
    if (!this.__testCredentials(credentials)) {
      throw new Error('Credentials must be provided.');
    }

    this.credentials = credentials;
    this.opts = options;

    this.clientCredentials = btoa(
      encodeURIComponent(credentials.clientId) +
        ':' +
        encodeURIComponent(credentials.secret)
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
  async customers(version = 'v1') {
    const data = await this.getAccessToken();
    if (this.opts.verbose) {
      log.info('Fetching:', this.urls.customers[version]);
    }

    const res = await fetch(this.urls.customers[version], {
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
   * Fetch list of accounts from server
   */
  async accounts() {
    const token = await this.getAccessToken();
    if (this.opts.verbose) {
      log.info('Fetching accounts:', this.urls.accounts.v1);
    }

    const res = await fetch(this.urls.accounts.v1, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: 'application/json',
        customerId: this.credentials.userId,
      },
    });

    if (this.opts.verbose) {
      log.info('  Status code:', res.status, res.statusText);
    }

    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);

    return res.json();
  }

  /**
   * Transfer money between accounts
   *
   * @param {Object} options
   * @param {float} options.value
   * @param {Object} options.from
   * @param {Object} options.to
   * @param {Object} options.message
   */
  async transfer(options) {
    const token = await this.getAccessToken();

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

    const res = await fetch(this.urls.transfer.v1, {
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
   * Fetches all transactions for an account for the defined interval, or
   * the last 30 days.
   * @param {Object} options
   * @param {string} options.accountId
   * @param {string} options.from
   * @param {string} options.to
   * @param {integer} options.limit
   */
  async transactions(options) {
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

    const res = await fetch(url, {
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
   * @returns Promise
   */
  getAccessToken() {
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
      .then((data) => JSON.parse(data))
      .then((data) => {
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
  refreshAccessToken() {
    if (this.opts.verbose) {
      log.info('Fetching new access token.');
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    return fetch(this.urls.auth, {
      method: 'post',
      body: params,
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${this.clientCredentials}`,
        customerId: this.credentials.userId,
      },
    })
      .then((res) => {
        if (this.opts.verbose) {
          log.info('Got response from server:', res.status, res.statusText);
          log.debug('here');
        }

        if (res.ok) {
          return res.json();
        } else {
          return res.json().then((json) => {
            log.error(json);
            throw new Error(`${res.status} ${res.statusText}`);
          });
        }
      })
      .then((json) => {
        if (this.opts.verbose) {
          log.info('Adding date to response');
        }
        json.date = new Date();
        return json;
      })
      .then((json) => {
        if (this.opts.verbose) {
          log.info('Storing access token in cache.');
        }
        try {
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
      })
      .catch((err) => {
        log.error('Received error from Sbanken:', err.message);
        process.exit(1);
      });
  }

  __isAccessTokenFresh(data) {
    const then = new Date(data.date);
    const now = new Date();

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

  __testCredentials(c) {
    if (
      c.hasOwnProperty('clientId') &&
      c.hasOwnProperty('secret') &&
      c.hasOwnProperty('userId')
    ) {
      return true;
    }
    return false;
  }

  hello() {
    console.log('hello world');
  }
}

module.exports = Sbanken;
