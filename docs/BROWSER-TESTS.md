# Browser functionality tests

## GA validation

The accepted beta.8 workflow passed all 18 browser cases across Chromium, Firefox
and WebKit, plus 57 JavaScript, 38 backend and eight bundle tests:
https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/39762374436

The 1.0.0 release repeats this matrix with stable packaging. Its final source and
workflow are recorded in the artifact’s `release.json`. The real-service beta.8
check completed with zero false policy issues, and View on platform opened the
expected inspector URL in a new Chrome tab. See [validation](VALIDATION.md) for
the remaining service and hosting boundaries. The sections below preserve the
regression history; they do not replace the final release workflow result.

The [initial GA browser run](https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/39779653852)
passed 16 of 18 cases. Firefox saved the domain successfully, then its native
token request remained pending during reload. A later plugin-disabled login also
stalled on Umbraco's authorize endpoint. The disposable SQLite hosts now omit
`Cache=Shared`, following Microsoft's guidance for databases using WAL. This
corrects the fixture configuration; the traces do not establish the underlying
CMS stall's root cause. No assertion, timeout or error classifier was relaxed.
See [Microsoft.Data.Sqlite connection strings](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/connection-strings#basic).

## Beta 8 upgrades with cached assets

Preview scripts use the plugin assembly's package version in their URL. Local
module imports use the matching package version, with a JavaScript regression
preventing drift from the manifest. The browser lifecycle test serves unusable
old scripts at unversioned helper and preview URLs; upgraded editors and previews
must still load and complete the same scan, highlight, navigation and popup checks.

## Beta 7 preview content and platform links

The rendered preview initializes one assistant in its native `umb-preview`
parent window. The SDK's document callback and highlight callback keep pointing
to the rendered page; neither the launcher nor the assistant panel is placed in
that document. A platform-link regression opens a separate tab while asserting
that Umbraco's page iframe still has only
`allow-scripts allow-same-origin allow-forms`. Preview navigation retains one
outer overlay and updates the current document callback.

On the beta.5 deployment, the reported policy match highlighted `Siteimprove`
inside `#siTooltip`, rather than customer page content. A fresh draft check
reproduced it. “View on platform” also failed to open from the nested assistant;
the native page iframe did not allow popups. Neither symptom was fixed by the
beta.6 preview script, which was identical to the deployed script.

JavaScript regressions cover the host selection, document/highlight targets,
overlay reuse and teardown ordering. The accepted beta.8 run and deployment above
verify these regressions.

## Beta 6 nested workspace restoration

The assistant retains each live workspace's document and culture in nesting
order. Closing a child revalidates the surviving parent's current URL and
restores its launcher. Parent updates cannot override an open child; closed and
unauthorized contexts cannot be restored. Returning to a draft uses a fresh
isolated results session.

Coverage includes 53 JavaScript regressions, 35 backend regressions and package
install/publish asset checks. The browser matrix combines the original lifecycle
suite, native creation/two-level picker workflows and CMS-only auth diagnostics
across Chromium, Firefox and WebKit. The picker cases assert both launcher and
panel visibility and the exact parent URL at each return level.

The [first beta.6 workflow](https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/38725427278)
passed 17 of 18 browser cases, including the nested-editor regression cases.
The WebKit plugin-disabled navigation control failed because its known CMS
workspace error appended an expression explanation to `provideAt is not a function`.
The shared classifier now accepts that WebKit suffix only with the confirmed
Umbraco workspace source frame. Regressions reject the same text from plugin or
unrelated modules and unrelated TypeErrors. Distribution requires a complete
successful matrix for the final source commit; a bundle's `release.json` identifies
that build and workflow for verification.

The [next workflow](https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/38886968441)
passed the WebKit lifecycle case. Its stricter Firefox picker control caught
an initial news-dashboard import interrupted by the fixture's full navigation.
The trace records navigation at 197142 ms, the module request at 197173 ms with
no response, and the import error at 197178 ms. Setup now waits for the rendered
news dashboard before creating fixtures and navigating. The error remains a
failure; it was not added to the known-CMS classifier.

The [following workflow](https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/38888304596)
passed both picker workflows in all three browsers. Chromium's plugin-disabled
rapid-navigation control exposed the same disposed-view failure at
`workspace/index.js:1012`, in addition to the previously recorded router/constants
call sites. The pinned [workspace route setup](https://github.com/umbraco/Umbraco-CMS/blob/release-17.7.1/src/Umbraco.Web.UI.Client/src/packages/core/workspace/components/workspace-editor/workspace-editor.element.ts#L155)
calls `provideAt` on the view controller; [controller destruction](https://github.com/umbraco/Umbraco-CMS/blob/release-17.7.1/src/Umbraco.Web.UI.Client/src/packages/core/view/context/view.controller.ts#L364)
sets that method to undefined. The classifier includes this confirmed first frame;
other modules and later CMS callers remain rejected by regression tests.

## 16 October authentication-control setup

The [preview follow-up workflow](https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/38905879390)
passed 17 of 18 browser cases. WebKit's CMS-only authentication control clicked
Media while the initial Content route was still loading: the trace shows the
Media URL after the click, followed by the Content tree and welcome dashboard
loading instead. No Media dashboard appeared, so authentication recovery was
never reached. The control now waits for the rendered welcome dashboard before
starting its native section-navigation loop, as the document-workflow setup
already does. Navigation assertions, authentication recovery, error recording
and the zero-Siteimprove-request check remain in place.

The [verification run](https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/38907794823)
passed all three authentication controls. Chromium's preview case exposed a
separate input-focus race: its saved request appended the draft body text to the
page name and retained the original body value. The rendered preview matched
that request. Setup now clicks the body editor and checks its focus before
filling it, then verifies both input values before saving. It waits for the
document update response specifically; the earlier substring match also accepted
the preceding validation response. The preview still must show the exact renamed
heading and saved draft body.

The [next run](https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/38909255979)
passed the Chromium preview and all authentication controls. Firefox's saved
document was already open when preview setup clicked its tree item again;
the trace records no document GET after that click. The first preview now opens
directly from the saved editor instead of waiting for a redundant navigation.

The [following run](https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/38910930455)
passed Chromium and Firefox. WebKit completed its functional assertions but
recorded a native module import failure: fixture setup reloaded at trace time
362314 ms, document-tree item module requests were aborted at 362344–362347 ms,
and the extension loader reported the error at 362350 ms. Login now waits for
the initial dashboard; fixture setup waits for idle requests before reloading,
then waits for the dashboard and Home item afterward. The initial tree does not
refresh for API-created fixtures, so Home is checked only after the reload.
Module import errors remain failures.

## 15 October workflow follow-up

`document-workflows.spec.js` adds native document creation and save, a document
picker fixture, and two nested document workspace editors. The new-document
checks passed in Chromium, Firefox and WebKit. All three plugin-disabled workflows
passed with zero Siteimprove requests.

The three plugin-enabled cases failed against beta.5:
closing the inner editor hides the launcher and clears its parent URL; closing
the outer editor leaves the main editor in the same cleared state. Reloading
restores the assistant. The failure was also reproduced with the real overlay on
the self-hosted installation. The same regression cases now exercise the beta.6
restoration fix without skipping or expecting those failures.

`cms-auth-recovery.spec.js` records native section-navigation errors and an
expired-session recovery with all Siteimprove manifests disabled. It expires
the disposable browser's server cookies before calling the public auth timeout
API; otherwise background refresh can restore the session before the modal is
usable. The diagnostic records console errors even when sign-in succeeds. A
passing recovery does not imply a clean CMS console. All three recovery controls
passed: Chromium, Firefox and WebKit recorded 39, 31 and 10 uncaught CMS errors,
respectively, with zero Siteimprove requests. The auth modal's double-success
`_subject is undefined` error reproduced in Chromium and WebKit and was also
seen on the live installation; Firefox did not reproduce it in this run.

Run these cases against freshly prepared disposable hosts:

```sh
npm --prefix tests/browser test -- document-workflows.spec.js cms-auth-recovery.spec.js
```

The historical follow-up used the packaged beta.5 plugin. Current runs install
the version in `Directory.Build.props` from its NuGet package.

## Historical beta.5 coverage

Beta.5 has 41 passing JavaScript checks, 35 backend checks and
clean-consumer package checks. Its three-browser matrix adds HTTP session
initialization, actual saved field text in preview, authorization expiry and
recovery, and non-content workspace modals. Results are recorded after a complete
run; the matrix uses a stub overlay and does not certify the vendor service.

Document entry across sections uses a full navigation because cached native tree
visibility is unreliable after a section change in Umbraco 17.7.1. Document
switching within Content and section exits still use native menus.

Each CMS-only control records all errors and verifies zero Siteimprove requests.
The plugin flow rejects unknown or plugin exceptions. It records confirmed CMS
exceptions and their comparison with that browser's control, including known
exceptions not reproduced in the same run. Raw errors remain in the evidence; a passing integration run does not claim a clean CMS console.

## Beta 4 validation

Passed locally on 2026-10-14 with Umbraco 17.7.1, .NET 10 and Chromium:
29 JavaScript tests, 35 backend tests, NuGet clean-consumer installation/build/
publish checks, and the full fresh-CMS browser flow. The browser test completed
in 65 seconds (91 seconds including host startup), with no failed or flaky tests.

Draft-result regressions seed a shared cached result, open two different
unpublished drafts, reopen the first draft, and require an empty result context
before each check. Each preview has a distinct session, its callback supplies the
current rendered document, and navigation to published content restores a null
session with the correct public URL. Unit tests also cover unpublished cultures,
late published responses and delayed overlay initialization.

The plugin-disabled rapid-navigation control made zero Siteimprove requests and
reproduced 54 core tree-context exceptions. The plugin flow rejected any exception
whose exact message and first source frame were absent from that control.
Real-service verification is separate from this stubbed overlay test.

## Beta 3 validation

Passed on 2026-10-14 with Umbraco 17.7.1, .NET SDK 10.0.402 and Chromium on macOS:
23 JavaScript tests, 32 backend tests, NuGet installation/publish checks and the
full browser lifecycle flow in 54.5 seconds. Preview regressions check a renamed
saved draft against its published route, a never-published page with no live URL,
navigation inside preview, and one overlay in the rendered iframe.

Visibility checks cover document editing, drafts, Content dashboards, Settings,
Media and Users. The plugin flow reported no browser exceptions. A matching
plugin-disabled section-navigation control produced nine Umbraco tree/router
teardown exceptions and no Siteimprove requests. The suite rejects unknown
control errors and any plugin-flow exception whose message and source frame
were not reproduced by the control.

## Previous beta 2 validation

Passed on 2026-10-13 against source commit
`49d70214c8697936724f6717f5ad07a03aacf0ea`: the full Chromium flow completed
in 55.2 seconds. The workflow also passed all 45 regression tests, package creation,
NuGet installation, and published asset checks.

This beta.2 run used native menu/tree navigation and waited for the target
document's rendered field values and enabled publish action. Both the plugin
flow and the plugin-disabled control reported zero browser errors. The control
made zero Siteimprove module, API, or overlay requests.

Workflow and evidence:
https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/38471887229

The configuration now appears under **Settings → Siteimprove**, with no top-level
Siteimprove section or custom user-group section grant. The browser test opens the
tab through Settings and checks that Siteimprove is absent from the top menu.

Testing found duplicate overlays in Umbraco's preview shell; the port now skips
that shell and loads the assistant once in the rendered preview iframe.

The suite in `tests/browser` runs Chromium, Firefox and WebKit through Playwright against an actual
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
3. The Siteimprove dashboard in Settings saves a public domain, persists it after
   reload, and rejects URLs containing a path.
4. Switching documents sends the mapped URL; leaving content clears stale context.
5. Unpublished content clears live-page context; publishing refreshes the live URL.
6. Published and never-published previews render with the preview script.
7. Preview callbacks return the rendered document and register highlighting.
8. The preview shell loads no duplicate overlay; the rendered iframe loads one.
9. Ordinary public pages receive no preview injection.
10. A non-admin account is denied settings read/write access.
    A branch-restricted editor can resolve its allowed document but cannot resolve
    a sibling outside that branch through either the CMS or plugin API.
11. Blocking Siteimprove's CDN still permits editing, saving and publishing content.
12. A CMS-only rapid-navigation control removes Siteimprove's backoffice manifests
    and verifies that no plugin modules, APIs, or overlay requests run. The
    control rejects unknown framework errors. The plugin flow rejects errors
    outside the source-confirmed CMS findings and records the full control comparison.
13. A renamed saved draft keeps its published URL in preview; never-published
    preview content has no live URL while retaining prepublish callbacks.
14. The launcher and panel are hidden outside document editing, remain available
    for drafts, and return when a document workspace is opened.


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

Run `scripts/prepare-browser-hosts.py` before a rerun to replace only the generated
`tests/browser/.hosts` fixtures. Each browser uses its own database, port and
content root. These fixtures are disposable; do not point the suite at a real site.
Generated database, views, assets, reports, and dependency directories are ignored.

To inspect downloaded evidence, extract the artifact and run:

```sh
npx playwright show-report playwright-report
npx playwright show-trace test-results/plugin-real-Umbraco-backoffice-and-preview-lifecycle/trace.zip
```

## Remaining acceptance

These are standalone browser checks on a local CMS. They do not certify an actual Umbraco
Cloud deployment, a Windows/IIS installation, multilingual/multisite routing,
custom CSP/proxy settings, or the full real-service crawl lifecycle. Those acceptance checks
remain in [VALIDATION.md](VALIDATION.md).

The full CMS test host restore reports NuGet audit warnings for Umbraco's inherited
ImageSharp 3.1.12 dependency. No image processing is exercised by this suite.
Review the application dependency audit and patched Umbraco/dependency releases
before production deployment.
