# Code quality review

Reviewed the backend API and preview middleware, browser modules, NuGet asset
targets, regression/browser tests, CI, customer bundle, and installation/usage
documentation. This is a code quality review, not a certification of customer
hosting or the vendor's live service.

## Findings addressed in beta.2

| Priority | Finding | Change and verification |
| --- | --- | --- |
| High | Document-tree access alone did not enforce permissions on the requested document. A branch-restricted editor could request another document's published URL. | Apply Umbraco's resource-based browse authorization before URL resolution, matching its document Management API. Backend tests cover allowed/denied requests; Playwright checks an allowed document and a forbidden sibling with a restricted editor. |
| Medium | Queued context callbacks could access workspace data after teardown. | Register the context through `UmbContextBase`, provide a dedicated identity, and guard callbacks after destruction. Tests cover disposed workspace callbacks; Playwright uses native menu/tree navigation. |
| Medium | A pending version request could initialize the assistant after logout, teardown, or replacement of the backoffice instance. | Guard initialization with the current controller and authentication sequence. Tests cover unload, replacement, loss of authentication, and stale failures. |
| Medium | Version literals in the project, test host, and installation script could diverge; the package smoke test selected the first archive in the output directory. | Use `Directory.Build.props` for the package/test-host version. Shared metadata checks detect manifest drift, and package verification selects the exact current-version archive and verifies its metadata. |
| Medium | The browser navigation helper treated API/network completion as editor readiness. It could tear down a workspace while its view route was still rendering. | Use native menu/tree navigation and wait for the target document's visible text field and enabled publish action. The test uses the unmodified CMS assets and continues to reject all browser errors. |

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

## GA preparation review, 22 October 2026

The final review of beta.8 found no new functional blocker. The project owner
confirmed successful testing and selected 1.0.0 GA. Release preparation adds
stable version/channel handling to the verified bundle tools, updates package
and cache versions together, and replaces beta distribution instructions with
stable publication steps. Existing beta bundles remain verifiable.

The accepted beta.8 workflow passed 57 JavaScript, 38 backend, eight bundle and
18 browser tests. GA packaging adds stable bundle regressions and requires a new
complete successful run for the final source commit. Use `release.json` from the
release artifact to identify that exact run. The full merged commit is the source
for NuGet and GitHub release artifacts; a green PR alone does not publish them.

The review's two release findings were stable versions being rejected by the
bundle scripts and customer documentation still describing beta.8. No runtime
refactor or new feature is part of the GA preparation. Known CMS advisories,
native errors and hosting coverage remain in [VALIDATION.md](VALIDATION.md).

## Historical beta.2 validation

Beta.2 passed 19 JavaScript tests, 26 backend tests, package installation/publish
checks, and the full Playwright flow on real Umbraco 17.7.1. Both the native
plugin navigation and plugin-disabled control reported zero browser errors.
[Verified run](https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/38471887229)
tested source `49d70214c8697936724f6717f5ad07a03aacf0ea`.

## Remaining acceptance and limits

- Real-service draft checks and highlighting have separate self-hosted evidence.
  Published-page results, URL matching and recheck await the site's initial review.
  Browser tests stub the vendor overlay.
- Verify the customer's Cloud or self-hosted deployment, languages/site domains,
  CSP/proxy, and upgraded database. Automated checks use Linux and three browsers on a
  disposable local CMS.
- Fast navigation before an editor finishes rendering exposed a destroyed
  Umbraco workspace view in the fixture. The shipped view controller explicitly
  clears `provideAt` on destruction; a pending route tried to call it afterward.
  The browser flow now waits for rendered editor readiness. Check fast navigation
  in the customer's CMS as part of acceptance; no CMS code patch is shipped.
- Preview HTML is buffered in memory. Measure very large rendered previews
  before wider rollout; a buffer limit or disk-backed buffering would be a
  separate change if customer workloads need it.
- Review the full CMS host's inherited dependency audit warnings and the patched
  releases available to the customer's application before production deployment.

See [browser evidence](BROWSER-TESTS.md), [package information](DISTRIBUTION.md), and the
[release checklist](VALIDATION.md). No merge, public NuGet publication, or
production deployment is part of this review.
