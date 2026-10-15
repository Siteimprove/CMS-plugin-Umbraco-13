import { test } from "node:test";
import assert from "node:assert/strict";
import { SiteimproveAssistant } from "../../contentFiles/App_Plugins/Siteimprove/assistant.js";

function setup() {
    const commands = [], warnings = [], visibility = [];
    const assistant = new SiteimproveAssistant(c => commands.push(c), m => warnings.push(m), visible => visibility.push(visible));
    return { assistant, commands, warnings, visibility };
}
function deferred() {
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    return { promise, resolve };
}

test("selects a published document's public URL and culture", async () => {
    const { assistant, commands } = setup();
    await assistant.select("owner", { pageUrl: async (id, culture) => {
        assert.equal(id, "doc"); assert.equal(culture, "da-DK");
        return { url: "https://public.example.com/da/page/" };
    } }, "doc", "da-DK", false);
    assert.deepEqual(commands.filter(c => c[0] !== "setSession"), [["clear", ""], ["input", "https://public.example.com/da/page/", ""]]);
});

test("new, missing, and unpublished documents clear stale content", async () => {
    const { assistant, commands } = setup();
    const noRequest = { pageUrl: () => { throw new Error("Must not request a new document"); } };
    await assistant.select("o", noRequest, "new", null, true);
    await assistant.select("o", noRequest, undefined, null, false);
    await assistant.select("o", { pageUrl: async () => ({ url: null }) }, "unpublished", null, false);
    assert.deepEqual(commands.filter(c => c[0] !== "setSession"), [["clear", ""], ["clear", ""], ["clear", ""]]);
});

test("late responses cannot replace the newly selected page", async () => {
    const { assistant, commands } = setup();
    const slow = deferred();
    const first = assistant.select("first", { pageUrl: () => slow.promise }, "a", null, false);
    await assistant.select("second", { pageUrl: async () => ({ url: "https://public.example.com/b" }) }, "b", null, false);
    slow.resolve({ url: "https://public.example.com/a" });
    await first;
    assert.equal(commands.at(-1)[1], "https://public.example.com/b");
    assert.equal(commands.filter(c => c[0] === "input").length, 1);
});

test("teardown cancels requests and prevents repopulating a closed document", async () => {
    const { assistant, commands } = setup();
    const slow = deferred();
    let signal;
    const pending = assistant.select("o", { pageUrl: (id, culture, s) => { signal = s; return slow.promise; } }, "a", null, false);
    assistant.release("o");
    assert.equal(signal.aborted, true);
    slow.resolve({ url: "https://public.example.com/a" });
    await pending;
    assert.equal(commands.filter(c => c[0] === "input").length, 0);
});

test("old workspace teardown cannot clear a newer workspace", async () => {
    const { assistant, commands } = setup();
    await assistant.select("new", { pageUrl: async () => ({ url: "https://public.example.com/" }) }, "id", null, false);
    assistant.release("old");
    assert.equal(commands.at(-1)[0], "input");
});

test("request failures leave the assistant clear without an unhandled rejection", async () => {
    const { assistant, commands, warnings } = setup();
    await assistant.select("o", { pageUrl: async () => { throw new Error("Forbidden"); } }, "id", null, false);
    assert.deepEqual(commands.filter(c => c[0] !== "setSession"), [["clear", ""]]);
    assert.match(warnings[0], /Forbidden/);
});

test("new and unpublished document workspaces retain the launcher", async () => {
    const { assistant, visibility } = setup();
    await assistant.select("new", {}, undefined, null, true);
    assert.equal(visibility.at(-1), true);
    assistant.release("new");
    await assistant.select("draft", { pageUrl: async () => ({ url: null }) }, "draft", null, false);
    assert.equal(visibility.at(-1), true);
    assistant.release("draft");
    assert.equal(visibility.at(-1), false);
});

test("an old workspace cannot hide the current document launcher", async () => {
    const { assistant, visibility } = setup();
    await assistant.select("current", { pageUrl: async () => ({ url: "https://example.com/" }) }, "id", null, false);
    assistant.release("old");
    assert.deepEqual(visibility, [true]);
    assistant.clear();
    assert.equal(visibility.at(-1), false);
});

