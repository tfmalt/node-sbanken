# SBanken API Wrapper (SDK) and a command line tool

[![npm version](https://badge.fury.io/js/node-sbanken.svg)](http://badge.fury.io/js/node-sbanken)

## API Wrapper (SDK)

This is intended as a simple object oriented wrapper for the Sbanken banking REST API's. It removes the hassle of implementing the rest calls directly. It provides a fairly straight forward promise and async/await based library. All functions will return a promise that can be processed further.

The module supports typescript and has all types from the SBanken API included.

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

To use the library you first of all need to sign up for beta bank features at Sbanken: [Utviklerportalen](https://sbanken.no/bruke/utviklerportalen/)

### Javascript

```javascript
const Sbanken = require('./node-sbanken');

const credentials = {
  clientId: 'real clientid removed',
  secret: 'real secret removed',
  customerId: 'real customerId removed',
};

const sbanken = new Sbanken(credentials);

// Promise syntax
sbanken.accounts().then((data) => {
  // Do something with the account data
  console.table(data.items);
});

// async/await syntax
(async () => {
  const data = await sbanken.accounts();
  console.table(data.items);
})();
```

### Typescript

```typescript
import * as sb from './node-sbanken';

const credentials: sb.Credentials = {
  clientId: 'real clientid removed',
  secret: 'real secret removed',
  customerId: 'real customerid removed',
};

const client = new sb.Sbanken(credentials);

async function getAccounts(sbanken: sb.Sbanken): sb.AccountListResult {
  return await sbanken.accounts():
}

const data: sb.AccountListResult = getAccounts(client);
console.table(data.items);
```

## Command line tool

The module also contains a fairly complete command line client for doing simple banking operations. It can

- List your accounts and filter by name (case insensitive regex)
- List transactions for an account by name
- Transfer funds between your accounts

<img src="./doc/sbanken.png" alt="Screenshot of sbanken cli" width="640">

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

The command line tool expects you to provide the credentials through the following environment variables:

- SBANKEN_SECRET
- SBANKEN_CLIENTID
- SBANKEN_CUSTOMERID

```bash
SBANKEN_CLIENTID="add clientid" SBANKEN_SECRET="add secret" SBANKEN_CUSTOMERID="add userid" npx sbanken
```

To use the SDK you need to provide the credentials to the constructor.

By making the credentials accessible through code or in your terminal you expose yourself to the risk of a third party getting hold of your banking details. Only use the library or tool if you understand the risk and how to deal with them properly.
