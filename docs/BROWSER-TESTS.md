# Browser functionality tests

## Verified result

Passed on 2026-10-13 against source commit
`9498febad094533b6fe7b2c571d551cae3d285c8`: the full Chromium flow completed
in 40.1 seconds. The workflow also passed all 36 regression tests, package creation,
NuGet installation, and published asset checks.

Workflow and evidence:
https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/38456212323

Testing found duplicate overlays in Umbraco's preview shell; the port now skips
that shell and loads the assistant once in the rendered preview iframe.

The suite in `tests/browser` runs Chromium through Playwright against an actual
Umbraco 17.7.1 application on .NET 10. The host installs the packaged plugin via
NuGet, uses SQLite, and creates temporary admin/writer accounts and content through
Umbraco's real Management API. It is bound to localhost.

Siteimprove's CDN overlay is replaced with a browser stub that records commands and
callbacks. This verifies the plugin's integration contract without a Siteimprove
account. Siteimprove's own panel, account sign-in, crawl results, and remote
prepublish analysis are outside this test.

## Covered behavior

The browser flow checks:

1. Anonymous requests are denied by the plugin APIs.
2. Backoffice login loads the installed extensions and authenticated plugin API.
3. The settings dashboard saves a public domain, persists it after reload, and
   rejects URLs containing a path.
4. Switching documents sends the mapped URL; leaving content clears stale context.
5. Unpublished content clears live-page context; publishing refreshes the live URL.
6. Published and never-published previews render with the preview script.
7. Preview callbacks return the rendered document and register highlighting.
8. The preview shell loads no duplicate overlay; the rendered iframe loads one.
9. Ordinary public pages receive no preview injection.
10. A non-admin account is denied settings read/write access.
11. Blocking Siteimprove's CDN still permits editing, saving and publishing content.

Screenshots and a Playwright trace are retained in the GitHub workflow's
`Siteimprove-Playwright-evidence` artifact. The trace records a temporary local test
session, not a production account.

## Run locally

Use .NET 10, Node 24, Python 3, and a shell with Bash. On a clean checkout:

```sh
dotnet pack Siteimprove.Umbraco17.Plugin.csproj -c Release -o artifacts
bash scripts/prepare-browser-tests.sh
export E2E_ADMIN_PASSWORD="Choose-a-temporary-test-password"
npm --prefix tests/browser test
```

The password is supplied to the temporary unattended installation through an
environment variable and is not committed. The fixture enables runtime Razor
compilation because it creates its test templates through the API after building
the host.

A rerun reuses the fixture's SQLite database unless its generated
`tests/browser/host/umbraco/Data` directory is removed first. Use an isolated,
disposable checkout for repeated runs; do not point these tests at a real site.
Generated database, views, assets, reports, and dependency directories are ignored.

To inspect downloaded evidence, extract the artifact and run:

```sh
npx playwright show-report playwright-report
npx playwright show-trace test-results/plugin-real-Umbraco-backoffice-and-preview-lifecycle/trace.zip
```

## Remaining acceptance

These are standalone Linux/Chromium checks. They do not certify an actual Umbraco
Cloud deployment, a Windows/IIS installation, multilingual/multisite routing,
custom CSP/proxy settings, or a live Siteimprove account. Those acceptance checks
remain in [VALIDATION.md](VALIDATION.md).

The full CMS test host restore reports NuGet audit warnings for Umbraco's inherited
ImageSharp 3.1.12 dependency. No image processing is exercised by this suite.
Review the application dependency audit and patched Umbraco/dependency releases
before production deployment.
