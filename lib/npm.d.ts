/// <reference types="node" />
import type { Config } from "./config";
export declare type Package = {
    dependencies: {
        [name: string]: string;
    };
    devDependencies: {
        [name: string]: string;
    };
    name: string;
    version: string;
    tarballHash?: null | string;
    gitHead?: null | string;
};
export declare type PackageJson = Record<string, any>;
export declare type NpmLogin = {
    id: string;
    created: Date;
    current: boolean;
    logout: () => Promise<void>;
};
export declare type NpmAccount = {
    tfa: boolean;
    name: string;
    email: string;
    created: Date;
};
export declare class NPM {
    #private;
    constructor(config: Config);
    getPackageInfo(name: string): Promise<any>;
    getPackageVersions(name: string): Promise<Array<string>>;
    getPackage(name: string, version?: string): Promise<null | Package>;
    loadPackage(path?: string): Package;
    isLoggedIn(): Promise<null | NpmAccount>;
    login(): Promise<boolean>;
    getLogins(): Promise<null | Array<NpmLogin>>;
    logout(): Promise<boolean>;
    publish(path: string): Promise<PackageJson>;
    static getPackList(path: string): Array<string>;
    static computeTarballHash(path: string): string;
    static createTarball(path: string): Promise<Buffer>;
    static createManifest(path: string): Promise<PackageJson>;
}
