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
exports.getDateTime = exports.run = exports.getUrl = exports.saveJson = exports.loadJson = exports.atomicWrite = exports.stall = exports.sha256 = exports.repeat = void 0;
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const os_1 = __importDefault(require("os"));
const path_1 = require("path");
const url_1 = require("url");
function repeat(char, length) {
    if (char.length === 0) {
        return "";
    }
    let output = char;
    while (output.length < length) {
        output = output + output;
    }
    return output.substring(0, length);
}
exports.repeat = repeat;
function sha256(content) {
    return "0x" + crypto_1.createHash("sha256").update(content).digest("hex");
}
exports.sha256 = sha256;
function stall(duration) {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, duration);
        timer.unref();
    });
}
exports.stall = stall;
function atomicWrite(path, value) {
    const tmp = path_1.resolve(os_1.default.homedir(), ".reticulate-tmp-delete-me");
    fs_1.default.writeFileSync(tmp, value);
    fs_1.default.renameSync(tmp, path);
}
exports.atomicWrite = atomicWrite;
function loadJson(path) {
    return JSON.parse(fs_1.default.readFileSync(path).toString());
}
exports.loadJson = loadJson;
function saveJson(filename, data, sort) {
    let replacer = undefined;
    if (sort) {
        replacer = (key, value) => {
            if (Array.isArray(value)) {
                // pass
            }
            else if (value && typeof (value) === "object") {
                const keys = Object.keys(value);
                keys.sort();
                return keys.reduce((accum, key) => {
                    accum[key] = value[key];
                    return accum;
                }, {});
            }
            return value;
        };
    }
    atomicWrite(filename, JSON.stringify(data, replacer, 2) + "\n");
}
exports.saveJson = saveJson;
function getResponse(request) {
    return new Promise((resolve, reject) => {
        request.once("response", (resp) => {
            const response = {
                statusCode: resp.statusCode || 0,
                statusMessage: resp.statusMessage || "",
                headers: Object.keys(resp.headers).reduce((accum, name) => {
                    let value = resp.headers[name];
                    if (Array.isArray(value)) {
                        value = value.join(", ");
                    }
                    accum[name] = value;
                    return accum;
                }, {}),
                body: null
            };
            //resp.setEncoding("utf8");
            resp.on("data", (chunk) => {
                if (response.body == null) {
                    response.body = new Uint8Array(0);
                }
                const body = new Uint8Array(response.body.length + chunk.length);
                body.set(response.body, 0);
                body.set(chunk, response.body.length);
                response.body = body;
            });
            resp.on("end", () => {
                resolve(response);
            });
            resp.on("error", (error) => {
                /* istanbul ignore next */
                error.response = response;
                reject(error);
            });
        });
        request.on("error", (error) => { reject(error); });
    });
}
// The URL.parse uses null instead of the empty string
function nonnull(value) {
    if (value == null) {
        return "";
    }
    return value;
}
function _getUrl(href, options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (options == null) {
            options = {};
        }
        // @TODO: Once we drop support for node 8, we can pass the href
        //        directly into request and skip adding the components
        //        to this request object
        const url = url_1.parse(href);
        const request = {
            protocol: nonnull(url.protocol),
            hostname: nonnull(url.hostname),
            port: nonnull(url.port),
            path: (nonnull(url.pathname) + nonnull(url.search)),
            method: (options.method || "GET"),
            headers: (options.headers || {}),
        };
        if (options.user && options.password) {
            request.auth = `${options.user}:${options.password}`;
        }
        let req = null;
        switch (nonnull(url.protocol)) {
            case "http:":
                req = http_1.default.request(request);
                break;
            case "https:":
                req = https_1.default.request(request);
                break;
            default:
                /* istanbul ignore next */
                throw new Error(`unsupported protocol ${url.protocol}`);
        }
        if (options.body) {
            req.write(Buffer.from(options.body));
        }
        req.end();
        const response = yield getResponse(req);
        return response;
    });
}
function getUrl(href, options) {
    return __awaiter(this, void 0, void 0, function* () {
        let error = null;
        for (let i = 0; i < 3; i++) {
            try {
                const result = yield Promise.race([
                    _getUrl(href, options),
                    stall(30000).then((result) => { throw new Error("timeout"); })
                ]);
                return result;
            }
            catch (e) {
                error = e;
            }
            yield stall(1000);
        }
        throw error;
    });
}
exports.getUrl = getUrl;
function run(progname, args, currentWorkingDirectory) {
    if (args == null) {
        args = [];
    }
    const options = {};
    if (currentWorkingDirectory) {
        options.cwd = currentWorkingDirectory;
    }
    const child = child_process_1.spawnSync(progname, args, options);
    const result = {
        _stderr: child.stderr,
        stderr: (child.stderr.toString() || null),
        _stdout: child.stdout,
        stdout: child.stdout.toString(),
        status: child.status || 0,
        ok: (child.stderr.length === 0 && child.status === 0)
    };
    if (child.error) {
        (child.error).result = result;
        throw child.error;
    }
    return result;
}
exports.run = run;
function zpad(value, length) {
    if (length == null) {
        length = 2;
    }
    const str = String(value);
    return repeat("0", length - str.length) + str;
}
function getDate(date) {
    return [
        date.getFullYear(),
        zpad(date.getMonth() + 1),
        zpad(date.getDate())
    ].join("-");
}
function getDateTime(date) {
    return getDate(date) + " " + [
        zpad(date.getHours()),
        zpad(date.getMinutes() + 1)
    ].join(":");
}
exports.getDateTime = getDateTime;
//# sourceMappingURL=utils.js.map