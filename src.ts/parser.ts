
function count(text: string, chr: string): number {
    return text.length - text.replace(chr, "").length;
}

function repeat(c: string, length: number): string {
  if (c.length === 0) { throw new RangeError("too short"); }
  while (c.length < length) { c += c; }
  return c.substring(0, length);
}

function getWords(text: string): Array<string> {
    if (text[0] === "/") { return [ ]; }
    const words: Array<string> = [ ];
    text.replace(/([a-z]+)/ig, (all: string, word: string) => {
        words.push(word);
        return "";
    });
    return words;
}

export type Chunk = {
    text: string;
    line: number;
};

export function parseJavaScript(code: string): Array<Chunk> {
    //const original = code;
    const result: Array<Chunk> = [ ];

    code = code.replace(/\/\*(.*?)\*\//mg, (all, comment) => {
        return ("  " + repeat(" ", comment.length) + "  ")
    });
    code = code.replace(/\/\/(.*$|.*\n)/mg, (all, comment) => {
        return ("  " + repeat(" ", comment.length))
    });

    let line = 1;

    const quoteReplacer = (all: string, contents: string) => {
        console.log(line, contents);
        getWords(contents).forEach((word) => {
            result.push({ text: word, line });
        });
        return ('#' + repeat("#", contents.length) + '#');
    };

    while (true) {
        const index = code.search(/\/|['"`]/);
        if (index === -1) { break; }

        const prefix = code.substring(0, index);
        line = count(prefix, "\n");

        let chunk = code.substring(index);
        switch(chunk[0]) {
            // Nix regular expressions
            /*
            case "/":
                chunk = chunk.replace(/\/(([^/\\]|\\.)*)\//, (all, contents) => {
                    console.log("RR", contents);
                    return ('#' + repeat("#", contents.length) + '#');
                });
                break;
                */

            case "'":
                chunk = chunk.replace(/'(([^'\\]|\\.)*)'/, quoteReplacer);
                break;
            case '"':
                chunk = chunk.replace(/"(([^"\\]|\\.)*)"/, quoteReplacer);
                break;
            case '`':
                chunk = chunk.replace(/`(([^`\\]|\\.)*)`/, quoteReplacer);
                break;
        }

        const suffix = code.substring(prefix.length + chunk.length);
        code = prefix + chunk + suffix;
    }

    return result;
}

import fs from 'fs';
console.log(parseJavaScript(fs.readFileSync("./src.ts/parser.ts").toString()));
