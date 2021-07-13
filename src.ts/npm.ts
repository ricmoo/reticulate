import crypto from "crypto";
import fs from "fs";
import { dirname, join, resolve } from "path";
import { Writable } from "stream";

import { publish as npmPublish } from "libnpmpublish";
import profile from "npm-profile";
import semver from "semver";
import tar from "tar";

import type { Config } from "./config";
import { getTag } from "./git";
import { colorify, getPassword, getPrompt } from "./log";
import { getUrl, loadJson, normalizeJson, run, sha256 } from "./utils";

export type Package = {
    dependencies: { [ name: string ]: string };
    devDependencies: { [ name: string ]: string };
    name: string;
    version: string;
    tarballHash?: null | string;
    gitHead?: null | string;
//    location: "remote" | "local";
};

export type PackageJson = Record<string, any>

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


class WriteBuffer extends Writable {
    private _data: Array<Buffer>;

    constructor() {
        super();
        this._data = [ ];
    }

    get data(): Buffer {
        switch (this._data.length) {
            case 0:
                return Buffer.from([ ]);
            case 1:
                break;
            default:
                this._data = [ Buffer.concat(this._data) ];
        }
        return this._data[0];
    }

    _write(chunk: Buffer, encoding: string, callback: (error?: Error) => void) {
        this._data.push(Buffer.from(chunk));
        callback();
    }
}

// The `path` must be a folder containing a package.json
async function createTarball(path: string): Promise<{ tarball: Buffer, manifest: PackageJson }> {
    path = resolve(path);

    const manifest = JSON.parse(fs.readFileSync(resolve(path, "package.json")).toString());
    delete manifest.gitHead;
    delete manifest.tarballHash;

    // List of files we need to be executable (in the pkg.bin)
    const bins = Object.keys(manifest.bin || {}).map((filename) => resolve(path, manifest.bin[filename]));

    const now = new Date();

    const writeBuffer = new WriteBuffer();

    const pack = new tar.Pack.Sync({ gzip: true, portable: true });
    pack.pipe(writeBuffer);

    const addFile = (filename: string, content: Buffer) => {
        // Is this file part of pkg.bin?
        const isBin = (bins.indexOf(resolve(path, filename)) !== -1);

        // See: https://github.com/npm/node-tar/issues/143
        const readEntry = new tar.ReadEntry(new tar.Header({
            path: join("package", filename),
            mode: (isBin ? 0o0755: 0o0644),
            size: content.length,
            type: 'File',
            mtime: now,
            uid: 22, //process.getuid(),
            gid: 555, //process.getgid(),
            uname: "reticulate",
            gname: "reticulate"
        }));

        pack.write(readEntry);

        readEntry.write(content);
        readEntry.end(Buffer.alloc((Math.ceil(content.length / 512) * 512) - content.length));
        readEntry.end();
    }

    const hashes: Record<string, string> = {
        "package.json": sha256(Buffer.from(normalizeJson(manifest)))
    };

    const packList = NPM.getPackList(path);
    packList.forEach((filename) => {
        // We include the package.json last (and we loaded it above)
        if (filename === "package.json") { return }

        // Add the file and store its hash to compute the tarballHash
        const content = fs.readFileSync(resolve(path, filename));
        hashes[filename] = sha256(content);
        addFile(filename, content);
    });

    manifest.tarballHash = sha256(Buffer.from("{" + packList.map((filename) => {
        return `${ JSON.stringify(filename) }:"${ hashes[filename] }"`
    }).join(",") + "}"));
    manifest.gitHead = await getTag(path);

    addFile("package.json", Buffer.from(normalizeJson(manifest)));
    pack.end();

    const tarball = writeBuffer.data;

    manifest._id = `${ manifest.name }@${ manifest.version }`

    manifest._integrity = crypto.createHash("sha512").update(tarball).digest("base64");
    manifest._from = "file:"
    manifest._resolved = "/home/reticulate/faux-working";

    (<any>tarball).integrity = manifest._integrity;
    (<any>tarball).resolved = manifest._resolved;;
    (<any>tarball).from = manifest._from;

    return { manifest, tarball };
}

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

    loadPackage(path?: string): Package {
        if (path == null) { path = "./package.json"; }
        const pkg = loadJson(resolve(path));
        return {
            dependencies: (pkg.dependencies || {}),
            devDependencies: (pkg.devDependencies || {}),
            gitHead: pkg.gitHead || null,
            name: pkg.name,
            tarballHash: NPM.computeTarballHash(dirname(path)),
            version: pkg.version,
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

    async publish(path: string): Promise<PackageJson> {
        const npmOptions = await this.#getNpmOptions();
        if (npmOptions == null) { throw new Error("not logged in "); }
        const { options } = npmOptions;

        const { manifest, tarball } = await createTarball(path);
        return _retryOtp(options, async () => {
            await npmPublish(manifest, tarball, options);
            return manifest;
        });
    }

    static getPackList(path: string): Array<string> {
        const result = run("npm", [ "pack", "--json", path, "--dry-run" ]);
        if (!result.ok) {
            const error = new Error(`failed to run npm pack: ${ path }`);
            (<any>error).result = result;
            throw error;
        }
        return JSON.parse(result.stdout)[0].files.map((info: { path: string }) => info.path).sort();
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


    static async createTarball(path: string): Promise<Buffer> {
        return (await createTarball(path)).tarball;
    }

    static async createManifest(path: string): Promise<PackageJson> {
        return (await createTarball(path)).manifest;
    }
}

(async function() {
    const { manifest, tarball } = await createTarball(".");
    console.log("NPM", tarball, manifest);
    //fs.writeFileSync("./test-tarball.tgz", tarball);
})();
