"""Read the shared package version and detect backoffice manifest drift."""

import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET


def release_channel(version: str) -> str:
    number = r"(?:0|[1-9][0-9]*)"
    if re.fullmatch(rf"{number}\.{number}\.{number}", version):
        return "stable"
    if re.fullmatch(rf"{number}\.{number}\.{number}-beta\.{number}", version):
        return "beta"
    raise ValueError("Expected a stable X.Y.Z or beta X.Y.Z-beta.N version.")


def package_version(root: Path) -> str:
    version = ET.parse(root / "Directory.Build.props").findtext("./PropertyGroup/SiteimprovePackageVersion")
    manifest = json.loads((root / "contentFiles/App_Plugins/Siteimprove/umbraco-package.json").read_text())
    if not version or manifest["version"] != version:
        raise ValueError("Package version and backoffice manifest version must match.")
    release_channel(version)
    return version


if __name__ == "__main__":
    print(package_version(Path(__file__).resolve().parent.parent))
