const log = require('./log');
const btoa = require('btoa');
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const fs = require('fs');
const fsp = fs.promises;

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
      credentials.clientId + ':' + credentials.secret
    );

    this.urls = {
      auth: 'https://auth.sbanken.no/IdentityServer/connect/token',
      accounts: { v1: 'https://api.sbanken.no/bank/api/v1/accounts' },
      transactions: { v1: 'https://api.sbanken.no/bank/api/v1/transactions' },
      customers: {
        v1: 'https://api.sbanken.no/customers/api/v1/customers',
        v2: 'https://api.sbanken.no/customers/api/v2/customers',
      },
    };

    this.cache = {
      dir: `${__dirname}/.cache`,
      file: `${__dirname}/.cache/accesstoken.json`,
    };
  }

  options(opts = {}) {
    this.opts = Object.assign(this.opts, opts);
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
      .then(data => JSON.parse(data))
      .then(data => {
        if (this.__isAccessTokenFresh(data)) {
          return data;
        } else {
          if (this.opts.verbose) {
            log.info('Current access token stale.');
          }

          return this.refreshAccessToken();
        }
      })
      .catch(err => {
        log.error(err.message);
        process.exit(1);
      });
  }

  /**
   * Fetching customer data
   *
   * @param {string} version
   */
  customers(version = 'v1') {
    return this.getAccessToken().then(data => {
      if (this.opts.verbose) {
        log.info('Fetching:', this.urls.customers[version]);
      }

      return fetch(this.urls.customers[version], {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
          Accept: 'application/json',
          customerId: this.credentials.userId,
        },
      }).then(res => {
        if (this.opts.verbose) {
          log.info('Got response from server:', res.status, res.statusText);
        }

        if (res.ok) {
          return res.json();
        } else {
          throw new Error(res.status + ' ' + res.statusText);
        }
      });
    });
  }

  accounts() {
    return this.getAccessToken()
      .then(data => {
        if (this.opts.verbose) {
          log.info('Fetching accounts:', this.urls.accounts.v1);
        }
        return fetch(this.urls.accounts.v1, {
          headers: {
            Authorization: `Bearer ${data.access_token}`,
            Accept: 'application/json',
            customerId: this.credentials.userId,
          },
        });
      })
      .then(res => {
        if (res.ok) {
          if (this.opts.verbose) {
            log.info('  Status code:', res.status, res.statusText);
          }

          return res.json();
        } else {
          if (this.opts.verbose) {
            log.error('  Status code:', res.status, res.statusText);
          }

          throw new Error(res.status + ' ' + res.statusText);
        }
      })
      .catch(err => {
        log.error(err.message);
        process.exit(1);
      });
  }

  transactions(options) {
    return this.getAccessToken().then(data => {
      let url = `${this.urls.transactions.v1}/${options.accountId}`;

      const length = options.length || 1000;
      url += `?length=${length}`;
      if (options.from instanceof Date) {
        url += `&startDate=${options.from.toISOString().slice(0, 10)}`;
      }
      if (options.to instanceof Date) {
        url += `&endDate=${options.to.toISOString().slice(0, 10)}`;
      }

      if (this.opts.verbose) {
        log.info('Fetching transactions:', url);
      }

      return fetch(url, {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
          Accept: 'application/json',
          customerId: this.credentials.userId,
        },
      })
        .then(res => {
          if (res.ok) return res.json();

          console.debug(res.status, res.statusText);
          return res
            .json()
            .then(data => console.debug(data.errorType, ':', data.errorMessage))
            .then(() => process.exit(1));
        })
        .catch(error => {
          log.error('Got error:');
          log.error(error.message);
          process.exit(1);
        });
    });
  }

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
      .then(res => {
        if (this.opts.verbose) {
          log.info('Got response from server:', res.status, res.statusText);
        }

        if (res.ok) {
          return res.json();
        } else {
          throw new Error(`${res.status} ${res.statusText}`);
        }
      })
      .then(json => {
        if (this.opts.verbose) {
          log.info('Adding date to response');
        }
        json.date = new Date();
        return json;
      })
      .then(json => {
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
      .catch(err => {
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
