import { test } from "node:test";
import assert from "node:assert/strict";
import { SiteimproveAssistant } from "../../contentFiles/App_Plugins/Siteimprove/assistant.js";

function setup() {
    const commands = [], warnings = [];
    const assistant = new SiteimproveAssistant(c => commands.push(c), m => warnings.push(m));
    return { assistant, commands, warnings };
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
    assert.deepEqual(commands, [["clear", ""], ["input", "https://public.example.com/da/page/", ""]]);
});

test("new, missing, and unpublished documents clear stale content", async () => {
    const { assistant, commands } = setup();
    const noRequest = { pageUrl: () => { throw new Error("Must not request a new document"); } };
    await assistant.select("o", noRequest, "new", null, true);
    await assistant.select("o", noRequest, undefined, null, false);
    await assistant.select("o", { pageUrl: async () => ({ url: null }) }, "unpublished", null, false);
    assert.deepEqual(commands, [["clear", ""], ["clear", ""], ["clear", ""]]);
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
    assert.deepEqual(commands, [["clear", ""]]);
    assert.match(warnings[0], /Forbidden/);
});
