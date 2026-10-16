import { test } from "node:test";
import assert from "node:assert/strict";
import { knownCmsError } from "../browser/cms-errors.js";

const cms = "http://localhost:5019/umbraco/backoffice/d56a20e7827db26ced3340a804bd0855c99b1e04/packages/core/";
const webkit = "TypeError: n.provideAt is not a function. (In 'n.provideAt(r)', 'n.provideAt' is undefined)";
const error = (message, frame) => ({ message, stack: message + "\n    at " + frame });

test("the observed Chromium, Firefox and WebKit disposed-view errors are classified as CMS errors", () => {
    for (const [message, frame] of [
        ["n.provideAt is not a function", "Object.setup (" + cms + "constants-BpvpzOly.js:124:77)"],
        ["t.provideAt is not a function", "render (" + cms + "router/index.js:792:16)"],
        [webkit, "render (" + cms + "router/index.js:792:26)"]
    ]) assert.equal(knownCmsError(error(message, frame)), true, message);
});

test("the disposed-view diagnostic rejects plugin and third-party frames, including a later CMS caller", () => {
    for (const frame of [
        "restore (http://localhost:5019/App_Plugins/Siteimprove/assistant.js:1:1)",
        "restore (https://cdn.siteimprove.net/cms/overlay-latest.js:1:1)",
        "render (http://localhost:5019/unrelated/packages/core/router/index.js:792:26)"
    ]) {
        const value = error(webkit, frame);
        value.stack += "\n    at render (" + cms + "router/index.js:792:26)";
        assert.equal(knownCmsError(value), false);
    }
    assert.equal(knownCmsError({ message: webkit, stack: "" }), false);
});

test("unrecognized TypeErrors and changed WebKit expressions still fail the console check", () => {
    for (const message of [
        "TypeError: n.render is not a function",
        "TypeError: n.provideAt is not a function. (In 'other.provideAt(r)', 'other.provideAt' is undefined)",
        "TypeError: n.provideAt is not a function. Unexpected failure"
    ]) assert.equal(knownCmsError(error(message, "render (" + cms + "router/index.js:792:26)")), false);
});
