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
   */
  constructor(credentials = {}) {
    if (!this.__testCredentials(credentials)) {
      throw new Error('Credentials must be provided.');
    }
    this.credentials = credentials;

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

  /**
   * @returns Promise
   */
  getAccessToken() {
    return fsp
      .access(this.cache.file, fs.constants.R_OK)
      .then(() => {
        console.log('Found ', this.cache.file);
        return fsp.readFile(this.cache.file);
      })
      .then(data => JSON.parse(data))
      .then(data => {
        const now = new Date();
        const then = new Date(data.date);
        console.log('now', now);
        console.log('then', then);

        const diff =
          now.getTime() - (then.getTime() + (data.expires_in - 300) * 1000);

        console.log('diff', diff);
        if (diff > 0) {
          throw new Error('Current access token stale. Need to fetch new one.');
        }

        return data;
      })
      .catch(err => {
        console.log(err.message);

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
      });
  }

  accounts() {
    return this.getAccessToken()
      .then(data =>
        fetch(this.urls.accounts, {
          headers: {
            Authorization: `Bearer ${data.xaccess_token}`,
            Accept: 'application/json',
            customerId: this.credentials.userId,
          },
        })
      )
      .then(res => {
        if (res.ok) {
          console.log('result:', res.status, res.statusText);
          return res.json();
        } else {
          res.text().then(msg => {
            throw new Error(res.status + ' ' + res.statusText + '. ' + msg);
          });
        }
      })
      .then(json => {
        console.log(json);
      })
      .catch(err => {
        console.error('Error:', err.message);
      });
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
