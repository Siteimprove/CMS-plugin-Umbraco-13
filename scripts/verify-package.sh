#!/usr/bin/env bash
set -euo pipefail
TASK_REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TASK_PACKAGE_DIR="$TASK_REPO_DIR/artifacts"
TASK_PACKAGE_VERSION="$(python3 "$TASK_REPO_DIR/scripts/package_metadata.py")"
python3 - "$TASK_PACKAGE_DIR" "$TASK_PACKAGE_VERSION" <<'PY'
import sys, zipfile, json
from pathlib import Path
from xml.etree import ElementTree as ET
package = Path(sys.argv[1]) / f"Siteimprove.Umbraco17.Plugin.{sys.argv[2]}.nupkg"
with zipfile.ZipFile(package) as archive:
    paths = archive.namelist()
    nuspec = ET.fromstring(archive.read(next(name for name in paths if name.endswith('.nuspec'))))
    assert nuspec.findtext('{*}metadata/{*}version') == sys.argv[2]
    manifest = json.loads(archive.read('contentFiles/any/any/App_Plugins/Siteimprove/umbraco-package.json'))
    assert manifest['version'] == sys.argv[2]
    assert "buildTransitive/Siteimprove.Umbraco17.Plugin.targets" in paths, paths
    for name in ["umbraco-package.json", "entrypoint.js", "api.js", "assistant.js",
                 "document-context.js", "settings.element.js", "preview.js", "visibility.js"]:
        expected = "contentFiles/any/any/App_Plugins/Siteimprove/" + name
        assert expected in paths, (expected, paths)
        source = package.parent.parent / "contentFiles/App_Plugins/Siteimprove" / name
        assert archive.read(expected) == source.read_bytes(), "Stale packaged asset: " + name
print("NuGet archive paths verified.")
PY
TASK_SMOKE_DIR="$(mktemp -d)"
trap 'rm -rf "$TASK_SMOKE_DIR"' EXIT
dotnet new web -n Consumer -o "$TASK_SMOKE_DIR" --framework net10.0
python3 - "$TASK_SMOKE_DIR" "$TASK_PACKAGE_DIR" <<'PY'
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
root = ET.Element("configuration")
sources = ET.SubElement(root, "packageSources")
ET.SubElement(sources, "clear")
ET.SubElement(sources, "add", key="port", value=sys.argv[2])
ET.SubElement(sources, "add", key="nuget", value="https://api.nuget.org/v3/index.json")
ET.ElementTree(root).write(Path(sys.argv[1]) / "nuget.config", encoding="unicode")
PY
dotnet add "$TASK_SMOKE_DIR/Consumer.csproj" package Siteimprove.Umbraco17.Plugin --version "$TASK_PACKAGE_VERSION"
dotnet build "$TASK_SMOKE_DIR/Consumer.csproj" -c Release
dotnet publish "$TASK_SMOKE_DIR/Consumer.csproj" -c Release -o "$TASK_SMOKE_DIR/published"
for asset in umbraco-package.json entrypoint.js api.js assistant.js document-context.js settings.element.js preview.js visibility.js; do
  for directory in "$TASK_SMOKE_DIR" "$TASK_SMOKE_DIR/published"; do
    if [[ ! -f "$directory/App_Plugins/Siteimprove/$asset" ]]; then
      echo "Missing asset: $directory/App_Plugins/Siteimprove/$asset" >&2
      exit 1
    fi
    cmp "$directory/App_Plugins/Siteimprove/$asset" "$TASK_REPO_DIR/contentFiles/App_Plugins/Siteimprove/$asset"
  done
done
echo "NuGet build and publish asset checks passed."
