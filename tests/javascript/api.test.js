import { test } from "node:test";
import assert from "node:assert/strict";
import { SiteimproveApi } from "../../contentFiles/App_Plugins/Siteimprove/api.js";

function auth(path = "/umbraco", base = "https://cms.example.com") {
    let refreshes = 0;
    return {
        getOpenApiConfiguration: () => ({ base, credentials: "include" }),
        getRedirectUrl: () => "https://cms.example.com" + path + "/oauth_complete",
        getLatestToken: async () => "refreshed-" + ++refreshes
    };
}

test("uses fresh bearer tokens and encodes culture", async () => {
    const calls = [];
    const api = new SiteimproveApi(auth(), async (url, options) => {
        calls.push({ url, options });
        return { ok: true, json: async () => ({ url: "https://public.example.com/" }) };
    });
    await api.pageUrl("11111111-1111-1111-1111-111111111111", "pt-BR");
    await api.getPublicUrl();
    assert.match(calls[0].url.href, /\/management\/api\/v1\/siteimprove\/document\/.*\/url\?culture=pt-BR$/);
    assert.equal(calls[0].options.headers.Authorization, "Bearer refreshed-1");
    assert.equal(calls[1].options.headers.Authorization, "Bearer refreshed-2");
    assert.equal(calls[0].options.credentials, "include");
});

test("respects virtual directories, renamed backoffice, and remote API base", async () => {
    const api = new SiteimproveApi(auth("/site/admin", "https://api.example.com"), async (url) => {
        assert.equal(url.href, "https://api.example.com/site/admin/management/api/v1/siteimprove/version");
        return { ok: true, json: async () => ({ version: "17.0.0" }) };
    });
    await api.version();
});

test("saves using the Management API JSON contract", async () => {
    const api = new SiteimproveApi(auth(), async (url, options) => {
        assert.equal(options.method, "PUT");
        assert.deepEqual(JSON.parse(options.body), { publicUrl: "https://www.example.com" });
        assert.equal(options.headers["Content-Type"], "application/json");
        return { ok: true, json: async () => ({ publicUrl: "https://www.example.com", isConfigured: false }) };
    });
    await api.setPublicUrl("https://www.example.com");
});

test("surfaces an authorization or validation error", async () => {
    const api = new SiteimproveApi(auth(), async () => ({
        ok: false, status: 403, json: async () => ({ title: "Forbidden" })
    }));
    await assert.rejects(api.getPublicUrl(), /Forbidden/);
});

test("handles non-JSON errors", async () => {
    const api = new SiteimproveApi(auth(), async () => ({
        ok: false, status: 502, json: async () => { throw new Error("HTML body"); }
    }));
    await assert.rejects(api.version(), /502/);
});
