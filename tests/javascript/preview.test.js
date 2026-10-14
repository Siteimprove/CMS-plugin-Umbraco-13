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
    const window = {};
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
    const window = {};
    const document = {
        querySelector: () => ({ dataset: { umbracoVersion: "17.0.0", pageUrl: "", previewSession: "draft-session-a" } }),
        createElement: () => ({}), body: { appendChild: () => {} }
    };
    runInNewContext(script, { window, document, console });
    assert.equal(window._si.some(c => c[0] === "input"), false);
    assert.equal(window._si.some(c => c[0] === "registerPrepublishCallback"), true);
});


test("URL-less previews initialize their isolated session before clearing and registering callbacks", () => {
    const sessions = ["draft-a", "draft-b", "danish-variant", "reloaded-draft-a"];
    for (const previewSession of sessions) {
        const window = {};
        const document = {
            querySelector: () => ({ dataset: { umbracoVersion: "17.7.1", pageUrl: "", previewSession } }),
            createElement: () => ({}), body: { appendChild: () => {} }
        };
        runInNewContext(script, { window, document, console });
        assert.deepEqual(Array.from(window._si[0]), ["setSession", previewSession, null, "Umbraco 17.7.1"]);
        assert.deepEqual(Array.from(window._si[1]), ["clear"]);
        assert.equal(window._si[2][0], "registerPrepublishCallback");
        assert.equal(window._si[2][1]()[0], document);
        assert.equal(window._si.some(c => c[0] === "input"), false);
    }
});

test("published previews retain URL-based results with no draft session", () => {
    const window = {};
    const document = {
        querySelector: () => ({ dataset: { umbracoVersion: "17.7.1", pageUrl: "https://example.com/page/", previewSession: "" } }),
        createElement: () => ({}), body: { appendChild: () => {} }
    };
    runInNewContext(script, { window, document, console });
    assert.equal(window._si[0][1], null);
    assert.deepEqual(Array.from(window._si[1]), ["input", "https://example.com/page/"]);
});
