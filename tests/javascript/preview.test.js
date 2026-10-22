import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../../contentFiles/App_Plugins/Siteimprove/preview.js", import.meta.url), "utf8");
test("preview registers full-page checks and highlighting without an iframe or referrer", () => {
    const overlays = [];
    const document = {
        querySelector: () => ({ dataset: { umbracoVersion: "17.0.0", pageUrl: "https://public.example.com/page/" } }),
        createElement: () => ({}),
        body: { appendChild: element => overlays.push(element) }
    };
    const window = { addEventListener() {} };
    window.document = document;
    const context = { window, document, console };
    runInNewContext(script, context);
    assert.equal(overlays[0].src, "https://cdn.siteimprove.net/cms/overlay-latest.js");
    const si = window._si;
    assert.equal(si.find(c => c[0] === "input")[1], "https://public.example.com/page/");
    const prepublish = si.find(c => c[0] === "registerPrepublishCallback")[1];
    assert.equal(prepublish()[0], document);
    const highlight = si.find(c => c[0] === "onHighlight")[1];
    highlight({ selector: ".problem" });
    assert.equal(si.at(-1)[0], "applyDefaultHighlighting");
    assert.equal(si.at(-1)[2], document);
    runInNewContext(script, context);
    assert.equal(overlays.length, 1);
});

test("an unpublished preview still offers prepublish checks with no live URL", () => {
    const window = { addEventListener() {} };
    const document = {
        querySelector: () => ({ dataset: { umbracoVersion: "17.0.0", pageUrl: "", previewSession: "draft-session-a" } }),
        createElement: () => ({}), body: { appendChild: () => {} }
    };
    window.document = document;
    runInNewContext(script, { window, document, console });
    assert.equal(window._si.some(c => c[0] === "input"), false);
    assert.equal(window._si.some(c => c[0] === "registerPrepublishCallback"), true);
});


test("URL-less previews initialize their isolated session before clearing and registering callbacks", () => {
    const sessions = ["draft-a", "draft-b", "danish-variant", "reloaded-draft-a"];
    for (const previewSession of sessions) {
        const window = { addEventListener() {} };
        const document = {
            querySelector: () => ({ dataset: { umbracoVersion: "17.7.1", pageUrl: "", previewSession } }),
            createElement: () => ({}), body: { appendChild: () => {} }
        };
        window.document = document;
        runInNewContext(script, { window, document, console });
        assert.deepEqual(Array.from(window._si[0]), ["setSession", previewSession, null, "Umbraco 17.7.1"]);
        assert.deepEqual(Array.from(window._si[1]), ["clear"]);
        assert.equal(window._si[2][0], "registerPrepublishCallback");
        assert.equal(window._si[2][1]()[0], document);
        assert.equal(window._si.some(c => c[0] === "input"), false);
    }
});

test("published previews retain URL-based results with no draft session", () => {
    const window = { addEventListener() {} };
    const document = {
        querySelector: () => ({ dataset: { umbracoVersion: "17.7.1", pageUrl: "https://example.com/page/", previewSession: "" } }),
        createElement: () => ({}), body: { appendChild: () => {} }
    };
    window.document = document;
    runInNewContext(script, { window, document, console });
    assert.equal(window._si[0][1], null);
    assert.deepEqual(Array.from(window._si[1]), ["input", "https://example.com/page/"]);
});

function nativePreview(parent) {
    const overlays = [], listeners = {};
    const document = {
        querySelector: () => ({ dataset: { umbracoVersion: "17.7.1", pageUrl: "https://example.com/" } }),
        createElement: () => ({}), body: { appendChild: script => overlays.push(script) }
    };
    const window = {
        document, location: { origin: "https://example.com" },
        frameElement: { getRootNode: () => ({ host: { localName: "umb-preview" } }) },
        addEventListener: (name, callback) => { listeners[name] = callback; }
    };
    window.parent = parent || {
        location: { origin: "https://example.com" },
        document: { createElement: () => ({}), body: { appendChild: script => overlays.push(script) } }
    };
    runInNewContext(script, { window, document, console });
    return { window, document, overlays, listeners, parent: window.parent };
}

test("native previews host the assistant outside the sandbox while callbacks scan and highlight the clean page", () => {
    const s = nativePreview();
    assert.equal(s.window._si, undefined);
    assert.equal(s.overlays.length, 1);
    assert.equal(s.parent.__siteimprovePreviewOverlay, s.overlays[0]);
    const callback = s.parent._si.find(c => c[0] === "registerPrepublishCallback")[1];
    assert.equal(callback()[0], s.document);
    s.parent._si.find(c => c[0] === "onHighlight")[1]({ selector: "main" });
    assert.equal(s.parent._si.at(-1)[2], s.document);
});

test("preview navigation reuses the outer overlay and obsolete pages cannot clear the current callback", () => {
    const first = nativePreview();
    const next = nativePreview(first.parent);
    assert.equal(next.overlays.length, 0);
    const count = first.parent._si.length;
    first.listeners.pagehide();
    assert.equal(first.parent._si.length, count);
    next.listeners.pagehide();
    assert.equal(first.parent._si.at(-3)[0], "registerPrepublishCallback");
    assert.equal(first.parent._si.at(-3)[1], null);
    assert.equal(first.parent._si.at(-2)[0], "onHighlight");
    assert.equal(first.parent._si.at(-2)[1], null);
    assert.equal(first.parent._si.at(-1)[0], "clear");
});

test("unrelated embedding frames do not receive the preview assistant", () => {
    const s = nativePreview();
    const parent = { location: { origin: "https://example.com" } };
    const window = { document: s.document, parent, addEventListener() {},
        frameElement: { getRootNode: () => ({ host: { localName: "other-widget" } }) } };
    runInNewContext(script, { window, document: s.document, console });
    assert.ok(window._si);
    assert.equal(parent._si, undefined);
});
