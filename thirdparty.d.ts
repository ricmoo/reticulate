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
    export type Options = {
        access?: "public" | "restricted";
        npmVersion?: string;
        otp?: string;
        token?: string;
    };

    export function publish(path: string, manifest: string, options: Options): Promise<void>
}

declare module "npm-profile" {
    export type NpmOptions = Record<string, any>;

    export type TokenResult = {
        token: string;
        key: string;
        cidr_whitelist: Array<string>;
        created: Date;
        readonly: boolean;
    };

    export type LoginResult = {
        token: string;
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

    export function loginCouch(username: string, password: string, options?: NpmOptions): Promise<LoginResult>;

    export function createToken(password: string, noWrite: boolean, cidr_whitelist: Array<string>, options?: NpmOptions): Promise<TokenResult>
    export function listTokens(options?: NpmOptions): Promise<Array<TokenResult>>
    export function removeToken(id: string, options?: NpmOptions): Promise<void>;

    export function get(options?: NpmOptions): Promise<AccountResult>;
}
