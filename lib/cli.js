#!/usr/bin/env node
"use strict";
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
const crypto = require("crypto");
const npm_profile_1 = __importDefault(require("npm-profile"));
const config_1 = require("./config");
const log_1 = require("./log");
const npm_1 = require("./npm");
const reticulate_config_1 = require("./reticulate-config");
const utils_1 = require("./utils");
function showHelp() {
    console.log("Usage:");
    console.log("   reticulate COMMAND [ OPTIONS ]");
    console.log("");
    console.log("  --help             Show htis help");
    console.log("  --version          Show version");
    console.log("");
    console.log("Config Commands");
    console.log("  list-keys          List all stored keys");
    console.log("  get-key KEY        Print the encryped value for key");
    console.log("  set-key KEY VALUE  Set the encryped value for key");
    console.log("");
}
function listKeys(args) {
    return __awaiter(this, void 0, void 0, function* () {
        const keys = (yield reticulate_config_1.config.keys()).filter((k) => (k !== "_junk"));
        ;
        console.log(`Found ${keys.length} key${(keys.length === 1) ? "" : "s"}:`);
        keys.forEach((key) => {
            console.log(` - ${JSON.stringify(key)}`);
        });
    });
}
function getKey(args) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = shiftArgs(args);
        const value = yield reticulate_config_1.config.get(key);
        console.log(`${key}: ${JSON.stringify(value)}`);
    });
}
function setKey(args) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = shiftArgs(args);
        const value = shiftArgs(args);
        yield reticulate_config_1.config.set(key, value);
    });
}
function hoist(args) {
    return __awaiter(this, void 0, void 0, function* () {
        throw new Error("not implemented");
    });
}
function ratsnest(args) {
    return __awaiter(this, void 0, void 0, function* () {
        throw new Error("not implemented");
    });
}
function view(args) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let i = 0; i < args.length; i++) {
            const name = args[i];
            console.log("TB", npm_1.computeTarballHash(name));
            const pkg = yield npm_1.getPackage(name);
            if (!pkg) {
                continue;
            }
            console.log(name);
            console.log(pkg);
        }
    });
}
function _getNpmOptions() {
    return __awaiter(this, void 0, void 0, function* () {
        const options = {};
        const npmToken = yield reticulate_config_1.config.get("npm-token");
        if (!npmToken) {
            return null;
        }
        const token = npmToken.trim().split("=");
        options[token[0]] = token[1];
        //const info = 
        yield npm_profile_1.default.get(options);
        //console.log(info);
        return options;
    });
}
function npmLogin(args) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = yield _getNpmOptions();
        if (options) {
            console.log(log_1.colorify.green("Alreay logged in."));
            return;
        }
        const username = yield log_1.getPrompt("Username (npm): ");
        const password = yield log_1.getPassword("Password (npm): ");
        try {
            const result = yield npm_profile_1.default.loginCouch(username, password);
            yield reticulate_config_1.config.set("npm-token", `/\/registry.npmjs.org/:_authToken=${result.token}`);
        }
        catch (error) {
            if (error.message.match(/Unable to authenticate/i)) {
                throw new Error("incorrect NPM password");
            }
            else if (error.message.match(/no user with the username/i)) {
                throw new Error("incorrect NPM username");
            }
            throw error;
        }
    });
}
function npmLogins(args) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = yield _getNpmOptions();
        if (options == null) {
            console.log(log_1.colorify.bold("Not logged into NPM"));
            return;
        }
        const tokenKey = Object.keys(options).filter((k) => (k.indexOf("_authToken") >= 0))[0] || "_invalid";
        const current = crypto.createHash("sha512").update(options[tokenKey]).digest("hex");
        const tokens = yield npm_profile_1.default.listTokens(options);
        console.log(log_1.colorify.bold(`Found ${tokens.length} login token${(tokens.length === 1) ? "" : "s"}:`));
        tokens.forEach((token) => {
            if (current === token.key) {
                console.log(log_1.colorify.green(`  ${token.token}   ${utils_1.getDateTime(new Date(token.created))}   * current`));
            }
            else {
                console.log(`  ${token.token}   ${utils_1.getDateTime(new Date(token.created))}`);
            }
        });
    });
}
function npmLogout(args) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = yield _getNpmOptions();
        if (options == null) {
            console.log(log_1.colorify.bold("Not logged into NPM"));
            return;
        }
        const tokens = (yield npm_profile_1.default.listTokens(options)).reduce((accum, token) => {
            accum[token.token] = token.key;
            return accum;
        }, {});
        const tokenKey = Object.keys(options).filter((k) => (k.indexOf("_authToken") >= 0))[0] || "_invalid";
        const current = crypto.createHash("sha512").update(options[tokenKey]).digest("hex");
        const remove = args.map((k) => (tokens[k] || k));
        if (remove.length === 0) {
            remove.push(current);
        }
        for (let i = 0; i < remove.length; i++) {
            yield npm_profile_1.default.removeToken(remove[i], options);
        }
        if (remove.indexOf(current) >= 0) {
            reticulate_config_1.config.set("npm-token", null);
            const otherCount = remove.length - 1;
            if (otherCount) {
                console.log(`Removed ${otherCount} external login session${(otherCount === 1) ? "" : "s"}.`);
            }
            console.log(log_1.colorify.bold("Logged out."));
        }
        else {
            console.log(`Removed ${remove.length} external login session${(remove.length === 1) ? "" : "s"}.`);
        }
    });
}
function publish(args) {
    return __awaiter(this, void 0, void 0, function* () {
        throw new Error("not implemented");
    });
}
const commands = {
    "list-keys": { func: listKeys, argCount: 0 },
    "get-key": { func: getKey, argCount: 1, args: "KEY" },
    "set-key": { func: setKey, argCount: 2, args: "KEY VALUE" },
    "hoist": { func: hoist, argCount: 0 },
    "ratsnest": { func: ratsnest, argCount: 0 },
    "view": { func: view, args: "PATH [ PATH ... ]" },
    "npm-login": { func: npmLogin, argCount: 0 },
    "npm-logins": { func: npmLogins, argCount: 0 },
    "npm-logout": { func: npmLogout },
    "publish": { func: publish, args: "PATH [ PATH ... ]" },
};
function shiftArgs(args) {
    const result = args.shift();
    if (result == null) {
        throw new Error("missing argument");
    }
    return result;
}
function checkArgs(args, key) {
    const index = args.indexOf(key);
    if (index === -1) {
        return false;
    }
    args.splice(index, 1);
    return true;
}
let debug = false;
(function () {
    return __awaiter(this, void 0, void 0, function* () {
        const args = process.argv.slice(2);
        debug = checkArgs(args, "--debug");
        if (checkArgs(args, "--version")) {
            console.log("show version");
            return 0;
        }
        else if (checkArgs(args, "--help") || args.length === 0) {
            showHelp();
            return 0;
        }
        const cmd = shiftArgs(args);
        const command = commands[cmd];
        if (!command) {
            throw new Error(`unknown command: ${JSON.stringify(cmd)}`);
        }
        if (command.argCount != null) {
            if (args.length !== command.argCount) {
                if (args.length === 0) {
                    throw new Error(`unexpected argument: ${cmd}`);
                }
                else if (command.args) {
                    throw new Error(`invalid arguments: ${cmd} ${command.args}`);
                }
                throw new Error(`invalid arguments: ${cmd} requires exactly ${command.argCount} arguments`);
            }
        }
        try {
            yield command.func(args);
        }
        catch (error) {
            console.log(`ERROR: ${error.message}`);
            if (debug) {
                console.log(error);
            }
            return 2;
        }
        return 0;
    });
})().then((status) => {
    if (status !== 0) {
        process.exit(status);
    }
}, (error) => {
    switch (error.message) {
        case config_1.ConfigError.WRONG_PASSWORD:
            console.log(log_1.colorify.bold("Wrong password"));
            break;
        case config_1.ConfigError.CANCELLED:
            break;
        default:
            console.log(`ERROR: ${error.message}`);
            throw error;
    }
    if (debug) {
        console.log(error);
    }
    process.exit(1);
});
//# sourceMappingURL=cli.js.map