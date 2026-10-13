import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const API = "/umbraco/management/api/v1/";
const OVERLAY = "https://cdn.siteimprove.net/cms/overlay-latest.js";
const PUBLIC_ORIGIN = "https://public.example.test";
const stub = `
(() => {
    window.__siOverlayLoads = (window.__siOverlayLoads || 0) + 1;
    window.__siCommands = [];
    window.__siCallbacks = {};
    const queue = window._si || [];
    function capture(command) {
        if (typeof command[1] === "function") window.__siCallbacks[command[0]] = command[1];
        window.__siCommands.push(command.map(value =>
            typeof value === "function" ? "[callback]" : value === document ? "[document]" : value));
    }
    window._si = { push: capture };
    queue.forEach(capture);
})();
`;

async function mockOverlay(context) {
    await context.route(OVERLAY, route => route.fulfill({ status: 200, contentType: "text/javascript", body: stub }));
}
async function login(page, email = "admin@example.test") {
    await page.goto("/umbraco/");
    await page.locator('[name="username"]').fill(email);
    await page.locator('[name="password"]').fill(process.env.E2E_ADMIN_PASSWORD);
    await page.getByLabel("Login", { exact: true }).click();
    await expect(page.locator("umb-backoffice")).toBeVisible();
}
async function navigate(page, path) {
    const documentId = path.match(/\/workspace\/document\/edit\/([^/]+)/)?.[1];
    const documentLoaded = documentId ? page.waitForResponse(response =>
        new URL(response.url()).pathname === API + "document/" + documentId
        && response.request().method() === "GET") : undefined;
    const section = path.match(/\/section\/([^/]+)/)?.[1];
    const currentSection = new URL(page.url()).pathname.match(/\/section\/([^/]+)/)?.[1];
    if (section !== currentSection && ["content", "settings"].includes(section)) {
        await page.locator('umb-backoffice-header uui-tab[href="section/' + section + '"]').click();
        if (section === "content") {
            await expect(page.locator("umb-document-tree").getByText("Home", { exact: true })).toBeVisible();
        } else {
            // Umbraco remembers the last dashboard when returning to a section.
            await expect(page.locator('[href$="dashboard/siteimprove"]').first()).toBeVisible();
        }
        await page.waitForLoadState("networkidle");
    }
    if (documentId) {
        const target = page.locator('umb-document-tree a[href$="/edit/' + documentId + '"]');
        if (!await target.count()) {
            await page.locator('umb-document-tree uui-menu-item[label="Home"] button#caret-button').click();
        }
        await target.click();
        expect((await documentLoaded).status()).toBe(200);
        await page.waitForLoadState("networkidle");
    } else if (path.endsWith("/dashboard/siteimprove")) {
        await page.locator('[href$="dashboard/siteimprove"]').first().click();
        await expect(page.locator("siteimprove-settings")).toBeVisible();
    }

}
async function lastCommand(page) {
    return page.evaluate(() => window.__siCommands?.at(-1));
}
async function screenshot(page, testInfo, name) {
    await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
}
async function previewFrame(popup) {
    try { await expect.poll(async () => {
        for (const frame of popup.frames())
            if (await frame.locator("script[data-siteimprove-preview]").count()) return true;
        return false;
    }).toBe(true); }
    catch (error) {
        console.log("Preview diagnostics", JSON.stringify({
            cookies: (await popup.context().cookies()).map(c => ({ name: c.name, secure: c.secure, sameSite: c.sameSite })),
            frames: await Promise.all(popup.frames().map(f => f.evaluate(() => ({
                path: location.pathname, title: document.title,
                text: document.body?.textContent?.slice(0,800),
                scripts: [...document.scripts].map(s => s.src)
            })).catch(e => ({ error: e.message }))))
        }));
        throw error;
    }
    for (const frame of popup.frames())
        if (await frame.locator("script[data-siteimprove-preview]").count()) return frame;
    throw new Error("No rendered preview with the plugin script.");
}

