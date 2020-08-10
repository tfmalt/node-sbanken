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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
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
exports.Sbanken = void 0;
const log_1 = __importDefault(require("./log"));
const btoa_1 = __importDefault(require("btoa"));
const fetch = __importStar(require("node-fetch"));
const url_1 = require("url");
const fs_1 = __importDefault(require("fs"));
const sbanken_urls_json_1 = __importDefault(require("./sbanken-urls.json"));
const fsp = fs_1.default.promises;
const package_json_1 = require("../package.json");
__exportStar(require("./node-sbanken.types"), exports);
class Sbanken {
    constructor(credentials, options = { verbose: false }) {
        if (!this.__testCredentials(credentials)) {
            throw new Error('Credentials must be provided.');
        }
        this.credentials = credentials;
        this.opts = options;
        this.credentials.clientId = typeof credentials.clientId === 'string' ? credentials.clientId : '';
        this.credentials.secret = typeof credentials.secret === 'string' ? credentials.secret : '';
        this.credentials.userId = typeof credentials.userId === 'string' ? credentials.userId : '';
        this.clientCredentials = btoa_1.default(encodeURIComponent(this.credentials.clientId) + ':' + encodeURIComponent(this.credentials.secret));
        this.urls = sbanken_urls_json_1.default;
        this.version = package_json_1.version;
        this.author = package_json_1.author;
        this.description = package_json_1.description;
        this.cache = {
            dir: `${__dirname}/.cache`,
            file: `${__dirname}/.cache/accesstoken.json`,
        };
    }
    options(opts = {}) {
        this.opts = Object.assign(this.opts, opts);
    }
    customers(version = 'v1') {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.opts.verbose) {
                log_1.default.info('Fetching:', this.urls.customers[version]);
            }
            const res = yield this.__doRequest(this.urls.customers[version]);
            if (this.opts.verbose) {
                log_1.default.info(`Got response from server: ${res.status} ${res.statusText}`);
            }
            const json = yield res.json();
            if (!res.ok) {
                throw new Error(res.status + ' ' + res.statusText + JSON.stringify(json));
            }
            return json;
        });
    }
    accounts() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.opts.verbose) {
                log_1.default.info('Fetching accounts:', this.urls.accounts.v1);
            }
            const res = yield this.__doRequest(this.urls.accounts.v1);
            if (this.opts.verbose) {
                log_1.default.info('  Status code:', res.status, res.statusText);
            }
            return res.json();
        });
    }
    transfer(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.getAccessToken();
            const msg = options.message || `From ${options.from.name} to ${options.to.name}`.slice(0, 30);
            const body = {
                fromAccountId: options.from.accountId,
                toAccountId: options.to.accountId,
                message: msg,
                amount: parseFloat(options.amount),
            };
            if (this.opts.verbose)
                log_1.default.info('Fetching:', this.urls.transfer.v1);
            if (this.opts.verbose)
                log_1.default.debug('body:', JSON.stringify(body));
            const res = yield this.__doRequest(this.urls.transfer.v1, body);
            if (res.ok)
                return res;
            if (res.status === 400)
                return res;
            const json = yield res.json();
            throw new Error(`${res.status} ${res.statusText} ${JSON.stringify(json)}`);
        });
    }
    payments(accountId) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = `${this.urls.payments.v1}/${accountId}`;
            if (this.opts.verbose) {
                console.log('Fetching Payments:', { accountId, url });
            }
            const res = yield this.__doRequest(url);
            if (res.ok)
                return res.json();
            console.log('Status:', res.status, 'msg:', res.statusText);
            throw new Error(`${res.status} ${res.statusText}`);
        });
    }
    transactions(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { accountId, from, to, limit } = options;
            if (this.opts.verbose) {
                log_1.default.debug('Fetching transactions. Options:', JSON.stringify(options));
            }
            const url = new url_1.URL(`${this.urls.transactions.v1}/${accountId}`);
            url.searchParams.append('length', String(limit || 1000));
            if (from instanceof Date) {
                url.searchParams.append('startDate', from.toISOString().slice(0, 10));
            }
            if (to instanceof Date) {
                url.searchParams.append('endDate', to.toISOString().slice(0, 10));
            }
            if (this.opts.verbose) {
                log_1.default.info('Fetching transactions:', url.href);
            }
            const res = yield this.__doRequest(url.href);
            const json = yield res.json();
            if (res.ok)
                return json;
            console.debug(res.status, res.statusText);
            console.debug(json.errorType, ':', json.errorMessage);
            throw new Error(`${res.status} ${res.statusText} - ${json.errorType} ${json.errorMessage}`);
        });
    }
    getAccessToken() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.opts.verbose) {
                log_1.default.info('Fetching access token');
            }
            if (!fs_1.default.existsSync(this.cache.file)) {
                return this.refreshAccessToken();
            }
            return fsp
                .access(this.cache.file, fs_1.default.constants.R_OK)
                .then(() => {
                if (this.opts.verbose) {
                    log_1.default.info('Found cached access token:');
                    log_1.default.info('  ', this.cache.file);
                }
                return fsp.readFile(this.cache.file);
            })
                .then((data) => JSON.parse(data.toString()))
                .then((data) => {
                if (this.__isAccessTokenFresh(data)) {
                    return data;
                }
                else {
                    if (this.opts.verbose) {
                        log_1.default.info('Current access token stale.');
                    }
                    return this.refreshAccessToken();
                }
            })
                .catch((err) => {
                log_1.default.error(err.message);
                process.exit(1);
            });
        });
    }
    refreshAccessToken() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.opts.verbose) {
                log_1.default.info('Fetching new access token.');
            }
            const params = new url_1.URLSearchParams();
            params.append('grant_type', 'client_credentials');
            try {
                const res = yield fetch.default(this.urls.auth, {
                    method: 'post',
                    body: params,
                    headers: {
                        Accept: 'application/json',
                        Authorization: `Basic ${this.clientCredentials}`,
                        customerId: this.credentials.userId,
                    },
                });
                const json = yield this.__handleAccessTokenResponse(res);
                return json;
            }
            catch (err) {
                log_1.default.error('Received error from Sbanken:', err.message);
                process.exit(1);
            }
        });
    }
    __doRequest(url, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.getAccessToken();
            const method = typeof body === 'undefined' ? 'GET' : 'POST';
            const data = typeof body === 'undefined' ? undefined : JSON.stringify(body);
            if (this.opts.verbose) {
                log_1.default.info('Doing request:', method);
            }
            const res = yield fetch.default(url, {
                method: method,
                body: data,
                headers: {
                    Authorization: `Bearer ${token.access_token}`,
                    Accept: 'application/json',
                    customerId: this.credentials.userId,
                    'Content-Type': 'application/json',
                },
            });
            if (!res.ok)
                throw new Error(res.status + ' ' + res.statusText);
            return res;
        });
    }
    __handleAccessTokenResponse(res) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.opts.verbose) {
                log_1.default.info('  AccessToken response from server:', res.status, res.statusText);
            }
            if (!res.ok) {
                throw new Error(`${res.status} ${res.statusText}`);
            }
            const json = yield res.json();
            json.date = new Date().toJSON();
            try {
                if (this.opts.verbose) {
                    log_1.default.info('  Storing access token in cache.');
                }
                if (!fs_1.default.existsSync(`${__dirname}/.cache`)) {
                    fs_1.default.mkdirSync(`${__dirname}/.cache`);
                }
                fs_1.default.writeFileSync(`${__dirname}/.cache/accesstoken.json`, JSON.stringify(json), {
                    mode: 0o600,
                });
            }
            catch (err) {
                throw err;
            }
            return json;
        });
    }
    __isAccessTokenFresh(data) {
        const then = new Date(data.date);
        const now = new Date();
        if (then.getTime() + (data.expires_in - 300) * 1000 > now.getTime()) {
            if (this.opts.verbose) {
                log_1.default.info('Token is still fresh.');
            }
            return true;
        }
        if (this.opts.verbose) {
            log_1.default.info('Token is stale.');
        }
        return false;
    }
    __testCredentials(c) {
        if (typeof c.clientId === 'string' && typeof c.secret === 'string' && typeof c.userId === 'string') {
            return true;
        }
        return false;
    }
    hello() {
        console.log('hello world');
    }
}
exports.Sbanken = Sbanken;
//# sourceMappingURL=node-sbanken.js.map