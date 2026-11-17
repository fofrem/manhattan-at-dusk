# Validation

Local checks performed with Node.js 24 and installed Google Chrome in an isolated headless test session, using a loopback HTTP server.

- Four unit tests: deterministic neighbourhood, road clearance, swept collision/wall sliding, viewpoints outside buildings, moving taxi lanes and timed stops.
- Production minified HTML loads and renders real WebGPU shaders.
- Keyboard movement changes camera coordinates; all six viewpoints and tour paths reviewed.
- Help, quality, exposure and canvas resizing exercised.
- A browser with no WebGPU displays the readable fallback.
- Mobile layout renders and exposes touch movement controls.
- No external runtime requests or JavaScript/GPU validation errors in smoke tests.
- Standalone HTML opens directly from disk (`file://`), without a server.
- Independent read-only code review found one keyboard accessibility defect: Space on a focused button was treated as movement. A browser regression test reproduced it; keyboard input now preserves native control activation.
- Visual inspection of landing, roof, street and mobile screenshots. Corrected negative window coverage at grazing angles, which had produced saturated pixel artifacts.

The environment reported approximately 60 fps at 1600 × 1000 during the desktop smoke test. This is a result for that test machine, not a performance promise for other GPUs. Mobile controls were exercised in Chrome device emulation, not on a physical handset. Taxi motion is decorative; no traffic simulation or map accuracy is claimed.
