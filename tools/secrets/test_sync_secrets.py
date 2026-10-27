import contextlib
import io
import unittest
from unittest.mock import patch
import sync_secrets as s

class SyncTests(unittest.TestCase):
    def test_audit_never_prompts_or_writes(self):
        with patch.object(s, 'names_in', return_value=set()), patch.object(s.getpass, 'getpass') as prompt, patch.object(s, 'gh') as gh:
            s.sync(['owner/repo'], s.DEFAULT_NAMES)
            prompt.assert_not_called()
            gh.assert_not_called()

    def test_existing_requires_explicit_overwrite(self):
        with patch.object(s, 'names_in', return_value={'FOD_CLIENT_ID'}), patch.object(s.getpass, 'getpass') as prompt:
            with self.assertRaises(RuntimeError):
                s.sync(['owner/repo'], s.DEFAULT_NAMES, True)
            prompt.assert_not_called()

    def test_conflicting_auth_stops_before_prompt(self):
        with patch.object(s, 'names_in', return_value={'FOD_USER'}), patch.object(s.getpass, 'getpass') as prompt:
            with self.assertRaises(RuntimeError):
                s.sync(['owner/repo'], s.DEFAULT_NAMES, True, True)
            prompt.assert_not_called()

    def test_sync_once_to_multiple_repos_no_value_in_logs_or_argv(self):
        output = io.StringIO()
        with patch.object(s, 'names_in', side_effect=[set(), set(), set(s.DEFAULT_NAMES), set(s.DEFAULT_NAMES)]), patch.object(s.getpass, 'getpass', side_effect=['private-id', 'private-value']) as prompt, patch.object(s, 'gh', return_value='') as gh, contextlib.redirect_stdout(output):
            s.sync(['owner/one', 'owner/two'], s.DEFAULT_NAMES, True)
            self.assertEqual(prompt.call_count, 2)
            self.assertEqual(gh.call_count, 4)
            for call in gh.call_args_list:
                self.assertNotIn('private-value', call.args)
                self.assertNotIn('private-id', call.args)
            self.assertNotIn('private-value', output.getvalue())
            self.assertNotIn('private-id', output.getvalue())

    def test_empty_input_does_not_write(self):
        with patch.object(s, 'names_in', return_value=set()), patch.object(s.getpass, 'getpass', side_effect=['id', '']), patch.object(s, 'gh') as gh:
            with self.assertRaises(ValueError):
                s.sync(['owner/repo'], s.DEFAULT_NAMES, True)
            gh.assert_not_called()

    def test_partial_failure_is_not_success(self):
        output = io.StringIO()
        with patch.object(s, 'names_in', return_value=set()), patch.object(s.getpass, 'getpass', return_value='hidden'), patch.object(s, 'gh', side_effect=['', RuntimeError('failed')]), contextlib.redirect_stdout(output):
            with self.assertRaises(RuntimeError):
                s.sync(['owner/repo'], s.DEFAULT_NAMES, True)
        self.assertIn('1 writes accepted', output.getvalue())
        self.assertNotIn('names verified', output.getvalue())

    def test_invalid_destination_before_network(self):
        with patch.object(s, 'names_in') as inventory:
            with self.assertRaises(ValueError):
                s.sync(['https://example.com/repo'], s.DEFAULT_NAMES, True)
            inventory.assert_not_called()

if __name__ == '__main__':
    unittest.main()
