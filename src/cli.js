#!/usr/bin/env node
// const package = require('../package');
const credentials = require('../etc/sbanken');
const Sbanken = require('./node-sbanken');
const log = require('./log');
const program = require('commander');
const chalk = require('chalk');
// const { name, description, version } = package;

setupCredentials();
const sbanken = new Sbanken(credentials);

program.version(sbanken.version).description(sbanken.description);
program.option('-v, --verbose', 'Tell the program to be verbose');

program
  .command('accounts')
  .description('List all accounts')
  .action(handleAccounts);

program
  .command('account [name]')
  .alias('ac')
  .description('List accounts matching the provided name.')
  .action(handleAccount);

program
  .command('customers')
  .alias('cu')
  .option('-a --api_version [version]', 'Version of API to use, v1 or v2')
  .description(
    'Print out information about the customer associated with the current userId.'
  )
  .action(handleCustomers);

program
  .command('transactions <name>')
  .alias('tr')
  .description(
    'Print out transactions for the account matching the provided name.'
  )
  .usage('[options] <name>')
  .option('-f --from <yyyy-mm-dd>', 'From date')
  .option('-t --to <yyyy-mm-dd>', 'To date')
  .option('-l --limit <number>', 'Number of transactions to fetch.')
  .action(handleTransactions);

program
  .command('transfer <amount>')
  .description('Transfer money between two accounts.')
  .option('-f --from <name|account>')
  .option('-t --to <name|account>')
  .action(handleTransfer);

program.on('option:verbose', function() {
  process.env.VERBOSE = this.verbose;
  sbanken.options({ verbose: this.verbose });
});

program.on('command:*', function() {
  console.error(
    'Invalid command: %s\nSee --help for a list of available commands.',
    program.args.join(' ')
  );
  process.exit(1);
});
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.help();
}

// ===========================================================================
//   Functions
// ===========================================================================

/**
 * Fetches all accounts and prints them with the standard console.table output.
 */
async function handleAccounts() {
  if (program.verbose) {
    log.info('Command: List all accounts.');
  }
  const json = await sbanken.accounts();
  console.table(json.items);
}

async function handleAccount(name) {
  if (program.verbose) {
    log.info('Told to list account by name: ' + name);
  }
  const regex = new RegExp(name, 'ui');
  const json = await sbanken.accounts();

  json.items
    .filter(item => item.name.match(regex))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(item => printAccountInfoRow(item));
}
async function handleTransfer(amount, options) {
  if (program.verbose) {
    log.info('Running command transfer', options.from, options.to, amount);
  }

  const accounts = await sbanken.accounts();
  const from = findAccountOrExit(accounts, options.from);
  const to = findAccountOrExit(accounts, options.to);

  console.log(
    'Transferring',
    chalk.white.bold(`${parseFloat(amount).toFixed(2)} kr`),
    chalk`from {red.bold ${from.name}} ({yellow ${from.accountNumber}})`,
    chalk`to {green.bold ${to.name}} ({yellow ${to.accountNumber}})`
  );

  const res = await sbanken.transfer({ from, to, amount });

  if (!res.ok) return handleRequestError(res);

  console.log(
    chalk`{blue ${res.status}} {white.bold ${
      res.statusText
    }} - Transfer successful`
  );

  const updatedAccounts = await sbanken.accounts();
  updatedAccounts.items
    .filter(i => {
      if (i.accountId === from.accountId || i.accountId === to.accountId) {
        return true;
      }
    })
    .forEach(i => printAccountInfoRow(i));
}

