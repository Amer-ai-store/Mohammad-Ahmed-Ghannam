"""Deterministic self-tests for the repository-native DCO trailer audit."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from verify_pr_dco import trailer_matches_author  # noqa: E402


class TestDcoTrailers(unittest.TestCase):
    def test_exact_author_passes(self):
        self.assertTrue(trailer_matches_author(
            "feat: safe change\n\nSigned-off-by: Amer-ai-store "
            "<263270685+Amer-ai-store@users.noreply.github.com>\n",
            "Amer-ai-store", "263270685+Amer-ai-store@users.noreply.github.com",
        ))

    def test_missing_trailer_fails(self):
        self.assertFalse(trailer_matches_author(
            "feat: unsigned change", "Amer-ai-store", "author@example.com"
        ))

    def test_other_person_cannot_sign_for_author(self):
        self.assertFalse(trailer_matches_author(
            "fix: change\n\nSigned-off-by: Reviewer <reviewer@example.com>",
            "Amer-ai-store", "author@example.com",
        ))

    def test_wrong_email_fails(self):
        self.assertFalse(trailer_matches_author(
            "fix: change\n\nSigned-off-by: Amer-ai-store <else@example.com>",
            "Amer-ai-store", "author@example.com",
        ))

    def test_partial_or_inline_trailer_fails(self):
        self.assertFalse(trailer_matches_author(
            "fix: Signed-off-by: Amer-ai-store <author@example.com>",
            "Amer-ai-store", "author@example.com",
        ))


if __name__ == "__main__":
    unittest.main()
