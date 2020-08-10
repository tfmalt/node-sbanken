"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = __importDefault(require("chalk"));
const __date = () => new Date().toJSON();
exports.default = {
    info: (...msgs) => console.info(__date(), chalk_1.default.blue('info'), msgs.reduce((a, b) => a + ' ' + b)),
    debug: (...msgs) => console.debug(__date(), chalk_1.default.green('debug'), msgs.reduce((a, b) => a + ' ' + b)),
    warn: (...msgs) => console.warn(__date(), chalk_1.default.yellow('warning'), msgs.reduce((a, b) => a + ' ' + b)),
    error: (...msgs) => console.error(__date(), chalk_1.default.red('error'), msgs.reduce((a, b) => a + ' ' + b)),
    log: (...msgs) => {
        return console.log(__date(), chalk_1.default.dim('log'), msgs.reduce((a, b) => a + ' ' + b));
    },
};
//# sourceMappingURL=log.js.map