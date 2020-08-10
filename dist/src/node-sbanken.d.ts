import * as fetch from 'node-fetch';
import { Credentials, Options, Urls, CacheInfo, CustomerItemResult, AccountListResult, TransactionsOptions, TransferOptions, AccessTokenInfo, TransactionList, TransferCreateRequest } from './node-sbanken.types';
export * from './node-sbanken.types';
export declare class Sbanken {
    credentials: Credentials;
    opts: Options;
    clientCredentials: string;
    urls: Urls;
    version: string;
    description: string;
    author: string;
    cache: CacheInfo;
    constructor(credentials: Credentials, options?: Options);
    options(opts?: {}): void;
    customers(version?: string): Promise<CustomerItemResult>;
    accounts(): Promise<AccountListResult>;
    transfer(options: TransferOptions): Promise<fetch.Response>;
    payments(accountId: string): Promise<any>;
    transactions(options: TransactionsOptions): Promise<TransactionList>;
    getAccessToken(): Promise<AccessTokenInfo>;
    refreshAccessToken(): Promise<AccessTokenInfo>;
    __doRequest(url: string, body?: TransferCreateRequest): Promise<fetch.Response>;
    __handleAccessTokenResponse(res: fetch.Response): Promise<any>;
    __isAccessTokenFresh(data: AccessTokenInfo): boolean;
    __testCredentials(c: Credentials): boolean;
    hello(): void;
}
