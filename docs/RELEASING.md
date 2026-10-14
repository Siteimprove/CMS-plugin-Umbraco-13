# Preparing a customer beta release

Run the validation workflow for the intended source commit. It tests the plugin,
checks NuGet installation and published assets, runs the browser suite, and
creates the customer bundle. A manual workflow run performs the same validation:

```sh
gh workflow run ci.yaml --repo Siteimprove/CMS-plugin-Umbraco-13 --ref <branch-or-tag>
```

After the run succeeds, download its `Siteimprove-Umbraco17-beta` artifact.
Use the version from `Directory.Build.props` and the matching notes in
`docs/releases/` to prepare a draft prerelease targeting that tested commit.

Attach the customer ZIP, its `.sha256` file, and the NuGet package from inside
the ZIP. Preserve the bundle's build-time guides and `release.json`. Verify the
ZIP checksum, its `SHA256SUMS`, and the source commit in `release.json` before
distributing it.

Review the release notes and assets before publishing. Update the README and
installation guide with the published release link. Keep the acceptance checks
in [VALIDATION.md](VALIDATION.md); distributing a beta does not complete them.
