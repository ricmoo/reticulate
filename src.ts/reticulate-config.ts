import os from "os";
import { resolve } from "path";

import { Config } from "./config";

const _config = new Config(resolve(os.homedir(), ".reticulaterc"));

export const config = {
    get: async function(key: string) {
        return await _config.get(key);
    },
    set: async function(key: string, value: null | string) {
        await _config.set(key, value);
    },
    keys: async function() {
        return await _config.keys();
    },
    lock: async function() {
        await _config.lock();
    }
};
