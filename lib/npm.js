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
var _NPM_instances, _NPM_cache, _NPM_config, _NPM_getNpmOptions;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NPM = void 0;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = require("path");
const stream_1 = require("stream");
const libnpmpublish_1 = require("libnpmpublish");
const npm_profile_1 = __importDefault(require("npm-profile"));
const semver_1 = __importDefault(require("semver"));
const tar_1 = __importDefault(require("tar"));
const git_1 = require("./git");
const log_1 = require("./log");
const utils_1 = require("./utils");
class WriteBuffer extends stream_1.Writable {
    constructor() {
        super();
        this._data = [];
    }
    get data() {
        switch (this._data.length) {
            case 0:
                return Buffer.from([]);
            case 1:
                break;
            default:
                this._data = [Buffer.concat(this._data)];
        }
        return this._data[0];
    }
    _write(chunk, encoding, callback) {
        this._data.push(Buffer.from(chunk));
        callback();
    }
}
// The `path` must be a folder containing a package.json
function createTarball(path) {
    return __awaiter(this, void 0, void 0, function* () {
        path = path_1.resolve(path);
        const manifest = JSON.parse(fs_1.default.readFileSync(path_1.resolve(path, "package.json")).toString());
        delete manifest.gitHead;
        delete manifest.tarballHash;
        // List of files we need to be executable (in the pkg.bin)
        const bins = Object.keys(manifest.bin || {}).map((filename) => path_1.resolve(path, manifest.bin[filename]));
        const now = new Date();
        const writeBuffer = new WriteBuffer();
        const pack = new tar_1.default.Pack.Sync({ gzip: true, portable: true });
        pack.pipe(writeBuffer);
        const addFile = (filename, content) => {
            // Is this file part of pkg.bin?
            const isBin = (bins.indexOf(path_1.resolve(path, filename)) !== -1);
            // See: https://github.com/npm/node-tar/issues/143
            const readEntry = new tar_1.default.ReadEntry(new tar_1.default.Header({
                path: path_1.join("package", filename),
                mode: (isBin ? 0o0755 : 0o0644),
                size: content.length,
                type: 'File',
                mtime: now,
                uid: 22,
                gid: 555,
                uname: "reticulate",
                gname: "reticulate"
            }));
            pack.write(readEntry);
            readEntry.write(content);
            readEntry.end(Buffer.alloc((Math.ceil(content.length / 512) * 512) - content.length));
            readEntry.end();
        };
        const hashes = {
            "package.json": utils_1.sha256(Buffer.from(utils_1.normalizeJson(manifest)))
        };
        const packList = NPM.getPackList(path);
        packList.forEach((filename) => {
            // We include the package.json last (and we loaded it above)
            if (filename === "package.json") {
                return;
            }
            // Add the file and store its hash to compute the tarballHash
            const content = fs_1.default.readFileSync(path_1.resolve(path, filename));
            hashes[filename] = utils_1.sha256(content);
            addFile(filename, content);
        });
        manifest.tarballHash = utils_1.sha256(Buffer.from("{" + packList.map((filename) => {
            return `${JSON.stringify(filename)}:"${hashes[filename]}"`;
        }).join(",") + "}"));
        manifest.gitHead = yield git_1.getTag(path);
        addFile("package.json", Buffer.from(utils_1.normalizeJson(manifest)));
        pack.end();
        const tarball = writeBuffer.data;
        manifest._id = `${manifest.name}@${manifest.version}`;
        manifest._integrity = crypto_1.default.createHash("sha512").update(tarball).digest("base64");
        manifest._from = "file:";
        manifest._resolved = "/home/reticulate/faux-working";
        tarball.integrity = manifest._integrity;
        tarball.resolved = manifest._resolved;
        ;
        tarball.from = manifest._from;
        return { manifest, tarball };
    });
}
function _retryOtp(options, func) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield func();
        }
        catch (error) {
            // We need an OTP
            if (error.code === "EOTP") {
                const otp = yield log_1.getPrompt(log_1.colorify.bold("Enter OTP: "));
                options.otp = otp.replace(" ", "");
                // Retry with the new OTP
                return yield _retryOtp(options, func);
            }
            throw error;
        }
    });
}
class NPM {
    constructor(config) {
        _NPM_instances.add(this);
        _NPM_cache.set(this, {});
        _NPM_config.set(this, void 0);
        __classPrivateFieldSet(this, _NPM_cache, {}, "f");
        __classPrivateFieldSet(this, _NPM_config, config, "f");
    }
    getPackageInfo(name) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!__classPrivateFieldGet(this, _NPM_cache, "f")[name]) {
                try {
                    const result = yield utils_1.getUrl(`http:/\/registry.npmjs.org/${name}`);
                    if (!result.body) {
                        throw new Error(`failed to fetch ${name}`);
                    }
                    __classPrivateFieldGet(this, _NPM_cache, "f")[name] = JSON.parse(Buffer.from(result.body).toString("utf8"));
                }
                catch (error) {
                    if (error.status === 404) {
                        return null;
                    }
                    throw error;
                }
            }
            return __classPrivateFieldGet(this, _NPM_cache, "f")[name] || null;
        });
    }
    getPackageVersions(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const infos = yield this.getPackageInfo(name);
            if (infos == null) {
                return [];
            }
            const versions = Object.keys(infos.versions);
            versions.sort(semver_1.default.compare);
            return versions;
        });
    }
    getPackage(name, version) {
        return __awaiter(this, void 0, void 0, function* () {
            const infos = yield this.getPackageInfo(name);
            if (infos == null) {
                return null;
            }
            if (version == null) {
                const versions = Object.keys(infos.versions);
                versions.sort(semver_1.default.compare);
                version = versions.pop();
                if (version == null) {
                    throw new Error("internal error; version is null");
                }
            }
            const info = infos.versions[version];
            return {
                dependencies: (info.dependencies || {}),
                devDependencies: (info.devDependencies || {}),
                gitHead: info.gitHead || null,
                //location: "remote",
                name: info.name,
                tarballHash: info.tarballHash || null,
                version: info.version,
                //_ethers_nobuild: !!info._ethers_nobuild,
            };
        });
    }
    loadPackage(path) {
        if (path == null) {
            path = "./package.json";
        }
        const pkg = utils_1.loadJson(path_1.resolve(path));
        return {
            dependencies: (pkg.dependencies || {}),
            devDependencies: (pkg.devDependencies || {}),
            gitHead: pkg.gitHead || null,
            name: pkg.name,
            tarballHash: NPM.computeTarballHash(path_1.dirname(path)),
            version: pkg.version,
        };
    }
    isLoggedIn() {
        return __awaiter(this, void 0, void 0, function* () {
            const npmOptions = yield __classPrivateFieldGet(this, _NPM_instances, "m", _NPM_getNpmOptions).call(this);
            if (npmOptions == null) {
                return null;
            }
            const { info } = npmOptions;
            return {
                tfa: !!info.tfa,
                name: (info.name || ""),
                email: (info.name || ""),
                created: info.created
            };
        });
    }
    login() {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.isLoggedIn()) {
                return true;
            }
            const username = yield log_1.getPrompt("Username (npm): ");
            const password = yield log_1.getPassword("Password (npm): ");
            try {
                const options = {};
                const result = yield _retryOtp(options, () => __awaiter(this, void 0, void 0, function* () {
                    return yield npm_profile_1.default.loginCouch(username, password, options);
                }));
                const token = `/\/registry.npmjs.org/:_authToken=${result.token}`;
                yield __classPrivateFieldGet(this, _NPM_config, "f").set("npm-token", token);
            }
            catch (error) {
                if (error.message.match(/Unable to authenticate/i)) {
                    console.log(log_1.colorify.red("incorrect NPM password"));
                }
                else if (error.message.match(/no user with the username/i)) {
                    console.log(log_1.colorify.red("incorrect NPM username"));
                }
                else {
                    throw error;
                }
                return false;
            }
            return true;
        });
    }
    getLogins() {
        return __awaiter(this, void 0, void 0, function* () {
            const npmOptions = yield __classPrivateFieldGet(this, _NPM_instances, "m", _NPM_getNpmOptions).call(this);
            if (npmOptions == null) {
                return null;
            }
            const { options } = npmOptions;
            const tokenKey = Object.keys(options).filter((k) => (k.indexOf("_authToken") >= 0))[0] || "_invalid";
            const currentKey = crypto_1.default.createHash("sha512").update(options[tokenKey]).digest("hex");
            const tokens = yield npm_profile_1.default.listTokens(options);
            return tokens.map(({ token, key, created }) => {
                const current = (key === currentKey);
                return {
                    id: token,
                    created, current,
                    logout: (() => __awaiter(this, void 0, void 0, function* () {
                        yield npm_profile_1.default.removeToken(key, options);
                        if (current) {
                            __classPrivateFieldGet(this, _NPM_config, "f").set("npm-token", null);
                        }
                    }))
                };
            });
        });
    }
    logout() {
        return __awaiter(this, void 0, void 0, function* () {
            const logins = yield this.getLogins();
            if (logins == null) {
                return true;
            }
            const current = logins.filter((l) => l.current);
            if (current.length !== 1) {
                throw new Error("missing login");
            }
            yield current.pop().logout();
            return true;
        });
    }
    publish(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const { manifest, tarball } = yield createTarball(path);
            const npmOptions = yield __classPrivateFieldGet(this, _NPM_instances, "m", _NPM_getNpmOptions).call(this);
            if (npmOptions == null) {
                throw new Error("not logged in ");
            }
            const { options } = npmOptions;
            if (manifest.publishConfig) {
                if (manifest.publishConfig.access) {
                    options.access = manifest.publishConfig.access;
                }
                if (manifest.publishConfig.tag) {
                    options.tag = manifest.publishConfig.tag;
                }
            }
            return _retryOtp(options, () => __awaiter(this, void 0, void 0, function* () {
                yield libnpmpublish_1.publish(manifest, tarball, options);
                return manifest;
            }));
        });
    }
    static getPackList(path) {
        const result = utils_1.run("npm", ["pack", "--json", path, "--dry-run"]);
        if (!result.ok) {
            const error = new Error(`failed to run npm pack: ${path}`);
            error.result = result;
            throw error;
        }
        return JSON.parse(result.stdout)[0].files.map((info) => info.path).sort();
    }
    static computeTarballHash(path) {
        // Sort the files to get a consistent hash
        const files = NPM.getPackList(path);
        files.sort();
        // Compute the hash for each file
        const hashes = files.reduce((accum, filename) => {
            let content = fs_1.default.readFileSync(path_1.resolve(path, filename));
            // The package.json includes the hash, so we need to nix it to get a consistent hash
            if (filename === "package.json") {
                const info = JSON.parse(content.toString());
                delete info.gitHead;
                delete info.tarballHash;
                content = Buffer.from(JSON.stringify(info, null, 2));
            }
            accum[filename] = utils_1.sha256(content);
            return accum;
        }, {});
        return utils_1.sha256(Buffer.from("{" + files.map((filename) => {
            return `${JSON.stringify(filename)}:"${hashes[filename]}"`;
        }).join(",") + "}"));
    }
    static createTarball(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield createTarball(path)).tarball;
        });
    }
    static createManifest(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield createTarball(path)).manifest;
        });
    }
}
exports.NPM = NPM;
_NPM_cache = new WeakMap(), _NPM_config = new WeakMap(), _NPM_instances = new WeakSet(), _NPM_getNpmOptions = function _NPM_getNpmOptions() {
    return __awaiter(this, void 0, void 0, function* () {
        const options = {};
        const npmToken = yield __classPrivateFieldGet(this, _NPM_config, "f").get("npm-token");
        if (!npmToken) {
            return null;
        }
        const token = npmToken.trim().split("=");
        options[token[0]] = token[1];
        return { info: (yield npm_profile_1.default.get(options)), options };
    });
};
//# sourceMappingURL=npm.js.map