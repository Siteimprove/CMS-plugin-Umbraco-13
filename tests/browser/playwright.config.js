import { defineConfig } from "@playwright/test";
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
    use: {
        baseURL: "http://localhost:5017",
        browserName: "chromium",
        testIdAttribute: "data-mark",
        trace: "on",
        screenshot: "only-on-failure"
    },
    webServer: {
        command: "dotnet run --project host/BrowserHost.csproj -c Release --no-build --no-launch-profile",
        url: "http://localhost:5017/umbraco/login",
        timeout: 180000,
        reuseExistingServer: false,
        env: {
            ASPNETCORE_URLS: "http://localhost:5017",
            ASPNETCORE_ENVIRONMENT: "Development",
            Umbraco__CMS__Unattended__UnattendedUserPassword: password
        }
    }
});
