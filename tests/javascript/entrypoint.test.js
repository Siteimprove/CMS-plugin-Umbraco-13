import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../contentFiles/App_Plugins/Siteimprove/entrypoint.js", import.meta.url), "utf8")
    .replace(/^import .*;\n/gm, "").replace(/^export /gm, "");
function setup() {
    const callbacks = [], versions = [], overlays = [], warnings = [], authStates = [], modalStates = [], modalVisibility = [];
    let clears = 0;
    const modalToken = {};
    class Controller {
        consumeContext(token, callback) { if (token === modalToken) { modalStates.push(callback); } else callbacks.push(callback); }
        observe(_observable, callback, alias) { if (alias === "siteimprove-workspace-modals") { modalStates.push(callback); return callback([]); } authStates.push(callback); return callback(true); }
        destroy() {}
    }
    class Api {
        version() { return new Promise((resolve, reject) => versions.push({ resolve, reject })); }
    }
    const context = {
        UmbControllerBase: Controller, UMB_AUTH_CONTEXT: {}, UMB_MODAL_MANAGER_CONTEXT: modalToken, SiteimproveApi: Api,
        assistant: { clear: () => clears++ }, loadOverlay: async version => overlays.push(version),
        initializeVisibility: () => {}, setWorkspaceModalVisibility: value => modalVisibility.push(value),
        console: { warn: message => warnings.push(message) }
    };
    runInNewContext(source + "\nglobalThis.entrypoint = { onInit, onUnload };", context);
    return { ...context.entrypoint, callbacks, versions, overlays, warnings, authStates, modalStates, modalVisibility, clears: () => clears };
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


test("authorization loss on the same context clears the assistant and cancels initialization", async () => {
    const s = setup(); s.onInit({});
    const pending = s.callbacks[0]({});
    await s.authStates[0](false);
    s.versions[0].resolve({ version: "17.7.1" }); await pending;
    assert.equal(s.clears(), 1); assert.deepEqual(s.overlays, []);
});

test("authorization recovery on the same context initializes the assistant", async () => {
    const s = setup(); s.onInit({});
    const first = s.callbacks[0]({});
    s.versions[0].resolve({ version: "17.7.1" }); await first;
    await s.authStates[0](false);
    const recovered = s.authStates[0](true);
    s.versions[1].resolve({ version: "17.7.1" }); await recovered;
    assert.deepEqual(s.overlays, ["17.7.1", "17.7.1"]); assert.equal(s.clears(), 1);
});

test("an obsolete authorization observer cannot initialize or clear a replacement context", async () => {
    const s = setup(); s.onInit({});
    const first = s.callbacks[0]({});
    s.versions[0].resolve({ version: "17.7.1" }); await first;
    const replacement = s.callbacks[0]({});
    s.versions[1].resolve({ version: "17.7.1" }); await replacement;
    await s.authStates[0](false); await s.authStates[0](true);
    assert.equal(s.clears(), 0); assert.equal(s.versions.length, 2);
});

test("obsolete modal observers cannot hide the assistant in a replacement backoffice", () => {
    const s = setup(); s.onInit({}); s.modalStates[0]({ modals: {} });
    const oldObserver = s.modalStates[1];
    s.onInit({});
    const count = s.modalVisibility.length;
    oldObserver([{ alias: "Umb.Modal.Workspace", data: { entityType: "template" } }]);
    assert.equal(s.modalVisibility.length, count);
});