test("real Umbraco backoffice and preview lifecycle", async ({ page, context, request, browser }, testInfo) => {
    const errors = [];
    page.on("pageerror", async error => {
        errors.push(error.message);
        console.log("Backoffice browser error", JSON.stringify({
            path: new URL(page.url()).pathname, message: error.message, stack: error.stack
        }));
        if (error.message.includes("provideAt")) {
            const source = error.stack?.match(/(http:\/\/localhost:5017\/[^ )\n]+\.js):(\d+):\d+/);
            if (source) {
                const response = await page.request.get(source[1]);
                const lines = (await response.text()).split("\n");
                const line = Number(source[2]);
                console.log("Router source diagnostics", JSON.stringify(lines.slice(Math.max(0,line-6),line+5)));
            }
            const views = await page.locator("umb-workspace-editor").evaluateAll(elements => elements.map(element => ({
                tag: element.localName,
                views: (element._workspaceViews || []).map(view => ({
                    alias: view.manifest?.alias, constructor: view.constructor?.name,
                    provideAt: typeof view.provideAt, keys: Object.keys(view).slice(0,15)
                }))
            })));
            console.log("Workspace view diagnostics", JSON.stringify(views));
        }
    });
    let token;
    page.on("request", r => {
        const bearer = r.headers().authorization;
        if (r.url().includes(API) && bearer?.startsWith("Bearer ")) token = bearer;
    });
    await mockOverlay(context);
    async function api(path, options = {}) {
        const response = await page.request.fetch(API + path, {
            ...options, headers: { Authorization: token, ...options.headers }
        });
        expect(response.ok(), path + ": " + response.status() + " " + await response.text()).toBe(true);
        return response;
    }
    async function json(path) { return (await api(path)).json(); }
    async function createDocument(name, typeId, templateId, parentId, published) {
        const id = randomUUID();
        await api("document", { method: "POST", data: {
            id, parent: parentId ? { id: parentId } : null,
            documentType: { id: typeId }, template: { id: templateId },
            values: [{ alias: "text", culture: null, segment: null, value: "Preview content for " + name }],
            variants: [{ culture: null, segment: null, name }]
        } });
        if (published) await api("document/" + id + "/publish", {
            method: "PUT", data: { publishSchedules: [{ culture: null }] }
        });
        return id;
    }
    const documentPath = id => "/umbraco/section/content/workspace/document/edit/" + id + "/invariant";
    let home, first, second, draft, previewDraft, groups, writer;

    await test.step("anonymous requests cannot access plugin APIs", async () => {
        for (const endpoint of ["version", "public-url", "document/" + randomUUID() + "/url"]) {
            const response = await request.get(API + "siteimprove/" + endpoint);
            expect([401, 403]).toContain(response.status());
        }
    });

    await test.step("login loads the installed backoffice extensions and authenticates the plugin API", async () => {
        const version = page.waitForResponse(r => r.url().endsWith(API + "siteimprove/version"));
        await login(page);
        expect((await version).status()).toBe(200);
        await expect.poll(() => page.evaluate(() => window.__siOverlayLoads)).toBe(1);
        expect(await page.evaluate(() => window.__siCommands.some(c => c[0] === "setSession" && c[3].startsWith("Umbraco 17.")))).toBe(true);
        expect(errors).toEqual([]);
        await screenshot(page, testInfo, "authenticated-backoffice");
    });

    await test.step("create published and unpublished pages in the real CMS", async () => {
        const templateId = randomUUID(), pageTypeId = randomUUID(), homeTypeId = randomUUID();
        const dataTypeId = randomUUID(), containerId = randomUUID();
        await api("data-type", { method: "POST", data: {
            id: dataTypeId, name: "Browser Test Text", editorAlias: "Umbraco.TextBox",
            editorUiAlias: "Umb.PropertyEditorUi.TextBox", values: []
        } });
        await api("template", { method: "POST", data: {
            id: templateId, name: "Browser Test", alias: "BrowserTest",
            content: '@inherits Umbraco.Cms.Web.Common.Views.UmbracoViewPage\n<!doctype html><html><head><title>@Model.Name</title></head><body><h1>@Model.Name</h1><p class="content">Preview content for @Model.Name</p><a href="/second-page/">Second page</a></body></html>'
        } });
        const type = {
            alias: "browserTestPage", name: "Browser Test Page", icon: "icon-document",
            allowedAsRoot: false, variesByCulture: false, variesBySegment: false, isElement: false,
            properties: [{ id: randomUUID(), alias: "text", name: "Text", sortOrder: 0,
                dataType: { id: dataTypeId }, container: { id: containerId },
                variesByCulture: false, variesBySegment: false,
                validation: { mandatory: false }, appearance: { labelOnTop: false } }],
            containers: [{ id: containerId, name: "Content", type: "Group", sortOrder: 0 }],
            compositions: [], allowedTemplates: [{ id: templateId }],
            defaultTemplate: { id: templateId }, cleanup: { preventCleanup: true }
        };
        await api("document-type", { method: "POST", data: { ...type, id: pageTypeId, allowedDocumentTypes: [] } });
        const homeContainerId = randomUUID();
        await api("document-type", { method: "POST", data: {
            ...type, id: homeTypeId, alias: "browserTestHome", name: "Browser Test Home", allowedAsRoot: true,
            properties: type.properties.map(p => ({ ...p, id: randomUUID(), container: { id: homeContainerId } })),
            containers: type.containers.map(c => ({ ...c, id: homeContainerId })),
            allowedDocumentTypes: [{ documentType: { id: pageTypeId }, sortOrder: 0 }]
        } });
        home = await createDocument("Home", homeTypeId, templateId, null, true);
        first = await createDocument("First Page", pageTypeId, templateId, home, true);
        second = await createDocument("Second Page", pageTypeId, templateId, home, true);
        draft = await createDocument("Draft Page", pageTypeId, templateId, home, false);
        previewDraft = await createDocument("Preview Draft", pageTypeId, templateId, home, false);
        groups = (await json("user-group?skip=0&take=100")).items;
        writer = groups.find(g => /writers|editors/i.test(g.name));
        expect(writer).toBeTruthy();
        await page.reload();
        await expect(page.locator("umb-backoffice")).toBeVisible();
    });

    await test.step("Siteimprove lives in Settings and saves a public domain without a custom section grant", async () => {
        await navigate(page, "/umbraco/section/settings");
        await expect(page.locator("umb-backoffice-header").getByText("Siteimprove", { exact: true })).toHaveCount(0);
        await page.locator('[href$="dashboard/siteimprove"]').first().click();
        await expect(page).toHaveURL(/\/umbraco\/section\/settings\/dashboard\/siteimprove$/);
        await expect(page.locator("siteimprove-settings")).toBeVisible();
        const input = page.getByLabel("Public domain", { exact: true });
        await expect(input).toBeEnabled();
        await input.fill(PUBLIC_ORIGIN + "/not-an-origin");
        await page.getByLabel("Save public URL", { exact: true }).click();
        await expect(page.getByRole("alert")).toContainText("without a path");
        await input.fill(PUBLIC_ORIGIN);
        await page.getByLabel("Save public URL", { exact: true }).click();
        await expect(page.getByRole("status")).toContainText("Public URL saved.");
        expect((await json("siteimprove/public-url")).publicUrl).toBe(PUBLIC_ORIGIN);
        await page.reload();
        await expect(page.getByLabel("Public domain", { exact: true })).toHaveValue(PUBLIC_ORIGIN);
        await screenshot(page, testInfo, "settings-domain-saved");
    });

    await test.step("document navigation sends the mapped URL and clears context outside content", async () => {
        await navigate(page, documentPath(first));
        await expect.poll(() => lastCommand(page)).toEqual(["input", PUBLIC_ORIGIN + "/first-page/", ""]);
        await navigate(page, documentPath(second));
        await expect.poll(() => lastCommand(page)).toEqual(["input", PUBLIC_ORIGIN + "/second-page/", ""]);
        await navigate(page, "/umbraco/section/settings/dashboard/siteimprove");
        await expect(page.locator("siteimprove-settings")).toBeVisible();
        await expect.poll(() => lastCommand(page)).toEqual(["clear", ""]);
    });

    await test.step("unpublished content clears the assistant, then publishing refreshes its live URL", async () => {
        expect((await json("siteimprove/document/" + draft + "/url")).url).toBeNull();
        await navigate(page, documentPath(draft));
        await expect(page.getByTestId("workspace-action:Umb.WorkspaceAction.Document.SaveAndPublish")).toBeVisible();
        await expect.poll(() => lastCommand(page)).toEqual(["clear", ""]);
        await page.getByTestId("workspace-action:Umb.WorkspaceAction.Document.SaveAndPublish").click();
        await expect.poll(() => lastCommand(page)).toEqual(["input", PUBLIC_ORIGIN + "/draft-page/", ""]);
        await screenshot(page, testInfo, "document-published");
    });

    for (const [name, id] of [["published", () => first], ["never-published", () => previewDraft]]) {
        await test.step(name + " preview registers a full-page prepublish callback and highlighting", async () => {
            await navigate(page, documentPath(id()));
            const popupPromise = page.waitForEvent("popup");
            await page.getByTestId("workspace-action:Umb.WorkspaceAction.Document.SaveAndPreview").click();
            const popup = await popupPromise;
            const frame = await previewFrame(popup);
            expect(await popup.evaluate(() => window.__siOverlayLoads || 0)).toBe(0);
            await expect.poll(() => frame.evaluate(() => window.__siOverlayLoads)).toBe(1);
            await expect.poll(() => frame.evaluate(() => typeof window.__siCallbacks?.registerPrepublishCallback)).toBe("function");
            const check = await frame.evaluate(() => {
                const result = window.__siCallbacks.registerPrepublishCallback();
                window.__siCallbacks.onHighlight({ selector: ".content" });
                return {
                    usesRenderedDocument: result[0] === document, label: result[2],
                    highlightCommand: window.__siCommands.at(-1)[0],
                    hasContent: document.body.textContent.includes("Preview content")
                };
            });
            expect(check).toEqual({ usesRenderedDocument: true, label: "Full page", highlightCommand: "applyDefaultHighlighting", hasContent: true });
            await screenshot(popup, testInfo, name + "-preview");
            await popup.close();
        });
    }

    await test.step("ordinary public pages receive no preview injection", async () => {
        const publicContext = await browser.newContext();
        const publicPage = await publicContext.newPage();
        const response = await publicPage.goto("http://localhost:5017/first-page/");
        expect(response.status()).toBe(200);
        await expect(publicPage.getByRole("heading", { name: "First Page", exact: true })).toBeVisible();
        expect(await publicPage.locator("script[data-siteimprove-preview]").count()).toBe(0);
        await publicContext.close();
    });

    await test.step("a non-admin user cannot read or change settings", async () => {
        const restrictedGroup = await json("user-group/" + writer.id);
        await api("user-group/" + writer.id, { method: "PUT", data: {
            ...restrictedGroup, documentStartNode: { id: first }, documentRootAccess: false
        } });
        const response = await api("user", { method: "POST", data: {
            email: "writer@example.test", name: "Browser Test Writer", userName: "writer@example.test",
            kind: "Default", userGroupIds: [{ id: writer.id }]
        } });
        const writerId = response.headers().location.split("/").at(-1);
        await api("user/" + writerId + "/change-password", { method: "POST", data: { newPassword: process.env.E2E_ADMIN_PASSWORD } });
        const writerContext = await browser.newContext();
        await mockOverlay(writerContext);
        const writerPage = await writerContext.newPage();
        let writerToken;
        writerPage.on("request", r => {
            const bearer = r.headers().authorization;
            if (r.url().includes(API) && bearer?.startsWith("Bearer ")) writerToken = bearer;
        });
        await login(writerPage, "writer@example.test");
        await expect.poll(() => !!writerToken).toBe(true);
        for (const method of ["GET", "PUT"]) {
            const denied = await writerPage.request.fetch(API + "siteimprove/public-url", {
                method, headers: { Authorization: writerToken },
                ...(method === "PUT" ? { data: { publicUrl: "" } } : {})
            });
            expect(denied.status()).toBe(403);
        }
        const allowed = await writerPage.request.get(API + "siteimprove/document/" + first + "/url", {
            headers: { Authorization: writerToken }
        });
        expect(allowed.status()).toBe(200);
        expect((await allowed.json()).url).toBe(PUBLIC_ORIGIN + "/first-page/");
        for (const endpoint of ["document/" + second, "siteimprove/document/" + second + "/url"]) {
            const denied = await writerPage.request.get(API + endpoint, {
                headers: { Authorization: writerToken }
            });
            expect(denied.status()).toBe(403);
        }
        await writerContext.close();
    });

    await test.step("a blocked overlay does not prevent content editing", async () => {
        const offlineContext = await browser.newContext();
        await offlineContext.route(OVERLAY, route => route.abort("failed"));
        const offlinePage = await offlineContext.newPage();
        const offlineErrors = [];
        let offlineToken;
        offlinePage.on("request", r => {
            const bearer = r.headers().authorization;
            if (r.url().includes(API) && bearer?.startsWith("Bearer ")) offlineToken = bearer;
        });
        offlinePage.on("pageerror", e => offlineErrors.push(e.message));
        await login(offlinePage);
        await navigate(offlinePage, documentPath(first));
        await expect(offlinePage.getByTestId("workspace-action:Umb.WorkspaceAction.Document.SaveAndPublish")).toBeVisible();
        await offlinePage.locator("umb-property-editor-ui-text-box input").fill("Edited while the Siteimprove overlay was blocked");
        const saved = offlinePage.waitForResponse(r =>
            r.url().includes("/document/" + first + "/update-and-publish") && r.status() === 200);
        await offlinePage.getByTestId("workspace-action:Umb.WorkspaceAction.Document.SaveAndPublish").click();
        await saved;
        const documentResponse = await offlinePage.request.get(API + "document/" + first, {
            headers: { Authorization: offlineToken }
        });
        expect((await documentResponse.json()).values.find(v => v.alias === "text").value)
            .toBe("Edited while the Siteimprove overlay was blocked");
        expect(offlineErrors).toEqual([]);
        await screenshot(offlinePage, testInfo, "editor-with-overlay-blocked");
        await offlineContext.close();
    });
    await test.step("CMS-only rapid-navigation control disables all Siteimprove backoffice extensions", async () => {
        const controlContext = await browser.newContext();
        await controlContext.route(/\/manifest\/manifest\/(public|private)$/, async route => {
            const response = await route.fetch();
            const manifests = await response.json();
            await route.fulfill({ response, json: manifests.filter(m => m.name !== "Siteimprove Content Assistant") });
        });
        const controlPage = await controlContext.newPage();
        const controlErrors = [], pluginRequests = [];
        controlPage.on("pageerror", e => controlErrors.push({ message: e.message, stack: e.stack }));
        controlPage.on("request", r => {
            if (r.url().includes("/siteimprove/") || r.url().includes("/App_Plugins/Siteimprove/")
                || r.url() === OVERLAY) pluginRequests.push(r.url());
        });
        await login(controlPage);
        for (let i = 0; i < 12; i++) {
            const id = i % 2 ? second : first;
            await controlPage.evaluate(path => history.pushState(null, "", path), documentPath(id));
            await expect(controlPage.locator("umb-property-editor-ui-text-box input"))
                .toHaveValue(i % 2 ? "Preview content for Second Page" : "Edited while the Siteimprove overlay was blocked");
        }
        await controlPage.waitForLoadState("networkidle");
        expect(pluginRequests).toEqual([]);
        expect(controlErrors).toEqual([]);
        console.log("CMS-only control: Siteimprove requests=" + pluginRequests.length
            + ", browser errors=" + controlErrors.length);
        await testInfo.attach("cms-only-navigation-control", {
            body: JSON.stringify({ pluginRequests, controlErrors }, null, 2), contentType: "application/json"
        });
        await controlContext.close();
    });
    expect(errors).toEqual([]);
});
