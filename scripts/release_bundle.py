"""Verify customer bundles without extracting or installing their contents."""

import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile
from package_metadata import release_channel

PACKAGE_ID = "Siteimprove.Umbraco17.Plugin"
GUIDES = (
    "INSTALLATION.md", "USAGE.md", "BETA.md", "BROWSER-TESTS.md",
    "VALIDATION.md", "REVIEW.md", "RELEASING.md", "MARKETPLACE.md",
)

RELEASE_GUIDES = tuple("DISTRIBUTION.md" if name == "BETA.md" else name for name in GUIDES)


def bundle_guides(version: str, *, legacy: bool = False) -> tuple[str, ...]:
    if legacy:
        return GUIDES
    return RELEASE_GUIDES if release_channel(version) == "stable" else GUIDES + ("DISTRIBUTION.md",)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def archive_files(data: bytes) -> dict[str, bytes]:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError("Duplicate archive entries.")
        for name in names:
            path = PurePosixPath(name)
            if path.is_absolute() or ".." in path.parts or "\\" in name:
                raise ValueError(f"Unsafe archive path: {name}")
        return {name: archive.read(name) for name in names if not name.endswith("/")}


def verify_package(data: bytes, version: str, build_commit: str, root: Path | None = None) -> None:
    files = archive_files(data)
    nuspecs = [name for name in files if name.endswith(".nuspec")]
    if len(nuspecs) != 1:
        raise ValueError("Expected one NuGet manifest.")
    metadata = ET.fromstring(files[nuspecs[0]]).find("{*}metadata")
    if metadata is None or metadata.findtext("{*}id") != PACKAGE_ID:
        raise ValueError("Unexpected NuGet package ID.")
    if metadata.findtext("{*}version") != version:
        raise ValueError("NuGet package version does not match the bundle.")
    repository = metadata.find("{*}repository")
    if repository is None or repository.get("commit") != build_commit:
        raise ValueError("NuGet repository commit does not match the bundle build; rebuild the package.")
    prefix = "contentFiles/any/any/App_Plugins/Siteimprove/"
    manifest = json.loads(files[prefix + "umbraco-package.json"])
    if manifest.get("version") != version:
        raise ValueError("Packaged backoffice manifest has the wrong version.")
    required = {prefix + name for name in (
        "entrypoint.js", "api.js", "assistant.js", "document-context.js",
        "settings.element.js", "preview.js", "visibility.js",
    )} | {"lib/net10.0/" + PACKAGE_ID + ".dll", "buildTransitive/" + PACKAGE_ID + ".targets", "README.md"}
    missing = required - files.keys()
    if missing:
        raise ValueError(f"Missing NuGet contents: {sorted(missing)}")
    if root is not None:
        source = root / "contentFiles/App_Plugins/Siteimprove"
        expected = {prefix + path.relative_to(source).as_posix(): path.read_bytes()
                    for path in source.rglob("*") if path.is_file()}
        packaged = {name: value for name, value in files.items() if name.startswith(prefix)}
        if expected != packaged:
            raise ValueError("NuGet browser assets differ from the current source; rebuild the package.")
        for name in ("README.md", "buildTransitive/" + PACKAGE_ID + ".targets"):
            if files[name] != (root / name).read_bytes():
                raise ValueError(f"Stale NuGet file: {name}; rebuild the package.")


def verify_bundle(bundle: Path, *, require_ci: bool = False,
                  expected_source_commit: str | None = None, root: Path | None = None) -> dict:
    data = bundle.read_bytes()
    checksum = bundle.with_suffix(bundle.suffix + ".sha256").read_text().strip()
    if checksum != f"{sha256(data)}  {bundle.name}":
        raise ValueError("Customer ZIP checksum does not match its sidecar.")
    files = archive_files(data)
    release = json.loads(files["release.json"])
    version = release.get("version", "")
    channel = release_channel(version)
    if release.get("release_channel", "beta") != channel:
        raise ValueError("Release channel does not match the package version.")
    package_name = f"{PACKAGE_ID}.{version}.nupkg"
    required = {package_name, "START-HERE.md", "README.md", "release.json", "SHA256SUMS",
                f"docs/releases/{version}.md"} | {f"docs/{name}" for name in bundle_guides(version, legacy="release_channel" not in release)}
    if set(files) != required:
        raise ValueError(f"Unexpected bundle contents; missing={sorted(required - files.keys())}, extra={sorted(files.keys() - required)}")
    expected_hashes = "".join(f"{sha256(value)}  {name}\n"
                              for name, value in sorted(files.items()) if name != "SHA256SUMS")
    if files["SHA256SUMS"].decode() != expected_hashes:
        raise ValueError("SHA256SUMS does not cover the exact bundle contents and hashes.")
    if release.get("package") != PACKAGE_ID or release.get("package_sha256") != sha256(files[package_name]):
        raise ValueError("Package identity or checksum does not match release.json.")
    for field in ("source_commit", "build_commit"):
        if not re.fullmatch(r"[0-9a-f]{40}", release.get(field, "")):
            raise ValueError(f"Invalid {field} in release.json.")
    if type(release.get("source_worktree_dirty")) is not bool:
        raise ValueError("Missing source worktree status in release.json.")
    if expected_source_commit and release["source_commit"] != expected_source_commit:
        raise ValueError("Bundle does not contain the expected source commit.")
    if require_ci:
        workflow = release.get("validation_workflow") or ""
        if not re.fullmatch(r"https://github.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/[0-9]+", workflow):
            raise ValueError("Distribution requires a GitHub validation workflow URL.")
        if release["source_worktree_dirty"]:
            raise ValueError("Distribution requires a clean source worktree.")
    verify_package(files[package_name], version, release["build_commit"], root)
    for name, value in files.items():
        if not name.endswith(".md"):
            continue
        for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", value.decode()):
            target = target.strip("<>").split("#", 1)[0]
            if not target or re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", target):
                continue
            path = posixpath.normpath(posixpath.join(posixpath.dirname(name), target))
            if path not in files:
                raise ValueError(f"Broken bundle guide link in {name}: {target}")
    return release
