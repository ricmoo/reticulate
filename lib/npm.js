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
exports.computeTarballHash = exports.getPackList = exports.publish = exports.getPackage = exports.getPackageVersions = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = require("path");
const libnpmpublish_1 = require("libnpmpublish");
const semver_1 = __importDefault(require("semver"));
const log_1 = require("./log");
const utils_1 = require("./utils");
const cache = {};
function getPackageInfo(name) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!cache[name]) {
            try {
                const result = yield utils_1.getUrl("http:/" + "/registry.npmjs.org/" + name);
                if (!result.body) {
                    throw new Error(`failed to fetch ${name}`);
                }
                cache[name] = JSON.parse(Buffer.from(result.body).toString("utf8"));
            }
            catch (error) {
                if (error.status === 404) {
                    return null;
                }
                throw error;
            }
        }
        return cache[name] || null;
    });
}
function getPackageVersions(name) {
    return __awaiter(this, void 0, void 0, function* () {
        const infos = yield getPackageInfo(name);
        if (infos == null) {
            return [];
        }
        const versions = Object.keys(infos.versions);
        versions.sort(semver_1.default.compare);
        return versions;
    });
}
exports.getPackageVersions = getPackageVersions;
function getPackage(name, version) {
    return __awaiter(this, void 0, void 0, function* () {
        const infos = yield getPackageInfo(name);
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
exports.getPackage = getPackage;
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
function publish(path, manifest, options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield libnpmpublish_1.publish(path, manifest, options);
        }
        catch (error) {
            // We need an OTP
            if (error.code === "EOTP") {
                const otp = yield log_1.getPrompt(log_1.colorify.bold("Enter OTP: "));
                options.otp = otp.replace(" ", "");
                // Retry with the new OTP
                return yield publish(path, manifest, options);
            }
            throw error;
        }
    });
}
exports.publish = publish;
function getPackList(path) {
    const result = utils_1.run("npm", ["pack", "--json", path, "--dry-run"]);
    if (!result.ok) {
        const error = new Error(`failed to run npm pack: ${name}`);
        error.result = result;
        throw error;
    }
    return JSON.parse(result.stdout)[0].files.map((info) => info.path);
}
exports.getPackList = getPackList;
function computeTarballHash(path) {
    // Sort the files to get a consistent hash
    const files = getPackList(path);
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
exports.computeTarballHash = computeTarballHash;
//# sourceMappingURL=npm.js.map