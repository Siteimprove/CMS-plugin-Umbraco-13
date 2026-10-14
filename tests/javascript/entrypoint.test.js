import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../contentFiles/App_Plugins/Siteimprove/entrypoint.js", import.meta.url), "utf8")
    .replace(/^import .*;\n/gm, "").replace(/^export /gm, "");
function setup() {
    const callbacks = [], versions = [], overlays = [], warnings = [];
    let clears = 0;
    class Controller {
        consumeContext(_token, callback) { callbacks.push(callback); }
        destroy() {}
    }
    class Api {
        version() { return new Promise((resolve, reject) => versions.push({ resolve, reject })); }
    }
    const context = {
        UmbControllerBase: Controller, UMB_AUTH_CONTEXT: {}, SiteimproveApi: Api,
        assistant: { clear: () => clears++ }, loadOverlay: async version => overlays.push(version),
        initializeVisibility: () => {},
        console: { warn: message => warnings.push(message) }
    };
    runInNewContext(source + "\nglobalThis.entrypoint = { onInit, onUnload };", context);
    return { ...context.entrypoint, callbacks, versions, overlays, warnings, clears: () => clears };
}

test("unloading while version is loading prevents late overlay initialization", async () => {
    const s = setup(); s.onInit({});
    const pending = s.callbacks[0]({});
    s.onUnload(); s.versions[0].resolve({ version: "17.7.1" }); await pending;
    assert.deepEqual(s.overlays, []); assert.equal(s.clears(), 1);
});

test("the outer preview shell does not initialize a second assistant", () => {
    const s = setup();
    s.onInit({ getHostElement: () => ({ localName: "umb-preview" }) });
    assert.deepEqual(s.callbacks, []);
    assert.deepEqual(s.overlays, []);
});

test("a new backoffice instance supersedes an old initialization", async () => {
    const s = setup(); s.onInit({});
    const old = s.callbacks[0]({});
    s.onInit({}); const current = s.callbacks[1]({});
    s.versions[1].resolve({ version: "17.7.1" }); await current;
    s.versions[0].resolve({ version: "old" }); await old;
    assert.deepEqual(s.overlays, ["17.7.1"]);
});

test("losing authentication clears the assistant and invalidates pending initialization", async () => {
    const s = setup(); s.onInit({}); const pending = s.callbacks[0]({});
    await s.callbacks[0](undefined);
    s.versions[0].resolve({ version: "17.7.1" }); await pending;
    assert.deepEqual(s.overlays, []); assert.equal(s.clears(), 1);
});

test("failures from an unloaded instance produce no stale warning", async () => {
    const s = setup(); s.onInit({}); const pending = s.callbacks[0]({});
    s.onUnload(); s.versions[0].reject(new Error("request cancelled")); await pending;
    assert.deepEqual(s.warnings, []);
});
