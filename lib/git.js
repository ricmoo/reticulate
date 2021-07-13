"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChanges = exports.getStatus = exports.getTag = exports.GitStatus = void 0;
const path_1 = require("path");
const utils_1 = require("./utils");
class GitStatus {
    constructor(line) {
        this.code = line.substring(0, 2);
        let match = line.substring(3).match(/([^" ]+|"([^"\\]|\\.)*")( -> ([^" ]+|"([^"\\]|\\.)*"))?/);
        if (!match) {
            throw new Error(`internal error; parsing ${JSON.stringify(line)}`);
        }
        this.source = unescape(match[1]);
        this.target = match[4] ? unescapeString(match[4]) : null;
    }
}
exports.GitStatus = GitStatus;
// Returns the most recent git commit hash for a given filename
function getTag(filename) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield utils_1.run("git", ["log", "-n", "1", "--", filename]);
        if (!result.ok) {
            throw new Error(`git log error`);
        }
        let log = result.stdout.trim();
        if (!log) {
            return null;
        }
        const hashMatch = log.match(/^commit\s+([0-9a-f]{40})\n/i);
        if (!hashMatch) {
            return null;
        }
        return hashMatch[1];
    });
}
exports.getTag = getTag;
// C escape sequences used in quoted strings
const escapes = {
    "'": 0x27,
    '"': 0x22,
    "?": 0x3f,
    "\\": 0x5c,
    "a": 0x07,
    "b": 0x08,
    "f": 0x0c,
    "n": 0x0a,
    "r": 0x0d,
    "t": 0x09,
    "v": 0x0b,
};
function unescapeString(text) {
    if (text[0] !== '"') {
        return text;
    }
    return text.substring(1, text.length - 1).replace(/\\(.)/g, (all, c) => {
        const repl = escapes[c];
        console.log("repl", c, repl);
        if (!repl) {
            throw new Error(`unknown escape sequence: ${JSON.stringify(c)}`);
        }
        return String.fromCharCode(repl);
    });
}
function getStatus(path) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield utils_1.run("git", ["status", "--porcelain", path]);
        if (!result.ok) {
            throw new Error("git stauts error");
        }
        let status = result.stdout;
        if (!status) {
            return [];
        }
        return status.split("\n").filter((l) => l.trim()).map((l) => (new GitStatus(l)));
    });
}
exports.getStatus = getStatus;
function getChanges(since, path) {
    return __awaiter(this, void 0, void 0, function* () {
        const gitResult = yield utils_1.run("git", ["log", (since + ".."), "--", path_1.resolve(path || ".")]);
        if (!gitResult.ok) {
            console.log(gitResult);
            throw new Error("Error running git log");
        }
        const changes = [];
        gitResult.stdout.split("\n").forEach((line) => {
            if (line.toLowerCase().substring(0, 6) === "commit") {
                changes.push({
                    commit: line.substring(6).trim(),
                    date: "unknown",
                    body: ""
                });
            }
            else if (line.toLowerCase().substring(0, 5) === "date:") {
                changes[changes.length - 1].date = utils_1.getDateTime(new Date(line.substring(5).trim()));
            }
            else if (line.substring(0, 1) === " ") {
                line = line.trim();
                if (line === "") {
                    return;
                }
                changes[changes.length - 1].body += line + " ";
            }
        });
        return changes;
    });
}
exports.getChanges = getChanges;
(function () {
    return __awaiter(this, void 0, void 0, function* () {
        const status = yield getChanges("b12386232820e5ceecc23a5eec53c49faaf223df", ".");
        console.log(status);
    });
})();
//# sourceMappingURL=git.js.map