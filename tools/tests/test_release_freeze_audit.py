"""Synthetic tests for read-only production freeze audit."""
import importlib.util
from pathlib import Path
import unittest

path = Path(__file__).resolve().parents[1] / "release_freeze_audit.py"
spec = importlib.util.spec_from_file_location("freeze_guard", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class FreezeGuardTests(unittest.TestCase):
    def test_blocks_pages_action(self):
        self.assertTrue(mod.inspect_workflow("other.yml", "steps:\n  - uses: actions/deploy-pages@v4"))

    def test_blocks_release_commands(self):
        self.assertTrue(mod.inspect_workflow("release.yml", "run: gh release create v1.0"))
        self.assertTrue(mod.inspect_workflow("release.yml", "run: npx wrangler deploy"))

    def test_does_not_flag_safe_ci(self):
        body = "permissions:\n  contents: read\nsteps:\n  - uses: actions/upload-artifact@v4"
        self.assertEqual(mod.inspect_workflow("test.yml", body), [])

    def test_freeze_pages_require_marker(self):
        self.assertTrue(mod.inspect_workflow("pages.yml", "name: Not clearly frozen"))
        self.assertEqual(mod.inspect_workflow("pages.yml", "name: Production Pages deployment frozen"), [])


if __name__ == "__main__":
    unittest.main()
