"""Read the shared package version and detect backoffice manifest drift."""

import json
from pathlib import Path
import xml.etree.ElementTree as ET


def package_version(root: Path) -> str:
    version = ET.parse(root / "Directory.Build.props").findtext("./PropertyGroup/SiteimprovePackageVersion")
    manifest = json.loads((root / "contentFiles/App_Plugins/Siteimprove/umbraco-package.json").read_text())
    if not version or manifest["version"] != version:
        raise ValueError("Package version and backoffice manifest version must match.")
    return version


if __name__ == "__main__":
    print(package_version(Path(__file__).resolve().parent.parent))
