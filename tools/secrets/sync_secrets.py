#!/usr/bin/env python3
"""Audit or sync explicitly named Actions secrets; never retrieve stored values."""
import argparse
import getpass
import json
import re
import subprocess
import sys
import warnings

DEFAULT_REPO = 'Mohammadzxzx1991/Mohammad-Ahmed-Ghannam'
DEFAULT_NAMES = ['FOD_CLIENT_ID', 'FOD_CLIENT_SECRET']


def gh(*args, value=None):
    try:
        result = subprocess.run(['gh', *args], input=value, text=True,
                                capture_output=True, timeout=90)
    except (OSError, subprocess.TimeoutExpired):
        raise RuntimeError('GitHub CLI unavailable or timed out. Install gh and run gh auth login.') from None
    if result.returncode:
        # Never echo child stdout/stderr: it may contain sensitive material.
        raise RuntimeError('GitHub operation failed. Check gh authentication and repository Secrets permission.')
    return result.stdout


def names_in(repo):
    data = json.loads(gh('secret', 'list', '--repo', 'github.com/' + repo,
                         '--app', 'actions', '--json', 'name'))
    return {item['name'] for item in data}


def sync(repos, names, apply=False, overwrite=False):
    # Explicit destinations only. Never discover and write to every repository.
    for repo in repos:
        if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo):
            raise ValueError('Use OWNER/REPO for each destination.')
    for name in names:
        if not re.fullmatch(r'[A-Z_][A-Z0-9_]*', name) or name.startswith('GITHUB_'):
            raise ValueError('Invalid secret name.')
    inventory = {repo: names_in(repo) for repo in repos}
    for repo, existing in inventory.items():
        for name in names:
            print(f'{repo}: {name}: {"PRESENT (value unverified)" if name in existing else "MISSING"}')
    if not apply:
        print('AUDIT ONLY. No values read or written.')
        return
    if set(DEFAULT_NAMES) & set(names):
        for repo, existing in inventory.items():
            if existing & {'FOD_USER', 'FOD_TENANT', 'FOD_PAT'}:
                raise RuntimeError(f'{repo}: existing FoD user credentials conflict with client authentication. Resolve the chosen authentication method first; nothing was written.')
    if not overwrite and any(set(names) & existing for existing in inventory.values()):
        raise RuntimeError('Existing secrets found. Review the audit, then use --overwrite to intentionally replace selected names. Nothing was written.')
    values = {}
    # Collect all values before making any write. No files or command-line values.
    with warnings.catch_warnings():
        warnings.simplefilter('error', getpass.GetPassWarning)
        for name in names:
            try:
                value = getpass.getpass(f'{name} (hidden input): ')
            except getpass.GetPassWarning:
                raise RuntimeError('A terminal with hidden input is required; nothing was written.') from None
            if not value.strip():
                raise ValueError('Empty value rejected; nothing was written.')
            values[name] = value
    written = []
    try:
        for repo in repos:
            for name in names:
                gh('secret', 'set', name, '--repo', 'github.com/' + repo,
                   '--app', 'actions', value=values[name])
                written.append((repo, name))
                print(f'{repo}: {name}: API WRITE ACCEPTED')
            missing = set(names) - names_in(repo)
            if missing:
                raise RuntimeError('Metadata verification failed.')
            print(f'{repo}: names verified. Credential validity and workflow execution are NOT verified.')
    except Exception:
        print(f'PARTIAL/FAILED: {len(written)} writes accepted. No automatic rollback: previous values cannot be read.')
        raise
    finally:
        values.clear()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', action='append', help='Repeat for each explicitly selected OWNER/REPO')
    parser.add_argument('--secret', action='append', help='Repeat for each selected secret name')
    parser.add_argument('--apply', action='store_true', help='Prompt once per secret and write to selected repositories')
    parser.add_argument('--overwrite', action='store_true', help='Allow replacing existing selected secrets')
    args = parser.parse_args()
    try:
        sync(list(dict.fromkeys(args.repo or [DEFAULT_REPO])),
             list(dict.fromkeys(args.secret or DEFAULT_NAMES)), args.apply, args.overwrite)
    except (RuntimeError, ValueError, KeyError, EOFError, KeyboardInterrupt) as error:
        print(f'STOPPED: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
