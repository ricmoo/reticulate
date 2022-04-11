"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _OrderedSet_instances, _OrderedSet_keys, _OrderedSet_values, _OrderedSet_sort, _Package_path, _Package_pkg, _MonoRepo_packages, _MonoRepo_single;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonoRepo = exports.Package = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = require("path");
const utils_1 = require("./utils");
/**
 * Notes:
 *
 * - Does not currently handle node_modules/.bin
 */
function addWords(path, words) {
    if (fs_1.default.statSync(path).isDirectory()) {
        for (const filename of fs_1.default.readdirSync(path)) {
            addWords(path_1.resolve(path, filename), words);
        }
        return;
    }
    fs_1.default.readFileSync(path).toString().replace(/([a-z]+)/ig, (all, word) => {
        words.push(word.toLowerCase());
        return "";
    });
}
class OrderedSet {
    constructor() {
        _OrderedSet_instances.add(this);
        _OrderedSet_keys.set(this, void 0);
        _OrderedSet_values.set(this, void 0);
        __classPrivateFieldSet(this, _OrderedSet_keys, [], "f");
        __classPrivateFieldSet(this, _OrderedSet_values, {}, "f");
    }
    add(key) {
        __classPrivateFieldGet(this, _OrderedSet_values, "f")[key] = true;
        __classPrivateFieldSet(this, _OrderedSet_keys, null, "f");
    }
    contains(key) {
        return !!__classPrivateFieldGet(this, _OrderedSet_values, "f")[key];
    }
    get length() {
        return __classPrivateFieldGet(this, _OrderedSet_instances, "m", _OrderedSet_sort).call(this).length;
    }
    get(index) {
        return __classPrivateFieldGet(this, _OrderedSet_instances, "m", _OrderedSet_sort).call(this)[index];
    }
}
_OrderedSet_keys = new WeakMap(), _OrderedSet_values = new WeakMap(), _OrderedSet_instances = new WeakSet(), _OrderedSet_sort = function _OrderedSet_sort() {
    if (__classPrivateFieldGet(this, _OrderedSet_keys, "f") != null) {
        return __classPrivateFieldGet(this, _OrderedSet_keys, "f");
    }
    __classPrivateFieldSet(this, _OrderedSet_keys, Object.keys(__classPrivateFieldGet(this, _OrderedSet_values, "f")), "f");
    __classPrivateFieldGet(this, _OrderedSet_keys, "f").sort();
    return __classPrivateFieldGet(this, _OrderedSet_keys, "f");
};
class Package {
    constructor(path) {
        _Package_path.set(this, void 0);
        _Package_pkg.set(this, void 0);
        __classPrivateFieldSet(this, _Package_path, path, "f");
        try {
            __classPrivateFieldSet(this, _Package_pkg, utils_1.loadJson(path_1.resolve(path, "package.json")), "f");
            ;
        }
        catch (error) {
            throw new Error(`missing or bad package.json in ${path}`);
        }
    }
    get path() { return __classPrivateFieldGet(this, _Package_path, "f"); }
    get name() { return __classPrivateFieldGet(this, _Package_pkg, "f").name; }
    get version() { return __classPrivateFieldGet(this, _Package_pkg, "f").version; }
    get folder() { return (this.name.split("/").pop()); }
    get dependencies() {
        return __classPrivateFieldGet(this, _Package_pkg, "f").dependencies || {};
    }
    get devDependencies() {
        return __classPrivateFieldGet(this, _Package_pkg, "f").devDependencies || {};
    }
    get typeDependencies() {
        return (__classPrivateFieldGet(this, _Package_pkg, "f").reticulate || {}).typeDependencies || {};
    }
    get allDependencies() {
        const result = {};
        // @TODO: check versions match, ensure each package exists
        const addDeps = (deps) => {
            for (const key in deps) {
                result[key] = deps[key];
            }
        };
        addDeps(this.dependencies);
        addDeps(this.devDependencies);
        addDeps(this.typeDependencies);
        return result;
    }
}
exports.Package = Package;
_Package_path = new WeakMap(), _Package_pkg = new WeakMap();
class MonoRepo {
    constructor(root) {
        _MonoRepo_packages.set(this, void 0);
        _MonoRepo_single.set(this, void 0);
        this.root = path_1.resolve(root) + "/";
        if (!fs_1.default.statSync(this.root).isDirectory()) {
            throw new Error("not a directory");
        }
        const config = JSON.parse(fs_1.default.readFileSync(path_1.resolve(this.root, "package.json")).toString()).reticulate;
        if (config == null) {
            throw new Error("no reticulate package config found");
        }
        this.config = Object.freeze(Object.assign({}, config));
        // Determine the package folder root (or null for single packages);
        let packageFolder = null;
        if (this.config.packages) {
            packageFolder = path_1.resolve(this.root, this.config.packages);
            if (packageFolder.substring(0, this.root.length) !== this.root) {
                throw new Error("outside of root");
            }
        }
        else {
            packageFolder = path_1.resolve(this.root, "packages");
            if (!fs_1.default.existsSync(packageFolder) || !fs_1.default.statSync(packageFolder).isDirectory()) {
                packageFolder = null;
            }
        }
        __classPrivateFieldSet(this, _MonoRepo_packages, [], "f");
        if (packageFolder) {
            const existing = new Map();
            for (const folder of fs_1.default.readdirSync(packageFolder)) {
                const pkg = new Package(path_1.resolve(packageFolder, folder));
                const exists = existing.get(pkg.folder);
                if (exists) {
                    throw new Error(`duplicate package name: ${pkg.name} in ${folder} and ${exists.path}`);
                }
                existing.set(pkg.folder, pkg);
                __classPrivateFieldGet(this, _MonoRepo_packages, "f").push(pkg);
            }
            __classPrivateFieldSet(this, _MonoRepo_single, false, "f");
        }
        else {
            __classPrivateFieldGet(this, _MonoRepo_packages, "f").push(new Package(this.root));
            __classPrivateFieldSet(this, _MonoRepo_single, true, "f");
        }
    }
    get packages() {
        return __classPrivateFieldGet(this, _MonoRepo_packages, "f").slice();
    }
    getPackage(name) {
        const pkgs = __classPrivateFieldGet(this, _MonoRepo_packages, "f").filter((p) => (p.name === name));
        if (pkgs.length === 1) {
            return pkgs[0];
        }
        throw new Error(`no such package: ${name}`);
    }
    hasPackage(name) {
        try {
            return !!this.getPackage(name);
        }
        catch (error) { }
        ;
        return false;
    }
    // Returns the list of pacakges, with all dependencies for a given package
    // occuring earlier than the package itself
    get depgraph() {
        // Single packages have a flat depgraph
        if (__classPrivateFieldGet(this, _MonoRepo_single, "f")) {
            return this.packages;
        }
        // Maps packages to names to list of dependencies; { [ name:string]: Array<name: string> }
        const deps = {};
        const addDeps = (name, depends) => {
            Object.keys(depends).forEach((dep) => {
                // Not a package we manage
                if (!this.hasPackage(dep)) {
                    return;
                }
                deps[name].add(dep);
            });
        };
        // Get all dependencies
        this.packages.forEach((pkg) => {
            deps[pkg.name] = new OrderedSet();
            addDeps(pkg.name, pkg.dependencies);
            //addDeps(pkg.name, pkg.devDependencies);
        });
        // The ordered package names
        const ordered = [];
        // The remaiing packages to be processed
        const remaining = Object.keys(deps).sort();
        // Returns true if all depndencies for name are included
        const isSatisfied = (name) => {
            for (let i = 0; i < deps[name].length; i++) {
                if (ordered.indexOf(deps[name].get(i)) === -1) {
                    return false;
                }
            }
            return true;
        };
        // Promote any packages that are ready
        while (remaining.length) {
            let bail = true;
            for (let i = 0; i < remaining.length; i++) {
                if (!isSatisfied(remaining[i])) {
                    continue;
                }
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
    createRatsnest() {
        // Single packages do not need a ratsnest
        if (__classPrivateFieldGet(this, _MonoRepo_single, "f")) {
            return;
        }
        // Make a symlink in the ROOT/node_modules to each package in this repo
        this.packages.forEach((pkg) => {
            // e.g. /node_modules/@ethersproject/abi => ../../packages/abi
            {
                const target = path_1.resolve(this.root, "node_modules", pkg.name);
                const relSrc = path_1.relative(path_1.resolve(target, ".."), pkg.path);
                utils_1.link(relSrc, target);
            }
            // e.g. /packages/abi/node_modules => ../../.package_node_modules/abi/
            {
                const target = path_1.resolve(pkg.path, "node_modules");
                const src = path_1.resolve(this.root, ".package_node_modules", pkg.folder);
                const relSrc = path_1.relative(path_1.resolve(target, ".."), src);
                fs_1.default.mkdirSync(src, { recursive: true });
                utils_1.link(relSrc, target);
            }
        });
        // Link each package in the package.json into the .package_node_modules
        this.packages.forEach((pkg) => {
            // /.package_node_modules/abi/foo => ../../node_modules/foo
            // /.package_node_modules/abi/@foo/bar => ../../node_modules/@foo/bar
            const deps = pkg.allDependencies;
            for (const dep in deps) {
                const target = path_1.resolve(this.root, ".package_node_modules", pkg.folder, dep);
                const src = path_1.resolve(this.root, "node_modules", dep);
                const relSrc = path_1.relative(path_1.resolve(target, ".."), src);
                utils_1.link(relSrc, target);
            }
        });
    }
    // Updates the `include` in the tsconfig.json to ensure the build-order
    // builds all dependencies for each package first
    updateTsconfig() {
        // Single package does not use composite pacakges
        if (__classPrivateFieldGet(this, _MonoRepo_single, "f")) {
            return;
        }
        const filename = path_1.resolve(this.root, "tsconfig.project.json");
        const tsconfig = utils_1.loadJson(filename);
        tsconfig.references = this.depgraph.map((pkg) => {
            return { path: ("./" + path_1.relative(this.root, pkg.path)) };
        });
        utils_1.saveJson(filename, tsconfig, true);
    }
    updateVersionConsts() {
        this.packages.forEach((pkg) => {
            const content = `export const version = ${JSON.stringify([pkg.name, pkg.version].join("@"))};`;
            const filename = path_1.resolve(pkg.path, "src.ts/_version.ts");
            if (fs_1.default.readFileSync(filename).toString() !== content) {
                fs_1.default.writeFileSync(filename, content);
            }
        });
    }
    checkFiles() {
        var _a, _b;
        const words = [];
        for (const path of (((_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.spellCheck) === null || _b === void 0 ? void 0 : _b.paths) || [])) {
            addWords(path, words);
        }
        this.packages.forEach((pkg) => {
            //console.log(pkg);
        });
    }
}
exports.MonoRepo = MonoRepo;
_MonoRepo_packages = new WeakMap(), _MonoRepo_single = new WeakMap();
//# sourceMappingURL=monorepo.js.map