test("a late document response cannot show the launcher after leaving content", async () => {
    const { assistant, visibility } = setup(), slow = deferred();
    const pending = assistant.select("owner", { pageUrl: () => slow.promise }, "id", null, false);
    assistant.release("owner");
    slow.resolve({ url: "https://example.com/" });
    await pending;
    assert.deepEqual(visibility, [true, false]);
});


test("unpublished documents and cultures receive isolated result sessions", async () => {
    const { assistant, commands } = setup();
    const api = { pageUrl: async () => ({ url: null }) };
    for (const [id, culture] of [["draft-a", null], ["draft-b", null], ["draft-b", "da-DK"]])
        await assistant.select("owner", api, id, culture, false);
    const sessions = commands.filter(c => c[0] === "setSession").map(c => c[1]);
    assert.equal(new Set(sessions).size, 3);
    assert.ok(sessions.every(id => /^[0-9a-f-]{36}$/.test(id)));
    assert.equal(commands.some(c => c[0] === "input"), false);
});

test("published content restores URL-based results after an isolated draft", async () => {
    const { assistant, commands } = setup();
    await assistant.select("draft", { pageUrl: async () => ({ url: null }) }, "draft", null, false);
    await assistant.select("page", { pageUrl: async () => ({ url: "https://example.com/page/" }) }, "page", null, false);
    assert.deepEqual(commands.at(-2), ["setSession", null, null, "Umbraco"]);
    assert.deepEqual(commands.at(-1), ["input", "https://example.com/page/", ""]);
});

test("overlay initialization preserves the current draft session", async () => {
    const { assistant, commands } = setup();
    await assistant.select("draft", { pageUrl: async () => ({ url: null }) }, "draft", null, false);
    const session = commands.find(c => c[0] === "setSession")[1];
    assistant.initialize("17.7.1");
    assert.deepEqual(commands.at(-1), ["setSession", session, null, "Umbraco 17.7.1"]);
});

test("a late published response cannot reset the new draft's isolated session", async () => {
    const { assistant, commands } = setup(), slow = deferred();
    const pending = assistant.select("page", { pageUrl: () => slow.promise }, "page", null, false);
    await assistant.select("draft", { pageUrl: async () => ({ url: null }) }, "draft", null, false);
    const count = commands.length;
    slow.resolve({ url: "https://example.com/page/" });
    await pending;
    assert.equal(commands.length, count);
    assert.notEqual(commands.filter(c => c[0] === "setSession").at(-1)[1], null);
});

test("HTTP backoffices can create isolated sessions without crypto.randomUUID", async () => {
    const { readFileSync } = await import("node:fs");
    const { runInNewContext } = await import("node:vm");
    const { randomFillSync } = await import("node:crypto");
    const source = readFileSync(new URL("../../contentFiles/App_Plugins/Siteimprove/assistant.js", import.meta.url), "utf8")
        .replace(/^import .*;\n/gm, "").replace(/^export /gm, "");
    const window = {};
    const context = { window, console, AbortController, setDocumentVisibility: () => {},
        crypto: { getRandomValues: data => randomFillSync(data) } };
    runInNewContext(source + "\nglobalThis.testAssistant = assistant;", context);
    const assistant = context.testAssistant;
    const api = { pageUrl: async () => ({ url: null }) };
    await assistant.select("a", api, "draft-a", null, false);
    await assistant.select("b", api, "draft-b", null, false);
    const sessions = window._si.filter(c => c[0] === "setSession").map(c => c[1]);
    assert.equal(new Set(sessions).size, 2);
    assert.ok(sessions.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)));
});

test("closing nested document editors restores each surviving parent's URL and launcher", async () => {
    const { assistant, commands, visibility } = setup();
    const api = { pageUrl: async id => ({ url: "https://example.com/" + id }) };
    for (const owner of ["root", "child", "inner"])
        await assistant.select(owner, api, owner, null, false);
    for (const [closed, parent] of [["inner", "child"], ["child", "root"]]) {
        await assistant.release(closed);
        assert.equal(visibility.at(-1), true);
        assert.deepEqual(commands.at(-1), ["input", "https://example.com/" + parent, ""]);
    }
    assistant.release("root");
    assert.equal(visibility.at(-1), false);
});

