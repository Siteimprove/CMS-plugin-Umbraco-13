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
