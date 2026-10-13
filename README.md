# Siteimprove Content Assistant for Umbraco 17

This port targets Umbraco CMS 17.7.1 or later in the 17.x series and .NET 10.
The same NuGet package is intended
for Umbraco Cloud and self-hosted Umbraco. It is an alpha until the acceptance
checks in [docs/VALIDATION.md](docs/VALIDATION.md) have passed in both environments.

## Install

Build the package, then install it in an Umbraco 17 site:

```sh
dotnet pack Siteimprove.Umbraco17.Plugin.csproj -c Release -o artifacts
dotnet add YourSite.csproj package Siteimprove.Umbraco17.Plugin --version 1.0.0-alpha.1 --source /absolute/path/to/artifacts
```

The second command selects the local feed. Restore the site with its normal
NuGet sources as well if Umbraco dependencies are not already cached.
The package is not yet published to NuGet.org.

Remove `Siteimprove.Umbraco13.Plugin` and stale `App_Plugins/Siteimprove` files
before installing the new package. Rebuild and restart the site, then reload the
backoffice. NuGet build targets copy the new files into `App_Plugins/Siteimprove`
for development and include them in published output. No frontend compilation
or npm dependencies are required; the modules use Umbraco's backoffice import map.

This upgrades the plugin, not the site's CMS or database. Follow Umbraco's supported
upgrade process separately. The old implementation is retained on `umbraco-13`.

## Use and configuration

A valid Siteimprove account is required. The Content Assistant loads after
backoffice authentication. Selecting a published document sends its public URL
to the assistant. New/unpublished documents clear the previous live-page context.
Saving or publishing refreshes that URL; leaving the document clears it.

For multilingual content, the selected culture is passed to Umbraco's URL provider.
In split view the single assistant uses the first (left-hand) culture.

Administrators can grant the **Siteimprove** section to their user group and set
a public domain there. Use an HTTP or HTTPS origin such as
`https://www.example.com`; leave it blank to retain Umbraco's published URLs.
The scheme, hostname, and port are replaced while the page path is preserved.
The original `SiteimprovePublicUrl` database key is retained.

Environment configuration takes precedence over the database value:

```json
{
  "Siteimprove": {
    "PublicUrl": "https://www.example.com",
    "EnablePreviewChecks": true
  }
}
```

Omit `PublicUrl` to use the database value. Set it to `""` to force unmodified
Umbraco URLs for that environment. When configured, the dashboard displays a
read-only value. Settings endpoints require administrator access; document URL
endpoints require backoffice authentication and access to the document tree.

### Umbraco Cloud

Install the package in the Cloud site's project and deploy through its normal
Git/build process. Set domain overrides per environment using configuration
(for example `Siteimprove__PublicUrl` where environment-variable configuration
is available). Confirm whether each environment should map to the live domain;
a development preview's prepublish check still examines the preview's rendered HTML.

### Self-hosted / on-premises

Install and publish the same package with the application. Ensure editors'
browsers can access Siteimprove's CDN and account services. Siteimprove's live
crawling also needs access to the published site; private-site crawling needs
a separately supported Siteimprove setup.

Restrictive Content Security Policies must allow the plugin's same-origin script,
Siteimprove's overlay script at `https://cdn.siteimprove.net`, and the services
required by your Siteimprove account. The plugin does not relax CSP headers.

## Preview checks

Use Umbraco's **Save and preview** action. The assistant is injected into rendered
HTML only when Umbraco verifies the preview session and the routed request is in
preview mode. It supports Umbraco 17's separate preview window, without assuming
an iframe, a referrer, or an integer document ID.

The prepublish callback returns the rendered document and supports highlighting.
An unpublished page can be checked even when it has no public URL.
Ordinary public responses are untouched. Non-HTML, compressed, non-UTF-8, and
non-success responses are passed through.

Headless/external preview providers render outside this Umbraco application and
need their own Siteimprove integration. This middleware covers server-rendered
Umbraco website previews.

## Development and validation

```sh
npm test
dotnet test tests/Siteimprove.Umbraco17.Plugin.Tests.csproj -c Release
dotnet pack Siteimprove.Umbraco17.Plugin.csproj -c Release -o artifacts
bash scripts/verify-package.sh
```

The GitHub validation workflow builds, tests, packs, and checks installation and
published assets. It uploads the alpha package as an artifact and does not publish
a NuGet package or create a release. See [docs/VALIDATION.md](docs/VALIDATION.md)
for the acceptance checks needed before release.

