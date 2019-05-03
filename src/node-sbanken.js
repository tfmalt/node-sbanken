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
      accounts: 'https://api.sbanken.no/bank/api/v1/accounts',
      transactions: 'https://api.sbanken.no/bank/api/v1/transactions',
      customers: 'https://api.sbanken.no/customers/api/v1/customers',
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
    if (!fs.existsSync(this.cache.file)) {
      return this.refreshAccessToken();
    }

    return fsp
      .access(this.cache.file, fs.constants.R_OK)
      .then(() => {
        if (this.opts.verbose) {
          console.info('Found cached access token:', this.cache.file);
        }
        return fsp.readFile(this.cache.file);
      })
      .then(data => JSON.parse(data))
      .then(data => {
        if (this.__isAccessTokenFresh(data)) {
          return data;
        } else {
          if (this.opts.verbose) {
            console.info('Current access token stale. Need to fetch new one.');
          }

          return this.refreshAccessToken();
        }
      })
      .catch(err => {
        console.log(err.message);
      });
  }

  accounts() {
    return this.getAccessToken()
      .then(data =>
        fetch(this.urls.accounts, {
          headers: {
            Authorization: `Bearer ${data.access_token}`,
            Accept: 'application/json',
            customerId: this.credentials.userId,
          },
        })
      )
      .then(res => {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error(res.status + ' ' + res.statusText);
        }
      })
      .catch(err => {
        console.error('Error:', err.message);
      });
  }

  refreshAccessToken() {
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
        if (res.ok) {
          return res.json();
        } else {
          throw new Error(`${res.status} ${res.statusText}`);
        }
      })
      .then(json => {
        json.date = new Date();
        return json;
      })
      .then(json => {
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
        console.log('Got error');
        console.error(err);
      });
  }

  __isAccessTokenFresh(data) {
    const then = new Date(data.date);
    const now = new Date();

    if (this.opts.verbose) {
      console.info('Validating current access token:');
      console.info('  then', then);
      console.info('  now', now);
    }
    if (then.getTime() + (data.expires_in - 300) * 1000 > now.getTime()) {
      if (this.opts.verbose) {
        console.info('Token is still fresh.');
      }
      return true;
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
