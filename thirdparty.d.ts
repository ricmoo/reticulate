declare module "aes-js" {
    export class Counter {
        constructor(iv: Uint8Array);
    }

    export namespace ModeOfOperation {
        class cbc{
            constructor(key: Uint8Array, iv: Uint8Array);
            decrypt(data: Uint8Array): Uint8Array;
            encrypt(data: Uint8Array): Uint8Array;
        }

        class ctr{
            constructor(key: Uint8Array, counter: Counter);
            decrypt(data: Uint8Array): Uint8Array;
            encrypt(data: Uint8Array): Uint8Array;
        }
    }

    export namespace padding {
        export namespace pkcs7 {
            export function strip(data: Uint8Array): Uint8Array;
        }
    }
}

declare module "libnpmpublish" {
    export type NpmOptions = Record<string, any>;
    /*
    export type Options = {
        access?: "public" | "restricted";
        npmVersion?: string;
        otp?: string;
        token?: string;
    };
    */

    export function publish(manifest: any, tarData: Buffer, options: NpmOptions): Promise<void>
}

declare module "npm-profile" {
    export type NpmOptions = Record<string, any>;

    export type TokenResult = {
        token: string;
        key: string;
        cidr_whitelist: null | Array<string>;
        created: Date;
        readonly: boolean;
    };

    export type AccountResult = {
        tfa: null | false | { "mode": "auth-only", pending: Boolean } |[ "recovery", "codes" ] | string;
        name: string;
        email: string;
        email_verified: boolean;
        created: Date;
        updated: Date;
        cidr_whitelist: null | Array<string>;
        fullname: string;
        homepage: string;
        freenode: string;
        twitter: string;
        github: string;
    }

    export function loginCouch(username: string, password: string, options?: NpmOptions): Promise<NpmOptions>;

    export function createToken(password: string, noWrite: boolean, cidr_whitelist: Array<string>, options?: NpmOptions): Promise<TokenResult>
    export function listTokens(options?: NpmOptions): Promise<Array<TokenResult>>
    export function removeToken(id: string, options?: NpmOptions): Promise<void>;

    export function get(options?: NpmOptions): Promise<AccountResult>;
}

declare module "tar" {
    import { Writable } from "stream";

    export interface PackOptions {
        cwd?: string;
        gzip?: boolean;
        portable?: boolean;
    }

    export interface HeaderOptions {
       path: string;
       mode: number;
       size: number;
       type: string;
       mtime: Date;
       uid: number;
       gid: number;
       uname: string;
       gname: string;
    }

    export class Header{
        constructor(options: HeaderOptions);
    }

    export class ReadEntry {
        constructor(header: Header);
        write(data: Buffer): void;
        end(pad?: Buffer): void;
    }

    class PackSync {
        constructor(options?: PackOptions);
        write(file: string | ReadEntry): void;
        pipe(stream: Writable): void;
        end(): void;
    }

    export class Pack {
        constructor(options?: PackOptions);
        write(file: string | ReadEntry): void;
        pipe(stream: Writable): void;
        end(): void;

        static Sync: new (options?: PackOptions) => PackSync;
    }
}
