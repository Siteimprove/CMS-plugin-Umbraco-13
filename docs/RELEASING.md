# Preparing the customer beta on GitHub Releases

Prepare **1.0.0-beta.2** as a draft GitHub release with **pre-release** selected.
Use title **Siteimprove for Umbraco 17 — 1.0.0-beta.2** and tag
`v1.0.0-beta.2`, targeting the tested source commit
`49d70214c8697936724f6717f5ad07a03aacf0ea` on `port/umbraco-17`.
Keep the beta version; an RC version follows customer acceptance.

The release notes are in [releases/1.0.0-beta.2.md](releases/1.0.0-beta.2.md).
This preparation does not merge the port or publish a package to NuGet.org.

## Assets

Reuse the unchanged binary assets from
[validation run 38471887229](https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/38471887229).
The customer artifact expires on **2027-01-11**; copy it to release assets
before then. A GitHub release avoids Actions artifact expiry and, for a public
repository, allows customers to download published assets without signing in.
Draft releases are only visible to users with repository write access.

Attach:

- `Siteimprove.Umbraco17.Plugin.1.0.0-beta.2.customer.zip`
- `Siteimprove.Umbraco17.Plugin.1.0.0-beta.2.customer.zip.sha256`
- `Siteimprove.Umbraco17.Plugin.1.0.0-beta.2.nupkg` (from inside the customer ZIP)
- Current `INSTALLATION.md` and `USAGE.md` as standalone guides

The original ZIP contains its build-time documentation and `release.json`.
Use the current standalone guides for the release download instructions;
preserve the original ZIP and its checksum.

## Create the draft

From this repository's root on `port/umbraco-17`, use an authenticated GitHub
CLI account with repository release access. The script needs Python 3 and
`unzip` and `sha256sum` (available on Linux). It verifies the run, bundle
checksums, provenance, and package version before creating a **draft prerelease**:

```sh
bash scripts/draft-beta-release.sh
```

The script neither publishes the draft nor replaces an existing release.
Review the assets and rendered notes in GitHub, then publish the prerelease
when ready for customer distribution. After publishing, update the README and
installation guide to point directly to `/releases/tag/v1.0.0-beta.2` and remove
the pending-publication wording. Keep the live-account/hosting acceptance
limitations in the release notes until verified.
