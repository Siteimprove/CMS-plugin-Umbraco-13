import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const source = readFileSync(new URL("../../contentFiles/App_Plugins/Siteimprove/visibility.js", import.meta.url), "utf8").replace(/^export /gm, "");
function setup() {
    const attributes = new Set(); let style;
    const context = { document: {
        querySelector: () => style, createElement: () => ({ dataset: {} }),
        head: { appendChild: value => { style = value; } },
        documentElement: { toggleAttribute: (name, value) => value ? attributes.add(name) : attributes.delete(name) }
    } };
    runInNewContext(source + "\nglobalThis.visibility = { setDocumentVisibility, setWorkspaceModalVisibility };", context);
    return { ...context.visibility, attributes, style: () => style };
}
const modal = entityType => ({ alias: { toString: () => "Umb.Modal.Workspace" }, data: { entityType } });
test("non-content workspaces hide both controls without discarding document visibility", () => {
    const s = setup(); s.setDocumentVisibility(true); s.setWorkspaceModalVisibility([modal("template")]);
    assert.ok(s.attributes.has("data-siteimprove-document-active"));
    assert.ok(s.attributes.has("data-siteimprove-non-content-modal"));
    assert.match(s.style().textContent, /html\[data-siteimprove-non-content-modal\] .si-toggle-container/);
    assert.match(s.style().textContent, /html\[data-siteimprove-non-content-modal\] .si-iframe-container/);
    s.setWorkspaceModalVisibility([]);
    assert.ok(!s.attributes.has("data-siteimprove-non-content-modal"));
});
test("the innermost workspace controls nested modals; content dialogs remain eligible", () => {
    const s = setup();
    s.setWorkspaceModalVisibility([modal("template"), modal("document"), { alias: "Umb.Modal.Document.Publish" }]);
    assert.ok(!s.attributes.has("data-siteimprove-non-content-modal"));
    s.setWorkspaceModalVisibility([modal("document"), modal("document-type")]);
    assert.ok(s.attributes.has("data-siteimprove-non-content-modal"));
});
