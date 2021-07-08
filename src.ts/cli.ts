#!/usr/bin/env node

import crypto = require("crypto");
import profile from "npm-profile";

import { ConfigError } from "./config";
import { colorify, getPassword, getPrompt } from "./log";
import { computeTarballHash, getPackage } from "./npm";
import { config } from "./reticulate-config";
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

async function listKeys(args: Array<string>): Promise<void> {
    const keys = (await config.keys()).filter((k) => (k !== "_junk"));;
    console.log(`Found ${ keys.length } key${ (keys.length === 1) ? "": "s"}:`);
    keys.forEach((key) => {
        console.log(` - ${ JSON.stringify(key) }`);
    });
}

async function getKey(args: Array<string>): Promise<void> {
    const key = shiftArgs(args);
    const value = await config.get(key);
    console.log(`${ key }: ${ JSON.stringify(value) }`);
}

async function setKey(args: Array<string>): Promise<void> {
    const key = shiftArgs(args);
    const value = shiftArgs(args);
    await config.set(key, value);
}

async function hoist(args: Array<string>): Promise<void> {
    throw new Error("not implemented");
}

async function ratsnest(args: Array<string>): Promise<void> {
    throw new Error("not implemented");
}

async function view(args: Array<string>): Promise<void> {
    for (let i = 0; i < args.length; i++) {
        const name = args[i];
        console.log("TB", computeTarballHash(name));
        const pkg = await getPackage(name);
        if (!pkg) { continue; }
        console.log(name);
        console.log(pkg);
    }
}

async function _getNpmOptions(): Promise<null | any> {
    const options: any = { };

    const npmToken = await config.get("npm-token");
    if (!npmToken) { return null; }

    const token = npmToken.trim().split("=");
    options[token[0]] = token[1];

    //const info = 
    await profile.get(options);
    //console.log(info);

    return options;
}

async function npmLogin(args: Array<string>): Promise<void> {
    const options = await _getNpmOptions();
    if (options) {
        console.log(colorify.green("Alreay logged in."));
        return;
    }

    const username = await getPrompt("Username (npm): ");
    const password = await getPassword("Password (npm): ");

    try {
        const result = await profile.loginCouch(username, password);
        await config.set("npm-token", `/\/registry.npmjs.org/:_authToken=${ result.token }`);
    } catch (error) {
        if (error.message.match(/Unable to authenticate/i)) {
            throw new Error("incorrect NPM password");
        } else if (error.message.match(/no user with the username/i)) {
            throw new Error("incorrect NPM username");
        }
        throw error;
    }
}

async function npmLogins(args: Array<string>): Promise<void> {
    const options = await _getNpmOptions();
    if (options == null) {
        console.log(colorify.bold("Not logged into NPM"));
        return;
    }

    const tokenKey = Object.keys(options).filter((k) => (k.indexOf("_authToken") >= 0))[0] || "_invalid";
    const current = crypto.createHash("sha512").update(options[tokenKey]).digest("hex")

    const tokens = await profile.listTokens(options);
    console.log(colorify.bold(`Found ${ tokens.length } login token${ (tokens.length === 1) ? "": "s" }:`));
    tokens.forEach((token) => {
        if (current === token.key) {
            console.log(colorify.green(`  ${ token.token }   ${ getDateTime(new Date(token.created)) }   * current`));
        } else {
            console.log(`  ${ token.token }   ${ getDateTime(new Date(token.created)) }`);
        }
    });
}

async function npmLogout(args: Array<string>): Promise<void> {
    const options = await _getNpmOptions();
    if (options == null) {
        console.log(colorify.bold("Not logged into NPM"));
        return;
    }

    const tokens = (await profile.listTokens(options)).reduce((accum, token) => {
        accum[token.token] = token.key;
        return accum;
    }, <Record<string, string>>{ });

    const tokenKey = Object.keys(options).filter((k) => (k.indexOf("_authToken") >= 0))[0] || "_invalid";
    const current = crypto.createHash("sha512").update(options[tokenKey]).digest("hex");

    const remove = args.map((k) => (tokens[k] || k));
    if (remove.length === 0) { remove.push(current); }

    for (let i = 0; i < remove.length; i++) {
        await profile.removeToken(remove[i], options);
    }

    if (remove.indexOf(current) >= 0) {
        config.set("npm-token", null);
        const otherCount = remove.length - 1;
        if (otherCount) { console.log(`Removed ${ otherCount } external login session${ (otherCount === 1) ? "": "s" }.`); }
        console.log(colorify.bold("Logged out."));
    } else {
        console.log(`Removed ${ remove.length } external login session${ (remove.length === 1) ? "": "s" }.`);
    }
}

async function publish(args: Array<string>): Promise<void> {
    throw new Error("not implemented");
}

type Command = {
    func: (args: Array<string>) => Promise<void>;
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
        await command.func(args);
    } catch (error) {
        console.log(`ERROR: ${ error.message }`);
        if (debug) { console.log(error); }
        return 2;
    }

    return 0;

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
