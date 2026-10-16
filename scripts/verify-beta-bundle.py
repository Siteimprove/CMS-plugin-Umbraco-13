"""Check a customer ZIP, checksums, package provenance, contents and guide links."""

import argparse
from pathlib import Path
from beta_bundle import verify_bundle

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("bundle", type=Path)
parser.add_argument("--require-ci", action="store_true", help="Require a workflow URL and clean build.")
parser.add_argument("--expected-source-commit", help="Require the source commit selected for release.")
args = parser.parse_args()
release = verify_bundle(args.bundle, require_ci=args.require_ci,
                        expected_source_commit=args.expected_source_commit)
print(f"Verified {args.bundle.name}: {release['version']}, source {release['source_commit']}.")
