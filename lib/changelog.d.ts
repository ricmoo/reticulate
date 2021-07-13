export declare type Linker = (target: string) => null | string;
export declare class Version {
    name: string;
    version: string;
    date: string;
    readonly items: Array<string>;
    constructor(name: string, version: string, date: string, items: Array<string>);
    get title(): string;
}
export declare class ChangeLog {
    title: string;
    banner: string;
    versions: Array<Version>;
    constructor(title: string, banner: string, versions: Array<Version>);
    addVersion(name: string, version: string, items: Array<string>): Version;
    getItemString(text: string, linker?: Linker): string;
    markdown(): string;
    static from(text: string): ChangeLog;
}
