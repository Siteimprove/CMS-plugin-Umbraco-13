# Release preparation

The current version is **1.0.0-beta.8**. The customer beta and stable release
have separate acceptance gates. A successful workflow produces a candidate;
the live-service and deployment checks in [VALIDATION.md](VALIDATION.md) still
govern stable publication.

## Validate and obtain the candidate

Run the validation workflow for the intended source commit. It tests the plugin,
checks NuGet installation and published assets, runs the browser suite, and
creates the customer bundle. A manual workflow run performs the same validation:

```sh
gh workflow run ci.yaml --repo Siteimprove/CMS-plugin-Umbraco-13 --ref <branch-or-tag>
```

After the full run succeeds, download its `Siteimprove-Umbraco17-beta` artifact.
Use the version from `Directory.Build.props` and the matching notes in
`docs/releases/` to prepare a draft prerelease targeting that tested commit.
Do not distribute the separate package artifact from a run whose browser job failed.

Bundle creation checks the NuGet ID/version, backoffice manifest, required DLL
and build targets, all packaged browser asset bytes, README and target bytes,
and the NuGet repository commit against the current build commit. It includes
the matching release notes and all linked local guides, verifies their links,
and validates every checksum. Local bundles record a dirty worktree and lack a
validation workflow URL; they are for local inspection until validated in CI.

## Verify before distribution

Keep the downloaded ZIP and its `.sha256` file together. From the source checkout,
run the verifier with the full source commit selected for release:

```sh
python3 scripts/verify-beta-bundle.py /absolute/path/to/Siteimprove.Umbraco17.Plugin.1.0.0-beta.8.customer.zip --require-ci --expected-source-commit <full-source-commit>
```

This verifies the ZIP sidecar, exact contents, internal checksums, package and
bundle metadata, source/build provenance, and relative guide links without
extracting the ZIP. `--require-ci` requires a validation workflow URL and a clean
source worktree. Checksums establish integrity, not publisher authenticity;
obtain the files from the trusted repository run and check that the recorded
workflow completed successfully.

For pull requests, `source_commit` identifies the proposed head and `build_commit`
may identify GitHub's tested merge commit. The package repository commit must
match `build_commit`. Keep both values when recording acceptance.

## Prepare the prerelease

Attach the customer ZIP, its `.sha256` file, and the NuGet package from inside
the ZIP. Preserve the bundle's build-time guides and `release.json`. Verify the
ZIP checksum, its `SHA256SUMS`, and the source commit in `release.json` before
distributing it.

Review the release notes and assets before publishing. Update the README and
installation guide with the published release link. Keep the acceptance checks
in [VALIDATION.md](VALIDATION.md); distributing a beta does not complete them.

## Stable publication gates

- Record a successful complete validation run for the final source commit and
  verify its customer bundle. Any code or packaging change requires a new run.
- Complete live Siteimprove published-page results, URL matching and recheck;
  customer deployment/upgrade acceptance; and the CMS dependency/error decisions
  in [VALIDATION.md](VALIDATION.md). Record the environment, tester, date, package
  checksum and result for each outstanding check.
- Update the shared package version and backoffice manifest together only after
  acceptance, prepare stable release notes, and run validation for that version.
  The customer bundle creator currently accepts beta versions; adapt and verify
  stable packaging when a stable version is selected.
- Follow [Marketplace consolidation](MARKETPLACE.md), preserve the v13 package,
  and validate the resulting v13/v17 compatibility mapping.
- Publish the accepted NuGet package and GitHub release with the reviewed notes
  and immutable assets. Record the release URL in installation guidance and keep
  the preceding package for rollback.
