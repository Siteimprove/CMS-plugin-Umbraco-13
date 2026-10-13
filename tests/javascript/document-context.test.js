import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../contentFiles/App_Plugins/Siteimprove/document-context.js", import.meta.url), "utf8")
    .replace(/^import .*;\n/gm, "").replace(/^export class /gm, "class ")
    .replace(/^export \{.*\};\n/gm, "");
function setup() {
    const authToken = {}, workspaceToken = {}, callbacks = new Map(), selections = [], releases = [];
    let observations = 0;
    class Context {
        consumeContext(token, callback) { callbacks.set(token, callback); }
        observe(_observable, callback) { observations++; callback(["doc", false, {}, []]); }
        destroy() {}
    }
    const context = {
        UmbContextBase: Context, UMB_AUTH_CONTEXT: authToken, UMB_DOCUMENT_WORKSPACE_CONTEXT: workspaceToken,
        SiteimproveApi: class {}, observeMultiple: values => values,
        assistant: { select: (...args) => selections.push(args), release: owner => releases.push(owner) }
    };
    runInNewContext(source + "\nglobalThis.Context = SiteimproveDocumentContext;", context);
    return {
        instance: new context.Context({}), selections, releases, observations: () => observations,
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
