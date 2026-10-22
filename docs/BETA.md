# Customer beta: 1.0.0-beta.8

This beta ports Siteimprove Content Assistant to **Umbraco 17.7.1+ (17.x)** on
**.NET 10**, for customer acceptance testing on Umbraco Cloud or self-hosted sites.
It is not a stable release and is not published to NuGet.org.

Beta.6 restores the parent document's launcher and URL after closing nested
document editors, retains parent culture updates, and rejects closed or unauthorized
contexts. It includes beta.5's isolated draft results, published-route preview URL
resolution, and visibility and authentication fixes.
See [beta.7 changes](releases/1.0.0-beta.8.md) and [review findings](REVIEW.md).
Opening or reloading an unpublished preview starts with no prior results. Run a
content check to analyze that rendered draft; Recheck draft and highlighting remain
available while the preview is open.

The configuration is under **Settings → Siteimprove**. The package integrates
published document URLs, save/publish refreshes, full-page preview checks and
highlighting, and optional environment-specific public-domain mapping. It retains
the v13 database setting. Installing it does not upgrade the CMS itself.

## Bundle contents

- `Siteimprove.Umbraco17.Plugin.1.0.0-beta.8.nupkg`: installable NuGet package.
- `START-HERE.md`, `README.md`, and `docs/`: installation, usage, beta notes,
  release notes, automated-test evidence, acceptance and release guidance.
- `release.json`: version, source commit, build commit, package checksum, and
  source worktree status and validation workflow URL when built in GitHub Actions.
- `SHA256SUMS`: checksums of all the other files in the customer ZIP.

The CI customer bundle is created only after regression tests, package
installation/publish checks, and the Chromium, Firefox and WebKit/Playwright flows pass.
Creation also verifies NuGet/source asset equality, package/build commit equality,
guide links, required contents and every checksum. The exact beta run is recorded
in `release.json`; confirm that it completed successfully before distribution.

For an extracted bundle on Linux/macOS with `sha256sum`, run
`sha256sum --check SHA256SUMS`. On PowerShell, use
`Get-FileHash ./Siteimprove.Umbraco17.Plugin.1.0.0-beta.8.nupkg -Algorithm SHA256`
and compare the hash with `SHA256SUMS` or `release.json`.
The source repository also provides a [complete bundle verifier](RELEASING.md),
including release provenance checks.

## Install

Follow [installation and upgrade](INSTALLATION.md) to configure a local or
internal NuGet source, then add the package to the Umbraco web project:

```sh
dotnet add src/YourSite/YourSite.csproj package Siteimprove.Umbraco17.Plugin --version 1.0.0-beta.8
```

Run this from the site repository root after configuring the source. Replace
the project path with your own. Build, deploy to a test environment, and open
**Settings → Siteimprove**. No custom top-level section permission is needed.
Use [the usage guide](USAGE.md) for domain configuration and editor workflows.

## Customer acceptance

Record the hosting environment, Umbraco version, and package version when trying
the beta. With your actual Siteimprove account, check:

1. The assistant appears once while editing content or viewing rendered preview,
   shows the selected published page, and is hidden elsewhere in the backoffice.
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
Draft checks have separate real-service evidence on the self-hosted test site.
Published-page crawling there awaits Siteimprove's initial site review. Actual
Cloud/Windows deployment and the customer's multilingual/multisite routing
still require acceptance.
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
