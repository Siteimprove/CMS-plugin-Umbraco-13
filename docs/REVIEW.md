# Beta quality review

Reviewed the backend API and preview middleware, browser modules, NuGet asset
targets, regression/browser tests, CI, customer bundle, and installation/usage
documentation. This is a code quality review, not a certification of customer
hosting or the vendor's live service.

## Findings addressed in beta.2

| Priority | Finding | Change and verification |
| --- | --- | --- |
| High | Document-tree access alone did not enforce permissions on the requested document. A branch-restricted editor could request another document's published URL. | Apply Umbraco's resource-based browse authorization before URL resolution, matching its document Management API. Backend tests cover allowed/denied requests; Playwright checks an allowed document and a forbidden sibling with a restricted editor. |
| High | The workspace context extension inherited a plain controller, which does not implement Umbraco's `provideAt` contract. Native tree navigation exposed router failures. | Inherit `UmbContextBase` and provide a dedicated context identity. Guard callbacks after teardown; tests cover disposed workspace callbacks, and Playwright exercises native menu/tree navigation. |
| Medium | A pending version request could initialize the assistant after logout, teardown, or replacement of the backoffice instance. | Guard initialization with the current controller and authentication sequence. Tests cover unload, replacement, loss of authentication, and stale failures. |
| Medium | Version literals in the project, test host, and installation script could diverge; the package smoke test selected the first archive in the output directory. | Use `Directory.Build.props` for the package/test-host version. Shared metadata checks detect manifest drift, and package verification selects the exact current-version archive and verifies its metadata. |

Beta.1 remains an immutable earlier build; beta.2 contains these fixes.

## Structure

The current separation is suitable for a small Umbraco plugin: the API controller
handles authorization and HTTP contracts; the URL service owns configuration and
URL resolution; preview middleware owns HTML injection; the browser API and
assistant modules isolate authentication, requests, and stale-response handling.
The settings component and extension manifest place configuration within Umbraco
Settings without adding a separate section.

Keep that structure. A broad rewrite or additional frontend build framework
would add maintenance work without addressing the findings above. The shared
version file removes duplication where it affects packaging; the plain modules
continue to use Umbraco's import map.

## Remaining acceptance and limits

- Test Siteimprove's actual panel, login, analysis, and highlighting with a live
  account. Browser tests stub the vendor overlay.
- Verify the customer's Cloud or self-hosted deployment, languages/site domains,
  CSP/proxy, and upgraded database. Automated checks use Linux/Chromium and a
  disposable local CMS.
- Preview HTML is buffered in memory. Measure very large rendered previews
  before wider rollout; a buffer limit or disk-backed buffering would be a
  separate change if customer workloads need it.
- Review the full CMS host's inherited dependency audit warnings and the patched
  releases available to the customer's application before production deployment.

See [browser evidence](BROWSER-TESTS.md), [beta acceptance](BETA.md), and the
[release checklist](VALIDATION.md). No merge, public NuGet publication, or
production deployment is part of this review.
