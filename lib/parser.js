"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJavaScript = void 0;
function count(text, chr) {
    return text.length - text.replace(chr, "").length;
}
function repeat(c, length) {
    if (c.length === 0) {
        throw new RangeError("too short");
    }
    while (c.length < length) {
        c += c;
    }
    return c.substring(0, length);
}
function getWords(text) {
    if (text[0] === "/") {
        return [];
    }
    const words = [];
    text.replace(/([a-z]+)/ig, (all, word) => {
        words.push(word);
        return "";
    });
    return words;
}
function parseJavaScript(code) {
    //const original = code;
    const result = [];
    code = code.replace(/\/\*(.*?)\*\//mg, (all, comment) => {
        return ("  " + repeat(" ", comment.length) + "  ");
    });
    code = code.replace(/\/\/(.*$|.*\n)/mg, (all, comment) => {
        return ("  " + repeat(" ", comment.length));
    });
    let line = 1;
    const quoteReplacer = (all, contents) => {
        console.log(line, contents);
        getWords(contents).forEach((word) => {
            result.push({ text: word, line });
        });
        return ('#' + repeat("#", contents.length) + '#');
    };
    while (true) {
        const index = code.search(/\/|['"`]/);
        if (index === -1) {
            break;
        }
        const prefix = code.substring(0, index);
        line = count(prefix, "\n");
        let chunk = code.substring(index);
        switch (chunk[0]) {
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
exports.parseJavaScript = parseJavaScript;
const fs_1 = __importDefault(require("fs"));
console.log(parseJavaScript(fs_1.default.readFileSync("./src.ts/parser.ts").toString()));
//# sourceMappingURL=parser.js.map