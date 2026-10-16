import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../contentFiles/App_Plugins/Siteimprove/document-context.js", import.meta.url), "utf8")
    .replace(/^import .*;\n/gm, "").replace(/^export class /gm, "class ")
    .replace(/^export \{.*\};\n/gm, "");
function setup() {
    const authToken = {}, workspaceToken = {}, callbacks = new Map(), selections = [], releases = [], registrations = [], suspensions = [];
    let observations = 0;
    const emissions = [], authStates = [], eligibility = [];
    class Context {
        consumeContext(token, callback) { callbacks.set(token, callback); }
        observe(_observable, callback, alias) {
            if (alias === "siteimprove-authorization") { authStates.push(callback); callback(true); return; }
            observations++; emissions.push(callback); callback(["doc", false, {}, []]);
        }
        destroy() {}
    }
    const context = {
        UmbContextBase: Context, UMB_AUTH_CONTEXT: authToken, UMB_DOCUMENT_WORKSPACE_CONTEXT: workspaceToken,
        SiteimproveApi: class {}, observeMultiple: values => values,
        assistant: { register: (owner, isEligible) => { registrations.push(owner); eligibility.push(isEligible); }, suspend: owner => suspensions.push(owner),
            select: (...args) => selections.push(args), release: owner => releases.push(owner) }
    };
    runInNewContext(source + "\nglobalThis.Context = SiteimproveDocumentContext;", context);
    return {
        instance: new context.Context({}), selections, releases, registrations, suspensions, emissions, authStates, observations: () => observations,
        isEligible: () => eligibility[0](),
        auth: value => callbacks.get(authToken)(value), workspace: value => callbacks.get(workspaceToken)(value)
    };
}

test("a queued context callback after teardown cannot observe disposed workspace data", () => {
    const s = setup(); s.instance.destroy();
    s.auth({});
    s.workspace({ get unique() { throw new Error("Disposed workspace"); } });
    assert.equal(s.observations(), 0); assert.deepEqual(s.selections, []);
});

test("teardown releases the document owner and prevents later selections", () => {
    const s = setup(); s.auth({});
    s.workspace({ unique: {}, isNew: {}, persistedData: {}, splitView: { activeVariantsInfo: {} } });
    assert.equal(s.selections.length, 1);
    const owner = s.selections[0][0]; s.instance.destroy();
    assert.equal(s.releases.at(-1), owner);
    s.auth({}); assert.equal(s.selections.length, 1); assert.equal(s.observations(), 1);
});


function workspace() {
    return { unique: {}, isNew: {}, persistedData: {}, splitView: { activeVariantsInfo: {} } };
}

test("queued document emissions cannot restore the assistant after authentication is lost", () => {
    const s = setup(); s.auth({}); s.workspace(workspace());
    const count = s.selections.length;
    s.auth(undefined);
    s.emissions[0](["doc", false, {}, []]);
    assert.equal(s.selections.length, count);
});

test("queued emissions from a replaced workspace cannot overwrite the current document", () => {
    const s = setup(); s.auth({}); s.workspace(workspace());
    s.workspace(workspace());
    const count = s.selections.length;
    s.emissions[0](["old-doc", false, {}, []]);
    assert.equal(s.selections.length, count);
});

test("queued document emissions after destruction cannot select content", () => {
    const s = setup(); s.auth({}); s.workspace(workspace());
    const count = s.selections.length;
    s.instance.destroy();
    s.emissions[0](["doc", false, {}, []]);
    assert.equal(s.selections.length, count);
});


test("timeout suspends content without changing workspace registration order", () => {
    const s = setup(); s.auth({}); s.workspace(workspace());
    const count = s.selections.length;
    s.authStates[0](false);
    s.emissions[0](["late-doc", false, {}, []]);
    assert.equal(s.selections.length, count);
    assert.equal(s.suspensions.at(-1), s.selections[0][0]);
    assert.deepEqual(s.registrations, [s.selections[0][0]]);
    s.authStates[0](true);
    assert.equal(s.selections.length, count + 1);
});

test("a replaced auth context's observer cannot restore access or release the new context", () => {
    const s = setup(); s.auth({}); s.workspace(workspace()); s.auth({});
    const count = s.selections.length, releases = s.releases.length;
    s.authStates[0](false); s.authStates[0](true);
    assert.equal(s.selections.length, count); assert.equal(s.releases.length, releases);
});

test("restoration eligibility reflects live authorization before queued observers run", () => {
    const s = setup();
    let authorized = true;
    assert.equal(s.isEligible(), false);
    s.auth({ getIsAuthorized: () => authorized }); s.workspace(workspace());
    assert.equal(s.isEligible(), true);
    authorized = false;
    assert.equal(s.isEligible(), false);
    authorized = true;
    s.instance.destroy();
    assert.equal(s.isEligible(), false);
});
