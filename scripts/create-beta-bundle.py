"""Bundle the built beta package and customer guides; CI runs this after validation."""

import hashlib
import json
import os
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET
import zipfile

root = Path(__file__).resolve().parent.parent
version = ET.parse(root / "Siteimprove.Umbraco17.Plugin.csproj").findtext("./PropertyGroup/Version")
manifest = json.loads((root / "contentFiles/App_Plugins/Siteimprove/umbraco-package.json").read_text())
if not version or "-beta." not in version or manifest["version"] != version:
    raise ValueError("Expected matching beta versions in the project and backoffice manifest.")

package_name = f"Siteimprove.Umbraco17.Plugin.{version}.nupkg"
package = root / "artifacts" / package_name
with zipfile.ZipFile(package) as archive:
    nuspec = next(name for name in archive.namelist() if name.endswith(".nuspec"))
    metadata = ET.fromstring(archive.read(nuspec)).find("{*}metadata")
    if metadata.findtext("{*}version") != version:
        raise ValueError("Built NuGet package version does not match the beta version.")
    packaged_manifest = json.loads(archive.read("contentFiles/any/any/App_Plugins/Siteimprove/umbraco-package.json"))
    if packaged_manifest["version"] != version:
        raise ValueError("Packaged backoffice manifest has the wrong version.")

files = {package_name: package.read_bytes(), "README.md": (root / "README.md").read_bytes()}
for name in ["INSTALLATION.md", "USAGE.md", "BETA.md", "BROWSER-TESTS.md", "VALIDATION.md"]:
    files[f"docs/{name}"] = (root / "docs" / name).read_bytes()
files["START-HERE.md"] = (
    f"# Siteimprove for Umbraco 17 — {version}\n\n"
    "For customer acceptance testing on Umbraco 17.7.1+ (17.x) and .NET 10.\n\n"
    "1. Read [beta notes](docs/BETA.md) and the acceptance checklist.\n"
    "2. Follow [installation](docs/INSTALLATION.md) to install the included NuGet package.\n"
    "3. Open **Settings → Siteimprove** and follow [usage/configuration](docs/USAGE.md).\n\n"
    "Build provenance is in `release.json`; verify file hashes with `SHA256SUMS`.\n"
).encode()

build_commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
workflow_url = None
if os.environ.get("GITHUB_RUN_ID"):
    workflow_url = f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}"
files["release.json"] = (json.dumps({
    "package": "Siteimprove.Umbraco17.Plugin", "version": version,
    "umbraco": ">=17.7.1 <18.0.0", "dotnet": "10",
    "source_commit": os.environ.get("BETA_SOURCE_COMMIT", build_commit),
    "build_commit": build_commit, "validation_workflow": workflow_url,
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
print(f"Created {bundle.name} with {len(files)} files.")
