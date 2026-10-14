# Siteimprove CMS plugin

Integrates Siteimprove Content Assistant with Umbraco, bringing content quality,
accessibility and SEO insights into the editing workflow. A valid Siteimprove
account is required.

## Umbraco versions and packages

| Umbraco version | NuGet package | Release status |
| --- | --- | --- |
| 13 | `Siteimprove.Umbraco13.Plugin` | Available on NuGet.org |
| 17.7.1 or later in the 17.x series | `Siteimprove.Umbraco17.Plugin` | Customer beta; not yet published to NuGet.org |

This listing covers separate implementations for Umbraco 13 and 17. Support for
Umbraco 14, 15 and 16 is not claimed.

## Install on Umbraco 13

```sh
dotnet add package Siteimprove.Umbraco13.Plugin
```

Build and restart the application, then reload the backoffice. See the
[Umbraco 13 guide](https://github.com/Siteimprove/CMS-plugin-Umbraco-13/blob/umbraco-13/README.md)
for configuration and usage.

## Install on Umbraco 17

The v17 package targets .NET 10 and is intended for Umbraco Cloud and self-hosted
applications. Features include published-page insights, preview prepublish checks
and highlighting, multilingual URL resolution, and optional public-domain mapping.

During the beta, follow the
[Umbraco 17 installation guide](https://github.com/Siteimprove/CMS-plugin-Umbraco-13/blob/port/umbraco-17/docs/INSTALLATION.md)
to obtain and install the package from a local feed. Stable release requires
acceptance on both Cloud and self-hosted Umbraco 17.

For editor workflows, connectivity requirements and preview-provider limitations,
see the
[Umbraco 17 usage guide](https://github.com/Siteimprove/CMS-plugin-Umbraco-13/blob/port/umbraco-17/docs/USAGE.md).

When upgrading a site from Umbraco 13, follow Umbraco's CMS upgrade process, then
remove `Siteimprove.Umbraco13.Plugin` and stale `App_Plugins/Siteimprove` files
before installing the v17 package. Follow the installation guide for the full
upgrade steps.
