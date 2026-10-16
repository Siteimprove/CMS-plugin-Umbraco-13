"""Create a separate disposable CMS database and content root for each browser."""
from pathlib import Path
import shutil

repo = Path(__file__).resolve().parent.parent
source = repo / "tests/browser/host"
for engine in ["chromium", "firefox", "webkit"]:
    target = repo / "tests/browser/.hosts" / engine
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    shutil.copy(source / "appsettings.json", target / "appsettings.json")
    for directory in ["App_Plugins", "wwwroot"]:
        if (source / directory).exists():
            shutil.copytree(source / directory, target / directory)
        else:
            (target / directory).mkdir()
print("Prepared three isolated CMS browser fixtures.")
