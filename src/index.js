#!/usr/bin/env node
const fetch = require('node-fetch');
const package = require('../package');
const config = require('../etc/sbanken');
const btoa = require('btoa');
const Sbanken = require('./node-sbanken');
const { name, description, version } = package;

console.log(`${name} - ${description} - Version: ${version}`);

if (process.env.SBANKEN_SECRET) {
  config.secret = process.env.SBANKEN_SECRET;
}

if (process.env.SBANKEN_CLIENTID) {
  config.clientId = process.env.SBANKEN_CLIENTID;
}

if (process.env.SBANKEN_USERID) {
  config.userId = process.env.SBANKEN_USERID;
}

sbanken = new Sbanken(config);
// sbanken.hello();

sbanken.accounts();

//  .getAccessToken()
//  .then(data => {
//    console.log('Got token:');
//    // console.log(data);
//    return data;
//  })
//  .then(data => {
//    // console.log(data.access_token);
//    return fetch('https://api.sbanken.no/bank/api/v1/accounts/', {
//      headers: {
//        Authorization: `Bearer ${data.access_token}`,
//        Accept: 'application/json',
//        customerId: config.userId,
//      },
//    });
//  })
//  .then(res => {
//    if (res.ok) {
//      return res.json();
//    }
//
//    throw new Error(res.status + ' ' + res.statusText);
//  })
//  .then(json => {
//    console.log('Got accounts:');
//    console.table(
//      json.items.map(i => ({
//        accountNumber: i.accountNumber,
//        name: i.name,
//        available: i.available
//          .toFixed(2)
//          .toString()
//          .padStart(10, ' '),
//        balance: i.balance
//          .toFixed(2)
//          .toString()
//          .padStart(10, ' '),
//      }))
//    );
//    // console.log(json);
//    // json.items.forEach(account => {
//    //   console.log('%s: kr %f', account.name, account.available);
//    // });
//  })
//  .catch(err => {
//    console.error('Got Error:', err.message);
//  });
//
