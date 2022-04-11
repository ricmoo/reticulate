/**
 *  bootstrap-hoist
 *
 *  This should be added to the root of your Reticulate MonoRepo
 *  folder and added as a `preinstall` step.
 *
 *  It scans all packages for the MonoRepo and overwrites the
 *  root package.json dependencies with the dependencies of all
 *  packages, so that the `npm install` machinery just works.
 *
 *  Note: This OVERWRITES the root pacakge.json `dependencies`. You
 *        should only use the `devDependencies` in the root package.json
 */
import fs from "fs";
import { resolve } from "path";

const root = resolve(".");

function loadJson(path: string): any {
    return JSON.parse(fs.readFileSync(path).toString());
}

function atomicWrite(path: string, value: string | Uint8Array): void {
    const tmp = resolve(root, ".atomic-tmp");
    fs.writeFileSync(tmp, value);
    fs.renameSync(tmp, path);
}

function saveJson(filename: string, data: any, sort?: boolean): any {

    let replacer: undefined | ((key: string, value: any) => any) = undefined;
    if (sort) {
        replacer = (key, value) => {
            if (Array.isArray(value)) {
                // pass
            } else if (value && typeof(value) === "object") {
                const keys = Object.keys(value);
                keys.sort();
                return keys.reduce((accum, key) => {
                    accum[key] = value[key];
                    return accum;
                }, <Record<string, any>>{});
            }
            return value;
        };
    }

    atomicWrite(filename, JSON.stringify(data, replacer, 2) + "\n");
}

(function(filename) {
    const pkg = loadJson(filename);
    const packageFolder = (pkg.reticulate || { }).pacakges || "packages";

    {
      // @TODO: Check within root
    }

    const pkgs: Record<string, Record<string, string>> = fs.readdirSync(packageFolder).reduce((accum, folder) => {
        const pkg = loadJson(resolve(root, packageFolder, folder, "package.json"));
        if (accum[pkg.name]) { throw new Error(`duplicate package named ${ pkg.name }`); }
        accum[pkg.name] = pkg.dependencies || { };
        return accum;
    }, <Record<string, Record<string, string>>>{ });

    const result: Record<string, string> = { };
    Object.keys(pkgs).forEach((name) => {
        const versions = pkgs[name];
        for (const dep in versions) {

            // This package is managed by this monorepo
            if (dep in pkgs) { continue; }

            // The required dependency version
            const ver = versions[dep];

            // This already exists in the result...
            const existing = result[dep];
            if (existing) {
                // ...but doesn't match
                if (existing !== ver) {
                    throw new Error(`package dependency version mismatch: ${ dep }`);
                }
            } else {
                result[dep] = ver;
            }
        }
    });

    console.log(`Hoisting ${ Object.keys(result).length } dependencies from ${ packageFolder }/*/package.json...\n`);

    pkg.dependencies = result;
    saveJson(filename, pkg, true);

})(resolve(root, "package.json"));

