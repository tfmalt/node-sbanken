#!/usr/bin/env node
import * as sbanken from './node-sbanken';
import log from './log';
import program from 'commander';
import chalk from 'chalk';
import { version, author, description } from '../package.json';

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

const credentials: sbanken.Credentials = getCredentials();
const sb = new sbanken.Sbanken(credentials);

program.version(version).description(description);

if (!process.argv.slice(2).length) {
  program.help();
}

program.option('-v, --verbose', 'Tell the program to be verbose');
program.command('accounts').description('List all accounts').action(handleAccounts);

program
  .command('account [name]')
  .alias('ac')
  .description('List accounts matching the provided name.')
  .action(handleAccount);

program
  .command('customers')
  .alias('cu')
  .option('-a --api_version [version]', 'Version of API to use, v1 or v2')
  .description('Print out information about the customer associated with the current userId.')
  .action(handleCustomers);

program
  .command('transactions <name>')
  .alias('tr')
  .description('Print out transactions for the account matching the provided name.')
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

program.on('command:*', function () {
  console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
  process.exit(1);
});
program.parse(process.argv);



const options: program.OptionValues = program.opts();

if (options.verbose) {
   process.env.VERBOSE = options.verbose;
   console.log("Setting verbose:", options.verbose);
   sb.options({ verbose: options.verbose });
}

// ===========================================================================
//   Functions
// ===========================================================================

/**
 * Fetches all accounts and prints them with the standard console.table output.
 */
async function handleAccounts() {
  if (options.verbose) {
    log.info('Command: List all accounts.');
  }
  const json = await sb.accounts().catch(handleException);
  console.table(json.items);
}

async function handleAccount(name?: string) {
  if (program.opts().verbose) {
    if (typeof name === 'undefined') {
      log.info('Told to list all accounts');
    } else {
      log.info('Told to list account by name: ' + name);
    }
  }

  const str: string = typeof name === 'undefined' ? '' : name;
  const regex: RegExp = new RegExp(str, 'ui');
  const json = await sb.accounts().catch(handleException);

  const list: sbanken.Account[] = json.items
    .filter((item: sbanken.Account) => item.name.match(regex))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (list.length > 0) {
    list.forEach((item) => printAccountInfoRow(item));
  } else {
    console.log(chalk`Could not find an account with {red ${name}} in name.`);
  }
}

/**
 * Transfer money between accounts.
 * The message is automatically truncated to 30 characters.
 *
 * @param {Number} amount
 * @param {Object} options
 */
async function handleTransfer(amount: string, options: HandleTransferOptions) {
  if (program.opts().verbose) {
    log.info('Running command transfer', options.from, options.to, amount);
  }

  const accounts = await sb.accounts().catch(handleException);
  const from: sbanken.Account = findAccountOrExit(accounts, options.from);
  const to: sbanken.Account = findAccountOrExit(accounts, options.to);
  const message = options.message ? options.message.slice(0, 30) : undefined;

  console.log(chalk`Transferring {white.bold ${parseFloat(amount).toFixed(2)} kr}`);
  console.log(
    chalk`From: {red.bold ${from.name}} ({yellow ${from.accountNumber}}), To: {green.bold ${to.name}} ({yellow ${to.accountNumber}})`
  );
  console.log(chalk`Message: {magenta.bold ${message}}.`);

  const res = await sb.transfer({ from, to, amount, message }).catch(handleException);
  if (!res.ok) return handleRequestError(res);

  console.log(chalk`{blue ${res.status}} {white.bold ${res.statusText}} - Transfer successful`);

  const updatedAccounts = await sb.accounts().catch(handleException);
  updatedAccounts.items
    .filter((i: sbanken.Account) => {
      if (i.accountId === from.accountId || i.accountId === to.accountId) {
        return true;
      }
    })
    .forEach((i) => printAccountInfoRow(i));
}

/**
 * Fetches payments registered for an account.
 *
 * @param aName partial name of the account to fetch payments for
 */
