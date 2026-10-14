#!/usr/bin/env bash
# Reuse the verified beta.2 binaries and create a private draft prerelease.
set -euo pipefail

cd "$(dirname "$0")/.."
repo=Siteimprove/CMS-plugin-Umbraco-13
run=38471887229
source_commit=49d70214c8697936724f6717f5ad07a03aacf0ea
version=1.0.0-beta.2
package="Siteimprove.Umbraco17.Plugin.${version}.nupkg"
bundle="Siteimprove.Umbraco17.Plugin.${version}.customer.zip"

for program in gh python3 unzip sha256sum; do
    command -v "$program" >/dev/null || { echo "Required command missing: $program" >&2; exit 1; }
done
[[ "$(python3 scripts/package_metadata.py)" == "$version" ]] || {
    echo 'This script is pinned to the verified beta.2 release.' >&2; exit 1;
}

gh run view "$run" --repo "$repo" --json status,conclusion,headSha |
    python3 -c 'import json, sys
run = json.load(sys.stdin)
if run["status"] != "completed" or run["conclusion"] != "success" or run["headSha"] != sys.argv[1]:
    raise SystemExit("The pinned validation run must have passed for the expected source commit.")' "$source_commit"

release_dir=$(mktemp -d)
trap 'rm -rf "$release_dir"' EXIT
gh run download "$run" --repo "$repo" --name Siteimprove-Umbraco17-beta --dir "$release_dir"
(cd "$release_dir" && sha256sum --check "${bundle}.sha256")
unzip -q "$release_dir/$bundle" -d "$release_dir/bundle"
(cd "$release_dir/bundle" && sha256sum --check SHA256SUMS)

python3 - "$release_dir/bundle" "$version" "$source_commit" "$repo" "$run" <<'PY'
import hashlib
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile

directory, version, source, repo, run = sys.argv[1:]
directory = Path(directory)
provenance = json.loads((directory / "release.json").read_text())
expected = {
    "package": "Siteimprove.Umbraco17.Plugin", "version": version,
    "source_commit": source,
    "validation_workflow": f"https://github.com/{repo}/actions/runs/{run}",
}
if any(provenance.get(key) != value for key, value in expected.items()):
    raise SystemExit("The bundle provenance does not match the verified beta.2 build.")
package = directory / f"Siteimprove.Umbraco17.Plugin.{version}.nupkg"
if hashlib.sha256(package.read_bytes()).hexdigest() != provenance["package_sha256"]:
    raise SystemExit("The package checksum does not match its provenance.")
with zipfile.ZipFile(package) as archive:
    nuspec = next(name for name in archive.namelist() if name.endswith(".nuspec"))
    metadata = ET.fromstring(archive.read(nuspec)).find("{*}metadata")
    manifest = json.loads(archive.read("contentFiles/any/any/App_Plugins/Siteimprove/umbraco-package.json"))
    if metadata.findtext("{*}version") != version or manifest["version"] != version:
        raise SystemExit("The NuGet package or backoffice manifest version does not match.")
PY

gh release create "v${version}" --repo "$repo" --target "$source_commit" \
    --draft --prerelease --latest=false \
    --title "Siteimprove for Umbraco 17 — ${version}" \
    --notes-file "docs/releases/${version}.md" \
    "$release_dir/$bundle" "$release_dir/${bundle}.sha256" \
    "$release_dir/bundle/$package" docs/INSTALLATION.md docs/USAGE.md
