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
        .forEach(item => printAccountInfoRow(item));
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
      console.log(
        'name:'.padEnd(pad),
        chalk.white.bold(`${json.item.firstName} ${json.item.lastName}`)
      );
      console.log(
        'email:'.padEnd(pad),
        chalk.white.bold(json.item.emailAddress)
      );
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
        sbanken.transactions({ accountId, from, to }).then(json => {
          if (program.verbose) {
            log.info('Available items:', json.availableItems);
          }
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
            ' Type'.padEnd(21),
            'Description'.padEnd(40)
          );
          console.log(
            '---------- ',
            '----------- ',
            '------------------- ',
            '---------------------------------------------------'
          );
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
            line += ' ' + item.transactionType.padEnd(15) + '  ';
            line += item.text;

            console.log(line);
          });
        });
        // log.log(json.items[0]);
      });
  });

program
  .command('transfer <amount>')
  .description('Transfer money between two accounts.')
  .option('-f --from <name|account>')
  .option('-t --to <name|account>')
  .action((amount, options) => {
    if (program.verbose)
      log.info('Running command transfer', options.from, options.to, amount);

    sbanken
      .accounts()
      .then(accounts => {
        const froms = accounts.items.filter(i =>
          i.name.match(new RegExp(options.from, 'ui'))
        );
        if (froms.length != 1) {
          console.error(
            'Did not get correct match for from account. Make from specific.'
          );
          process.exit(1);
        }

        const tos = accounts.items.filter(i =>
          i.name.match(new RegExp(options.to, 'ui'))
        );
        if (tos.length != 1) {
          console.error(
            'Did not get correct match for to account. Make to specific.'
          );
          process.exit(1);
        }

        return { from: froms[0], to: tos[0], amount: amount };
      })
      .then(opts => {
        console.log(
          'Transferring',
          chalk.white.bold(`${parseFloat(opts.amount).toFixed(2)} kr`),
          chalk`from {red.bold ${opts.from.name}} ({yellow ${
            opts.from.accountNumber
          }})`,
          chalk`to {green.bold ${opts.to.name}} ({yellow ${
            opts.to.accountNumber
          }})`
        );
        sbanken
          .transfer(opts)
          .then(res => {
            if (res.ok) {
              console.log(
                chalk`{blue ${res.status}} {white.bold ${
                  res.statusText
                }} - Transfer successful`
              );
            } else if (res.status === 400) {
              return res.json().then(json => {
                console.log(
                  chalk`{red ${res.status}} {white.bold ${res.statusText}} - ${
                    json.errorMessage
                  }`
                );
                process.exit(1);
              });
            }
          })
          .then(() => sbanken.accounts())
          .then(accounts => {
            accounts.items
              .filter(i => {
                if (
                  i.accountId === opts.from.accountId ||
                  i.accountId === opts.to.accountId
                ) {
                  return true;
                }
              })
              .forEach(i => printAccountInfoRow(i));
          });
      });
  });

program.parse(process.argv);
sbanken.options({ verbose: program.verbose });

if (!process.argv.slice(2).length) {
  program.help();
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
