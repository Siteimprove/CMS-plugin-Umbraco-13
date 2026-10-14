# Siteimprove CMS plugin Marketplace listing

Use one Marketplace listing titled **Siteimprove CMS plugin**, with separate
NuGet packages for Umbraco 13 and 17. Keep the v13 NuGet package available for
customers running Umbraco 13.

## Metadata

`umbraco-marketplace-siteimprove.umbraco17.plugin.json` belongs to the v17 package.
Its `VersionSpecificPackageIds` entry maps Umbraco 13 to
`Siteimprove.Umbraco13.Plugin`. The package-specific filename prevents the v13
package from importing v17's mapping as its own metadata.

`umbraco-marketplace-readme.md` is shared by both package IDs and documents each
package's installation and release status. Keep this text accurate while v17 is
in customer testing.

Marketplace discovers these files at the NuGet package's project URL:
`https://github.com/Siteimprove/CMS-plugin-Umbraco-13`. It reads the repository's
default branch, currently `master`. Files present only on the port branch or in
a NuGet archive will not update the live listing.

The v17 project's Umbraco dependency range is `[17.7.1,18.0.0)`. Keep its upper
bound so that Marketplace does not infer support for later major releases.
The v13 mapping does not establish compatibility with Umbraco 14–16.

## Release and consolidation

1. Complete the stable release acceptance checks in [VALIDATION.md](VALIDATION.md).
2. Merge the Marketplace metadata and shared README into the default branch.
   Preserve the v13 source and guide on `umbraco-13`.
3. Publish the accepted v17 package to NuGet with the `umbraco-marketplace` tag.
   Update the shared README with the published version, normal NuGet installation
   command and final documentation links.
4. Use the [Marketplace validator](https://marketplace.umbraco.com/validate) with
   `Siteimprove.Umbraco17.Plugin` and its JSON metadata. Check the resulting title,
   compatibility and version-specific installation instructions.
5. After synchronization, verify that selecting Umbraco 13 points to
   `Siteimprove.Umbraco13.Plugin` and selecting Umbraco 17 points to
   `Siteimprove.Umbraco17.Plugin`. Confirm that 14–16 are not advertised as
   supported. New tagged packages are scanned daily; known packages refresh every
   two hours.
6. Keep the existing v13 listing until the combined listing works. If a duplicate
   v13 listing remains, request consolidation through the
   [Umbraco Marketplace issue tracker](https://github.com/umbraco/Umbraco.Marketplace.Issues/issues),
   including both listing URLs and asking how to preserve existing v13 links.
   Keep the v13 NuGet package published and available.

See Umbraco's [listing documentation](https://docs.umbraco.com/umbraco-dxp/marketplace/listing-your-package)
and [guidance on combining version-specific packages](https://umbraco.com/blog/umbraco-marketplace-update-january-2023/).
