import { test, expect } from "@playwright/test";

test("CMS-only authentication recovery and native section navigation diagnostics", async ({ page, context }, testInfo) => {
    const errors = [], consoleErrors = [], pluginRequests = [];
    await context.route(/\/manifest\/manifest\/(public|private)$/, async route => {
        const response = await route.fetch();
        await route.fulfill({ response, json: (await response.json()).filter(m => m.name !== "Siteimprove Content Assistant") });
    });
    page.on("pageerror", error => errors.push({ message: error.message, stack: error.stack }));
    page.on("console", message => {
        if (message.type() === "error") consoleErrors.push({ message: message.text(), location: message.location() });
    });
    page.on("request", request => {
        if (/siteimprove/i.test(request.url())) pluginRequests.push(request.url());
    });
    await page.goto("/umbraco/");
    await page.locator('[name="username"]').fill("admin@example.test");
    await page.locator('[name="password"]').fill(process.env.E2E_ADMIN_PASSWORD);
    await page.getByLabel("Login", { exact: true }).click();
    await expect(page.locator("umb-backoffice")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const header = page.locator("umb-backoffice-header");
    let navigationErrors = [], recovered = 0;
    try {
        for (let i = 0; i < 4; i++) {
            await header.locator('uui-tab[href="section/media"]').click();
            await expect(page.locator("umb-media-dashboard")).toBeVisible();
            await header.locator('uui-tab[href="section/user-management"]').click();
            await expect(page.getByRole("heading", { name: "Users", exact: true }).first()).toBeVisible();
            await header.locator('uui-tab[href="section/settings"]').click();
            await expect(page.getByRole("heading", { name: "Structure", exact: true })).toBeVisible();
        }
        navigationErrors = [...errors];
        await page.waitForLoadState("networkidle");
        // Expire the disposable browser's server session as well as its client state.
        // Otherwise background requests can immediately restore it from auth cookies.
        await context.clearCookies();
        await page.locator("umb-app").evaluate(async host => {
            const { UMB_AUTH_CONTEXT } = await import("@umbraco-cms/backoffice/auth");
            const auth = await host.getContext(UMB_AUTH_CONTEXT);
            auth.timeOut();
        });
        await expect(page.getByRole("heading", { name: "Sign in to Umbraco", exact: true })).toBeVisible();
        const popupPromise = page.waitForEvent("popup");
        await page.getByRole("button", { name: "Sign in with Umbraco", exact: true }).click();
        const popup = await popupPromise;
        await Promise.race([
            popup.locator('[name="username"]').waitFor({ state: "visible" }).then(async () => {
                await popup.locator('[name="username"]').fill("admin@example.test");
                await popup.locator('[name="password"]').fill(process.env.E2E_ADMIN_PASSWORD);
                await popup.getByLabel("Login", { exact: true }).click();
            }).catch(error => { if (!popup.isClosed()) throw error; }),
            popup.waitForEvent("close")
        ]);
        await expect(page.getByRole("heading", { name: "Sign in to Umbraco", exact: true })).toBeHidden();
        await header.locator('uui-tab[href="section/user-management"]').click();
        await expect(page.getByRole("heading", { name: "Users", exact: true }).first()).toBeVisible();
        recovered++;
        await page.waitForLoadState("networkidle");
    } finally {
        expect(pluginRequests).toEqual([]);
        await testInfo.attach("cms-auth-and-navigation-diagnostics", { body: JSON.stringify({
            pluginRequests, navigationErrors, errors, consoleErrors,
            authSubjectError: consoleErrors.some(e => e.message.includes("[AuthView]") && e.message.includes("_subject is undefined")),
            recoveries: recovered
        }, null, 2), contentType: "application/json" });
        await testInfo.attach("cms-only-recovered-users", { body: await page.screenshot(), contentType: "image/png" });
        console.log("CMS-only diagnostic: " + JSON.stringify({ errors: errors.length, consoleErrors: consoleErrors.length,
            recoveries: recovered, authSubjectError: consoleErrors.some(e => e.message.includes("[AuthView]") && e.message.includes("_subject is undefined")) }));
    }
});
