import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { errorSignature, knownCmsError } from "../cms-errors.js";

const API = "/umbraco/management/api/v1/";
const OVERLAY = "https://cdn.siteimprove.net/cms/overlay-latest.js";
const PUBLIC_ORIGIN = "https://public.example.test";
const stub = `
(() => {
    window.__siOverlayLoads = (window.__siOverlayLoads || 0) + 1;
    window.__siCommands = [];
    window.__siCallbacks = {};
    const launcher = document.createElement("div");
    launcher.className = "si-toggle-container";
    launcher.style.cssText = "position:fixed;right:0;bottom:0;pointer-events:none";
    launcher.textContent = "Siteimprove test launcher";
    document.body.appendChild(launcher);
    const panel = document.createElement("div");
    panel.className = "si-iframe-container";
    panel.style.cssText = "position:fixed;right:0;top:60px;pointer-events:none";
    panel.textContent = "Siteimprove test panel";
    document.body.appendChild(panel);
    let session;
    const resultKey = () => "__siDraftResult:" + (session || "shared");
    localStorage.setItem("__siDraftResult:shared", "Cached result from another draft");
    const queue = window._si || [];
    function capture(command) {
        if (command[0] === "setSession") {
            session = command[1];
            window.__siDraftResult = localStorage.getItem(resultKey());
        }
        if (command[0] === "registerPrepublishCallback") {
            window.__siCallbacks[command[0]] = () => {
                const result = command[1]();
                localStorage.setItem(resultKey(), result[0].title);
                window.__siDraftResult = result[0].title;
                return result;
            };
        } else if (typeof command[1] === "function") window.__siCallbacks[command[0]] = command[1];
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
    await expect(page.locator("umb-umbraco-news-dashboard")).toBeVisible();
}
async function navigate(page, path) {
    const documentId = path.match(/\/workspace\/document\/edit\/([^/]+)/)?.[1];
    const documentLoaded = documentId ? page.waitForResponse(response =>
        new URL(response.url()).pathname === API + "document/" + documentId
        && response.request().method() === "GET", { timeout: 20000 }) : undefined;
    const section = path.match(/\/section\/([^/]+)/)?.[1];
    const currentSection = new URL(page.url()).pathname.match(/\/section\/([^/]+)/)?.[1];
    const fullDocumentEntry = documentId && currentSection !== "content";
    if (fullDocumentEntry) {
        await page.goto(path);
    } else if (section !== currentSection && ["content", "settings"].includes(section)) {
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
        const target = page.locator('umb-document-tree uui-menu-item[href$="/edit/' + documentId + '"] #label');
        if (!fullDocumentEntry) {
            const caret = page.locator('umb-document-tree uui-menu-item[label="Home"] button#caret-button');
            await expect(caret).toBeVisible();
            const expand = page.getByRole("button", { name: "Expand child items for Home", exact: true });
            if (await expand.isVisible()) await expand.click();
            await expect(target).toBeVisible();
        }
        // Click the slotted label so native hit-testing waits for the menu to be ready.
        if (!fullDocumentEntry) await target.click();
        await expect(page).toHaveURL(new RegExp("/workspace/document/edit/" + documentId + "/"));
        const response = await documentLoaded;
        expect(response.status()).toBe(200);
        const document = await response.json();
        const text = document.values.find(value => value.alias === "text").value;
        await expect(page.locator("umb-property-editor-ui-text-box input")).toBeVisible();
        await expect(page.locator("umb-property-editor-ui-text-box input")).toHaveValue(text);
        await expect(page.getByTestId("workspace-action:Umb.WorkspaceAction.Document.SaveAndPublish")).toBeEnabled();
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

test("real Umbraco backoffice and preview lifecycle", async ({ page, context, request, browser, baseURL }, testInfo) => {
    const errors = [];
    page.on("pageerror", error => {
        errors.push({ message: error.message, stack: error.stack });
        console.log("Backoffice browser error", JSON.stringify({
            path: new URL(page.url()).pathname, message: error.message, stack: error.stack
        }));
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
    let home, first, second, draft, previewDraft, otherPreviewDraft, groups, writer;
    const savedDraftText = "Preview content from the latest saved draft";
    let baselineErrors = new Set();

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
        await expect(page.locator(".si-toggle-container")).toBeHidden();
        await expect(page.locator(".si-iframe-container")).toBeHidden();
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
            content: '@inherits Umbraco.Cms.Web.Common.Views.UmbracoViewPage\n@using Umbraco.Extensions\n<!doctype html><html><head><title>@Model.Name</title></head><body><h1>@Model.Name</h1><p class="content">@Model.Value("text")</p><a href="/second-page/">Second page</a></body></html>'
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
        otherPreviewDraft = await createDocument("Other Preview Draft", pageTypeId, templateId, home, false);
        groups = (await json("user-group?skip=0&take=100")).items;
        writer = groups.find(g => /writers|editors/i.test(g.name));
        expect(writer).toBeTruthy();
        // Let the initial dashboard requests finish before reloading the API-created fixtures.
        await page.waitForLoadState("networkidle");
        await page.reload();
        await expect(page.locator("umb-backoffice")).toBeVisible();
        await expect(page.locator("umb-umbraco-news-dashboard")).toBeVisible();
        await expect(page.locator("umb-document-tree").getByText("Home", { exact: true })).toBeVisible();
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
        await expect(page.locator(".si-toggle-container")).toBeVisible();
        await expect(page.locator(".si-iframe-container")).toBeVisible();
        await expect.poll(() => lastCommand(page)).toEqual(["input", PUBLIC_ORIGIN + "/first-page/", ""]);
        await navigate(page, documentPath(second));
        await expect.poll(() => lastCommand(page)).toEqual(["input", PUBLIC_ORIGIN + "/second-page/", ""]);
        await navigate(page, "/umbraco/section/settings/dashboard/siteimprove");
        await expect(page.locator("siteimprove-settings")).toBeVisible();
        await expect.poll(() => lastCommand(page)).toEqual(["clear", ""]);
        await expect(page.locator(".si-toggle-container")).toBeHidden();
        await expect(page.locator(".si-iframe-container")).toBeHidden();
    });

    await test.step("dashboards, Media and Users hide both the icon and an open panel", async () => {
        await navigate(page, documentPath(first));
        await page.getByRole("link", { name: "Content", exact: true }).click();
        await expect(page).toHaveURL(/\/section\/content(?:\/dashboard\/[^/]+)?$/);
        await page.waitForLoadState("networkidle");
        await expect(page.locator(".si-toggle-container")).toBeHidden();
        await page.locator("umb-backoffice-header").getByRole("tab", { name: "Media", exact: true }).click();
        await expect(page.locator("umb-media-dashboard")).toBeVisible();
        await page.waitForLoadState("networkidle");
        await expect(page.locator(".si-toggle-container")).toBeHidden();
        await expect(page.locator(".si-iframe-container")).toBeHidden();
        await page.locator('umb-backoffice-header uui-tab[href="section/user-management"]').click();
        await expect(page.getByRole("heading", { name: "Users", exact: true }).first()).toBeVisible();
        await page.waitForLoadState("networkidle");
        await expect.poll(() => page.evaluate(() => window.__siOverlayLoads)).toBe(1);
        await expect(page.locator(".si-toggle-container")).toBeHidden();
        await expect(page.locator(".si-iframe-container")).toBeHidden();
    });

    await test.step("unpublished content clears the assistant, then publishing refreshes its live URL", async () => {
        expect((await json("siteimprove/document/" + draft + "/url")).url).toBeNull();
        await navigate(page, documentPath(draft));
        await expect(page.getByTestId("workspace-action:Umb.WorkspaceAction.Document.SaveAndPublish")).toBeVisible();
        await expect.poll(() => lastCommand(page)).toEqual(["clear", ""]);
        await expect(page.locator(".si-toggle-container")).toBeVisible();
        await page.getByTestId("workspace-action:Umb.WorkspaceAction.Document.SaveAndPublish").click();
        await expect.poll(() => lastCommand(page)).toEqual(["input", PUBLIC_ORIGIN + "/draft-page/", ""]);
        await screenshot(page, testInfo, "document-published");
    });

    await test.step("save a renamed draft while keeping the published route", async () => {
        await navigate(page, documentPath(first));
        const name = page.getByRole("textbox", { name: "Enter a name...", exact: true });
        const text = page.locator("umb-property-editor-ui-text-box input");
        await name.fill("Renamed First Page");
        // Move focus through the native editor before filling its input.
        await text.click();
        await expect(text).toBeFocused();
        await text.fill(savedDraftText);
        await expect(name).toHaveValue("Renamed First Page");
        await expect(text).toHaveValue(savedDraftText);
        const saved = page.waitForResponse(r => new URL(r.url()).pathname === API + "document/" + first
            && r.request().method() === "PUT" && r.status() === 200);
        await page.getByTestId("workspace-action:Umb.WorkspaceAction.Document.Save").click();
        await saved;
        expect((await json("siteimprove/document/" + first + "/url")).url).toBe(PUBLIC_ORIGIN + "/first-page/");
    });

    const draftSessions = new Set();
    for (const [name, id] of [["published", () => first], ["never-published", () => previewDraft],
        ["other-draft", () => otherPreviewDraft], ["reopened-draft", () => previewDraft]]) {
        await test.step(name + " preview registers a full-page prepublish callback and highlighting", async () => {
            // The published document is already open from the preceding save step.
            if (name !== "published") await navigate(page, documentPath(id()));
            const popupPromise = page.waitForEvent("popup");
            await page.getByTestId("workspace-action:Umb.WorkspaceAction.Document.SaveAndPreview").click();
            const popup = await popupPromise;
            const frame = await previewFrame(popup);
            expect(await popup.evaluate(() => window.__siOverlayLoads || 0)).toBe(0);
            await expect.poll(() => frame.evaluate(() => window.__siOverlayLoads)).toBe(1);
            await expect(frame.locator(".si-toggle-container")).toBeVisible();
            await expect(frame.locator("script[data-siteimprove-preview]")).toHaveAttribute("data-page-url",
                name === "published" ? PUBLIC_ORIGIN + "/first-page/" : "");
            const session = await frame.locator("script[data-siteimprove-preview]").getAttribute("data-preview-session");
            const commands = await frame.evaluate(() => window.__siCommands);
            if (name === "published") {
                expect(session).toBe("");
                expect(commands[0][1]).toBeNull();
            } else {
                expect(session).toMatch(/^[0-9a-f-]{36}$/);
                expect(draftSessions.has(session)).toBe(false);
                draftSessions.add(session);
                expect(commands[0]).toEqual(["setSession", session, null, "Umbraco 17.7.1"]);
                expect(commands[1]).toEqual(["clear"]);
                expect(await frame.evaluate(() => window.__siDraftResult)).toBeNull();
            }
            if (name === "published") {
                await expect(frame.getByRole("heading", { name: "Renamed First Page", exact: true })).toBeVisible();
                await expect(frame.locator(".content")).toHaveText(savedDraftText);
            }
            else
                expect(await frame.evaluate(() => window.__siCommands.some(c => c[0] === "input"))).toBe(false);
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
            expect(await frame.evaluate(() => window.__siDraftResult)).toBe(await frame.title());
            await screenshot(popup, testInfo, name + "-preview");
            await frame.getByRole("link", { name: "Second page", exact: true }).click();
            await expect(frame.getByRole("heading", { name: "Second Page", exact: true })).toBeVisible();
            await expect(frame.locator("script[data-siteimprove-preview]")).toHaveAttribute("data-page-url", PUBLIC_ORIGIN + "/second-page/");
            await expect.poll(() => frame.evaluate(() => window.__siOverlayLoads)).toBe(1);
            await expect(frame.locator("script[data-siteimprove-preview]")).toHaveAttribute("data-preview-session", "");
            expect(await frame.evaluate(() => window.__siCommands[0][1])).toBeNull();
            await popup.close();
        });
    }

    await test.step("ordinary public pages receive no preview injection", async () => {
        const publicContext = await browser.newContext({ baseURL });
        const publicPage = await publicContext.newPage();
        const response = await publicPage.goto("/first-page/");
        expect(response.status()).toBe(200);
        await expect(publicPage.getByRole("heading", { name: "First Page", exact: true })).toBeVisible();
        expect(await publicPage.locator("script[data-siteimprove-preview]").count()).toBe(0);
        await expect(publicPage.locator(".content")).toHaveText("Preview content for First Page");
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
        const writerContext = await browser.newContext({ baseURL });
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

    await test.step("template and document-type modals hide the assistant and closing restores it", async () => {
        await navigate(page, documentPath(first));
        await page.getByRole("tab", { name: "Info", exact: true }).click();
        for (const name of ["Browser Test", "Browser Test Page"]) {
            await page.getByRole("link", { name, exact: true }).click();
            await expect(page.getByRole("dialog")).toBeVisible();
            if (name === "Browser Test") await expect(page.locator(".monaco-editor")).toBeVisible();
            await expect(page.locator(".si-toggle-container")).toBeHidden();
            await expect(page.locator(".si-iframe-container")).toBeHidden();
            await screenshot(page, testInfo, "non-content-workspace-" + name.replaceAll(" ", "-"));
            await page.getByRole("button", { name: "Close", exact: true }).click();
            await expect(page.getByRole("dialog")).toBeHidden();
            await expect(page.locator(".si-toggle-container")).toBeVisible();
            await expect(page.locator(".si-iframe-container")).toBeVisible();
        }
    });

    await test.step("session timeout hides the assistant and sign-in restores the selected document", async () => {
        await navigate(page, documentPath(second));
        await navigate(page, documentPath(first));
        await expect(page.locator(".si-toggle-container")).toBeVisible();
        await expect(page.locator(".si-iframe-container")).toBeVisible();
        await page.locator("umb-app").evaluate(async host => {
            const { UMB_AUTH_CONTEXT } = await import("@umbraco-cms/backoffice/auth");
            const auth = await Promise.race([host.getContext(UMB_AUTH_CONTEXT),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Auth context lookup timed out")), 5000))]);
            if (!auth) throw new Error("No CMS auth context in the disposable test host");
            auth.timeOut();
        });
        await expect(page.getByRole("heading", { name: "Sign in to Umbraco", exact: true })).toBeVisible();
        await expect(page.locator(".si-toggle-container")).toBeHidden();
        await expect(page.locator(".si-iframe-container")).toBeHidden();
        await screenshot(page, testInfo, "expired-session-assistant-hidden");
        const popupPromise = page.waitForEvent("popup");
        await page.getByRole("button", { name: "Sign in with Umbraco", exact: true }).click();
        const popup = await popupPromise;
        const deadline = Date.now() + 20000;
        while (Date.now() < deadline && !popup.isClosed()) {
            if (await popup.locator('[name="username"]').isVisible().catch(() => false)) {
                await popup.locator('[name="username"]').fill("admin@example.test");
                await popup.locator('[name="password"]').fill(process.env.E2E_ADMIN_PASSWORD);
                await popup.getByLabel("Login", { exact: true }).click();
                break;
            }
            await page.waitForTimeout(200);
        }
        await expect(page.getByRole("heading", { name: "Sign in to Umbraco", exact: true })).toBeHidden();
        await expect(page.locator(".si-toggle-container")).toBeVisible();
        await expect.poll(() => lastCommand(page)).toEqual(["input", PUBLIC_ORIGIN + "/first-page/", ""]);
        await screenshot(page, testInfo, "session-recovered-with-current-document");
    });
    await test.step("a blocked overlay does not prevent content editing", async () => {
        const offlineContext = await browser.newContext({ baseURL });
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
        const offlineField = offlinePage.locator("umb-property-editor-ui-text-box input");
        await offlineField.click();
        await expect(offlineField).toBeFocused();
        await offlineField.fill("Edited while the Siteimprove overlay was blocked");
        await offlineField.press("Tab");
        await expect(offlinePage.getByRole("textbox", { name: "Enter a name...", exact: true })).toHaveValue("Renamed First Page");
        const saved = offlinePage.waitForResponse(r =>
            r.url().includes("/document/" + first + "/update-and-publish") && r.status() === 200);
        await offlinePage.getByTestId("workspace-action:Umb.WorkspaceAction.Document.SaveAndPublish").click();
        const savedResponse = await saved;
        expect(savedResponse.request().postDataJSON().values.find(value => value.alias === "text").value)
            .toBe("Edited while the Siteimprove overlay was blocked");
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
        const controlContext = await browser.newContext({ baseURL });
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
        await controlPage.locator('umb-backoffice-header uui-tab[href="section/media"]').click();
        await expect(controlPage.locator("umb-media-dashboard")).toBeVisible();
        await controlPage.waitForLoadState("networkidle");
        // Use the CMS lifecycle API to reproduce an uncancelled debounced reload after disposal.
        await controlPage.locator("umb-media-collection").evaluate(async host => {
            const { UMB_COLLECTION_CONTEXT } = await import("@umbraco-cms/backoffice/collection");
            const collection = await host.getContext(UMB_COLLECTION_CONTEXT);
            collection.loadCollection();
            collection.destroy();
        });
        await controlPage.locator('umb-backoffice-header uui-tab[href="section/user-management"]').click();
        await expect(controlPage.getByRole("heading", { name: "Users", exact: true }).first()).toBeVisible();
        await controlPage.waitForLoadState("networkidle");
        await expect.poll(() => controlErrors.some(error => error.message.includes("Missing repository for"))).toBe(true);
        async function controlDocument(id, text) {
            await controlPage.evaluate(path => history.pushState(null, "", path), documentPath(id));
            await expect(controlPage.locator("umb-property-editor-ui-text-box input")).toBeVisible();
            await expect(controlPage.locator("umb-property-editor-ui-text-box input")).toHaveValue(text);
            await controlPage.waitForLoadState("networkidle");
        }
        for (let i = 0; i < 6; i++) {
            await controlDocument(first, "Edited while the Siteimprove overlay was blocked");
            await expect(controlPage.getByRole("heading", { name: "Content", exact: true }).first()).toBeVisible();
            const expand = controlPage.getByRole("button", { name: "Expand child items for Home", exact: true });
            if (await expand.isVisible()) await expand.click();
            await controlPage.locator('umb-backoffice-header uui-tab[href="section/settings"]').click();
            await expect(controlPage.getByRole("heading", { name: "Structure", exact: true })).toBeVisible();
            await controlPage.waitForLoadState("networkidle");
        }
        await controlDocument(first, "Edited while the Siteimprove overlay was blocked");
        await screenshot(controlPage, testInfo, "cms-only-document");
        await controlPage.getByRole("tab", { name: "Info", exact: true }).click();
        for (const name of ["Browser Test", "Browser Test Page"]) {
            await controlPage.getByRole("link", { name, exact: true }).click();
            await expect(controlPage.getByRole("dialog")).toBeVisible();
            if (name === "Browser Test") await expect(controlPage.locator(".monaco-editor")).toBeVisible();
            await screenshot(controlPage, testInfo, "cms-only-workspace-" + name.replaceAll(" ", "-"));
            await controlPage.getByRole("button", { name: "Close", exact: true }).click();
            await expect(controlPage.getByRole("link", { name, exact: true })).toBeVisible();
        }
        await controlPage.locator("umb-document-workspace-editor").getByRole("tab", { name: "Content", exact: true }).click();
        await expect(controlPage.locator("umb-property-editor-ui-text-box input")).toBeVisible();
        for (let i = 0; i < 12; i++) {
            const id = i % 2 ? second : first;
            await controlPage.evaluate(path => history.pushState(null, "", path), documentPath(id));
            await expect(controlPage.locator("umb-property-editor-ui-text-box input"))
                .toHaveValue(i % 2 ? "Preview content for Second Page" : "Edited while the Siteimprove overlay was blocked");
        }
        await controlPage.waitForLoadState("networkidle");
        expect(pluginRequests).toEqual([]);
        expect(controlErrors.filter(error => !knownCmsError(error))).toEqual([]);
        baselineErrors = new Set(controlErrors.map(errorSignature));
        console.log("CMS-only error signatures", JSON.stringify([...new Set(controlErrors.map(errorSignature))]));
        console.log("CMS-only control: Siteimprove requests=" + pluginRequests.length
            + ", browser errors=" + controlErrors.length);
        await testInfo.attach("cms-only-navigation-control", {
            body: JSON.stringify({ pluginRequests, controlErrors }, null, 2), contentType: "application/json"
        });
        await controlContext.close();
    });
    // Unknown errors still fail; confirmed CMS defects remain explicit diagnostics.
    expect(errors.filter(error => !knownCmsError(error))).toEqual([]);
    const unmatchedCmsErrors = errors.filter(error => !baselineErrors.has(errorSignature(error)));
    await testInfo.attach("cms-console-comparison", {
        body: JSON.stringify({ errors, unmatchedCmsErrors }, null, 2), contentType: "application/json"
    });
    console.log("CMS exceptions: plugin flow=" + errors.length
        + ", not reproduced in this control=" + unmatchedCmsErrors.length);
});


test("the assistant initializes on an HTTP backoffice without randomUUID", async ({ browser }, testInfo) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.route("http://backoffice.example.test/**", route => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith(".js")) {
            const name = path.slice(1);
            if (!["assistant.js", "visibility.js"].includes(name)) return route.abort();
            return route.fulfill({ contentType: "text/javascript", body: readFileSync(
                new URL("../../../contentFiles/App_Plugins/Siteimprove/" + name, import.meta.url), "utf8") });
        }
        return route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head></head><body>
            <h1>HTTP backoffice diagnostic</h1><p id="result">Initializing</p>
            <script type="module">
                import { assistant } from "/assistant.js";
                assistant.initialize("17.7.1");
                await assistant.select("draft", {pageUrl: async () => ({url: null})}, "draft", null, false);
                document.querySelector("#result").textContent = "Isolated draft ready";
            </script></body></html>` });
    });
    await page.goto("http://backoffice.example.test/");
    expect(await page.evaluate(() => isSecureContext)).toBe(false);
    expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe("undefined");
    await expect(page.getByText("Isolated draft ready", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => window._si.find(c => c[0] === "setSession")[1])).toMatch(/^[0-9a-f-]{36}$/);
    await screenshot(page, testInfo, "http-backoffice-session");
    await context.close();
});

test("native Users navigation with the plugin disabled", async ({ page, context }, testInfo) => {
    const errors = [], pluginRequests = [];
    await context.route(/\/manifest\/manifest\/(public|private)$/, async route => {
        const response = await route.fetch();
        const manifests = await response.json();
        await route.fulfill({ response, json: manifests.filter(m => m.name !== "Siteimprove Content Assistant") });
    });
    page.on("pageerror", error => errors.push({ message: error.message, stack: error.stack }));
    page.on("request", r => {
        if (/siteimprove/i.test(r.url())) pluginRequests.push(r.url());
    });
    await login(page);
    await page.locator('umb-backoffice-header uui-tab[href="section/user-management"]').click();
    await expect(page.getByRole("heading", { name: "Users", exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Users", exact: true }).first()).toBeVisible();
    expect(pluginRequests).toEqual([]);
    await testInfo.attach("plugin-disabled-users-errors", {
        body: JSON.stringify({ pluginRequests, errors }, null, 2), contentType: "application/json"
    });
    await screenshot(page, testInfo, "native-users-without-plugin");
});
