export declare type Config = {
    packages?: string;
    spellCheck?: {
        paths?: Array<string>;
    };
};
export declare class Package {
    #private;
    constructor(path: string);
    get path(): string;
    get name(): string;
    get version(): string;
    get folder(): string;
    get dependencies(): Record<string, string>;
    get devDependencies(): Record<string, string>;
    get typeDependencies(): Record<string, string>;
    get allDependencies(): Record<string, string>;
}
export declare class MonoRepo {
    #private;
    readonly root: string;
    readonly config: Config;
    constructor(root: string);
    get packages(): Array<Package>;
    getPackage(name: string): Package;
    hasPackage(name: string): boolean;
    get depgraph(): Array<Package>;
    createRatsnest(): void;
    updateTsconfig(): void;
    updateVersionConsts(): void;
    checkFiles(): void;
}
