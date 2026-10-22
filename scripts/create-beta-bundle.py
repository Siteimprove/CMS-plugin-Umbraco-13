"""Compatibility entry point for the release bundle command."""

from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).with_name("create-release-bundle.py")), run_name="__main__")
