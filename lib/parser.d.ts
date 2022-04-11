export declare type Chunk = {
    text: string;
    line: number;
};
export declare function parseJavaScript(code: string): Array<Chunk>;
