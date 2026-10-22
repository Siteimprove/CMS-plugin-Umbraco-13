# Release 1.0.0

The GA version is **1.0.0**. The project owner confirmed successful functional
acceptance on 22 October 2026 and selected GA. Known CMS dependencies and hosting
coverage are recorded in [VALIDATION.md](VALIDATION.md); they are not changed by
this packaging release. CI builds and verifies artifacts; publication is manual.

## Merge and select the release commit

1. Confirm the final PR validation is green, then merge PR #6 into `master`.
   Preserve the `umbraco-13` branch and existing v13 NuGet package.
2. Wait for **Umbraco 17 validation** on the resulting `master` commit to succeed.
   Use that merged commit's artifacts for publication. PR artifacts can refer to
   GitHub's temporary test merge commit, so do not tag or publish those by mistake.
3. Record the full merged commit SHA and successful run ID. Download its
   `Siteimprove-Umbraco17-release` artifact:

```sh
gh run download <successful-master-run-id> --repo Siteimprove/CMS-plugin-Umbraco-13 --name Siteimprove-Umbraco17-release --dir release-1.0.0
```

If a manual validation run is needed, use:

```sh
gh workflow run ci.yaml --repo Siteimprove/CMS-plugin-Umbraco-13 --ref master
```

The run must test the same commit selected for publication. Recheck the commit
if another change lands on `master`. No publication step rebuilds the package.

## Verify the bundle

Use Python 3.10 or later from the repository checkout:

```sh
python3 scripts/verify-release-bundle.py release-1.0.0/Siteimprove.Umbraco17.Plugin.1.0.0.customer.zip --require-ci --expected-source-commit <full-merged-commit-sha>
python3 -m zipfile -e release-1.0.0/Siteimprove.Umbraco17.Plugin.1.0.0.customer.zip release-1.0.0/contents
```

Check `release.json`: `version` is `1.0.0`, `release_channel` is `stable`,
`source_worktree_dirty` is `false`, the workflow succeeded, and `source_commit`
and `build_commit` both identify the selected merged commit. The NuGet package's
repository commit must match `build_commit`; the verifier checks this.

The verifier checks ZIP/sidecar and internal checksums, exact contents, package
identity and provenance, and relative guide links. Checksums verify integrity;
obtain artifacts from the trusted repository and confirm the workflow result.
The older `verify-beta-bundle.py` command remains an alias, and historical beta
bundles remain verifiable.

## Publish the same artifacts

1. Create a **draft** GitHub release with a new tag `v1.0.0` targeting the full
   merged commit. Use `docs/releases/1.0.0.md` as the notes. Attach the verified
   customer ZIP, its `.sha256`, and the `.nupkg` extracted from it. Leave
   **Set as a pre-release** unchecked. Verify the draft target and attachments.
2. Publish that `.nupkg` to NuGet.org using an account/API key authorized to create
   and publish `Siteimprove.Umbraco17.Plugin`. Set `NUGET_API_KEY` securely in your
   shell; do not put the key in source, release notes or command history:

```sh
dotnet nuget push release-1.0.0/contents/Siteimprove.Umbraco17.Plugin.1.0.0.nupkg --api-key "$NUGET_API_KEY" --source https://api.nuget.org/v3/index.json
```

3. Confirm NuGet lists stable `1.0.0` and a clean Umbraco 17 project can restore
   it from NuGet.org. NuGet processing/indexing can take time. If the package
   already exists, inspect its identity and checksum; do not overwrite or silently
   skip a different upload.
4. Publish the GitHub draft as the latest stable release. Keep the exact assets
   and package checksum with the release record.
5. Follow [Marketplace consolidation](MARKETPLACE.md), validate the metadata and
   verify the v13/v17 installation choices after synchronization.

If the repository is renamed, use its new name in `gh` commands and refresh the
package project/repository URLs before the next package version. Do not delete
or recreate the old repository; GitHub's rename redirects preserve existing links.

## Future versions

Update `Directory.Build.props`, the backoffice manifest and all versioned relative
JavaScript imports together. Update guide versions/links and add matching release
notes, then run the full
validation workflow. The bundle tools accept stable `X.Y.Z` and beta
`X.Y.Z-beta.N` versions and record their channel. Any change to code or packaging
requires new validated artifacts. Retain the prior package for rollback.
