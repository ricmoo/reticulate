import fs from "fs";
import { resolve } from "path";

import { Options, publish as npmPublish } from "libnpmpublish";
import semver from "semver";

import { colorify, getPrompt } from "./log";
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

const cache: Record<string, any> = { };

async function getPackageInfo(name: string): Promise<any> {
    if (!cache[name]) {
        try {
            const result = await getUrl("http:/" + "/registry.npmjs.org/" + name);
            if (!result.body) { throw new Error(`failed to fetch ${ name }`); }
            cache[name] = JSON.parse(Buffer.from(result.body).toString("utf8"));
        } catch (error) {
            if (error.status === 404) { return null; }
            throw error;
        }
    }
    return cache[name] || null;
}

export async function getPackageVersions(name: string): Promise<Array<string>> {
    const infos = await getPackageInfo(name);
    if (infos == null) { return [ ]; }

    const versions = Object.keys(infos.versions);
    versions.sort(semver.compare);
    return versions;
}

export async function getPackage(name: string, version?: string): Promise<null | Package> {
    const infos = await getPackageInfo(name);
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
/*
export function sortRecords(record: Record<string, any>): Record<string, any> {
    const keys = Object.keys(record);
    keys.sort();

    return keys.reduce((accum, name) => {
        accum[name] = record[name];
        return accum;
    }, <Record<string, any>>{ });
}
*/

export async function publish(path: string, manifest: any, options: Options): Promise<void> {
    try {
        await npmPublish(path, manifest, options);

    } catch (error) {

        // We need an OTP
        if (error.code === "EOTP") {
            const otp = await getPrompt(colorify.bold("Enter OTP: "));
            options.otp = otp.replace(" ", "");

            // Retry with the new OTP
            return await publish(path, manifest, options);
        }
        throw error;
    }
}

export function getPackList(path: string): Array<string> {
    const result = run("npm", [ "pack", "--json", path, "--dry-run" ]);
    if (!result.ok) {
        const error = new Error(`failed to run npm pack: ${ name }`);
        (<any>error).result = result;
        throw error;
    }
    return JSON.parse(result.stdout)[0].files.map((info: { path: string }) => info.path);
}

export function computeTarballHash(path: string): string {

    // Sort the files to get a consistent hash
    const files = getPackList(path);
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
