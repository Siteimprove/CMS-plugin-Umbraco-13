# Umbraco 17 port validation

Upstream baseline: Siteimprove/CMS-plugin-Umbraco-13 commit
`2f376ce445956dc8ee65fb0ed75cde5d96901767`.
API and extension contracts were checked against Umbraco's
`release-17.0.0` source. The initial baseline build passed 23 backend tests.
The package now requires 17.7.1 or later in 17.x, the latest stable v17 release
at implementation time. Restoring the original 17.0.0 dependency baseline raised
NuGet vulnerability warnings for its transitive packages; consumers should use
current patched Umbraco releases.

## Current beta.5 quality pass

The package targets Umbraco 17.7.1 and .NET 10. Local validation uses SDK
10.0.402 and runtime 10.0.13. Current regression coverage includes 41 JavaScript
checks and 35 backend checks. The NuGet archive and clean-consumer build/publish
checks compare every installed asset with the source.

The browser matrix uses current Chromium, Firefox and WebKit against separate
disposable CMS installations. It covers saved draft field text, isolated result
sessions, timeout/recovery, HTTP backoffices and template/document-type modals,
in addition to permissions, publishing, settings, preview and CDN failure.
See [browser evidence](BROWSER-TESTS.md) for the latest completed run and boundaries.

The self-hosted test deployment has real-service draft analysis evidence,
multilingual routes and two site roots. The backup restore drill passed in an
isolated container with networking disabled. An unpublished Danish child remained
404, and eight published routes returned 200 without preview injection.

## Production blockers and remaining acceptance

- **Published-page Siteimprove results:** the test site is in Siteimprove's initial
  quality review. Its dashboard reports 2–6 business days. Repeat live results,
  URL matching and page recheck once that review finishes; draft checks alone do
  not certify crawling.
- **CMS dependency audit:** cryptography Pkcs/Xml are patched to 10.0.13. The full
  Umbraco host still resolves ImageSharp 3.1.12 and reports five advisories. There
  is no compatible 3.1.x patch in the registry at this check; moving to 4.x needs
  separate imaging compatibility and licensing review. These restore warnings
  are not evidence of exploitability in this application.
- **Core backoffice errors:** tree/repository teardown errors occur with the
  plugin disabled. Preserve the browser/source-frame evidence and resolve or
  explicitly accept those CMS defects before production sign-off.
- **Other hosts:** actual Umbraco Cloud, Windows/IIS, a v13 upgrade and retained
  database setting, multi-instance settings, separate hostnames/certificates,
  custom CSP/backoffice paths and headless previews are not certified by the
  current self-hosted installation.

Historical beta.2 workflow evidence remains available:
https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/38471887229

Run this checklist on an Umbraco 17 Cloud development environment and on a
self-hosted Umbraco 17 site, using a working Siteimprove account.

1. Install the built beta package in a clean v17 site and one upgraded from v13.
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
