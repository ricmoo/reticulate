export declare const config: {
    get: (key: string) => Promise<string>;
    set: (key: string, value: null | string) => Promise<void>;
    keys: () => Promise<string[]>;
    lock: () => Promise<void>;
};
