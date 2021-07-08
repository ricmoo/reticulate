import { spawnSync } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import http from "http";
import https from "https";
import os from "os";
import { resolve } from "path";
import { parse } from "url"

export type GetUrlResponse = {
    statusCode: number,
    statusMessage: string;
    headers: { [ key: string] : string };
    body: null | Uint8Array;
};

export type GetUrlOptions = {
    method?: string,
    body?: Uint8Array

    headers?: { [ key: string] : string },

    user?: string,
    password?: string,
};


export type RunResult = {
    stderr: string | null;
    _stderr: string | Buffer;

    stdout: string;
    _stdout: string | Buffer;

    status: number;
    ok: boolean;
};



export function repeat(char: string, length: number): string {
    if (char.length === 0) { return ""; }
    let output = char;
    while (output.length < length) { output = output + output; }
    return output.substring(0, length);
}

export function sha256(content: Buffer): string {
    return "0x" + createHash("sha256").update(content).digest("hex");
}

export function stall(duration: number): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, duration);
        timer.unref();
    });
}


export function atomicWrite(path: string, value: string | Uint8Array): void {
    const tmp = resolve(os.homedir(), ".reticulate-tmp-delete-me");
    fs.writeFileSync(tmp, value);
    fs.renameSync(tmp, path);
}

export function loadJson(path: string): any {
    return JSON.parse(fs.readFileSync(path).toString());
}

export function saveJson(filename: string, data: any, sort?: boolean): void {
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

function getResponse(request: http.ClientRequest): Promise<GetUrlResponse> {
    return new Promise((resolve, reject) => {
        request.once("response", (resp: http.IncomingMessage) => {
            const response: GetUrlResponse = {
                statusCode: resp.statusCode || 0,
                statusMessage: resp.statusMessage || "",
                headers: Object.keys(resp.headers).reduce((accum, name) => {
                    let value = resp.headers[name];
                    if (Array.isArray(value)) {
                        value = value.join(", ");
                    }
                    accum[name] = value!;
                    return accum;
                }, <{ [ name: string ]: string }>{ }),
                body: null
            };
            //resp.setEncoding("utf8");

            resp.on("data", (chunk: Uint8Array) => {
                if (response.body == null) { response.body = new Uint8Array(0); }

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
                (<any>error).response = response;
                reject(error);
            });
        });

        request.on("error", (error) => { reject(error); });
    });
}

// The URL.parse uses null instead of the empty string
function nonnull(value: null | string): string {
    if (value == null) { return ""; }
    return value;
}

async function _getUrl(href: string, options?: GetUrlOptions): Promise<GetUrlResponse> {
    if (options == null) { options = { }; }

    // @TODO: Once we drop support for node 8, we can pass the href
    //        directly into request and skip adding the components
    //        to this request object
    const url = parse(href);

    const request: http.ClientRequestArgs = {
        protocol: nonnull(url.protocol),
        hostname: nonnull(url.hostname),
        port: nonnull(url.port),
        path: (nonnull(url.pathname) + nonnull(url.search)),

        method: (options.method || "GET"),
        headers: (options.headers || { }),
    };

    if (options.user && options.password) {
        request.auth = `${ options.user }:${ options.password }`;
    }

    let req: null | http.ClientRequest = null;
    switch (nonnull(url.protocol)) {
        case "http:":
            req = http.request(request);
            break;
        case "https:":
            req = https.request(request);
            break;
        default:
            /* istanbul ignore next */
            throw new Error(`unsupported protocol ${ url.protocol }`);
    }

    if (options.body) {
        req.write(Buffer.from(options.body));
    }
    req.end();

    const response = await getResponse(req);
    return response;
}

export async function getUrl(href: string, options?: GetUrlOptions): Promise<GetUrlResponse> {
    let error: null | Error = null;
    for (let i = 0; i < 3; i++) {
        try {
            const result = await Promise.race([
                _getUrl(href, options),
                stall(30000).then((result) => { throw new Error("timeout") })
            ]);
            return result;
        } catch (e) {
            error = e;
        }
        await stall(1000);
    }
    throw error;
}

export function run(progname: string, args?: Array<string>, currentWorkingDirectory?: string): RunResult {
    if (args == null) { args = [ ]; }

    const options: any = { };
    if (currentWorkingDirectory) { options.cwd = currentWorkingDirectory; }
    const child = spawnSync(progname, args, options);

    const result = {
        _stderr: child.stderr,
        stderr: (child.stderr.toString() || null),
        _stdout: child.stdout,
        stdout: child.stdout.toString(),
        status: child.status || 0,
        ok: (child.stderr.length === 0 && child.status === 0)
    };

    if (child.error) {
        (<any>(child.error)).result = result;
        throw child.error;
    }

    return result;
}

function zpad(value: number, length?: number): string {
    if (length == null) { length = 2; }
    const str = String(value);
    return repeat("0", length - str.length) + str;
}

function getDate(date: Date): string {
    return [
        date.getFullYear(),
        zpad(date.getMonth() + 1),
        zpad(date.getDate())
    ].join("-");
}

export function getDateTime(date: Date): string {
    return getDate(date) + " " + [
        zpad(date.getHours()) ,
        zpad(date.getMinutes() + 1)
    ].join(":");
}
