# Package information: 1.0.0

Siteimprove Content Assistant 1.0.0 targets Umbraco **17.7.1+ within 17.x** and
**.NET 10**. Install `Siteimprove.Umbraco17.Plugin` through NuGet using the
[installation guide](INSTALLATION.md). See [usage](USAGE.md) for editor workflows,
domain configuration and troubleshooting, and [release notes](releases/1.0.0.md)
for changes and known limits.

## Verified release bundle

The successful validation workflow produces:

- `Siteimprove.Umbraco17.Plugin.1.0.0.nupkg`: installable package.
- `START-HERE.md`, `README.md` and `docs/`: matching guides and release notes.
- `release.json`: version, release channel, source/build commits, workflow URL,
  worktree status and package SHA-256.
- `SHA256SUMS`: checksums for every other file in the customer ZIP.

Keep `Siteimprove.Umbraco17.Plugin.1.0.0.customer.zip` beside its `.sha256` file.
The [release verifier](RELEASING.md#verify-the-bundle) checks both ZIP and internal
checksums, exact contents, guide links, package identity and build provenance.
It also verifies that the package's browser assets match source during creation.
The ZIP is produced only after all CI validation steps pass.

On Linux/macOS with `sha256sum`, an extracted bundle can additionally be checked
with `sha256sum --check SHA256SUMS`. On PowerShell, use
`Get-FileHash ./Siteimprove.Umbraco17.Plugin.1.0.0.nupkg -Algorithm SHA256` and compare
with `release.json`. Obtain artifacts from the trusted repository: checksums
verify integrity, not publisher identity.

## Deployment checks and rollback

Check the assistant's selected page, save/publish updates, settings persistence,
draft checks/highlighting and platform links in your environment. Confirm content
editing still works when Siteimprove is unavailable. See
[validation and known limits](VALIDATION.md) for what has been tested.

Keep the preceding application and package for your normal deployment rollback.
Removing the plugin leaves content and the saved domain mapping intact. The
Umbraco 13 plugin cannot run on Umbraco 17; see
[removal and rollback](INSTALLATION.md#removing-or-reverting-the-plugin).
