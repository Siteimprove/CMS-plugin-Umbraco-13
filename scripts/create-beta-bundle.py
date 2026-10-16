"""Bundle the built beta package and customer guides; CI runs this after validation."""

import hashlib
import json
import os
from pathlib import Path
import subprocess
import zipfile
from beta_bundle import GUIDES, verify_bundle, verify_package
from package_metadata import package_version

root = Path(__file__).resolve().parent.parent
version = package_version(root)
if "-beta." not in version:
    raise ValueError("Expected matching beta versions in the project and backoffice manifest.")

package_name = f"Siteimprove.Umbraco17.Plugin.{version}.nupkg"
package = root / "artifacts" / package_name
build_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
worktree_dirty = bool(subprocess.check_output(["git", "status", "--porcelain"], cwd=root, text=True).strip())
verify_package(package.read_bytes(), version, build_commit, root)

files = {package_name: package.read_bytes(), "README.md": (root / "README.md").read_bytes()}
for name in GUIDES:
    files[f"docs/{name}"] = (root / "docs" / name).read_bytes()
files[f"docs/releases/{version}.md"] = (root / "docs/releases" / f"{version}.md").read_bytes()
files["START-HERE.md"] = (
    f"# Siteimprove for Umbraco 17 — {version}\n\n"
    "For customer acceptance testing on Umbraco 17.7.1+ (17.x) and .NET 10.\n\n"
    "1. Read [beta notes](docs/BETA.md) and [the acceptance checklist](docs/VALIDATION.md).\n"
    "2. Follow [installation](docs/INSTALLATION.md) to install the included NuGet package.\n"
    "3. Open **Settings → Siteimprove** and follow [usage/configuration](docs/USAGE.md).\n\n"
    f"4. Review the [release notes](docs/releases/{version}.md).\n\n"
    "Build provenance is in `release.json`; verify file hashes with `SHA256SUMS`.\n"
    "A checksum verifies integrity; confirm the workflow succeeded before distribution.\n"
).encode()

workflow_url = None
if os.environ.get("GITHUB_RUN_ID"):
    workflow_url = f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
files["release.json"] = (json.dumps({
    "package": "Siteimprove.Umbraco17.Plugin", "version": version,
    "umbraco": ">=17.7.1 <18.0.0", "dotnet": "10",
    "source_commit": os.environ.get("BETA_SOURCE_COMMIT", build_commit),
    "build_commit": build_commit, "validation_workflow": workflow_url,
    "source_worktree_dirty": worktree_dirty,
    "package_sha256": hashlib.sha256(files[package_name]).hexdigest(),
}, indent=2) + "\n").encode()
files["SHA256SUMS"] = "".join(
    f"{hashlib.sha256(data).hexdigest()}  {name}\n" for name, data in sorted(files.items())
).encode()

bundle = root / "artifacts" / f"Siteimprove.Umbraco17.Plugin.{version}.customer.zip"
with zipfile.ZipFile(bundle, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for name, data in sorted(files.items()):
        archive.writestr(name, data)
bundle.with_suffix(bundle.suffix + ".sha256").write_text(
    f"{hashlib.sha256(bundle.read_bytes()).hexdigest()}  {bundle.name}\n"
)
verify_bundle(bundle, require_ci=os.environ.get("GITHUB_ACTIONS") == "true", root=root)
print(f"Created and verified {bundle.name} with {len(files)} files.")
