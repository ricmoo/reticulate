#!/usr/bin/env node

import os from "os";
import { resolve } from "path";

import { Config, ConfigError } from "./config";
import { colorify } from "./log";
import type { NpmLogin } from "./npm";
import { NPM } from "./npm";
import { getDateTime } from "./utils";

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

const config = new Config(resolve(os.homedir(), ".reticulaterc"));
const npm = new NPM(config);

function plural(word: string, count: number): string {
    return word + ((count === 1) ? "": "s");
}

async function listKeys(args: Array<string>): Promise<number> {
    const keys = (await config.keys()).filter((k) => (k !== "_junk"));;
    console.log(`Found ${ keys.length } ${ plural("key", keys.length) }:`);
    keys.forEach((key) => {
        console.log(` - ${ JSON.stringify(key) }`);
    });
    return 0;
}

async function getKey(args: Array<string>): Promise<number> {
    const key = shiftArgs(args);
    const value = await config.get(key);
    console.log(`${ key }: ${ JSON.stringify(value) }`);
    return 0;
}

async function setKey(args: Array<string>): Promise<number> {
    const key = shiftArgs(args);
    const value = shiftArgs(args);
    await config.set(key, value);
    return 0;
}

async function hoist(args: Array<string>): Promise<number> {
    throw new Error("not implemented");
}

async function ratsnest(args: Array<string>): Promise<number> {
    throw new Error("not implemented");
}

async function view(args: Array<string>): Promise<number> {
    for (let i = 0; i < args.length; i++) {
        const name = args[i];
        console.log("TB", NPM.computeTarballHash(name));
        const pkg = await npm.getPackage(name);
        if (!pkg) { continue; }
        console.log(name);
        console.log(pkg);
    }
    return 0;
}

async function npmLogin(args: Array<string>): Promise<number> {
   if (await npm.isLoggedIn()) {
        console.log(colorify.green("Alreay logged in."));
        return 0;
    }
    return ((await npm.login()) ? 0: 1);
}

async function npmLogins(args: Array<string>): Promise<number> {
    const logins = await npm.getLogins();
    if (logins == null) {
        console.log(colorify.bold("Not logged into NPM (use `reticulate npm-login`)"));
        return 1;
    }

    console.log(colorify.bold(`Found ${ logins.length } login ${ plural("token", logins.length) }:`));

    logins.forEach((login) => {
        if (login.current) {
            console.log(colorify.green(`  ${ login.id }   ${ getDateTime(new Date(login.created)) }   * current`));
        } else {
            console.log(`  ${ login.id }   ${ getDateTime(new Date(login.created)) }`);
        }
    });

    return 0;
}

async function npmLogout(args: Array<string>): Promise<number> {
    const logins = await npm.getLogins();
    if (logins == null) {
        console.log(colorify.bold("Not logged into NPM (use `reticulate login`)"));
        return 1;
    }

    if (args.length === 0) {
        await npm.logout();
        console.log(colorify.bold("Logged out."));

    } else {
        const loginLookup = logins.reduce((accum, token) => {
            accum[token.id] = token;
            return accum;
        }, <Record<string, NpmLogin>>{ });

        // Get all matching logouts (separating the current login)
        let current: null | NpmLogin = null;
        const logouts = args.reduce((accum, id) => {
            const login = loginLookup[id];
            if (login == null) { throw new Error(`unknown login: ${ id }`); }

            if (login.current) {
                current = login;
            } else {
                accum.push(login);
            }

            return accum;
        }, <Array<NpmLogin>>[ ])

        // Logout all external logins first (otherwise we'd lose permission to log them out)
        for (let i = 0; i < logouts.length; i++) {
            await logouts[i].logout();
        }
        if (logouts.length) { console.log(`Removed ${ logouts.length } external login ${ plural("session", logouts.length) }.`); }

        // Log out the current login
        if (current) {
            await (<NpmLogin>current).logout();
            console.log(colorify.bold("Logged out."));
        }
    }

    return 0;
}

async function publish(args: Array<string>): Promise<number> {
   if (await npm.isLoggedIn()) {
        console.log(colorify.green("Alreay logged in."));
        return 1;
    }

    if (args.length === 0) {
        await npm.publish(".");
    }

    return 0;
}

type Command = {
    func: (args: Array<string>) => Promise<number>;
    argCount?: number;
    args?: string;
};

const commands: Record<string, Command> = {
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

function shiftArgs(args: Array<string>): string {
    const result = args.shift();
    if (result == null) { throw new Error("missing argument"); }
    return result;
}

function checkArgs(args: Array<string>, key: string): boolean {
    const index = args.indexOf(key);
    if (index === -1) { return false; }
    args.splice(index, 1);
    return true;
}

let debug = false;
(async function() {
    const args = process.argv.slice(2);

    debug = checkArgs(args, "--debug");

    if (checkArgs(args, "--version")) {
        console.log("show version");
        return 0;
    } else if (checkArgs(args, "--help") || args.length === 0) {
        showHelp();
        return 0;
    }

    const cmd = shiftArgs(args);
    const command = commands[cmd];
    if (!command) { throw new Error(`unknown command: ${ JSON.stringify(cmd) }`); }

    if (command.argCount != null) {
        if (args.length !== command.argCount) {
            if (args.length === 0) {
                throw new Error(`unexpected argument: ${ cmd }`);
            } else if (command.args) {
                throw new Error(`invalid arguments: ${ cmd } ${ command.args }`);
           }
           throw new Error(`invalid arguments: ${ cmd } requires exactly ${ command.argCount } arguments`);
        }
    }

    try {
        return await command.func(args);
    } catch (error) {
        console.log(`ERROR: ${ error.message }`);
        if (debug) { console.log(error); }
        return 2;
    }

})().then((status) => {
    if (status !== 0) { process.exit(status); }
}, (error) => {
    switch (error.message) {
        case ConfigError.WRONG_PASSWORD:
            console.log(colorify.bold("Wrong password"));
            break;
        case ConfigError.CANCELLED:
            break;
        default:
            console.log(`ERROR: ${ error.message }`);
            throw error;
    }
    if (debug) { console.log(error); }
    process.exit(1);
});
