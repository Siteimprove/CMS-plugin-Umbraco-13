#!/usr/bin/env bash
set -euo pipefail
TASK_REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TASK_PACKAGE_DIR="$TASK_REPO_DIR/artifacts"
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
dotnet add "$TASK_SMOKE_DIR/Consumer.csproj" package Siteimprove.Umbraco17.Plugin --version 1.0.0-alpha.1
dotnet build "$TASK_SMOKE_DIR/Consumer.csproj" -c Release
dotnet publish "$TASK_SMOKE_DIR/Consumer.csproj" -c Release -o "$TASK_SMOKE_DIR/published"
for asset in umbraco-package.json entrypoint.js api.js assistant.js document-context.js settings.element.js preview.js; do
  test -f "$TASK_SMOKE_DIR/App_Plugins/Siteimprove/$asset"
  test -f "$TASK_SMOKE_DIR/published/App_Plugins/Siteimprove/$asset"
done
echo "NuGet build and publish asset checks passed."
