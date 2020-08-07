import { Address } from 'cluster';

export interface AccessTokenInfo {
  expires_in: number;
  access_token: string;
  date: string;
}

export interface Credentials {
  clientId: string;
  secret: string;
  userId: string;
}

export interface Options {
  verbose: boolean;
}

export interface Urls {
  auth: string;
  customers: {
    [key: string]: string;
  };
  accounts: {
    [key: string]: string;
  };
  transfer: {
    [key: string]: string;
  };
  payments: {
    [key: string]: string;
  };
  transactions: {
    [key: string]: string;
  };
}
export interface CacheInfo {
  file: string;
  dir: string;
}

export interface TransferOptions {
  message?: string;
  from: AccountInfo;
  to: AccountInfo;
  amount: string;
}

export interface TransactionsOptions {
  accountId: string;
  from?: Date;
  to?: Date;
  limit: number;
}

export interface Transaction {
  accountingDate: string;
  amount: string;
  transactionTypeCode: number;
  transactionType: string;
  text: string;
}
export interface TransactionList {
  availableItems: number;
  items: any;
}

export interface AccessTokenInfo {
  expires_in: number;
  access_token: string;
  date: string;
}

export interface AccountList {
  items: AccountInfo[];
}

export interface AccountInfo {
  name: string;
  accountId: string;
  accountNumber: number;
  available: number;
  balance: number;
}

export interface PaymentInfo {
  beneficiaryName: string;
  productType: string;
  dueDate: string;
  amount: number;
}

export interface PaymentList {
  items: PaymentInfo[];
}

export interface CustomerItemResult {
  item: Customer;
}

export interface SbankenAddress {
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  addressLine4: string;
  country: string;
  zipCode: string;
  city: string;
}

export interface PhoneNumber {
  countryCode?: string;
  number?: string;
}

export interface Customer {
  customerId?: string;
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  dateOfBirth?: string;
  postalAddress: SbankenAddress;
  phoneNumbers: PhoneNumber[];
}
