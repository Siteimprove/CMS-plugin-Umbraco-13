# Umbraco 17 port validation

Upstream baseline: Siteimprove/CMS-plugin-Umbraco-13 commit
`2f376ce445956dc8ee65fb0ed75cde5d96901767`.
API and extension contracts were checked against Umbraco's
`release-17.0.0` source. The initial baseline build passed 23 backend tests.
The package now requires 17.7.1 or later in 17.x, the latest stable v17 release
at implementation time. Restoring the original 17.0.0 dependency baseline raised
NuGet vulnerability warnings for its transitive packages; consumers should use
current patched Umbraco releases.

## Automated checks

- JavaScript: 13 regression tests passed locally using Node 24, covering refreshed
  authentication tokens, custom backoffice paths, request errors, document
  changes, stale responses, teardown, and preview callbacks.
- Backend: 23 tests passed on GitHub Actions against Umbraco 17.7.1,
  covering origin mapping, HTML escaping, preview gating,
  response headers/length, and stream restoration.
- Packaging: package creation, archive paths, installation in a fresh .NET web
  project, and development/published asset checks passed on GitHub Actions.
- The editing workspace has no .NET SDK, so backend checks run on GitHub Actions.
  Final 17.7.1 build and package installation validation passed:
  https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/38451366281
  This run reported no build warnings. Its alpha package is available as an artifact.

## Release acceptance (pending)

Run this checklist on an Umbraco 17 Cloud development environment and on a
self-hosted Umbraco 17 site, using a working Siteimprove account.

1. Install the built alpha package in a clean v17 site and one upgraded from v13.
   Verify the v13 database domain setting is retained and legacy assets removed.
2. Log in: the assistant appears once, and no browser/module errors occur.
   Log out/in and confirm no stale document context remains.
3. Select two published documents quickly: the assistant always ends on the last
   document. Navigate to media/settings and confirm its live context clears.
4. Create an unpublished document: the previous live page clears. Publish it and
   confirm the live URL appears without a full backoffice reload.
5. Switch languages, including split view, and confirm correct culture-specific
   paths/domains. Test a multisite installation without a domain override.
6. Set/clear the public domain. Check paths, HTTPS/default ports, and custom ports.
   Test a per-environment configuration override and its read-only settings UI.
7. Confirm non-admin users cannot read or change settings through the API.
   Confirm anonymous requests cannot access any plugin Management API endpoint.
8. Use Save and preview for a published page and a never-published page.
   Run a prepublish check and verify highlighting in the rendered preview.
   Follow internal preview links and confirm the assistant updates with the page.
9. Open the ordinary public page and verify no Siteimprove preview script appears.
   Check response compression, existing CSP, custom backoffice paths, and deployment
   behind your actual reverse proxy.
10. Block Siteimprove's CDN temporarily: content editing, saving and publishing
    still work. Restore access and confirm the assistant recovers after reload.
11. Verify every plugin asset is present in Cloud and self-hosted published output,
    and multiple application instances read the same stored domain mapping.

Live crawling requires Siteimprove access to the published site. Prepublish checks
use the browser's rendered preview document; headless previews require separate
integration in the external preview frontend.
