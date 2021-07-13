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
const os_1 = __importDefault(require("os"));
const path_1 = require("path");
const semver_1 = __importDefault(require("semver"));
const config_1 = require("./config");
const log_1 = require("./log");
const npm_1 = require("./npm");
const utils_1 = require("./utils");
function showHelp() {
    console.log("Usage:");
    console.log("   reticulate COMMAND [ OPTIONS ]");
    console.log("");
    console.log("  --help                 Show htis help");
    console.log("  --version              Show version");
    console.log("");
    console.log("Config Commands");
    console.log("  list-keys              List all stored keys");
    console.log("  get-key KEY            Print the encryped value for key");
    console.log("  set-key KEY VALUE      Set the encryped value for key");
    console.log("");
    console.log("Build Commands");
    console.log("  hoist                  Setup root dependencies (from sub-packages)");
    console.log("  ratsnest               Setup sub-package node_modules");
    console.log("  bump [ DIR ... ]       Bump the patch version if changed");
    console.log("    --minor              Bump the minor vesion (always)");
    console.log("    --major              Bump the major vesion (always)");
    console.log("");
    console.log("NPM Commands");
    console.log("  npm-login              Log into NPM");
    console.log("  npm-logins             Show all login sessions");
    console.log("  npm-logout [ ID ... ]  Logout of NPM (default: current)");
    console.log("  publish [ DIR ... ]    Publish a package (default: .)");
    console.log("");
}
const config = new config_1.Config(path_1.resolve(os_1.default.homedir(), ".reticulaterc"));
const npm = new npm_1.NPM(config);
function plural(word, count) {
    return word + ((count === 1) ? "" : "s");
}
function listKeys(args, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const keys = (yield config.keys()).filter((k) => (k !== "_junk"));
        ;
        console.log(`Found ${keys.length} ${plural("key", keys.length)}:`);
        keys.forEach((key) => {
            console.log(` - ${JSON.stringify(key)}`);
        });
        return 0;
    });
}
function getKey(args, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = shiftArgs(args);
        const value = yield config.get(key);
        console.log(`${key}: ${JSON.stringify(value)}`);
        return 0;
    });
}
function setKey(args, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = shiftArgs(args);
        const value = shiftArgs(args);
        yield config.set(key, value);
        return 0;
    });
}
function hoist(args, options) {
    return __awaiter(this, void 0, void 0, function* () {
        throw new Error("not implemented");
    });
}
function ratsnest(args, options) {
    return __awaiter(this, void 0, void 0, function* () {
        throw new Error("not implemented");
    });
}
function bump(args, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (options.minor && options.major) {
            throw new Error("cannot specify --minor and --major");
        }
        if (args.length === 0) {
            const pkg = npm.loadPackage();
            const npmPkg = yield npm.getPackage(pkg.name);
            if (npmPkg == null) {
                throw new Error("package not found on npm");
            }
            if (pkg.tarballHash !== npmPkg.tarballHash) {
                const version = semver_1.default.inc(npmPkg.version, "patch");
                console.log(`changes; need to bump version to ${version}`);
            }
        }
        return 0;
    });
}
function view(args, options) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let i = 0; i < args.length; i++) {
            const name = args[i];
            console.log("TB", npm_1.NPM.computeTarballHash(name));
            const pkg = yield npm.getPackage(name);
            if (!pkg) {
                continue;
            }
            console.log(name);
            console.log(pkg);
        }
        return 0;
    });
}
function npmLogin(args, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield npm.isLoggedIn()) {
            console.log(log_1.colorify.green("Alreay logged in."));
            return 0;
        }
        return ((yield npm.login()) ? 0 : 1);
    });
}
function npmLogins(args, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const logins = yield npm.getLogins();
        if (logins == null) {
            console.log(log_1.colorify.bold("Not logged into NPM (use `reticulate npm-login`)"));
            return 1;
        }
        console.log(log_1.colorify.bold(`Found ${logins.length} login ${plural("token", logins.length)}:`));
        logins.forEach((login) => {
            if (login.current) {
                console.log(log_1.colorify.green(`  ${login.id}   ${utils_1.getDateTime(new Date(login.created))}   * current`));
            }
            else {
                console.log(`  ${login.id}   ${utils_1.getDateTime(new Date(login.created))}`);
            }
        });
        return 0;
    });
}
function npmLogout(args, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const logins = yield npm.getLogins();
        if (logins == null) {
            console.log(log_1.colorify.red("Not logged into NPM (use `reticulate npm-login`)"));
            return 1;
        }
        if (args.length === 0) {
            yield npm.logout();
            console.log(log_1.colorify.bold("Logged out."));
        }
        else {
            const loginLookup = logins.reduce((accum, token) => {
                accum[token.id] = token;
                return accum;
            }, {});
            // Get all matching logouts (separating the current login)
            let current = null;
            const logouts = args.reduce((accum, id) => {
                const login = loginLookup[id];
                if (login == null) {
                    throw new Error(`unknown login: ${id}`);
                }
                if (login.current) {
                    current = login;
                }
                else {
                    accum.push(login);
                }
                return accum;
            }, []);
            // Logout all external logins first (otherwise we'd lose permission to log them out)
            for (let i = 0; i < logouts.length; i++) {
                yield logouts[i].logout();
            }
            if (logouts.length) {
                console.log(`Removed ${logouts.length} external login ${plural("session", logouts.length)}.`);
            }
            // Log out the current login
            if (current) {
                yield current.logout();
                console.log(log_1.colorify.bold("Logged out."));
            }
        }
        return 0;
    });
}
function publish(args, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(yield npm.isLoggedIn())) {
            console.log(log_1.colorify.red("Not logged into NPM (use `reticulate npm-login`)"));
            return 1;
        }
        if (args.length === 0) {
            const manifest = yield npm.publish(".");
            console.log(log_1.colorify.green(`Published ${manifest._id}`));
        }
        return 0;
    });
}
const commands = {
    "list-keys": { func: listKeys, argCount: 0 },
    "get-key": { func: getKey, argCount: 1, args: "KEY" },
    "set-key": { func: setKey, argCount: 2, args: "KEY VALUE" },
    "hoist": { func: hoist, argCount: 0 },
    "ratsnest": { func: ratsnest, argCount: 0 },
    "bump": { func: bump, args: "[ DIR ... ]", flags: ["minor", "major"] },
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
        const args = [];
        const options = {};
        let endOfOptions = false;
        process.argv.slice(2).forEach((arg) => {
            if (arg === "--") {
                endOfOptions = true;
            }
            else if (!endOfOptions && arg.substring(0, 2) === "--") {
                console.log(arg);
                const match = arg.match(/^--([a-z0-9]+)(=(.*))?$/);
                if (match == null) {
                    throw new Error("internal error: null option match");
                }
                if (match[2]) {
                    options[match[1]] = match[3];
                }
                else {
                    options[match[1]] = true;
                }
            }
            else {
                args.push(arg);
            }
        });
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
        Object.keys(options).forEach((key) => {
            const value = options[key];
            if (value === true) {
                if (!command.flags || command.flags.indexOf(key) === -1) {
                    throw new Error(`unknown flag: ${key}`);
                }
                options[key] = "on";
            }
            else {
                if (!command.options || command.options.indexOf(key) === -1) {
                    throw new Error(`unknown option: ${key}`);
                }
            }
        });
        try {
            return yield command.func(args, options);
        }
        catch (error) {
            console.log(`ERROR: ${error.message}`);
            if (debug) {
                console.log(error);
            }
            return 2;
        }
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