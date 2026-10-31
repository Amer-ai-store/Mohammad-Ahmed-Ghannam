#!/usr/bin/env python3
"""Secret-free regression tests of the real inline credential guard."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github/workflows/claude-code-review.yml"
HELPER = ROOT / "scripts/save-claude-token.sh"


def auth_code():
    content = WORKFLOW.read_text(encoding="utf-8")
    anchor = "      - name: Prepare the Claude token"
    start = content.index("        run: |\n", content.index(anchor)) + len("        run: |\n")
    end = content.index("\n      - ", start)
    body = content[start:end]
    lines = body.splitlines()
    assert all(not l or l.startswith("          ") for l in lines), "Unexpected Python indent in workflow"
    code = "\n".join(l[10:] if l else "" for l in lines) + "\n"
    compile(code, str(WORKFLOW), "exec")
    return code


class ClaudeAuthGuardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.code = auth_code()

    def check(self, raw, api_key=False, expected_success=False, expected_saved=None):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_file = Path(temp_dir) / "github_env"
            output_file.write_text("", encoding="utf-8")
            env = os.environ.copy()
            env.update(RAW_TOKEN=raw, HAS_API_KEY=str(api_key).lower(), GITHUB_ENV=str(output_file))
            completed = subprocess.run(
                [sys.executable, "-c", self.code],
                capture_output=True, text=True, env=env, check=False, timeout=15,
            )
            combined = completed.stdout + completed.stderr
            self.assertEqual(completed.returncode == 0, expected_success, combined)
            saved = output_file.read_text(encoding="utf-8")
            self.assertEqual(saved, (f"CLAUDE_TOKEN={expected_saved}\n" if expected_saved else ""))
            if not expected_saved:
                # A malformed credential must never appear in error logs.
                self.assertNotIn(raw, combined) if len(raw) > 20 else None
            return combined

    def test_valid_single_line(self):
        token = "sk-ant-oat01-" + "A" * 112
        logged = self.check(token, expected_success=True, expected_saved=token)
        self.assertIn("::add-mask::", logged)

    def test_bad_secret_with_terminal_output(self):
        malformed = (
            "Copy the token printed by claude setup-token\n"
            "the token is sk-ant-oat01-\n"
            "additional instructions\n"
            "sk-ant-oat01-\n"
            "not-a-real-token\n"
            "still not a token\n"
            "end"
        )
        self.check(malformed)

    def test_wrapped_or_truncated_token_is_rejected(self):
        self.check("sk-ant-oat01-" + "A" * 40 + "\n" + "A" * 72)
        self.check("sk-ant-oat01-")
        self.check("sk-ant-oat01-" + "A" * 112 + " extra text")
        self.check(" sk-ant-oat01-" + "A" * 112 + " ")

    def test_api_key_fallback_does_not_save_bad_oauth(self):
        notice = self.check("not a real token pasted from a phone", api_key=True, expected_success=True)
        self.assertIn("ANTHROPIC_API_KEY", notice)

    def test_prefer_api_key_if_both_exist(self):
        self.check("sk-ant-oat01-" + "A" * 112, api_key=True, expected_success=True)

    def test_reject_missing_credentials(self):
        self.check("")

    def test_helper_targets_real_repo(self):
        helper = HELPER.read_text(encoding="utf-8")
        self.assertIn('REPO="Amer-ai-store/Mohammad-Ahmed-Ghannam"', helper)
        self.assertIn('git remote get-url origin', helper)
        self.assertIn('gh secret set "$SECRET" -R "$REPO"', helper)
        self.assertNotIn('REPO="Mohammadzxzx1991/', helper)

    def test_missing_credentials_fail_closed(self):
        workflow = WORKFLOW.read_text(encoding="utf-8")
        self.assertIn("Require Claude authentication", workflow)
        self.assertIn("exit 1", workflow)
        self.assertNotIn("Line shapes", workflow)


if __name__ == "__main__":
    unittest.main(verbosity=2)
