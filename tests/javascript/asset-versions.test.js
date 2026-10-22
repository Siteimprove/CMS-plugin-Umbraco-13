import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

test("helper imports use the package version to invalidate cached files after upgrades", () => {
    const directory = new URL("../../contentFiles/App_Plugins/Siteimprove/", import.meta.url);
    const { version } = JSON.parse(readFileSync(new URL("umbraco-package.json", directory), "utf8"));
    let imports = 0;
    for (const name of readdirSync(directory).filter(name => name.endsWith(".js"))) {
        const source = readFileSync(new URL(name, directory), "utf8");
        for (const [, path] of source.matchAll(/from "(\.\/[^\"]+)"/g)) {
            assert.equal(new URL(path, directory).searchParams.get("v"), version, name + ": " + path);
            imports++;
        }
    }
    assert.ok(imports > 0);
});
