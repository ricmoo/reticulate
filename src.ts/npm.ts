import crypto from "crypto";
import fs from "fs";
import { resolve } from "path";

import { publish as npmPublish } from "libnpmpublish";
import profile from "npm-profile";
import semver from "semver";

import type { Config } from "./config";
import { colorify, getPassword, getPrompt } from "./log";
import { getUrl, run, sha256 } from "./utils";

export type Package = {
    dependencies: { [ name: string ]: string };
    devDependencies: { [ name: string ]: string };
    name: string;
    version: string;
    tarballHash?: null | string;
    gitHead?: null | string;
//    location: "remote" | "local";
};

export type NpmLogin = {
    id: string;
    created: Date;
    current: boolean;
    logout: () => Promise<void>
};

export type NpmAccount = {
    tfa: boolean,
    name: string;
    email: string;
    created: Date;
};

async function _retryOtp<T>(options: Record<string, any>, func: () => Promise<T>): Promise<T> {
    try {
        return await func();

    } catch (error) {

        // We need an OTP
        if (error.code === "EOTP") {
            const otp = await getPrompt(colorify.bold("Enter OTP: "));
            options.otp = otp.replace(" ", "");

            // Retry with the new OTP
            return await _retryOtp(options, func);
        }

        throw error;
    }
}

export class NPM {
    #cache: Record<string, any> = { };
    #config: Config;

    constructor(config: Config) {
        this.#cache = { };
        this.#config = config;
    }

    async getPackageInfo(name: string): Promise<any> {
        if (!this.#cache[name]) {
            try {
                const result = await getUrl(`http:/\/registry.npmjs.org/${ name }`);
                if (!result.body) { throw new Error(`failed to fetch ${ name }`); }
                this.#cache[name] = JSON.parse(Buffer.from(result.body).toString("utf8"));
            } catch (error) {
                if (error.status === 404) { return null; }
                throw error;
            }
        }
        return this.#cache[name] || null;
    }

    async getPackageVersions(name: string): Promise<Array<string>> {
        const infos = await this.getPackageInfo(name);
        if (infos == null) { return [ ]; }

        const versions = Object.keys(infos.versions);
        versions.sort(semver.compare);
        return versions;
    }

    async getPackage(name: string, version?: string): Promise<null | Package> {
        const infos = await this.getPackageInfo(name);
        if (infos == null) { return null; }

        if (version == null) {
            const versions = Object.keys(infos.versions);
            versions.sort(semver.compare);
            version = versions.pop();
            if (version == null) { throw new Error("internal error; version is null"); }
        }

        const info = infos.versions[version];

        return {
            dependencies: (info.dependencies || {}),
            devDependencies: (info.devDependencies || {}),
            gitHead: info.gitHead || null,
            //location: "remote",
            name: info.name,
            tarballHash: info.tarballHash || null,
            version : info.version,
            //_ethers_nobuild: !!info._ethers_nobuild,
        };
    }

    async #getNpmOptions(): Promise<null | { info: Record<string, any>, options: Record<string, any> }> {
        const options: any = { };

        const npmToken = await this.#config.get("npm-token");
        if (!npmToken) { return null; }

        const token = npmToken.trim().split("=");
        options[token[0]] = token[1];

        return { info: (await profile.get(options)), options };
    }

    async isLoggedIn(): Promise<null | NpmAccount> {
        const npmOptions = await this.#getNpmOptions();
        if (npmOptions == null) { return null; }
        const { info } = npmOptions;
        return {
            tfa: !!info.tfa,
            name: (info.name || ""),
            email: (info.name || ""),
            created: info.created
        };
    }

    async login(): Promise<boolean> {
        if (await this.isLoggedIn()) { return true; }

        const username = await getPrompt("Username (npm): ");
        const password = await getPassword("Password (npm): ");

        try {
            const options = { };
            const result = await _retryOtp(options, async () => {
                return await profile.loginCouch(username, password, options);
            });
            const token = `/\/registry.npmjs.org/:_authToken=${ result.token }`;
            await this.#config.set("npm-token", token);

        } catch (error) {
            if (error.message.match(/Unable to authenticate/i)) {
                console.log(colorify.red("incorrect NPM password"));
            } else if (error.message.match(/no user with the username/i)) {
                console.log(colorify.red("incorrect NPM username"));
            } else {
                throw error;
            }
            return false;
        }

        return true;
    }

    async getLogins(): Promise<null | Array<NpmLogin>> {
        const npmOptions = await this.#getNpmOptions();
        if (npmOptions == null) { return null; }
        const { options } = npmOptions;

        const tokenKey = Object.keys(options).filter((k) => (k.indexOf("_authToken") >= 0))[0] || "_invalid";
        const currentKey = crypto.createHash("sha512").update(options[tokenKey]).digest("hex")

        const tokens = await profile.listTokens(options);
        return tokens.map(({ token, key, created }) => {
            const current = (key === currentKey);
            return {
                id: token,
                created, current,
                logout: (async () => {
                    await profile.removeToken(key, options);
                    if (current) { this.#config.set("npm-token", null); }
                })
            };
        });
    }

    async logout(): Promise<boolean> {
        const logins = await this.getLogins();
        if (logins == null) { return true; }

        const current = logins.filter((l) => l.current);
        if (current.length !== 1) { throw new Error("missing login"); }

        await current.pop()!.logout();

        return true;
    }

    async publish(path: string, manifest: any): Promise<void> {
        const npmOptions = await this.#getNpmOptions();
        if (npmOptions == null) { throw new Error("not logged in "); }
        const { options } = npmOptions;

        return _retryOtp(options, async () => {
            return await npmPublish(path, manifest, options);
        });
    }

    static getPackList(path: string): Array<string> {
        const result = run("npm", [ "pack", "--json", path, "--dry-run" ]);
        if (!result.ok) {
            const error = new Error(`failed to run npm pack: ${ name }`);
            (<any>error).result = result;
            throw error;
        }
        return JSON.parse(result.stdout)[0].files.map((info: { path: string }) => info.path);
    }

    static computeTarballHash(path: string): string {

        // Sort the files to get a consistent hash
        const files = NPM.getPackList(path);
        files.sort();

        // Compute the hash for each file
        const hashes = files.reduce((accum, filename) => {
            let content = fs.readFileSync(resolve(path, filename));

            // The package.json includes the hash, so we need to nix it to get a consistent hash
            if (filename === "package.json") {
                const info = JSON.parse(content.toString());
                delete info.gitHead;
                delete info.tarballHash;
                content = Buffer.from(JSON.stringify(info, null, 2));
            }

            accum[filename] = sha256(content);
            return accum;
        }, <Record<string, string>>{ });

        return sha256(Buffer.from("{" + files.map((filename) => {
            return `${ JSON.stringify(filename) }:"${ hashes[filename] }"`
        }).join(",") + "}"));
    }
}

