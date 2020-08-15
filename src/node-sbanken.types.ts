import { Address } from 'cluster';

export interface AccessTokenInfo {
  expires_in: number;
  access_token: string;
  date?: string;
  token_type: string;
  scope: string;
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

// https://api.sbanken.no/exec.bank/swagger/index.html?urls.primaryName=Transfers%20v1
export interface TransferCreateRequest {
  fromAccountId: string;
  toAccountId: string;
  message: string;
  amount: number;
}

export interface TransferOptions {
  message?: string;
  from: Account;
  to: Account;
  amount: string;
}

export interface TransactionsOptions {
  accountId: string;
  from?: Date;
  to?: Date;
  limit?: number;
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

export type ErrorType = 'System' | 'Input' | 'State' | 'ServiceUnavailable' | 'CustomHttpStatus' | 'NotFound';

export interface AccountListResult {
  availableItems: number;
  items: Account[];
  errorType: ErrorType | null;
  isError: boolean;
  errorCode: number | null;
  errorMessage: string | null;
  traceId: string | null;
}

export interface Account {
  accountId: string;
  accountNumber: string;
  ownerCustomerId: string;
  name: string;
  accountType: string;
  available: number;
  balance: number;
  creditLimit: number;
}

export interface Payment {
  paymentId: string;
  recipientAccountNumber: string;
  amount: number;
  dueDate: string;
  kid: string | null;
  text: string | null;
  isActive: boolean;
  status: string;
  allowedNewStatusTypes: 'Stopped' | 'Reactivated' | 'IgnoreLimit';
  statusDetail: string;
  productType: string;
  paymentType: string;
  paymentNumber: number;
  beneficiaryName: string | null;
}

export interface PaymentListResult {
  availableItems: number;
  items: Payment[];
  errorType: ErrorType | null;
  isError: boolean;
  errorCode: number | null;
  errorMessage: string | null;
  traceId: string | null;
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