async function handlePayments(aName: string) {
  if (program.opts().verbose) {
    log.info('Running command payments');
  }

  const json = await sb.accounts().catch(handleException);
  const account: sbanken.Account = findAccountOrExit(json, aName);

  if (program.opts().verbose) {
    console.log('account:', account);
  }

  const payments: sbanken.PaymentListResult = await sb.payments(account.accountId).catch(handleException);

  options.verbose && console.log(payments);

  console.log(
    chalk`name: {yellow ${account.name}}  account number: {yellow ${
      account.accountNumber
    }}  balance: {white.bold ${account.available.toFixed(2)}}`
  );
  console.log();
  payments.items
    .sort((a: sbanken.Payment, b: sbanken.Payment) => (new Date(a.dueDate) > new Date(b.dueDate) ? 1 : -1))
    .forEach((item) => {
      const bName = item.beneficiaryName || '';
      console.log(
        item.dueDate.slice(0, 10).padEnd(11),
        chalk`{red.bold ${item.amount.toFixed(2).padStart(11)}}`,
        chalk`{cyan ${item.productType.padStart(11).padEnd(12)}}`,
        chalk`${bName.padEnd(52)}`
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
async function handleTransactions(aName: string, trOptions: HandleTransactionsOptions) {
  if (program.opts().verbose) {
    log.info(chalk`Running command transactions for name {yellow ${aName}}`);
  }

  const json = await sb.accounts().catch(handleException);
  const account = findAccountOrExit(json, aName);

  const from = typeof trOptions.from === 'undefined' ? undefined : new Date(trOptions.from);

  const to = typeof trOptions.to === 'undefined' ? undefined : new Date(trOptions.to);

  if (program.opts().verbose) {
    log.info('Fetching transactions for account:', account.name);
  }

  const { accountId, name, accountNumber, balance } = account;
  const transactions: sbanken.TransactionList = await sb
    .transactions({
      accountId,
      from,
      to,
      limit: trOptions.limit,
    })
    .catch((e) => {
      console.log(chalk`{red.bold API Error} {white.bold ${e.message}}`);
      process.exit(1);
    });

  if (options.verbose) {
    log.info('Available items:', transactions.availableItems);
  }

  console.log(
    chalk`name: {white.bold ${name}}  account number: {white.bold ${accountNumber}}  balance: {white.bold ${balance}}`
  );

  console.log('Date'.padEnd(11), 'Amount'.padStart(11), ' Type'.padEnd(21), 'Description'.padEnd(40));

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
      amount < 0 ? chalk.bold.red(amount.toFixed(2).padStart(12)) : chalk.bold.green(amount.toFixed(2).padStart(12));

    line += amount + ' ';
    line += chalk.bold.yellow(item.transactionTypeCode.toString().padStart(4));
    line += ' ' + item.transactionType.padEnd(15) + '  ';
    line += item.text;

    console.log(line);
  });
}

async function handleCustomers() {
  let api = options.api_version || 'v1';
  if (options.verbose) {
    log.info(chalk`{yellow \uf45f} Fetching customer information. version: {white.bold ${api}}.`);
  }

  const json = await sb.customers(api).catch(handleException);
  const pad = 8;
  console.log('name:'.padEnd(pad), chalk.white.bold(`${json.item.firstName} ${json.item.lastName}`));

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

async function handleRequestError(res: Response) {
  const json = await res.json();
  console.log(chalk`{red ${res.status}} {white.bold ${res.statusText}} - ${json.errorMessage}`);

  process.exit(1);
}

/**
 * General function for printing the error on exceptions and exiting.
 *
 * @param {Error} e
 */
function handleException(e: Error): never {
  console.log(version);
  console.log(chalk`{red.bold API Error} {white.bold ${e.message}}`);
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
function findAccountOrExit(accounts: sbanken.AccountListResult, name: string) {
  const list = accounts.items.filter((i) => i.name.match(new RegExp(name, 'ui')));

  if (list.length === 0) {
    console.error(chalk`{red error} - Could not find an account with {red ${name}} in name.`);
    process.exit(1);
  }
  if (list.length > 1) {
    console.error(chalk`{red error} - Found multiple accounts with {red ${name}} in name.`);
    process.exit(1);
  }

  return list[0];
}

function printAccountInfoRow(account: sbanken.Account) {
  console.log(
    account.name.padEnd(32),
    chalk.white.bold(`${account.available.toFixed(2)} kr`.padStart(15)),
    chalk.yellow(`${account.balance.toFixed(2)} kr`.padStart(15))
  );
}

/**
 * Reads in credentials from the environments and sets up the credentials object
 * Verify that credentials exist and prints an error if they do not.
 *
 * @returns {sbanken.Credentials}
 */
function getCredentials(): sbanken.Credentials {
  if (
    typeof process.env.SBANKEN_SECRET !== 'string' ||
    typeof process.env.SBANKEN_CLIENTID !== 'string' 
  ) {
    console.log(version);
    console.log(chalk`{red error} {white Missing credentials - You need to provide them for the app to work.}`);
    process.exit(1);
  }

  return {
    secret: process.env.SBANKEN_SECRET,
    clientId: process.env.SBANKEN_CLIENTID
  };
}
