import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
const engines = ["chromium", "firefox", "webkit"];
const origin = index => "http://localhost:" + (5017 + index);
const fixture = name => fileURLToPath(new URL("./.hosts/" + name, import.meta.url));
const password = process.env.E2E_ADMIN_PASSWORD;
if (!password) throw new Error("Set E2E_ADMIN_PASSWORD for the temporary local test installation.");

export default defineConfig({
    testDir: "./specs",
    timeout: 240000,
    expect: { timeout: 20000 },
    workers: 1,
    retries: 0,
    reporter: [["line"], ["html", { outputFolder: "playwright-report", open: "never" }],
        ["json", { outputFile: "test-results/results.json" }]],
    projects: engines.map((name, index) => ({ name, use: { browserName: name, baseURL: origin(index) } })),
    use: {
        baseURL: "http://localhost:5017",
        actionTimeout: 20000,
        navigationTimeout: 30000,
        testIdAttribute: "data-mark",
        trace: "on",
        screenshot: "only-on-failure"
    },
    webServer: engines.map((name, index) => ({
        command: "dotnet host/bin/Release/net10.0/BrowserHost.dll",
        url: origin(index) + "/umbraco/login",
        timeout: 180000,
        reuseExistingServer: false,
        stdout: "pipe",
        stderr: "pipe",
        env: {
            ASPNETCORE_URLS: origin(index),
            ASPNETCORE_CONTENTROOT: fixture(name),
            ASPNETCORE_ENVIRONMENT: "Development",
            ConnectionStrings__umbracoDbDSN: "Data Source=" + fixture(name) + "/BrowserTests.sqlite.db;Cache=Shared;Foreign Keys=True;Pooling=True",
            Umbraco__CMS__Unattended__UnattendedUserPassword: password
        }
    }))
});
