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
exports.Config = exports.ConfigError = void 0;
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
//import os from "os";
//import { resolve } from "path";
const aes_js_1 = __importDefault(require("aes-js"));
const scrypt_js_1 = __importDefault(require("scrypt-js"));
const log_1 = require("./log");
function computeHmac(key, data) {
    return crypto_1.createHmac("sha512", key).update(data).digest();
}
function getScrypt(message, password, salt) {
    return __awaiter(this, void 0, void 0, function* () {
        const progress = log_1.getProgressBar(message);
        return Buffer.from(yield scrypt_js_1.default.scrypt(Buffer.from(password), Buffer.from(salt), (1 << 17), 8, 1, 64, progress));
    });
}
var ConfigError;
(function (ConfigError) {
    ConfigError["WRONG_PASSWORD"] = "wrong password";
    ConfigError["PASSWORD_MISMATCH"] = "passwords do not match";
    ConfigError["CANCELLED"] = "cancelled";
})(ConfigError = exports.ConfigError || (exports.ConfigError = {}));
;
class Config {
    constructor(filename) {
        this.dkey = null;
        this.values = {};
        this.filename = filename;
        if (fs_1.default.existsSync(this.filename)) {
            this.content = fs_1.default.readFileSync(this.filename).toString();
            const data = JSON.parse(this.content);
            if (data.version !== "v1") {
                throw new Error(`bad reticulate config; unsupported version`);
            }
            this.canary = data.canary || "";
            try {
                this.salt = Buffer.from(data.salt, "base64");
                if (this.salt.length !== 32) {
                    throw new Error("bad length");
                }
            }
            catch (error) {
                console.log(error);
                throw new Error(`bad reticulate config; invalid salt`);
            }
        }
        else {
            this.content = null;
            this.canary = "";
            this.salt = crypto_1.randomBytes(32);
        }
    }
    _verify(prompt, progress) {
        return __awaiter(this, void 0, void 0, function* () {
            const password = yield log_1.getPassword(log_1.colorify.bold(prompt));
            const dkey = yield getScrypt(log_1.colorify.bold(progress), password, this.salt);
            // Existing content, loaded form disk; verify the password is correct
            if (this.content != null) {
                const data = JSON.parse(this.content);
                let error = null;
                let current = "unknown";
                try {
                    current = "bad ciphertext";
                    const ciphertext = Buffer.from(data.ciphertext, "base64");
                    current = "bad iv";
                    const iv = Buffer.from(data.iv, "base64");
                    const aes = new aes_js_1.default.ModeOfOperation.ctr(dkey.slice(0, 32), new aes_js_1.default.Counter(iv));
                    const plaintext = aes.decrypt(ciphertext);
                    const hmac = computeHmac(dkey.slice(32, 64), plaintext);
                    if (hmac.toString("base64") !== data.hmac) {
                        console.log(log_1.colorify.red("Incorrect password."));
                        error = new Error(ConfigError.WRONG_PASSWORD);
                        throw error;
                    }
                    current = "bad encrypted payload";
                    this.values = JSON.parse(Buffer.from(plaintext).toString());
                }
                catch (e) {
                    if (error) {
                        throw error;
                    }
                    throw new Error(`bad reticulate config; ${current}`);
                }
            }
            return dkey;
        });
    }
    load(progress = "Unlocking") {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.dkey) {
                return;
            }
            this.dkey = yield this._verify("Password (config-store): ", progress);
        });
    }
    verify() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.dkey == null) {
                throw new Error("cannot verify unloaded config");
            }
            const dkey = yield this._verify("Confirm Password: ", "Verifying");
            if (dkey.toString("hex") !== this.dkey.toString("hex")) {
                throw new Error(ConfigError.PASSWORD_MISMATCH);
            }
        });
    }
    keys() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.load();
            return Object.keys(this.values);
        });
    }
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.dkey == null) {
                throw new Error("cannot save unloaded config");
            }
            this.values._junk = crypto_1.randomBytes(16 + Math.floor(Math.random() * 48)).toString("base64");
            const plaintext = Buffer.from(JSON.stringify(this.values));
            const iv = crypto_1.randomBytes(16);
            const hmac = computeHmac(this.dkey.slice(32, 64), plaintext);
            const aes = new aes_js_1.default.ModeOfOperation.ctr(this.dkey.slice(0, 32), new aes_js_1.default.Counter(iv));
            const ciphertext = Buffer.from(aes.encrypt(plaintext));
            const data = {
                version: "v1",
                ciphertext: ciphertext.toString("base64"),
                iv: iv.toString("base64"),
                salt: this.salt.toString("base64"),
                hmac: hmac.toString("base64"),
                canary: this.canary
            };
            fs_1.default.writeFileSync(this.filename, JSON.stringify(data, null, 2));
        });
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.load();
            return this.values[key];
        });
    }
    set(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.content) {
                console.log(log_1.colorify.green("Creating new Reticulate Config (~/.reticulaterc)"));
            }
            yield this.load("Generating");
            if (!this.content) {
                yield this.verify();
            }
            if (value == null) {
                delete this.values[key];
            }
            else {
                this.values[key] = value;
            }
            yield this.save();
        });
    }
    lock() {
        this.dkey = null;
    }
}
exports.Config = Config;
//# sourceMappingURL=config.js.map