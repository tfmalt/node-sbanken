/**
 * A simple wrapper object ot make verbose output prettier.
 */
const chalk = require('chalk');

const __date = () => new Date().toJSON();

module.exports = {
  info: (...msgs) =>
    console.info(
      __date(),
      chalk.blue('info'),
      msgs.reduce((a, b) => a + ' ' + b)
    ),
  debug: (...msgs) =>
    console.debug(
      __date(),
      chalk.green('debug'),
      msgs.reduce((a, b) => a + ' ' + b)
    ),
  warn: (...msgs) =>
    console.warn(
      __date(),
      chalk.yellow('warning'),
      msgs.reduce((a, b) => a + ' ' + b)
    ),
  error: (...msgs) =>
    console.error(
      __date(),
      chalk.red('error'),
      msgs.reduce((a, b) => a + ' ' + b)
    ),
  log: (...msgs) =>
    console.log(__date(), chalk.dim('log'), msgs.reduce((a, b) => a + ' ' + b)),
};
