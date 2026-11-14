# JAWAFA ERP AI — New independent application

**Version:** `0.1.0-foundation` · **State:** prototype / NOT production-ready.

A **new Flutter codebase**, independent of the original TrustSoft program and independent of the previous JAWAFA ONE app. Its intended platforms are **Windows (.exe in a distributable folder or ZIP), Android (.apk), and iOS (.app unsigned development build)**.

## Functional goal

Recreate **at least 90% of the catalogued, independently tested TrustSoft ERP workflows**, then extend the weighted catalog by **50%+ of additional AI/security features**. The weights and denominators must be frozen *after* reverse-engineering the approved software features and user-authorized database schema. **A table inventory is not a functional-completion percentage.**

## What currently works

- New cross-platform Material 3 RTL app shell with independent navigation.
- Prototype cheque state machine: event IDs, allowed transitions, different initiator/approver, role checks, event timeline. In-memory demo only; **no bank, cheque, or financial record is created or modified**.
- Exact integer fils bookkeeping rules for balanced journal entries.
- Stub screens identify their unimplemented status; no false operational data.
- Flutter tests and CI definitions for Android, Windows, and iOS.

## What is NOT connected or approved

- No connection to `Jawafa_DB`, TrustSoft, banks, tax authority, POS, or production ERP database.
- No production authentication, role provisioning, secure API gateway, audited storage, or deployment.
- No signed iOS IPA. iOS compilation on macOS without codesigning produces an **unsigned .app**, not an App Store/TestFlight installable distribution.
- Flutter Windows release is an `.exe` **with its runtime dependencies** in a folder, zipped by CI; it is not a standalone one-file installer.
- Android CI artifact is a **debug APK**, not a production-signed release.

## Development

Requires Flutter stable `3.47.0` (one source codebase).

```sh
flutter create . --project-name jawafa_erp_ai --org ai.jawafa --platforms=android,ios,windows
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
```

On Windows, `flutter build windows --release`; on macOS, `flutter build ios --release --no-codesign`.

The CI workflow generates platform scaffolds in each runner to keep the repository small and to avoid mixing legacy application code with the new ERP implementation.

## Safety and ownership

- Jawafa_DB and TrustSoft are **read-only reference systems**; no extraction of vendor source code.
- Financial records must never be altered, erased, backdated, or silently overwritten by agents.
- Separate new ERP storage will require audited immutable events, a backend authorizer and financial transaction controls before production use.
- The demo operates on fabricated examples only. No bank or account credentials are embedded.

See `docs/ARCHITECTURE.md`, `docs/TRUSTSOFT_MATCHING_PLAN.md`, and `backend/migrations/0001_erp_initial.sql`.
