import { resolve } from "path";

import { getDateTime, run } from "./utils";

export class GitStatus {
    code: string;
    source: string;
    target: null | string;
    constructor(line: string) {
        this.code = line.substring(0, 2);

        let match = line.substring(3).match(/([^" ]+|"([^"\\]|\\.)*")( -> ([^" ]+|"([^"\\]|\\.)*"))?/);
        if (!match) { throw new Error(`internal error; parsing ${ JSON.stringify(line) }`); }

        this.source = unescape(match[1]);
        this.target = match[4] ? unescapeString(match[4]): null;
    }
}

export type GitChange = {
    body: string;
    commit: string;
    date: string;
};

// Returns the most recent git commit hash for a given filename
export async function getTag(filename: string): Promise<null | string> {
    const result = await run("git", [ "log", "-n", "1", "--", filename ]);
    if (!result.ok) { throw new Error(`git log error`); }

    let log = result.stdout.trim();
    if (!log) { return null; }

    const hashMatch = log.match(/^commit\s+([0-9a-f]{40})\n/i);
    if (!hashMatch) { return null; }
    return hashMatch[1];
}

// C escape sequences used in quoted strings
const escapes: Record<string, number> = {
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

function unescapeString(text: string): string {
    if (text[0] !== '"') { return text; }
    return text.substring(1, text.length - 1).replace(/\\(.)/g, (all, c) => {
        const repl = escapes[c];
        console.log("repl", c, repl);
        if (!repl) { throw new Error(`unknown escape sequence: ${ JSON.stringify(c) }`); }
        return String.fromCharCode(repl);
    });
}

export async function getStatus(path: string): Promise<Array<GitStatus>> {
    const result = await run("git", [ "status", "--porcelain", path]);
    if (!result.ok) { throw new Error("git stauts error"); }

   let status = result.stdout;
   if (!status) { return [ ]; }

   return status.split("\n").filter((l) => l.trim()).map((l) => (new GitStatus(l)));
}

export async function getChanges(since: string, path?: string): Promise<Array<GitChange>> {
    const gitResult = await run("git", [ "log", (since + ".."), "--", resolve(path || ".") ]);

    if (!gitResult.ok) {
        console.log(gitResult);
        throw new Error("Error running git log");
    }

    const changes: Array<GitChange> = [ ];

    gitResult.stdout.split("\n").forEach((line) => {
        if (line.toLowerCase().substring(0, 6) === "commit") {
            changes.push({
                commit: line.substring(6).trim(),
                date: "unknown",
                body: ""
            });

        } else if (line.toLowerCase().substring(0, 5) === "date:") {
            changes[changes.length - 1].date = getDateTime(new Date(line.substring(5).trim()));

        } else if (line.substring(0, 1) === " ") {
            line = line.trim();
            if (line === "") { return; }
            changes[changes.length - 1].body += line + " ";
        }
    });

    return changes;
}

