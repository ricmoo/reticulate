import fs from "fs";
import { relative, resolve } from "path";
import { link, loadJson, saveJson } from "./utils";

/**
 * Notes:
 *
 * - Does not currently handle node_modules/.bin
 */

function addWords(path: string, words: Array<string>): void {
    if (fs.statSync(path).isDirectory()) {
        for (const filename of fs.readdirSync(path)) {
            addWords(resolve(path, filename), words);
        }
        return;
    }

    fs.readFileSync(path).toString().replace(/([a-z]+)/ig, (all, word) => {
        words.push(word.toLowerCase());
        return "";
    });
}

class OrderedSet {
    #keys: null | Array<string>;
    #values: Record<string, boolean>

    constructor() {
        this.#keys = [ ];
        this.#values = { };
    }

    add(key: string): void {
        this.#values[key] = true;
        this.#keys = null;
    }

    contains(key: string): boolean {
        return !!this.#values[key];
    }

    #sort(): Array<string> {
        if (this.#keys != null) { return this.#keys; }
        this.#keys = Object.keys(this.#values);
        this.#keys.sort();
        return this.#keys;
    }

    get length(): number {
        return this.#sort().length;
    }

    get(index: number): string {
        return this.#sort()[index];
    }
}

export type Config = {
    packages?: string;
    spellCheck?: {
        paths?: Array<string>
    }
};

export class Package {
    readonly #path: string;
    readonly #pkg: Record<string, any>;

    constructor(path: string) {
        this.#path = path;

        try {
            this.#pkg = loadJson(resolve(path, "package.json"));;
        } catch (error) {
            throw new Error(`missing or bad package.json in ${ path }`);
        }
    }

