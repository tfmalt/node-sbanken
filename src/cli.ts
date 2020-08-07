#!/usr/bin/env node
import credentials from '../etc/sbanken.json';
import * as sbanken from './node-sbanken';
import * as fetch from 'node-fetch';
import log from './log';
import program from 'commander';
import chalk from 'chalk';

interface HandleTransferOptions {
  from: string;
  to: string;
  message?: string;
}

interface HandleTransactionsOptions {
  from: string;
  to: string;
  limit: number;
}

setupCredentials();
const sb = new sbanken.Sbanken(credentials);

program.version(sb.version).description(sb.description);
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
  .command('payments <name>')
  .alias('pa')
  .description('Print payments waiting to be processed.')
  .usage('<name>')
  .action(handlePayments);

program
  .command('transfer <amount>')
  .description('Transfer money between two accounts.')
  .option('-f --from <name|account>')
  .option('-t --to <name|account>')
  .option('-m --message <message>')
  .action(handleTransfer);

program.on('option:verbose', function () {
  // @ts-ignore
  process.env.VERBOSE = this.verbose;
  // @ts-ignore
  sb.options({ verbose: this.verbose });
});

program.on('command:*', function () {
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
  const json: sbanken.AccountList = await sb.accounts();
  console.table(json.items);
}

async function handleAccount(name: string) {
  if (program.verbose) {
    log.info('Told to list account by name: ' + name);
  }
  const regex = new RegExp(name, 'ui');
  const json = await sb.accounts();

  json.items
    .filter((item) => item.name.match(regex))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((item) => printAccountInfoRow(item));
}

/**
 * Transfer money between accounts.
 * The message is automatically truncated to 30 characters.
 *
 * @param {Number} amount
 * @param {Object} options
 */
async function handleTransfer(amount: string, options: HandleTransferOptions) {
  if (program.verbose) {
    log.info('Running command transfer', options.from, options.to, amount);
  }

  const accounts: sbanken.AccountList = await sb.accounts();
  const from: sbanken.AccountInfo = findAccountOrExit(accounts, options.from);
  const to: sbanken.AccountInfo = findAccountOrExit(accounts, options.to);
  const message = options.message ? options.message.slice(0, 30) : undefined;

  console.log(
    chalk`Transferring {white.bold ${parseFloat(amount).toFixed(2)} kr}`
  );
  console.log(
    chalk`From: {red.bold ${from.name}} ({yellow ${from.accountNumber}}), To: {green.bold ${to.name}} ({yellow ${to.accountNumber}})`
  );
  console.log(chalk`Message: {magenta.bold ${message}}.`);

  const res = await sb.transfer({ from, to, amount, message });

  if (!res.ok) return handleRequestError(res);

  console.log(
    chalk`{blue ${res.status}} {white.bold ${res.statusText}} - Transfer successful`
  );

  const updatedAccounts = await sb.accounts();
  updatedAccounts.items
    .filter((i) => {
      if (i.accountId === from.accountId || i.accountId === to.accountId) {
        return true;
      }
    })
    .forEach((i) => printAccountInfoRow(i));
}

async function handlePayments(aName: string) {
  if (program.verbose) {
    log.info('Running command payments');
  }

  const json: sbanken.AccountList = await sb.accounts();
  const account: sbanken.AccountInfo = findAccountOrExit(json, aName);

  if (program.verbose) {
    console.log('account:', account);
  }

  const payments: sbanken.PaymentList = await sb.payments(account.accountId);

  console.log(
    chalk`name: {yellow ${account.name}}  account number: {yellow ${
      account.accountNumber
    }}  balance: {white.bold ${account.available.toFixed(2)}}`
  );
  console.log();
  payments.items
    .sort((a: sbanken.PaymentInfo, b: sbanken.PaymentInfo) =>
      new Date(a.dueDate) > new Date(b.dueDate) ? 1 : -1
    )
    .forEach((item) => {
      console.log(
        item.dueDate.slice(0, 10).padEnd(11),
        chalk`{red.bold ${item.amount.toFixed(2).padStart(11)}}`,
        chalk`{cyan ${item.productType.padStart(11).padEnd(12)}}`,
        chalk`${item.beneficiaryName.padEnd(52)}`
      );
    });
  // console.log(payments);
  console.log();
}

/**
 * List Transatcions for an account
 * @param {string} aName
 * @param {Object} options
 *
 */
async function handleTransactions(
  aName: string,
  options: HandleTransactionsOptions
) {
  if (program.verbose) {
    log.info(chalk`Running command transactions for name {yellow ${aName}}`);
  }

  const json = await sb.accounts();
  const account = findAccountOrExit(json, aName);

  const from =
    typeof options.from === 'undefined' ? undefined : new Date(options.from);

  const to =
    typeof options.to === 'undefined' ? undefined : new Date(options.to);

  if (program.verbose) {
    log.info('Fetching transactions for account:', account.name);
  }

  const { accountId, name, accountNumber, balance } = account;
  const transactions: sbanken.TransactionList = await sb.transactions({
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

  transactions.items.forEach((item: sbanken.Transaction) => {
    let line = item.accountingDate.substr(0, 10) + ' ';
    let amount: number | string = parseFloat(item.amount);

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

  const json = await sb.customers(api);
  const pad = 8;
  console.log(
    'name:'.padEnd(pad),
    chalk.white.bold(`${json.item.firstName} ${json.item.lastName}`)
  );

  console.log('email:'.padEnd(pad), chalk.white.bold(json.item.emailAddress));

  let phones: string = '';
  json.item.phoneNumbers.forEach((n) => {
    phones += `+${n.countryCode} ${n.number}, `;
  });

  console.log('phones:'.padEnd(pad), chalk.white.bold(phones));
  console.log(
    'address:'.padEnd(pad),
    chalk.white.bold(
      `${json.item.postalAddress.addressLine1}, ${json.item.postalAddress.addressLine2}, ${json.item.postalAddress.addressLine3}, ${json.item.postalAddress.addressLine4}`
    )
  );
}

async function handleRequestError(res: fetch.Response) {
  const json = await res.json();
  console.log(
    chalk`{red ${res.status}} {white.bold ${res.statusText}} - ${json.errorMessage}`
  );

  process.exit(1);
}

/**
 * Takes an AccountList and returns an AccountInfo if there is a single
 * regex match on the account name.
 *
 * @param accounts
 * @param name
 * @returns {sbanken.AccountInfo}
 */
function findAccountOrExit(accounts: sbanken.AccountList, name: string) {
  const list = accounts.items.filter((i) =>
    i.name.match(new RegExp(name, 'ui'))
  );

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

function printAccountInfoRow(account: sbanken.AccountInfo) {
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