async function handleTransactions(aName, options) {
  if (program.verbose) {
    log.info(chalk`Running command transactions for name {yellow ${aName}}`);
  }

  const json = await sbanken.accounts();
  const account = findAccountOrExit(json, aName);

  const from =
    typeof options.from === 'undefined' ? undefined : new Date(options.from);

  const to =
    typeof options.to === 'undefined' ? undefined : new Date(options.to);

  if (program.verbose) {
    log.info('Fetching transactions for account:', account.name);
  }

  const { accountId, name, accountNumber, balance } = account;
  const transactions = await sbanken.transactions({
    accountId,
    from,
    to,
    limit: options.limit,
  });

  if (program.verbose) {
    log.info('Available items:', transactions.availableItems);
  }

  console.log(
    chalk`name: {white.bold ${name}}  account number: {white.bold ${accountNumber}}  balance: {white.bold ${balance}}`
  );

  console.log(
    'Date'.padEnd(11),
    'Amount'.padStart(11),
    ' Type'.padEnd(21),
    'Description'.padEnd(40)
  );

  console.log(
    '---------- ',
    '----------- ',
    '------------------- ',
    '---------------------------------------------------'
  );

  transactions.items.forEach(item => {
    let line = item.accountingDate.substr(0, 10) + ' ';
    let amount = parseFloat(item.amount);

    amount =
      amount < 0
        ? chalk.bold.red(amount.toFixed(2).padStart(12))
        : chalk.bold.green(amount.toFixed(2).padStart(12));

    line += amount + ' ';
    line += chalk.bold.yellow(item.transactionTypeCode.toString().padStart(4));
    line += ' ' + item.transactionType.padEnd(15) + '  ';
    line += item.text;

    console.log(line);
  });
}

async function handleCustomers() {
  let api = program.api_version || 'v1';
  if (program.verbose) {
    log.info(
      chalk`{yellow \uf45f} Fetching customer information. version: {white.bold ${api}}.`
    );
  }

  const json = await sbanken.customers(api);
  const pad = 8;
  console.log(
    'name:'.padEnd(pad),
    chalk.white.bold(`${json.item.firstName} ${json.item.lastName}`)
  );

  console.log('email:'.padEnd(pad), chalk.white.bold(json.item.emailAddress));

  let phones = '';
  json.item.phoneNumbers.forEach(n => {
    phones += `+${n.countryCode} ${n.number}, `;
  });

  console.log('phones:'.padEnd(pad), chalk.white.bold(phones));
  console.log(
    'address:'.padEnd(pad),
    chalk.white.bold(
      `${json.item.postalAddress.addressLine1}, ${
        json.item.postalAddress.addressLine2
      }, ${json.item.postalAddress.addressLine3}, ${
        json.item.postalAddress.addressLine4
      }`
    )
  );
}

async function handleRequestError(res) {
  const json = await res.json();
  console.log(
    chalk`{red ${res.status}} {white.bold ${res.statusText}} - ${
      json.errorMessage
    }`
  );

  process.exit(1);
}

function findAccountOrExit(accounts, name) {
  const list = accounts.items.filter(i => i.name.match(new RegExp(name, 'ui')));

  if (list.length === 0) {
    console.error(
      chalk`{red error} - Could not find an account with {red ${name}} in name.`
    );
    process.exit(1);
  }
  if (list.length > 1) {
    console.error(
      chalk`{red error} - Found multiple accounts with {red ${name}} in name.`
    );
    process.exit(1);
  }

  return list[0];
}

function printAccountInfoRow(account) {
  console.log(
    account.name.padEnd(32),
    chalk.white.bold(`${account.available.toFixed(2)} kr`.padStart(15)),
    chalk.yellow(`${account.balance.toFixed(2)} kr`.padStart(15))
  );
}

/**
 * Reads in credentials from the environments and sets up the credentials object
 * Verify that credentials exist and prints an error if they do not.
 */
function setupCredentials() {
  if (process.env.SBANKEN_SECRET) {
    credentials.secret = process.env.SBANKEN_SECRET;
  }

  if (process.env.SBANKEN_CLIENTID) {
    credentials.clientId = process.env.SBANKEN_CLIENTID;
  }

  if (process.env.SBANKEN_USERID) {
    credentials.userId = process.env.SBANKEN_USERID;
  }

  if (
    typeof credentials.secret === 'string' &&
    typeof credentials.clientId === 'string' &&
    (typeof credentials.userId === 'string' ||
      typeof credentials.userId === 'number')
  ) {
    return true;
  } else {
    console.log(
      chalk`{red error} {white You need to provide correct credentials for the app to work.}`
    );
    process.exit(1);
  }
}
