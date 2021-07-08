import { createHmac, randomBytes } from "crypto";
import fs from "fs";
//import os from "os";
//import { resolve } from "path";

import AES from "aes-js";
import scrypt from "scrypt-js";

import { colorify, getPassword, getProgressBar } from "./log";

function computeHmac(key: Uint8Array, data: Uint8Array): Buffer {
    return createHmac("sha512", key, ).update(data).digest();
}

async function getScrypt(message: string, password: string, salt: Uint8Array): Promise<Buffer> {
    const progress = getProgressBar(message);
    return Buffer.from(await scrypt.scrypt(Buffer.from(password), Buffer.from(salt), (1 << 17), 8, 1, 64, progress));
}

export enum ConfigError {
    WRONG_PASSWORD = "wrong password",
    PASSWORD_MISMATCH = "passwords do not match",
    CANCELLED = "cancelled",
};

export class Config {
    private salt: Buffer;
    private canary: string;
    private filename: string;
    private content: null | string;

    // Only available after the config has been decrypted
    private dkey: null | Buffer;
    private values: Record<string, string>;

    constructor(filename: string) {
        this.dkey = null;
        this.values = { };
        this.filename = filename;

        if (fs.existsSync(this.filename)) {
            this.content = fs.readFileSync(this.filename).toString();

            const data = JSON.parse(this.content);

            if (data.version !== "v1") {
                throw new Error(`bad reticulate config; unsupported version`);
            }

            this.canary = data.canary || "";
            try {
                this.salt = Buffer.from(data.salt, "base64");
                if (this.salt.length !== 32) { throw new Error("bad length"); }
            } catch (error) {
                console.log(error);
                throw new Error(`bad reticulate config; invalid salt`);
            }
        } else {
            this.content = null;
            this.canary = "";
            this.salt = randomBytes(32);
        }

    }

    async _verify(prompt: string, progress: string): Promise<Buffer> {
        const password = await getPassword(colorify.bold(prompt));

        const dkey = await getScrypt(colorify.bold(progress), password, this.salt);

        // Existing content, loaded form disk; verify the password is correct
        if (this.content != null) {
            const data = JSON.parse(this.content);

            let error: null | Error = null;
            let current = "unknown";
            try {
                current = "bad ciphertext";
                const ciphertext = Buffer.from(data.ciphertext, "base64");
                current = "bad iv";
                const iv = Buffer.from(data.iv, "base64");
                const aes = new AES.ModeOfOperation.ctr(dkey.slice(0, 32), new AES.Counter(iv));
                const plaintext = aes.decrypt(ciphertext);
                const hmac = computeHmac(dkey.slice(32, 64), plaintext);
                if (hmac.toString("base64") !== data.hmac) {
                    console.log(colorify.red("Incorrect password."));
                    error = new Error(ConfigError.WRONG_PASSWORD);
                    throw error;
                }

                current = "bad encrypted payload";
                this.values = JSON.parse(Buffer.from(plaintext).toString());
            } catch (e) {
                if (error) { throw error; }
                throw new Error(`bad reticulate config; ${ current }`);
            }
        }

        return dkey;
    }

    async load(progress = "Unlocking"): Promise<void> {
        if (this.dkey) { return; }
        this.dkey = await this._verify("Password (config-store): ", progress);
    }

    async verify(): Promise<void> {
        if (this.dkey == null) {
            throw new Error("cannot verify unloaded config");
        }

        const dkey = await this._verify("Confirm Password: ", "Verifying");

        if (dkey.toString("hex") !== this.dkey.toString("hex")) {
            throw new Error(ConfigError.PASSWORD_MISMATCH);
        }
    }

    async keys(): Promise<Array<string>> {
        await this.load();
        return Object.keys(this.values);
    }

    async save(): Promise<void> {
        if (this.dkey == null) {
            throw new Error("cannot save unloaded config");
        }

        this.values._junk = randomBytes(16 + Math.floor(Math.random() * 48)).toString("base64")

        const plaintext = Buffer.from(JSON.stringify(this.values));

        const iv = randomBytes(16);
        const hmac = computeHmac(this.dkey.slice(32, 64), plaintext);

        const aes = new AES.ModeOfOperation.ctr(this.dkey.slice(0, 32), new AES.Counter(iv));
        const ciphertext = Buffer.from(aes.encrypt(plaintext));

        const data = {
            version: "v1",
            ciphertext: ciphertext.toString("base64"),
            iv: iv.toString("base64"),
            salt: this.salt.toString("base64"),
            hmac: hmac.toString("base64"),
            canary: this.canary
        };

        fs.writeFileSync(this.filename, JSON.stringify(data, null, 2));
    }

    async get(key: string): Promise<string> {
        await this.load();
        return this.values[key];
    }

    async set(key: string, value: null | string): Promise<void> {
        if (!this.content) {
            console.log(colorify.green("Creating new Reticulate Config (~/.reticulaterc)"));
        }

        await this.load("Generating");

        if (!this.content) { await this.verify(); }

        if (value == null) {
            delete this.values[key];
        } else {
            this.values[key] = value;
        }

        await this.save();
    }

    lock(): void {
        this.dkey = null;
    }
}

