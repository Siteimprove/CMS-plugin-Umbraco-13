"""Release verification must reject stale or incomplete customer artifacts."""

import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from beta_bundle import GUIDES, PACKAGE_ID, archive_files, sha256, verify_bundle

VERSION = "1.0.0-beta.6"
COMMIT = "a" * 40
PACKAGE = f"{PACKAGE_ID}.{VERSION}.nupkg"


def zipped(files):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    return output.getvalue()


class BundleVerificationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.bundle = Path(self.directory.name) / f"{PACKAGE_ID}.{VERSION}.customer.zip"
        prefix = "contentFiles/any/any/App_Plugins/Siteimprove/"
        package = {prefix + name: b"asset" for name in (
            "entrypoint.js", "api.js", "assistant.js", "document-context.js",
            "settings.element.js", "preview.js", "visibility.js")}
        package.update({
            prefix + "umbraco-package.json": json.dumps({"version": VERSION}).encode(),
            f"{PACKAGE_ID}.nuspec": (
                f"<package><metadata><id>{PACKAGE_ID}</id><version>{VERSION}</version>"
                f'<repository commit="{COMMIT}" /></metadata></package>').encode(),
            f"lib/net10.0/{PACKAGE_ID}.dll": b"assembly",
            f"buildTransitive/{PACKAGE_ID}.targets": b"targets", "README.md": b"package guide",
        })
        self.files = {f"docs/{name}": b"guide" for name in GUIDES}
        self.files.update({PACKAGE: zipped(package), "START-HERE.md": b"[Install](docs/INSTALLATION.md)",
                           "README.md": b"guide", f"docs/releases/{VERSION}.md": b"notes"})
        self.release = {"package": PACKAGE_ID, "version": VERSION, "source_commit": COMMIT,
                        "build_commit": COMMIT, "source_worktree_dirty": False,
                        "validation_workflow": "https://github.com/Siteimprove/CMS-plugin-Umbraco-13/actions/runs/123"}

    def write_bundle(self):
        self.release["package_sha256"] = sha256(self.files[PACKAGE])
        self.files["release.json"] = json.dumps(self.release).encode()
        self.files["SHA256SUMS"] = "".join(f"{sha256(data)}  {name}\n"
                                            for name, data in sorted(self.files.items())
                                            if name != "SHA256SUMS").encode()
        self.bundle.write_bytes(zipped(self.files))
        self.bundle.with_suffix(".zip.sha256").write_text(f"{sha256(self.bundle.read_bytes())}  {self.bundle.name}\n")

    def test_complete_ci_bundle(self):
        self.write_bundle()
        self.assertEqual(VERSION, verify_bundle(self.bundle, require_ci=True,
                                               expected_source_commit=COMMIT)["version"])

    def test_missing_release_notes(self):
        del self.files[f"docs/releases/{VERSION}.md"]
        self.write_bundle()
        with self.assertRaisesRegex(ValueError, "missing=.*releases"):
            verify_bundle(self.bundle)

    def test_package_from_another_commit(self):
        package = archive_files(self.files[PACKAGE])
        nuspec = f"{PACKAGE_ID}.nuspec"
        package[nuspec] = package[nuspec].replace(COMMIT.encode(), ("b" * 40).encode())
        self.files[PACKAGE] = zipped(package)
        self.write_bundle()
        with self.assertRaisesRegex(ValueError, "repository commit"):
            verify_bundle(self.bundle)

    def test_guide_tampering_with_valid_outer_checksum(self):
        self.write_bundle()
        self.files["README.md"] = b"altered guide"
        self.bundle.write_bytes(zipped(self.files))
        self.bundle.with_suffix(".zip.sha256").write_text(f"{sha256(self.bundle.read_bytes())}  {self.bundle.name}\n")
        with self.assertRaisesRegex(ValueError, "SHA256SUMS"):
            verify_bundle(self.bundle)

    def test_broken_relative_guide_link(self):
        self.files["README.md"] = b"[Missing](docs/NOT-IN-BUNDLE.md)"
        self.write_bundle()
        with self.assertRaisesRegex(ValueError, "Broken bundle guide link"):
            verify_bundle(self.bundle)

    def test_dirty_or_local_bundle_is_not_distributable(self):
        for field, value, error in (("source_worktree_dirty", True, "clean source"),
                                    ("validation_workflow", None, "workflow URL")):
            with self.subTest(field=field):
                original = self.release[field]
                self.release[field] = value
                self.write_bundle()
                verify_bundle(self.bundle)
                with self.assertRaisesRegex(ValueError, error):
                    verify_bundle(self.bundle, require_ci=True)
                self.release[field] = original

    def test_unexpected_source_commit(self):
        self.write_bundle()
        with self.assertRaisesRegex(ValueError, "expected source commit"):
            verify_bundle(self.bundle, expected_source_commit="b" * 40)

    def test_unsafe_archive_path(self):
        self.files["../outside"] = b"unexpected"
        self.write_bundle()
        with self.assertRaisesRegex(ValueError, "Unsafe archive path"):
            verify_bundle(self.bundle)


if __name__ == "__main__":
    unittest.main()
