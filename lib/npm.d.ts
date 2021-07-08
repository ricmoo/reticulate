import { Options } from "libnpmpublish";
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
export declare function getPackageVersions(name: string): Promise<Array<string>>;
export declare function getPackage(name: string, version?: string): Promise<null | Package>;
export declare function publish(path: string, manifest: any, options: Options): Promise<void>;
export declare function getPackList(path: string): Array<string>;
export declare function computeTarballHash(path: string): string;
