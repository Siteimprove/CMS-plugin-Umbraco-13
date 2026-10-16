import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { knownCmsError } from "../cms-errors.js";

const API = "/umbraco/management/api/v1/";
const OVERLAY = "https://cdn.siteimprove.net/cms/overlay-latest.js";
const stub = `window.__siCommands=[];const q=window._si||[];window._si={push:c=>window.__siCommands.push(c)};q.forEach(c=>window._si.push(c));for(const cls of ['si-toggle-container','si-iframe-container']){const el=document.createElement('div');el.className=cls;el.textContent=cls;el.style.cssText='position:fixed;right:0;bottom:0;pointer-events:none';document.body.append(el);}`;

async function setup(page, context, enabled) {
    const errors = [], pluginRequests = [];
    let token;
    page.on("pageerror", error => errors.push({ message: error.message, stack: error.stack }));
    page.on("request", request => {
        if (/siteimprove/i.test(request.url())) pluginRequests.push(request.url());
        const bearer = request.headers().authorization;
        if (request.url().includes(API) && bearer?.startsWith("Bearer ")) token = bearer;
    });
    if (enabled) await context.route(OVERLAY, route => route.fulfill({ contentType: "text/javascript", body: stub }));
    else await context.route(/\/manifest\/manifest\/(public|private)$/, async route => {
        const response = await route.fetch();
        await route.fulfill({ response, json: (await response.json()).filter(m => m.name !== "Siteimprove Content Assistant") });
    });
    await page.goto("/umbraco/");
    await page.locator('[name="username"]').fill("admin@example.test");
    await page.locator('[name="password"]').fill(process.env.E2E_ADMIN_PASSWORD);
    await page.getByLabel("Login", { exact: true }).click();
    await expect(page.locator("umb-backoffice")).toBeVisible();
    // The shell appears before the initial dashboard's lazy import completes.
    await expect(page.locator("umb-umbraco-news-dashboard")).toBeVisible();
    async function api(path, data, method = "POST") {
        const response = await page.request.fetch(API + path, {
            method, headers: { Authorization: token }, ...(data ? { data } : {})
        });
        expect(response.ok(), path + ": " + response.status() + " " + await response.text()).toBe(true);
        return response;
    }
    const suffix = randomUUID().slice(0, 8);
    const textType = randomUUID(), pickerType = randomUUID(), template = randomUUID();
    const pageType = randomUUID(), rootType = randomUUID();
    await api("data-type", { id: textType, name: "Workflow text " + suffix,
        editorAlias: "Umbraco.TextBox", editorUiAlias: "Umb.PropertyEditorUi.TextBox", values: [] });
    await api("data-type", { id: pickerType, name: "Workflow picker " + suffix,
        editorAlias: "Umbraco.ContentPicker", editorUiAlias: "Umb.PropertyEditorUi.DocumentPicker", values: [] });
    await api("template", { id: template, name: "Workflow " + suffix, alias: "workflow" + suffix,
        content: '@inherits Umbraco.Cms.Web.Common.Views.UmbracoViewPage\n@using Umbraco.Extensions\n<!doctype html><html><head><title>@Model.Name</title></head><body><h1>@Model.Name</h1><p>@Model.Value("text")</p></body></html>' });
    function type(id, root) {
        const group = randomUUID();
        return { id, alias: "workflow" + (root ? "Root" : "Page") + suffix,
            name: (root ? "Workflow Root " : "Workflow Page ") + suffix, icon: "icon-document",
            allowedAsRoot: root, variesByCulture: false, variesBySegment: false, isElement: false,
            properties: [["text", "Text", textType], ["related", "Related page", pickerType]].map(([alias, name, dataType], sortOrder) => ({
                id: randomUUID(), alias, name, sortOrder, dataType: { id: dataType }, container: { id: group },
                variesByCulture: false, variesBySegment: false, validation: { mandatory: false }, appearance: { labelOnTop: false }
            })), containers: [{ id: group, name: "Content", type: "Group", sortOrder: 0 }],
            compositions: [], allowedTemplates: [{ id: template }], defaultTemplate: { id: template },
            allowedDocumentTypes: root ? [{ documentType: { id: pageType }, sortOrder: 0 }] : [],
            cleanup: { preventCleanup: true } };
    }
    await api("document-type", type(pageType, false));
    await api("document-type", type(rootType, true));
    const home = randomUUID(), first = randomUUID(), second = randomUUID();
    const names = { home: "Workflow home " + suffix, first: "Workflow first " + suffix, second: "Workflow second " + suffix };
    for (const [id, name, parent, typeId, related] of [
        [home, names.home, null, rootType, first], [first, names.first, home, pageType, second],
        [second, names.second, home, pageType, null]
    ]) await api("document", { id, parent: parent ? { id: parent } : null, documentType: { id: typeId },
        template: { id: template }, values: [{ alias: "text", culture: null, segment: null, value: name },
            ...(related ? [{ alias: "related", culture: null, segment: null, value: related }] : [])],
        variants: [{ culture: null, segment: null, name }] });
    for (const id of [home, first, second]) await api("document/" + id + "/publish", { publishSchedules: [{ culture: null }] }, "PUT");
    const paths = enabled ? Object.fromEntries(await Promise.all([home, first, second].map(async id => [id,
        (await (await api("siteimprove/document/" + id + "/url", null, "GET")).json()).url]))) : {};
    await page.goto("/umbraco/section/content/workspace/document/edit/" + home + "/invariant");
    await expect(page.getByRole("textbox", { name: "Enter a name...", exact: true })).toHaveValue(names.home);
    await expect(page.locator("umb-property-editor-ui-document-picker").getByRole("link", { name: names.first })).toBeVisible();
    return { home, first, second, names, paths, suffix, errors, pluginRequests, api };
}