test("a suspended parent's latest document and culture return without stealing child focus", async () => {
    const { assistant, commands } = setup();
    const api = { pageUrl: async (id, culture) => ({ url: `https://example.com/${culture}/${id}` }) };
    await assistant.select("parent", api, "old", "en-US", false);
    await assistant.select("child", api, "child", "en-US", false);
    const count = commands.length;
    await assistant.select("parent", api, "updated", "da-DK", false);
    assert.equal(commands.length, count);
    await assistant.release("child");
    assert.deepEqual(commands.at(-1), ["input", "https://example.com/da-DK/updated", ""]);
});

test("restoring a draft parent keeps isolated results instead of the child's published URL", async () => {
    const { assistant, commands, visibility } = setup();
    const api = { pageUrl: async id => ({ url: id === "draft" ? null : "https://example.com/child" }) };
    await assistant.select("parent", api, "draft", null, false);
    const originalSession = commands.find(c => c[0] === "setSession")[1];
    await assistant.select("child", api, "child", null, false);
    await assistant.release("child");
    assert.equal(visibility.at(-1), true);
    assert.deepEqual(commands.at(-1), ["clear", ""]);
    const session = commands.filter(c => c[0] === "setSession").at(-1)[1];
    assert.match(session, /^[0-9a-f-]{36}$/);
    assert.notEqual(session, originalSession);
});

test("a closed parent's pending response cannot replace the restored ancestor", async () => {
    const { assistant, commands } = setup(), slow = deferred();
    const api = { pageUrl: async id => ({ url: "https://example.com/" + id }) };
    await assistant.select("root", api, "root", null, false);
    const pending = assistant.select("child", { pageUrl: () => slow.promise }, "child", null, false);
    await assistant.release("child");
    slow.resolve({ url: "https://example.com/child" });
    await pending;
    assert.deepEqual(commands.at(-1), ["input", "https://example.com/root", ""]);
});

test("closing an inactive parent cannot resurrect it after its child closes", async () => {
    const { assistant, commands, visibility } = setup();
    const api = { pageUrl: async id => ({ url: "https://example.com/" + id }) };
    await assistant.select("parent", api, "parent", null, false);
    await assistant.select("child", api, "child", null, false);
    const count = commands.length;
    assistant.release("parent");
    assert.equal(commands.length, count);
    assistant.release("child");
    assert.equal(visibility.at(-1), false);
    assert.deepEqual(commands.at(-1), ["clear", ""]);
});

test("authentication loss discards cached contexts and recovery retains nesting order", async () => {
    const { assistant, commands, visibility } = setup();
    const api = { pageUrl: async id => ({ url: "https://example.com/" + id }) };
    await assistant.select("parent", api, "parent", null, false);
    await assistant.select("child", api, "child", null, false);
    assistant.clear();
    assert.equal(visibility.at(-1), false);
    await assistant.select("child", api, "child", null, false);
    const count = commands.length;
    await assistant.select("parent", api, "parent", null, false);
    assert.equal(commands.length, count);
    await assistant.release("child");
    assert.deepEqual(commands.at(-1), ["input", "https://example.com/parent", ""]);
    assistant.clear();
    assistant.release("parent");
    assert.equal(visibility.at(-1), false);
});

test("registration order survives late parent initialization and temporary suspension", async () => {
    const { assistant, commands } = setup();
    const api = { pageUrl: async id => ({ url: "https://example.com/" + id }) };
    assistant.register("parent");
    assistant.register("child");
    assistant.suspend("parent");
    await assistant.select("child", api, "child", null, false);
    const count = commands.length;
    await assistant.select("parent", api, "parent", null, false);
    assert.equal(commands.length, count);
    await assistant.release("child");
    assert.deepEqual(commands.at(-1), ["input", "https://example.com/parent", ""]);
});

test("restoration checks current authorization before a parent's observer handles expiry", async () => {
    const { assistant, commands, visibility } = setup();
    const api = { pageUrl: async id => ({ url: "https://example.com/" + id }) };
    let authorized = true;
    assistant.register("parent", () => authorized);
    await assistant.select("parent", api, "parent", null, false);
    await assistant.select("child", api, "child", null, false);
    authorized = false;
    assistant.release("child");
    assert.equal(visibility.at(-1), false);
    assert.deepEqual(commands.at(-1), ["clear", ""]);
});
