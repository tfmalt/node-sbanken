/**
 * A simple wrapper object ot make verbose output prettier.
 */
import chalk from 'chalk';

const __date: Function = (): string => new Date().toJSON();

export default {
  info: (...msgs: (string | number)[]) =>
    console.info(
      __date(),
      chalk.blue('info'),
      msgs.reduce((a, b) => a + ' ' + b)
    ),
  debug: (...msgs: (string | number)[]) =>
    console.debug(
      __date(),
      chalk.green('debug'),
      msgs.reduce((a, b) => a + ' ' + b)
    ),
  warn: (...msgs: (string | number)[]) =>
    console.warn(
      __date(),
      chalk.yellow('warning'),
      msgs.reduce((a, b) => a + ' ' + b)
    ),
  error: (...msgs: (string | number)[]) =>
    console.error(
      __date(),
      chalk.red('error'),
      msgs.reduce((a, b) => a + ' ' + b)
    ),
  log: (...msgs: (string | number)[]) => {
    return console.log(
      __date(),
      chalk.dim('log'),
      msgs.reduce((a, b) => a + ' ' + b)
    );
  },
};
