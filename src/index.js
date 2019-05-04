#!/usr/bin/env node
const package = require('../package');
const credentials = require('../etc/sbanken');
const Sbanken = require('./node-sbanken');
const log = require('./log');
const program = require('commander');
const chalk = require('chalk');
const { name, description, version } = package;

setupCredentials();
sbanken = new Sbanken(credentials);

program.version(version).description(description);
program.option('-v, --verbose', 'Tell the program to be verbose');

program
  .command('accounts')
  .description('List all accounts')
  .action(() => {
    if (program.verbose) {
      log.info('Command: List all accounts.');
    }
    sbanken.accounts().then(json => {
      console.table(json.items);
    });
  });

program
  .command('account [name]')
  .alias('ac')
  .description('List accounts with a given name')
  .action(name => {
    if (program.verbose) {
      log.info('Told to list account by name: ' + name);
    }
    const regex = new RegExp(name, 'ui');
    sbanken.accounts().then(json => {
      json.items
        .filter(item => item.name.match(regex))
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(item => {
          log.log(
            item.name.padEnd(32),
            chalk.white.bold(`${item.balance.toFixed(2)} kr`.padStart(12))
          );
        });
    });
  });

program
  .command('customers')
  .alias('cu')
  .option('-a --api_version [version]', 'Version of API to use, v1 or v2')
  .description('Fetch the customers associated with the current userId.')
  .action(() => {
    let api = program.api_version || 'v1';
    if (program.verbose) {
      log.info(
        chalk.yellow('\uf45f '),
        'Fetching customer information. version:',
        api
      );
    }
    sbanken.customers(api).then(json => {
      const pad = 8;
      log.log(
        'name:'.padEnd(pad),
        chalk.white.bold(`${json.item.firstName} ${json.item.lastName}`)
      );
      log.log('email:'.padEnd(pad), chalk.white.bold(json.item.emailAddress));
      let phones = '';
      json.item.phoneNumbers.forEach(n => {
        phones += `+${n.countryCode} ${n.number}, `;
      });
      log.log('phones:'.padEnd(pad), chalk.white.bold(phones));
      log.log(
        'address:'.padEnd(pad),
        chalk.white.bold(
          `${json.item.postalAddress.addressLine1}, ${
            json.item.postalAddress.addressLine2
          }, ${json.item.postalAddress.addressLine3}, ${
            json.item.postalAddress.addressLine4
          }`
        )
      );

      // log.log(JSON.stringify(json));
    });
  });

program
  .command('transactions <name>')
  .alias('tr')
  .description('Fetch the transactions for the account with name.')
  .usage('[options] <name>')
  .option('-f --from <yyyy-mm-dd>', 'From date')
  .option('-t --to <yyyy-mm-dd>', 'To date')
  .action((name, options) => {
    if (program.verbose) {
      log.info(`Running command transactions for name '${name}'`);
    }
    sbanken
      .accounts()
      .then(json => {
        // Do filter and verify single account here.
        const re = new RegExp(name, 'ui');
        const accounts = json.items.filter(item => item.name.match(re));
        if (accounts.length != 1) {
          let error =
            accounts.length > 1
              ? `Found multiple account names matching '${name}'.`
              : `Did not find an account with the name '${name}'.`;
          if (program.verbose) {
            log.error(error);
          }

          console.log(error);
          if (accounts.length > 1) {
            accounts.forEach(item => console.log('  ', item.name));
          }
          console.log('Make the name match an unique account name.');
          process.exit(1);
        }

        return accounts[0];
      })
      .then(account => {
        const from =
          typeof options.from === 'undefined'
            ? undefined
            : new Date(options.from);
        const to =
          typeof options.to === 'undefined' ? undefined : new Date(options.to);

        if (program.verbose) {
          log.info('Fetching transactions for account:', account.name);
          log.info('  from:'.padStart(8), from);
          log.info('  to:'.padStart(8), to);
        }

        const { accountId, name, accountNumber, balance } = account;
        // console.log(account);
        console.log(
          'name:',
          chalk.white.bold(name),
          ' account number:',
          chalk.white.bold(accountNumber),
          ' balance:',
          chalk.white.bold(balance)
        );
        console.log(
          'Date'.padEnd(11),
          'Amount'.padStart(11),
          ' Type'.padEnd(15),
          'Description'.padEnd(40)
        );
        console.log(
          '---------- ',
          '----------- ',
          '------------- ',
          '---------------------------------------------------'
        );
        sbanken.transactions({ accountId, from, to }).then(json => {
          json.items.forEach(item => {
            let line = item.accountingDate.substr(0, 10) + ' ';
            let amount = parseFloat(item.amount);
            amount =
              amount < 0
                ? chalk.bold.red(amount.toFixed(2).padStart(12))
                : chalk.bold.green(amount.toFixed(2).padStart(12));
            line += amount + ' ';
            line += chalk.bold.yellow(
              item.transactionTypeCode.toString().padStart(4)
            );
            line += ' ' + item.transactionTypeText.padEnd(9) + '  ';
            line += item.text;

            console.log(line);
          });
        });
        // log.log(json.items[0]);
      });
  });

program.parse(process.argv);
sbanken.options({ verbose: program.verbose });

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
    log.error('You need to provide correct credentials for the app to work.');
    process.exit(1);
  }
}