    get path(): string { return this.#path; }
    get name(): string { return this.#pkg.name; }
    get version(): string { return this.#pkg.version; }

    get folder(): string { return <string>(this.name.split("/").pop()); }

    get dependencies(): Record<string, string> {
        return this.#pkg.dependencies || { };
    }
    get devDependencies(): Record<string, string> {
        return this.#pkg.devDependencies || { };
    }
    get typeDependencies(): Record<string, string> {
        return (this.#pkg.reticulate || { }).typeDependencies || { };
    }

    get allDependencies(): Record<string, string> {
        const result: Record<string, string> = { };
        // @TODO: check versions match, ensure each package exists
        const addDeps = (deps: Record<string, string>) => {
            for (const key in deps) { result[key] = deps[key]; }
        };

        addDeps(this.dependencies);
        addDeps(this.devDependencies);
        addDeps(this.typeDependencies);

        return result;
    }
}

export class MonoRepo {
    // the folder the monorepo is in; with a / suffix
    readonly root: string;

    // The `reticulate` configuration in the root package.json
    readonly config: Config;

    readonly #packages: Array<Package>;
    readonly #single: boolean;

    constructor(root: string) {
        this.root = resolve(root) + "/";
        if (!fs.statSync(this.root).isDirectory()) {
            throw new Error("not a directory");
        }

        const config = JSON.parse(fs.readFileSync(resolve(this.root, "package.json")).toString()).reticulate;
        if (config == null) { throw new Error("no reticulate package config found"); }
        this.config = Object.freeze(Object.assign({}, config));

        // Determine the package folder root (or null for single packages);
        let packageFolder: null | string = null;
        if (this.config.packages) {
            packageFolder = resolve(this.root, this.config.packages);
            if (packageFolder.substring(0, this.root.length) !== this.root) {
                throw new Error("outside of root");
            }
        } else {
            packageFolder = resolve(this.root, "packages");
            if (!fs.existsSync(packageFolder) || !fs.statSync(packageFolder).isDirectory()) {
                packageFolder = null;
            }
        }

        this.#packages = [ ];

        if (packageFolder) {
            const existing: Map<string, Package> = new Map();
            for (const folder of fs.readdirSync(packageFolder)) {
                const pkg = new Package(resolve(packageFolder, folder));
                const exists = existing.get(pkg.folder);
                if (exists) {
                    throw new Error(`duplicate package name: ${ pkg.name } in ${ folder } and ${ exists.path }`);
                }
                existing.set(pkg.folder, pkg);
                this.#packages.push(pkg);
            }
            this.#single = false;
        } else {
            this.#packages.push(new Package(this.root));
            this.#single = true;
        }
    }

    get packages(): Array<Package> {
        return this.#packages.slice();
    }

    getPackage(name: string): Package {
        const pkgs = this.#packages.filter((p) => (p.name === name));
        if (pkgs.length === 1) { return pkgs[0]; }
        throw new Error(`no such package: ${ name }`);
    }

    hasPackage(name: string): boolean {
        try {
            return !!this.getPackage(name);
        } catch(error){ };
        return false;
    }

    // Returns the list of pacakges, with all dependencies for a given package
    // occuring earlier than the package itself
    get depgraph(): Array<Package> {
        // Single packages have a flat depgraph
        if (this.#single) { return this.packages; }

        // Maps packages to names to list of dependencies; { [ name:string]: Array<name: string> }
        const deps: Record<string, OrderedSet> = { };

        const addDeps = (name: string, depends: Record<string, string>) => {
            Object.keys(depends).forEach((dep) => {
                // Not a package we manage
                if (!this.hasPackage(dep)) { return; }
                deps[name].add(dep);
            });
        }

        // Get all dependencies
        this.packages.forEach((pkg) => {
            deps[pkg.name] = new OrderedSet();
            addDeps(pkg.name, pkg.dependencies);
            //addDeps(pkg.name, pkg.devDependencies);
        });

        // The ordered package names
        const ordered: Array<string> = [ ];

        // The remaiing packages to be processed
        const remaining = Object.keys(deps).sort();

        // Returns true if all depndencies for name are included
        const isSatisfied = (name: string) => {
            for (let i = 0; i < deps[name].length; i++) {
                if (ordered.indexOf(deps[name].get(i)) === -1) { return false; }
            }
            return true;
        }

        // Promote any packages that are ready
        while (remaining.length) {
            let bail = true;
            for (let i = 0; i < remaining.length; i++) {
                if (!isSatisfied(remaining[i])) { continue; }
                bail = false;
                ordered.push(remaining[i]);
                remaining.splice(i, 1);
                break;
            }

            if (bail) {
                throw new Error("Nothing processed; circular dependencies...");
            }
        }

        return ordered.map((name) => this.getPackage(name));
    }

    // Writes to disk, creating or updating files

    // Creates the mess of relative symlinks required to make this monorepo work
    createRatsnest(): void {

        // Single packages do not need a ratsnest
        if (this.#single) { return; }

        // Make a symlink in the ROOT/node_modules to each package in this repo
        this.packages.forEach((pkg) => {

            // e.g. /node_modules/@ethersproject/abi => ../../packages/abi
            {
                const target = resolve(this.root, "node_modules", pkg.name);
                const relSrc = relative(resolve(target, ".."), pkg.path);
                link(relSrc, target);
            }

            // e.g. /packages/abi/node_modules => ../../.package_node_modules/abi/
            {
                const target = resolve(pkg.path, "node_modules");
                const src = resolve(this.root, ".package_node_modules", pkg.folder);
                const relSrc = relative(resolve(target, ".."), src);
                fs.mkdirSync(src, { recursive: true });
                link(relSrc, target);
            }
        });

        // Link each package in the package.json into the .package_node_modules
        this.packages.forEach((pkg) => {
            // /.package_node_modules/abi/foo => ../../node_modules/foo
            // /.package_node_modules/abi/@foo/bar => ../../node_modules/@foo/bar

            const deps = pkg.allDependencies;
            for (const dep in deps) {
                const target = resolve(this.root, ".package_node_modules", pkg.folder, dep);
                const src = resolve(this.root, "node_modules", dep);
                const relSrc = relative(resolve(target, ".."), src);
                link(relSrc, target);
            }
        });
    }

    // Updates the `include` in the tsconfig.json to ensure the build-order
    // builds all dependencies for each package first
    updateTsconfig(): void {
        // Single package does not use composite pacakges
        if (this.#single) { return; }

        const filename = resolve(this.root, "tsconfig.project.json");
        const tsconfig = loadJson(filename);
        tsconfig.references = this.depgraph.map((pkg) => {
            return { path: ("./" + relative(this.root, pkg.path)) };
        });
        saveJson(filename, tsconfig, true);
    }

    updateVersionConsts(): void {
        this.packages.forEach((pkg) => {
            const content = `export const version = ${ JSON.stringify([ pkg.name, pkg.version ].join("@")) };`
            const filename = resolve(pkg.path, "src.ts/_version.ts");
            if (fs.readFileSync(filename).toString() !== content) {
                 fs.writeFileSync(filename, content);
            }
        });
    }

    checkFiles(): void {
        const words: Array<string> = [ ];
        for (const path of (this.config?.spellCheck?.paths || [ ])) {
            addWords(path, words);
        }

        this.packages.forEach((pkg) => {
            //console.log(pkg);
        });
    }
}
