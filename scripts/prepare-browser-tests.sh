#!/usr/bin/env bash
set -euo pipefail
TASK_REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 - "$TASK_REPO_DIR" <<'PY'
import sys
from pathlib import Path
from xml.etree import ElementTree as ET
repo = Path(sys.argv[1])
config = ET.Element("configuration")
sources = ET.SubElement(config, "packageSources")
ET.SubElement(sources, "clear")
ET.SubElement(sources, "add", key="port", value=str(repo / "artifacts"))
ET.SubElement(sources, "add", key="nuget", value="https://api.nuget.org/v3/index.json")
ET.ElementTree(config).write(repo / "tests/browser/host/nuget.config", encoding="unicode")
PY
dotnet build "$TASK_REPO_DIR/tests/browser/host/BrowserHost.csproj" -c Release
npm --prefix "$TASK_REPO_DIR/tests/browser" install --no-audit --no-fund
(cd "$TASK_REPO_DIR/tests/browser" && npx playwright install --with-deps chromium)
