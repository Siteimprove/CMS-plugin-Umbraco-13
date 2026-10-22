# Validation and known limits

## Release decision, 22 October 2026

The project owner confirmed successful functional testing of beta.8 and selected
**1.0.0 GA**. The release keeps beta.8's runtime behavior, updates package/cache
versions and adds stable bundle support and release documentation.
The decision does not establish testing on hosts outside the evidence below or
resolve the inherited CMS issues. Publication uses the successful CI artifacts
for the final merged commit, as described in [RELEASING.md](RELEASING.md).

## Verified integration

The [accepted beta.8 workflow](https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/39762374436)
validated source `4d795f0f735f8097c28e0519c714ab80b41f9ed6` with 57 JavaScript,
38 backend, eight bundle and 18 browser tests. It verified clean NuGet
installation/build/publish and compared every browser asset with source.
The GA workflow repeats those checks and adds stable release bundle regressions.
Its artifact's `release.json` records the exact source/build commits and workflow;
confirm that run succeeded before publication.

Browser coverage runs against disposable Umbraco 17.7.1 installations using
Chromium, Firefox and WebKit. It covers authentication/permissions, settings,
document/culture changes, nested editors, saved draft text, isolated draft result
sessions, preview scanning/highlighting, popup links, cache invalidation and
vendor-script failure. The vendor overlay is stubbed in these automated tests.
See [browser evidence](BROWSER-TESTS.md) for historical runs and boundaries.

On the self-hosted Linux demo (Umbraco 17.7.1, .NET 10.0.13), all eight served
beta.8 assets matched the tested source. A fresh real-service Home draft check
completed with **zero policy issues** after excluding assistant UI from the
scanned page. The reported accessibility link opened the expected Siteimprove
inspector URL in a new Chrome tab. Umbraco's preview sandbox stayed unchanged.
A consistent database/file backup and the previous container image were retained.
Earlier self-hosted evidence covers multilingual routes, two site roots, an
isolated backup restore drill and ordinary public pages without preview injection.
The project owner also confirmed on 22 October 2026 that live view works and
the page report is accessible when the site has been crawled. This supersedes
the earlier observation of Siteimprove's initial quality-review notice.

## Known limits and inherited issues

- **Dependency advisories:** the final beta.8 CI reported ImageSharp 3.1.12 and
  MessagePack 3.1.8 warnings inherited through the Umbraco host. Pkcs/Xml are
  explicitly patched to 10.0.13. The warnings are retained; this release does
  not claim to remediate them or establish application exploitability.
  [ImageSharp 3.2.0](https://github.com/SixLabors/ImageSharp/releases/tag/v3.2.0)
  and [Umbraco's imaging update](https://github.com/umbraco/Umbraco-CMS/pull/24158)
  provide upgrade context; assess supported CMS updates and the publisher's
  licensing requirements in the host application. MessagePack's publisher lists
  3.1.9 as a fix in its
  [advisory](https://github.com/MessagePack-CSharp/MessagePack-CSharp/security/advisories/GHSA-qhrr-8q5h-9q3h).
- **Native backoffice lifecycle errors:** tree, repository and workspace teardown
  exceptions have also occurred with the plugin disabled. The browser suite only
  classifies specifically evidenced CMS errors by message and source frame;
  unknown errors still fail. No CMS lifecycle patch or global error suppression
  is shipped.
- **Hosting coverage:** actual Cloud, Windows/IIS, v13 database upgrades,
  multi-instance settings, separate hostnames/certificates and custom CSP or
  backoffice paths have not been independently certified. Customers should
  validate their deployment; the same NuGet package supports those build paths.
- **Preview scope:** server-rendered website previews are covered. External or
  headless preview frontends need their own Siteimprove integration. Preview HTML
  is buffered in memory; very large rendered previews need workload testing.

## Deployment checks

Use these deployment checks with a working Siteimprove account in the target
environment. They document coverage to confirm for that deployment; they do not
represent tests already completed on every host.

1. Install the release package in a clean v17 site and one upgraded from v13.
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
