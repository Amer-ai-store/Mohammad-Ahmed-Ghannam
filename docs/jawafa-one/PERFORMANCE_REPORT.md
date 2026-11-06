# PERFORMANCE_REPORT

| Measure | Result | Conditions |
|---|---|---|
| Time to ready (page load + Firebase SDK + emulator connect) | desktop 1054 ms, phone (390×844) 572 ms | Local static server, local SDK copy, local emulators — **not** a network/production measurement (E2E PERF-01) |
| Horizontal overflow at 390 px | 0 px | E2E-16 |
| App code size (uncompressed) | app.js ≈ 64 KB, core.js ≈ 14 KB, styles.css ≈ 13 KB (≈ 91 KB total) | No framework, no chart library (inline SVG) |
| Firebase SDK | loaded lazily after first paint (compat 10.14.1, 3 scripts) | Main cost on first visit |
| Effects | one radial gradient background + 8 px header blur; no animation loops; `prefers-reduced-motion` honoured | |

Not measured: real phone on mobile network, Lighthouse score, production CDN timing. Suggested next step: Lighthouse on the deployed `/one/` page.
