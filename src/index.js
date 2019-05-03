#!/usr/bin/env node
const package = require('../package');
const credentials = require('../etc/sbanken');
const Sbanken = require('./node-sbanken');
const program = require('commander');
const chalk = require('chalk');
const { name, description, version } = package;

if (process.env.SBANKEN_SECRET) {
  credentials.secret = process.env.SBANKEN_SECRET;
}

if (process.env.SBANKEN_CLIENTID) {
  credentials.clientId = process.env.SBANKEN_CLIENTID;
}

if (process.env.SBANKEN_USERID) {
  credentials.userId = process.env.SBANKEN_USERID;
}

sbanken = new Sbanken(credentials);

program.version(version).description(description);
program.option('-v, --verbose', 'Tell the program to be verbose');

program
  .command('accounts')
  .description('List all accounts')
  .action(() => {
    if (program.verbose) {
      console.info('Command: List all accounts.');
    }
    sbanken.accounts().then(json => {
      console.table(json.items);
    });
  });

program
  .command('account [name]')
  .description('List accounts with a given name')
  .action(name => {
    if (program.verbose) {
      console.info('Told to list account by name: ' + name);
    }
    const regex = new RegExp(name, 'ui');
    sbanken.accounts().then(json => {
      json.items
        .filter(item => item.name.match(regex))
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(item => {
          console.log(
            item.name.padEnd(32),
            chalk.white.bold(`${item.balance.toFixed(2)} kr`.padStart(12))
          );
        });
    });
  });

program.parse(process.argv);
sbanken.options({ verbose: program.verbose });
