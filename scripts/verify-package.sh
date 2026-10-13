#!/usr/bin/env bash
set -euo pipefail
TASK_REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TASK_PACKAGE_DIR="$TASK_REPO_DIR/artifacts"
python3 - "$TASK_PACKAGE_DIR" <<'PY'
import sys, zipfile
from pathlib import Path
package = next(Path(sys.argv[1]).glob("*.nupkg"))
with zipfile.ZipFile(package) as archive:
    paths = archive.namelist()
    assert "buildTransitive/Siteimprove.Umbraco17.Plugin.targets" in paths, paths
    for name in ["umbraco-package.json", "entrypoint.js", "api.js", "assistant.js",
                 "document-context.js", "settings.element.js", "preview.js"]:
        expected = "contentFiles/any/any/App_Plugins/Siteimprove/" + name
        assert expected in paths, (expected, paths)
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
dotnet add "$TASK_SMOKE_DIR/Consumer.csproj" package Siteimprove.Umbraco17.Plugin --version 1.0.0-beta.1
dotnet build "$TASK_SMOKE_DIR/Consumer.csproj" -c Release
dotnet publish "$TASK_SMOKE_DIR/Consumer.csproj" -c Release -o "$TASK_SMOKE_DIR/published"
for asset in umbraco-package.json entrypoint.js api.js assistant.js document-context.js settings.element.js preview.js; do
  for directory in "$TASK_SMOKE_DIR" "$TASK_SMOKE_DIR/published"; do
    if [[ ! -f "$directory/App_Plugins/Siteimprove/$asset" ]]; then
      echo "Missing asset: $directory/App_Plugins/Siteimprove/$asset" >&2
      exit 1
    fi
  done
done
echo "NuGet build and publish asset checks passed."
