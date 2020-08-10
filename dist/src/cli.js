#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sbanken_json_1 = __importDefault(require("../etc/sbanken.json"));
const sbanken = __importStar(require("./node-sbanken"));
const log_1 = __importDefault(require("./log"));
const commander_1 = __importDefault(require("commander"));
const chalk_1 = __importDefault(require("chalk"));
setupCredentials();
const sb = new sbanken.Sbanken(sbanken_json_1.default);
commander_1.default.version(sb.version).description(sb.description);
commander_1.default.option('-v, --verbose', 'Tell the program to be verbose');
commander_1.default.command('accounts').description('List all accounts').action(handleAccounts);
commander_1.default
    .command('account [name]')
    .alias('ac')
    .description('List accounts matching the provided name.')
    .action(handleAccount);
commander_1.default
    .command('customers')
    .alias('cu')
    .option('-a --api_version [version]', 'Version of API to use, v1 or v2')
    .description('Print out information about the customer associated with the current userId.')
    .action(handleCustomers);
commander_1.default
    .command('transactions <name>')
    .alias('tr')
    .description('Print out transactions for the account matching the provided name.')
    .usage('[options] <name>')
    .option('-f --from <yyyy-mm-dd>', 'From date')
    .option('-t --to <yyyy-mm-dd>', 'To date')
    .option('-l --limit <number>', 'Number of transactions to fetch.')
    .action(handleTransactions);
commander_1.default
    .command('payments <name>')
    .alias('pa')
    .description('Print payments waiting to be processed.')
    .usage('<name>')
    .action(handlePayments);
commander_1.default
    .command('transfer <amount>')
    .description('Transfer money between two accounts.')
    .option('-f --from <name|account>')
    .option('-t --to <name|account>')
    .option('-m --message <message>')
    .action(handleTransfer);
