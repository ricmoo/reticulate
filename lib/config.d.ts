/// <reference types="node" />
export declare enum ConfigError {
    WRONG_PASSWORD = "wrong password",
    PASSWORD_MISMATCH = "passwords do not match",
    CANCELLED = "cancelled"
}
export declare class Config {
    private salt;
    private canary;
    private filename;
    private content;
    private dkey;
    private values;
    constructor(filename: string);
    _verify(prompt: string, progress: string): Promise<Buffer>;
    load(progress?: string): Promise<void>;
    verify(): Promise<void>;
    keys(): Promise<Array<string>>;
    save(): Promise<void>;
    get(key: string): Promise<string>;
    set(key: string, value: null | string): Promise<void>;
    lock(): void;
}
