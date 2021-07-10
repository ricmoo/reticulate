/// <reference types="node" />
export declare type GetUrlResponse = {
    statusCode: number;
    statusMessage: string;
    headers: {
        [key: string]: string;
    };
    body: null | Uint8Array;
};
export declare type GetUrlOptions = {
    method?: string;
    body?: Uint8Array;
    headers?: {
        [key: string]: string;
    };
    user?: string;
    password?: string;
};
export declare type RunResult = {
    stderr: string | null;
    _stderr: string | Buffer;
    stdout: string;
    _stdout: string | Buffer;
    status: number;
    ok: boolean;
};
export declare function repeat(char: string, length: number): string;
export declare function sha256(content: Buffer): string;
export declare function stall(duration: number): Promise<void>;
export declare function atomicWrite(path: string, value: string | Uint8Array): void;
export declare function loadJson(path: string): any;
export declare function normalizeJson(data: any): any;
export declare function saveJson(filename: string, data: any, sort?: boolean): void;
export declare function getUrl(href: string, options?: GetUrlOptions): Promise<GetUrlResponse>;
export declare function run(progname: string, args?: Array<string>, currentWorkingDirectory?: string): RunResult;
export declare function getDateTime(date: Date): string;
