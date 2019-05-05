# SBanken API Wrapper (SDK) and command line tool

## API Wrapper (SDK)

This is a simple object oriented wrapper for the Sbanken banking REST API's. It removes the hassle of implementing the rest calls directly. It provides a fairly straight forward promise based library. All functions will return a promise that can be processed further.

## Installing

If you use npm

```
npm install node-sbanken --save
```

If you use yarn

```
yarn add node-sbanken
```

If you want to use command line tool globally

```
npm install -g node-sbanken
```

## Using the library

```javascript
const Sbanken = require('./node-sbanken');

const credentials = {
  clientId: 'real clientid removed',
  secret: 'real secret removed',
  userId: 'real userid removed',
};

const sbanken = new Sbanken(credentials);

sbanken.accounts().then(data => {
  // Do something with the account data
  console.table(data.items);
});
```

## Command line tool

The module also contains a fairly complete command line client for doing simple banking operations. It can

- List your accounts and filter by name (case insensitive regex)
- List transactions for an account by name
- Transfer funds between your accounts

### Usage

Help text

```
$ sbanken
Usage: sbanken [options][command]

A module wrapping the Sbanken APIs, and a command line tool to do banking with sbanken.

Options:
  -V, --version output the version number
  -v, --verbose Tell the program to be verbose
  -h, --help output usage information

Commands:
  accounts List all accounts
  account|ac [name] List accounts with a given name
  customers|cu [options] Fetch the customers associated with the current userId.
  transactions|tr [options] <name> Fetch the transactions for the account with name.
  transfer [options] <amount> Transfer money between two accounts.
```

Listing account information

```
$ sbanken ac --help
Usage: account|ac [options] [name]

List accounts with a given name

Options:
  -h, --help  output usage information
```

Listing transactions

```
$ sbanken tr --help
Usage: transactions|tr [options] <name>

Print out transactions for the account matching the provided name.

Options:
  -f --from <yyyy-mm-dd>  From date
  -t --to <yyyy-mm-dd>    To date
  -h, --help              output usage information
```

## Security

If you want to try the tool be mindful of how you store and provide the application with the secrets. The package has two ways of providing the credentials:

- By adding the credentials to the configuration file `./etc/sbanken.json`
- This might be preferred if you want to use the command line tool on a computer with an account you trust fully.

```json
{
  "clientId": "Add clientid here",
  "secret": "Add secret here",
  "userId": "Add user id here"
}
```

- By adding them as environment variables (every time running the tool, or when starting an app using the library)
- This might be preferred if you want to use the library to build a web app or similar.

```bash
SBANKEN_CLIENTID="add clientid" SBANKEN_SECRET="add secret" SBANKEN_USERID="add userid" node ./app.js
```

Regardless. By making the credentials accessible you expose yourself to the risk of a third party getting hold of your banking details. Only use the library or tool if you understand the risk and how to deal with them properly.
