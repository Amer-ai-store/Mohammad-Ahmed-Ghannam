# Issue #102 — Vercel release-freeze control, 2026-11-02

This document contains only deployment control evidence, never accounting data or secrets.

## Observed root cause
Vercel project `jawafa-secure-command-center` was automatically creating READY **preview** deployments on commits to development branches, including PR #117, PR #119 and PR #120. A GitHub Actions workflow-source scan alone cannot stop provider-side Git auto-builds. A preview deployment is **not** evidence of a production deployment, but it is an external publishing route.

## Safeguard applied through the authenticated Vercel project connector
At 2026-11-02, the targeted existing Jawafa project was updated with:
- `previewDeploymentsDisabled: true`;
- `commandForIgnoringBuildStep: "exit 0"` (skip Git builds);
- `gitForkProtection: true`.

The connector acknowledged an updated project. A subsequent project read confirmed that the same project remains accessible and retained its existing domain configuration; existing deployments were **not deleted**.

## Acceptance boundary
- This change targets **only** the named Jawafa Vercel project.
- A negative test on a fresh branch commit and independent confirmation of actual ignored/skipped status is required before calling the control fully verified.
- Check Vercel team/project settings and custom domains; manual API/CLI publishing and other provider integrations require independent testing.
- Separate production routes for Amer AI Store, Luqta, AppDeploy and GitHub Pages remain outside this single-project test.
- This document and the source scanner in PR #120 are non-production review material. DO NOT merge or resume production publishing before Issue #102 is independently accepted.