commander_1.default.on('option:verbose', function () {
    process.env.VERBOSE = this.verbose;
    sb.options({ verbose: this.verbose });
});
commander_1.default.on('command:*', function () {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', commander_1.default.args.join(' '));
    process.exit(1);
});
commander_1.default.parse(process.argv);
if (!process.argv.slice(2).length) {
    commander_1.default.help();
}
function handleAccounts() {
    return __awaiter(this, void 0, void 0, function* () {
        if (commander_1.default.verbose) {
            log_1.default.info('Command: List all accounts.');
        }
        const json = yield sb.accounts();
        console.table(json.items);
    });
}
function handleAccount(name) {
    return __awaiter(this, void 0, void 0, function* () {
        if (commander_1.default.verbose) {
            if (typeof name === 'undefined') {
                log_1.default.info('Told to list all accounts');
            }
            else {
                log_1.default.info('Told to list account by name: ' + name);
            }
        }
        const str = typeof name === 'undefined' ? '' : name;
        const regex = new RegExp(str, 'ui');
        const json = yield sb.accounts();
        const list = json.items
            .filter((item) => item.name.match(regex))
            .sort((a, b) => a.name.localeCompare(b.name));
        if (list.length > 0) {
            list.forEach((item) => printAccountInfoRow(item));
        }
        else {
            console.log(chalk_1.default `Could not find an account with {red ${name}} in name.`);
        }
    });
}
function handleTransfer(amount, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (commander_1.default.verbose) {
            log_1.default.info('Running command transfer', options.from, options.to, amount);
        }
        const accounts = yield sb.accounts();
        const from = findAccountOrExit(accounts, options.from);
        const to = findAccountOrExit(accounts, options.to);
        const message = options.message ? options.message.slice(0, 30) : undefined;
        console.log(chalk_1.default `Transferring {white.bold ${parseFloat(amount).toFixed(2)} kr}`);
        console.log(chalk_1.default `From: {red.bold ${from.name}} ({yellow ${from.accountNumber}}), To: {green.bold ${to.name}} ({yellow ${to.accountNumber}})`);
        console.log(chalk_1.default `Message: {magenta.bold ${message}}.`);
        const res = yield sb.transfer({ from, to, amount, message });
        if (!res.ok)
            return handleRequestError(res);
        console.log(chalk_1.default `{blue ${res.status}} {white.bold ${res.statusText}} - Transfer successful`);
        const updatedAccounts = yield sb.accounts();
        updatedAccounts.items
            .filter((i) => {
            if (i.accountId === from.accountId || i.accountId === to.accountId) {
                return true;
            }
        })
            .forEach((i) => printAccountInfoRow(i));
    });
}
function handlePayments(aName) {
    return __awaiter(this, void 0, void 0, function* () {
        if (commander_1.default.verbose) {
            log_1.default.info('Running command payments');
        }
        const json = yield sb.accounts();
        const account = findAccountOrExit(json, aName);
        if (commander_1.default.verbose) {
            console.log('account:', account);
        }
        const payments = yield sb.payments(account.accountId);
        if (commander_1.default.verbose) {
            console.log(payments);
        }
        console.log(chalk_1.default `name: {yellow ${account.name}}  account number: {yellow ${account.accountNumber}}  balance: {white.bold ${account.available.toFixed(2)}}`);
        console.log();
        payments.items
            .sort((a, b) => (new Date(a.dueDate) > new Date(b.dueDate) ? 1 : -1))
            .forEach((item) => {
            const bName = item.beneficiaryName || '';
            console.log(item.dueDate.slice(0, 10).padEnd(11), chalk_1.default `{red.bold ${item.amount.toFixed(2).padStart(11)}}`, chalk_1.default `{cyan ${item.productType.padStart(11).padEnd(12)}}`, chalk_1.default `${bName.padEnd(52)}`);
        });
        console.log();
    });
}
function handleTransactions(aName, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (commander_1.default.verbose) {
            log_1.default.info(chalk_1.default `Running command transactions for name {yellow ${aName}}`);
        }
        const json = yield sb.accounts();
        const account = findAccountOrExit(json, aName);
        const from = typeof options.from === 'undefined' ? undefined : new Date(options.from);
        const to = typeof options.to === 'undefined' ? undefined : new Date(options.to);
        if (commander_1.default.verbose) {
            log_1.default.info('Fetching transactions for account:', account.name);
        }
        const { accountId, name, accountNumber, balance } = account;
        const transactions = yield sb.transactions({
            accountId,
            from,
            to,
            limit: options.limit,
        });
        if (commander_1.default.verbose) {
            log_1.default.info('Available items:', transactions.availableItems);
        }
        console.log(chalk_1.default `name: {white.bold ${name}}  account number: {white.bold ${accountNumber}}  balance: {white.bold ${balance}}`);
        console.log('Date'.padEnd(11), 'Amount'.padStart(11), ' Type'.padEnd(21), 'Description'.padEnd(40));
        console.log('---------- ', '----------- ', '------------------- ', '---------------------------------------------------');
        transactions.items.forEach((item) => {
            let line = item.accountingDate.substr(0, 10) + ' ';
            let amount = parseFloat(item.amount);
            amount =
                amount < 0 ? chalk_1.default.bold.red(amount.toFixed(2).padStart(12)) : chalk_1.default.bold.green(amount.toFixed(2).padStart(12));
            line += amount + ' ';
            line += chalk_1.default.bold.yellow(item.transactionTypeCode.toString().padStart(4));
            line += ' ' + item.transactionType.padEnd(15) + '  ';
            line += item.text;
            console.log(line);
        });
    });
}
function handleCustomers() {
    return __awaiter(this, void 0, void 0, function* () {
        let api = commander_1.default.api_version || 'v1';
        if (commander_1.default.verbose) {
            log_1.default.info(chalk_1.default `{yellow \uf45f} Fetching customer information. version: {white.bold ${api}}.`);
        }
        const json = yield sb.customers(api);
        const pad = 8;
        console.log('name:'.padEnd(pad), chalk_1.default.white.bold(`${json.item.firstName} ${json.item.lastName}`));
        console.log('email:'.padEnd(pad), chalk_1.default.white.bold(json.item.emailAddress));
        let phones = '';
        json.item.phoneNumbers.forEach((n) => {
            phones += `+${n.countryCode} ${n.number}, `;
        });
        console.log('phones:'.padEnd(pad), chalk_1.default.white.bold(phones));
        console.log('address:'.padEnd(pad), chalk_1.default.white.bold(`${json.item.postalAddress.addressLine1}, ${json.item.postalAddress.addressLine2}, ${json.item.postalAddress.addressLine3}, ${json.item.postalAddress.addressLine4}`));
    });
}
function handleRequestError(res) {
    return __awaiter(this, void 0, void 0, function* () {
        const json = yield res.json();
        console.log(chalk_1.default `{red ${res.status}} {white.bold ${res.statusText}} - ${json.errorMessage}`);
        process.exit(1);
    });
}
function findAccountOrExit(accounts, name) {
    const list = accounts.items.filter((i) => i.name.match(new RegExp(name, 'ui')));
    if (list.length === 0) {
        console.error(chalk_1.default `{red error} - Could not find an account with {red ${name}} in name.`);
        process.exit(1);
    }
    if (list.length > 1) {
        console.error(chalk_1.default `{red error} - Found multiple accounts with {red ${name}} in name.`);
        process.exit(1);
    }
    return list[0];
}
function printAccountInfoRow(account) {
    console.log(account.name.padEnd(32), chalk_1.default.white.bold(`${account.available.toFixed(2)} kr`.padStart(15)), chalk_1.default.yellow(`${account.balance.toFixed(2)} kr`.padStart(15)));
}
function setupCredentials() {
    if (process.env.SBANKEN_SECRET) {
        sbanken_json_1.default.secret = process.env.SBANKEN_SECRET;
    }
    if (process.env.SBANKEN_CLIENTID) {
        sbanken_json_1.default.clientId = process.env.SBANKEN_CLIENTID;
    }
    if (process.env.SBANKEN_USERID) {
        sbanken_json_1.default.userId = process.env.SBANKEN_USERID;
    }
    if (typeof sbanken_json_1.default.secret === 'string' &&
        typeof sbanken_json_1.default.clientId === 'string' &&
        (typeof sbanken_json_1.default.userId === 'string' || typeof sbanken_json_1.default.userId === 'number')) {
        return true;
    }
    else {
        console.log(chalk_1.default `{red error} {white You need to provide correct credentials for the app to work.}`);
        process.exit(1);
    }
}
//# sourceMappingURL=cli.js.map