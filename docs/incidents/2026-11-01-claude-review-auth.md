# Claude review authentication incident — 2026-11-01

Author: ChatGPT — OpenAI GPT-6
Source: https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/actions/runs/41156418370/job/124458631306
Tracking: https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/107

## Evidence
The job's **Prepare the Claude token** step failed; review never ran. The debug log shows the OAuth secret expands to multiple masked lines; the alternate ANTHROPIC_API_KEY was unavailable. Ubuntu 26.04.1 is observed but not established as causal.

## Remediation and acceptance
- Inspect the actual Claude workflow filename and content before editing. Do not infer a path from the job name.
- Use one supported authentication method. A repository administrator must securely rotate/re-enter a valid one-line `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`, or a valid `ANTHROPIC_API_KEY`, into Actions secrets. Never commit, log or post secret values.
- Validate credential presence and single-line format without printing the value; fail closed with a descriptive message. Keep least-privilege token permissions.
- Pin a tested Ubuntu image; update deprecated Actions only after compatibility testing.
- Prove a green review run and an actual PR review comment on a safe test PR; record workflow SHA, run ID, job ID, and timestamps.
- Search historical runs for the same signature; document each historical failure and rerun eligible jobs only after fixing configuration. Reruns do not alter original history.
- Apply to other repositories only after checking that they contain the same affected workflow. Preserve deployment gates and do not touch financial data or Jawafa_DB.

Status: diagnostic evidence verified; authentication secret correction and successful rerun not verified. NO EVIDENCE = NO DONE.
