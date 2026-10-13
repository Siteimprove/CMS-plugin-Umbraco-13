# Customer beta: 1.0.0-beta.2

This beta ports Siteimprove Content Assistant to **Umbraco 17.7.1+ (17.x)** on
**.NET 10**, for customer acceptance testing on Umbraco Cloud or self-hosted sites.
It is not a stable release and is not published to NuGet.org.

Beta.2 supersedes beta.1 after a quality review. It adds document-level browse
authorization to URL requests, uses Umbraco's required workspace-context API,
guards delayed initialization and teardown, and shares one package version across the build and test
host. Use beta.2 for the customer trial. See [review findings](REVIEW.md).

The configuration is under **Settings → Siteimprove**. The package integrates
published document URLs, save/publish refreshes, full-page preview checks and
highlighting, and optional environment-specific public-domain mapping. It retains
the v13 database setting. Installing it does not upgrade the CMS itself.

## Bundle contents

- `Siteimprove.Umbraco17.Plugin.1.0.0-beta.2.nupkg`: installable NuGet package.
- `START-HERE.md`, `README.md`, and `docs/`: installation, usage, beta notes,
  automated-test evidence, and acceptance guidance.
- `release.json`: version, source commit, build commit, package checksum, and
  the validation workflow URL when built in GitHub Actions.
- `SHA256SUMS`: checksums of all the other files in the customer ZIP.

The CI customer bundle is created only after regression tests, package
installation/publish checks, and the full Chromium/Playwright flow pass.
The exact beta run is recorded in its `release.json`.

For an extracted bundle on Linux/macOS with `sha256sum`, run
`sha256sum --check SHA256SUMS`. On PowerShell, use
`Get-FileHash ./Siteimprove.Umbraco17.Plugin.1.0.0-beta.2.nupkg -Algorithm SHA256`
and compare the hash with `SHA256SUMS` or `release.json`.

## Install

Follow [installation and upgrade](INSTALLATION.md) to configure a local or
internal NuGet source, then add the package to the Umbraco web project:

```sh
dotnet add src/YourSite/YourSite.csproj package Siteimprove.Umbraco17.Plugin --version 1.0.0-beta.2
```

Run this from the site repository root after configuring the source. Replace
the project path with your own. Build, deploy to a test environment, and open
**Settings → Siteimprove**. No custom top-level section permission is needed.
Use [the usage guide](USAGE.md) for domain configuration and editor workflows.

## Customer acceptance

Record the hosting environment, Umbraco version, and package version when trying
the beta. With your actual Siteimprove account, check:

1. The assistant appears once after login and shows the selected published page.
2. Switching pages, saving, and publishing refresh the expected URL and results.
3. Settings saves the public domain and retains it after reload. Check the
   environment override if you use one.
4. Save and preview works for published and never-published content. Run a real
   prepublish check and confirm highlighting in the rendered page.
5. Normal content editing and publishing still work when the Siteimprove script
   is blocked or unavailable.
6. Check your languages, site domains, custom CSP/proxy, and Cloud or IIS
   deployment as applicable. Confirm an upgraded v13 site's saved domain remains.

The browser suite uses a stub for Siteimprove's overlay. It verifies the CMS
integration, not Siteimprove's own login, live results, or remote analysis.
Those checks and actual Cloud/Windows deployment acceptance remain pending.
Multilingual/multisite routing also needs acceptance in the customer's setup.
Headless/external preview rendering requires a separate integration.

See [browser tests](BROWSER-TESTS.md) for coverage and
[validation](VALIDATION.md) for the full release checklist and the test host's
inherited dependency audit warnings.

## Feedback and rollback

Report the action, expected/actual result, hosting and version information, and
relevant browser errors. Remove credentials, session tokens, and private page
content before sharing screenshots or logs. No customer contact details or
credentials are needed to install the package.

Keep your previous application/package and use your site's deployment rollback
process if needed. Removing the v17 plugin leaves content and the saved domain
mapping intact. The Umbraco 13 plugin cannot run on Umbraco 17; see
[removal and rollback](INSTALLATION.md#removing-or-reverting-the-plugin).
