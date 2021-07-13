export declare class GitStatus {
    code: string;
    source: string;
    target: null | string;
    constructor(line: string);
}
export declare type GitChange = {
    body: string;
    commit: string;
    date: string;
};
export declare function getTag(filename: string): Promise<null | string>;
export declare function getStatus(path: string): Promise<Array<GitStatus>>;
export declare function getChanges(since: string, path?: string): Promise<Array<GitChange>>;
