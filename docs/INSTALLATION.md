# Installation and upgrade

This guide installs `Siteimprove.Umbraco17.Plugin` into an existing Umbraco site.
The release version is **1.0.0**. Cloud and self-hosted sites use the same package.
See [validation and known limits](VALIDATION.md) for tested environments.

## Requirements

- Umbraco CMS **17.7.1 or later in the 17.x series**, running on **.NET 10**.
- Access to the site's project and build/deployment process. Install through
  NuGet; uploading files through the backoffice is insufficient.
- An Umbraco administrator with access to Settings for plugin configuration.
- A working Siteimprove account for the Content Assistant. Editors' browsers
  must reach Siteimprove's CDN and account services.

The .NET 10 SDK is needed on build machines and for local development.
Self-hosted servers need the appropriate .NET 10 runtime/hosting setup unless
the application is published self-contained. No plugin npm build is required.

## 1. Obtain and install the release

After publication to NuGet.org, run these commands from the site repository root,
replacing the project path with your Umbraco web project:

```sh
dotnet add src/YourSite/YourSite.csproj package Siteimprove.Umbraco17.Plugin --version 1.0.0
dotnet restore src/YourSite/YourSite.csproj
dotnet build src/YourSite/YourSite.csproj -c Release
```

Keep the exact package used for a deployment so it can be reproduced or restored.

### Before publication or with an internal feed

Use the `Siteimprove-Umbraco17-release` artifact from a successful validation run
for the intended source commit. It contains
`Siteimprove.Umbraco17.Plugin.1.0.0.customer.zip` and its checksum. Verify the bundle
using [release preparation](RELEASING.md), then extract the `.nupkg`.
A locally built package is also suitable for development:

```sh
dotnet pack Siteimprove.Umbraco17.Plugin.csproj -c Release -o artifacts
```

A local build does not establish that the browser matrix or customer acceptance
has passed. Public releases use the verified CI artifact.

Place the `.nupkg` in `packages/siteimprove` beneath your **site repository's root**.
Add that folder to the site's existing `NuGet.config`, preserving other sources
and package source mappings. For example:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="siteimprove" value="./packages/siteimprove" />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
  </packageSources>
</configuration>
```

Run the install/restore/build commands above. For a remote build, include that
package folder in the site repository or use an internal feed accessible to the
build machine. A workstation's absolute path will not work remotely. Configure
feed credentials through the deployment's supported secret mechanism.

The package registers its services and preview middleware automatically through
an Umbraco composer. You do not need to change `Program.cs`. Its NuGet targets
copy the browser files to `App_Plugins/Siteimprove` during builds and publication.

## 2. Deploy

### Umbraco Cloud

Install and try the package in the site's local development checkout. Commit the
project's package reference, NuGet configuration, and any repository-local
feed needed for restore. Deploy to a Cloud development environment through the
site's normal Git/build process and complete the checks below before promoting.

Set domain overrides separately for each environment using its supported
application configuration. Decide whether development content should map to
the live domain; preview checks still use the development preview's rendered
HTML. See [configuration](USAGE.md#configuration).

### Self-hosted / on-premises

Publish the web project and deploy the output using the site's normal process:

```sh
dotnet publish src/YourSite/YourSite.csproj -c Release -o artifacts/site
```

Check that `artifacts/site/App_Plugins/Siteimprove/umbraco-package.json` and its
JavaScript files are present. Deploy the complete application output and restart
the application. Configure the domain mapping for the target environment.
Siteimprove's live crawler also needs access to the public website; installation
alone does not enable crawling of a private network site.

## 3. Configure and verify

1. Reload the backoffice and sign in as an administrator.
2. Open **Settings → Siteimprove**. It is a Settings tab, not a top-level section.
3. Leave **Public domain** blank to use Umbraco's published URLs, or enter an
   origin such as `https://www.example.com`, then save. Paths are preserved.
4. Reload and confirm the value persists. If application configuration supplies
   the value, the field is read-only; change the environment configuration instead.
5. Select a published document and confirm the assistant receives the expected
   page. Follow any sign-in prompts in Siteimprove's own panel.
6. Use **Save and preview** on published and unpublished content. With a working
   Siteimprove account, check the rendered page and its highlighting.
7. Confirm ordinary public pages contain no Siteimprove preview injection.

The automated browser test uses a stub for the vendor overlay. Steps involving
the live panel and analysis must also be checked with your own account.

## Upgrading from the Umbraco 13 plugin

Plan the **CMS and database** upgrade through Umbraco's supported process.
Installing this package does not perform that upgrade. Keep a recoverable copy
of the existing application and database as part of the site's upgrade process.

Remove the old plugin reference as part of that upgrade:

```sh
dotnet remove src/YourSite/YourSite.csproj package Siteimprove.Umbraco13.Plugin
```

Before installing the new package, remove the old plugin's
`App_Plugins/Siteimprove` folder from the source/deployment where it was installed.
Remove only that plugin folder, then rebuild with the new reference. Avoid
deploying the old AngularJS assets alongside the v17 modules. Complete the CMS
upgrade before installing the new plugin; do not install the v17 package into
an Umbraco 13 site.

The stored `SiteimprovePublicUrl` database key is retained, so an upgraded
database keeps its domain mapping unless application configuration overrides it.
No custom Siteimprove section grant is needed in v17. Confirm the retained value
under **Settings → Siteimprove** after deployment.

## Removing or reverting the plugin

To remove it, remove the `Siteimprove.Umbraco17.Plugin` NuGet reference, remove
its generated `App_Plugins/Siteimprove` assets, rebuild, and redeploy. Remove any
unused `Siteimprove` application configuration. The saved database mapping is
retained; uninstalling the plugin does not delete content or upgrade/downgrade CMS.

To revert a v17 plugin update, redeploy the previously recorded v17 application
and package. The Umbraco 13 plugin cannot be used as a rollback package on v17.
For installation problems, see [troubleshooting](USAGE.md#troubleshooting).
