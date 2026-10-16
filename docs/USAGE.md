# Using Siteimprove in Umbraco 17

Install the package using the [installation guide](INSTALLATION.md).
The Content Assistant is available after backoffice login; configuration is
under **Settings → Siteimprove** for administrators with Settings access.
The launcher and panel appear only while editing a document or viewing its
rendered preview, including drafts. They are hidden on dashboards and other sections.

## For editors

1. Sign in to Umbraco and select a published document in Content.
2. Use Siteimprove's panel with your Siteimprove account to inspect the page.
   The plugin sends the document's published URL, including any configured
   public domain mapping. Siteimprove handles its own sign-in and analysis.
3. Switch documents to update the assistant. Saving or publishing refreshes
   the page URL. Leaving the document clears its live-page context.

An unpublished document has no live URL, so it clears the previous live page
from the assistant. Use **Save and preview** to check its rendered content before
publication. The preview integration supplies the full rendered document and
registers highlighting; it also works for published pages. The assistant loads
once in the rendered preview rather than in Umbraco's surrounding preview shell.
Live insights use the published URL even when a saved draft has a different name
or route. Never-published pages have no live URL; prepublish checks still work.

Preview checks are enabled by default. Headless or external preview providers
need an integration in their own rendering application. Ordinary public pages
do not receive the preview script.

For multilingual content, the plugin uses the selected culture's published URL.
In split view, the single assistant follows the first, left-hand culture.
Multilingual/multisite acceptance remains pending; see [validation](VALIDATION.md).

## Configuration

In **Settings → Siteimprove**, set **Public domain** only when Umbraco's published
domain differs from the domain Siteimprove should check. Enter an HTTP or HTTPS
origin, including an optional port. Do not include a page path, query, or fragment.
Leave the field blank to use Umbraco's published URLs.

For example, `https://www.example.com` maps
`https://cms.example.test/news/article/` to
`https://www.example.com/news/article/`.
One override applies to all document URLs. On a multisite installation, leave it
blank when each site's own published domain should be preserved.

Application configuration takes precedence over the saved dashboard value.
Merge this section into the site's existing configuration:

```json
{
  "Siteimprove": {
    "PublicUrl": "https://www.example.com",
    "EnablePreviewChecks": true
  }
}
```

| Setting | Default | Behavior |
| --- | --- | --- |
| `PublicUrl` | Omitted | Use the saved database value. With no saved value, use Umbraco's published URLs. |
| `PublicUrl` set to an origin | — | Override the saved domain and make the dashboard read-only. |
| `PublicUrl` set to `""` | — | Force Umbraco's published URLs and make the dashboard read-only. |
| `EnablePreviewChecks` | `true` | Set to `false` to disable preview injection; the backoffice assistant still loads. |

Where the deployment supports standard .NET environment-variable configuration,
the names are `Siteimprove__PublicUrl` and `Siteimprove__EnablePreviewChecks`.
Apply changes through the site's normal configuration/restart process. To make
the domain editable in the dashboard again, remove the `PublicUrl` override from
all applicable configuration providers, including environment variables.

Non-admin users cannot read or change the domain through the plugin's API.
The assistant's document URL API requires backoffice authentication and document
tree access and browse permission for the requested document. There is no plugin
API key field in this dashboard.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| NuGet cannot find the beta package | It is not on NuGet.org. Check the local/internal source contains the `.nupkg` and is available to the build machine. Preserve the sources needed for Umbraco dependencies. |
| An earlier alpha seems to remain installed | Alpha builds currently share a version. NuGet may reuse its cached `siteimprove.umbraco17.plugin/1.0.0-alpha.1` package. Locate the global cache with `dotnet nuget locals global-packages --list`, remove only that cached version, and restore from the intended artifact before rebuilding. |
| Settings has no Siteimprove tab | Use an administrator account with Settings access. Confirm the package reference, deployed manifest, and JavaScript assets, then restart the site and reload the backoffice. |
| The public domain field is read-only | `Siteimprove:PublicUrl` is supplied by application configuration, even if it is an empty string. Change/remove that override. |
| The assistant is missing | Inspect the browser console and network requests for failed plugin modules or `https://cdn.siteimprove.net/cms/overlay-latest.js`. Check CSP, proxy/filtering, browser extensions, and Siteimprove account access. |
| The assistant shows an unexpected domain | Check the dashboard, environment override, selected culture, and Umbraco's domain/URL configuration. A single public-domain override replaces every document's origin. |
| A new document has no live page in Siteimprove | This is expected before publication. Use Save and preview for prepublish checks. |
| Preview checks are unavailable | Confirm `EnablePreviewChecks` is enabled and use Umbraco's authenticated Save and preview flow. External/headless previews need their own integration. Non-success, compressed, and non-UTF-8 HTML responses are not injected. |
| Siteimprove cannot crawl the website | Check crawler access to the published site. Private-site crawling needs a supported Siteimprove setup; the CMS plugin does not provide network access. |
| Modules fail after upgrading from v13 | Remove legacy plugin assets, rebuild/deploy the v17 package, and reload the backoffice. Follow the [upgrade instructions](INSTALLATION.md#upgrading-from-the-umbraco-13-plugin). |

For restrictive CSP, allow the plugin's same-origin assets, Siteimprove's overlay
from `https://cdn.siteimprove.net`, and the account services used by your
Siteimprove setup. Use the actual browser violations to identify the required
directives and services. The plugin does not change the site's CSP.

Content editing, saving, and publishing should still work if Siteimprove's CDN
is unavailable; this was checked in Playwright. Reload after restoring access
to retry loading the assistant.

When reporting an issue in this repository, include the CMS/plugin versions,
hosting environment, affected action, and relevant console/network errors.
Remove credentials, session tokens, and private page content before sharing.
See [browser test evidence](BROWSER-TESTS.md) for the automated coverage and
[validation](VALIDATION.md) for the live-account and deployment acceptance checks.
