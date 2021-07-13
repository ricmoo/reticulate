import { getDateTime, repeat } from "./utils";

// A Linker will receive two types of links:
// - starting with a `#`, which can be used to link to issues or PRs
// - starting with an `@`, which can be used to link to commits
export type Linker = (target: string) => null | string;

export class Version {
    readonly items: Array<string>;

    constructor(public name: string, public version: string, public date: string, items: Array<string>) {
        this.items = items.slice();
    }

    get title(): string {
        return `${ this.name}/${ this.version } (${ this.date })`;
    }
}

export class ChangeLog {
    title: string;
    banner: string;
    versions: Array<Version>;

    constructor(title: string, banner: string, versions: Array<Version>) {
        this.title = title;
        this.banner = banner;
        this.versions = versions.slice();
    }

    addVersion(name: string, version: string, items: Array<string>): Version {
        const newVersion = new Version(name, version, getDateTime(), items)
        this.versions.unshift(newVersion);
        return newVersion;
    }

    getItemString(text: string, linker?: Linker): string {
        // @TODO: replace (#BLAH...). with links, if there is a () of # add the change, otherwise add (change)
        return text;
    }

    markdown(): string {
        let output = [ this.title, repeat("=", this.title.length), "" ];
        if (this.banner) {
            output.push(this.banner);
            output.push("");
        }

        this.versions.forEach((version) => {
            output.push(version.title);
            output.push(repeat('-', version.title.length));
            output.push("");
            version.items.forEach((item) => {
                item.split("\n").forEach((line, index) => {
                    output.push("  " + ((index === 0) ? "- ": "  ") + line);
                });
            });
            output.push("");
        });

        return output.join("\n");
    }

    static from(text: string): ChangeLog {
        let title = "";
        let banner = "";
        let versions: Array<Version> = [ ];

        const lines = text.trim().split("\n");
        if (lines.length === 0) { throw new Error("empty changelog"); }

        let lastLine = lines[0];
        for (let i = 1; i <= lines.length; i++) {
            // We intentionally go past the end by 1, and put a blank
            // line in to simplify the state machine, which examines
            // the current line to process the previous
            let line = lines[i] || "";

            if (line.match(/^==+\s*$/)) {
                // A line after a ====== heading (title)

                // Check a title makes sense and that it's ok
                if (title) { throw new Error("too many titles"); }
                if (!lastLine.trim()) { throw new Error("cannot have an empty title"); }
                title = lastLine.trim();
                line = "";

            } else if (line.match(/^--+\s*$/)) {
                // A line after a ------ heading (version heading)

                // Check the heading is ok
                if (!lastLine.trim()) { throw new Error("cannot have an empty version heading"); }
                const match = lastLine.trim().match(/^([^/]+)\/(v?[0-9.]+) \(([0-9: -]+)\)$/);
                console.log(match);
                if (!match) { throw new Error(`unsupported version title: ${ JSON.stringify(lastLine.trim()) }`); }
                versions.push(new Version(match[1], match[2], match[3], [ ]));
                line = "";

            } else if (versions.length === 0) {
                // Still inside the banner
                if (title) { banner += "\n" + lastLine; }

            } else if (lastLine.trim()) {
                const version = versions[versions.length - 1];
                const item = lastLine.trim();
                if (item.substring(0, 2) === "- ") {
                    version.items.push(item.substring(2).trim());
                } else {
                    if (version.items.length === 0) { throw new Error("stray version content without an item"); }
                    version.items[version.items.length - 1] += "\n" + item.trim();
                }
            }

            lastLine = line;
        }

        if (!title) { throw new Error("invalid changelog"); }

        return new ChangeLog(title, banner.trim(), versions);
    }
}