for (const enabled of [true, false]) test("new documents and nested document pickers, plugin " + (enabled ? "enabled" : "disabled"),
    async ({ page, context }, testInfo) => {
        const f = await setup(page, context, enabled);
        const command = () => page.evaluate(() => window.__siCommands?.at(-1));
        const input = id => ["input", f.paths[id], ""];
        const launcher = page.locator(".si-toggle-container");
        const panel = page.locator(".si-iframe-container");
        if (enabled) await expect.poll(command).toEqual(input(f.home));
        try {
            await test.step("create a document through the native UI and save it as a draft", async () => {
                await page.locator('umb-document-tree uui-menu-item[label="' + f.names.home + '"]').hover();
                await page.getByRole("button", { name: "Create item for " + f.names.home, exact: true }).click();
                await expect(page.getByRole("dialog")).toBeVisible();
                await page.locator("uui-ref-node-document-type").filter({ hasText: "Workflow Page " + f.suffix }).click();
                await expect(page.getByRole("textbox", { name: "Enter a name...", exact: true })).toHaveValue("");
                if (enabled) {
                    await expect(launcher).toBeVisible();
                    await expect.poll(command).toEqual(["clear", ""]);
                }
                const name = "Created draft " + f.suffix;
                await page.getByRole("textbox", { name: "Enter a name...", exact: true }).fill(name);
                await page.locator("umb-property-editor-ui-text-box input").fill("Saved through the new-document UI");
                const saved = page.waitForResponse(r => new URL(r.url()).pathname === API + "document" && r.request().method() === "POST");
                await page.getByTestId("workspace-action:Umb.WorkspaceAction.Document.Save").click();
                expect((await saved).status()).toBe(201);
                await expect(page).toHaveURL(/\/workspace\/document\/edit\/[0-9a-f-]+\/invariant/);
                const id = new URL(page.url()).pathname.match(/\/document\/edit\/([^/]+)/)[1];
                if (enabled) {
                    expect((await (await f.api("siteimprove/document/" + id + "/url", null, "GET")).json()).url).toBeNull();
                    await expect.poll(command).toEqual(["clear", ""]);
                }
                await testInfo.attach("saved-new-draft", { body: await page.screenshot(), contentType: "image/png" });
                await page.goto("/umbraco/section/content/workspace/document/edit/" + f.home + "/invariant");
                await expect(page.getByRole("textbox", { name: "Enter a name...", exact: true })).toHaveValue(f.names.home);
            });
            await test.step("closing nested document editors restores each parent's published context", async () => {
                const picker = page.locator("umb-property-editor-ui-document-picker");
                await picker.getByRole("link", { name: f.names.first, exact: true }).click();
                await expect(page.getByRole("dialog")).toHaveCount(1);
                const firstEditor = page.locator('umb-document-workspace-editor').last();
                await expect(firstEditor.getByRole("textbox", { name: "Enter a name...", exact: true })).toHaveValue(f.names.first);
                if (enabled) {
                    await expect(launcher).toBeVisible();
                    await expect.poll(command).toEqual(input(f.first));
                }
                await firstEditor.locator("umb-property-editor-ui-document-picker").getByRole("link", { name: f.names.second, exact: true }).click();
                await expect(page.getByRole("dialog")).toHaveCount(2);
                await expect(page.locator('umb-document-workspace-editor').last().getByRole("textbox", { name: "Enter a name...", exact: true })).toHaveValue(f.names.second);
                if (enabled) await expect.poll(command).toEqual(input(f.second));
                await testInfo.attach("two-nested-document-editors", { body: await page.screenshot(), contentType: "image/png" });
                await page.getByRole("button", { name: "Close", exact: true }).last().click();
                await expect(page.getByRole("dialog")).toHaveCount(1);
                await expect(page.locator('umb-document-workspace-editor').last().getByRole("textbox", { name: "Enter a name...", exact: true })).toHaveValue(f.names.first);
                if (enabled) {
                    await expect.soft(launcher, "inner modal close restores the parent launcher").toBeVisible({ timeout: 5000 });
                    await expect.soft(panel, "inner modal close restores the parent panel").toBeVisible({ timeout: 5000 });
                    await expect.soft.poll(command, { message: "inner modal close restores the parent URL", timeout: 5000 }).toEqual(input(f.first));
                }
                await testInfo.attach("after-inner-editor-close", { body: await page.screenshot(), contentType: "image/png" });
                await page.getByRole("button", { name: "Close", exact: true }).click();
                await expect(page.getByRole("dialog")).toHaveCount(0);
                await expect(page.getByRole("textbox", { name: "Enter a name...", exact: true })).toHaveValue(f.names.home);
                if (enabled) {
                    await expect.soft(launcher, "outer modal close restores the main launcher").toBeVisible({ timeout: 5000 });
                    await expect.soft(panel, "outer modal close restores the main panel").toBeVisible({ timeout: 5000 });
                    await expect.soft.poll(command, { message: "outer modal close restores the main URL", timeout: 5000 }).toEqual(input(f.home));
                }
                await testInfo.attach("after-outer-editor-close", { body: await page.screenshot(), contentType: "image/png" });
            });
        } finally {
            if (!enabled) expect(f.pluginRequests).toEqual([]);
            await testInfo.attach("workflow-console", { body: JSON.stringify({ errors: f.errors,
                pluginRequests: f.pluginRequests, lastCommand: enabled ? await command() : null }, null, 2), contentType: "application/json" });
            expect(f.errors.filter(error => !knownCmsError(error))).toEqual([]);
        }
    });
