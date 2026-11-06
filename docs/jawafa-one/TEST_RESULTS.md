# TEST_RESULTS — run 2026-11-06 on this branch's working tree

Environment: Linux container, Node 22.23.4, Java 21, firebase-tools 13 (Firestore + Auth emulators, project `demo-jawafa-one`), Chromium via Playwright, Electron 33.2.1. **Not** the production Firebase project.

| Suite | Command | Result | Evidence |
|---|---|---|---|
| Core unit | `node --test dashboard/tests/one-core.test.cjs` | 6/6 PASS | evidence/unit-tests.txt |
| Firestore rules (tenant isolation, RBAC, invites, router, audit, social, plan) | emulators:exec firestore | 15/15 PASS | evidence/rules-tests.txt |
| End-to-end (2 companies, owner/auditor/stranger, 390 px phone) | emulators:exec auth,firestore | 19/19 PASS (3 consecutive runs) | evidence/e2e-results.json, *.png |
| Desktop policy unit | `node --test apps/desktop/test/*.test.cjs` | 3/3 PASS | console |
| Desktop shell smoke (Linux Electron, same main.js) | xvfb-run electron | PASS — window title «جوافة ONE AI \| مركز القيادة»; unreachable URL → offline.html | console (session log) |
| Windows build | `npm run dist:zip` | PASS — `JAWAFA ONE AI.exe` is PE32+ x86-64 GUI; zip SHA-256 `ecd284d1fde7dfef7a4abbb460e74cc3db3b551409e0cd74a3556d0e6244d914` | build output |
| Windows installer (NSIS) | `npm run dist:win` | BLOCKED here — requires Wine; runs in CI on windows-latest | — |
| Android APK | gradle assembleDebug | BLOCKED here — Android SDK host dl.google.com returns 403; CI job added, not yet run | — |
| Regression (all existing dashboard tests) | `node --test dashboard/tests/*` | 52/53 PASS; #11 aas-roster FAILS identically before this change | evidence/regression-tests.txt |

## Defects found and fixed during testing

1. **Security (rules):** a stored role value `"owner"` in `roles` granted owner-level rights. Fixed: `roleIn` accepts only the 7 invitable roles; test RBAC-03.
2. **UX:** after creating a company, a late `location.hash = "#company"` fired on server acknowledgement and pulled the user away from the screen they had moved to. Removed.
3. **Syntax:** an extra parenthesis in app.js (missed by `node --check` on a .js file) — CORE-06 now checks app.js as an ES module.
4. Visual: empty company selector shown when signed out (`[hidden]` overridden by CSS), oversized DEMO badges, clipped chart axis labels, mixed digit styles.

## Not tested (and therefore not claimed)

Production Google sign-in, service worker/offline install, English translation completeness, light theme legibility, global search, the APK, the Windows exe on Windows, iOS.
