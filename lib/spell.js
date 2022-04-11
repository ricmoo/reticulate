"use strict";
//import { walk } from "./utils.js";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spellCheck = exports.asciiCheck = void 0;
//import type { MonoRepo } from "./monorepo.js";
function asciiCheck(text) {
    /*
    const files: Array<string> = [];
    args.forEach((path) => { walk(resolve(path), files); });
    files.forEach((filename) => {
        const data = fs.readFileSync(filename);
        for (let i = 0; i < data.length; i++) {
            if (data[i] & 0x80) { throw new Error("non-ascii"); }
        }
    });
    */
}
exports.asciiCheck = asciiCheck;
function spellCheck(text) {
    //const words: Array<string> = [ ];
    //const monorepo = new MonoRepo("");
}
exports.spellCheck = spellCheck;
//# sourceMappingURL=spell.js.map