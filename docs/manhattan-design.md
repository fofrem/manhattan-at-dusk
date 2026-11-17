# Manhattan at Dusk

Requested: a fork of Noniv/abyssal-garden with a few Manhattan blocks at dusk, lit windows, taxis and free movement between buildings.

Keep the upstream MIT license, history, procedural math helpers and single-HTML build. Replace the underwater scene with a compact, fictional Manhattan neighbourhood using native WebGPU. No runtime dependencies, downloaded models, map data, images or audio files.

Art direction: peach sunset, lavender haze, cool blue shadows, warm irregular windows, brick and limestone façades, stepped Art Deco towers, rooftop water tanks, street lamps, crosswalks and moving yellow cabs. This is an evocation of Manhattan, not a geographic reconstruction.

Camera: mouse look, WASD/ZQSD or arrows, E/Space up, Q/C/Ctrl down, Shift boost. Solid buildings, ground and bounded neighbourhood; no gravity so the visitor can rise above rooftops. Six viewpoints, an optional cinematic tour, sound toggle, help and quality controls. Respect reduced motion by not starting a camera tour automatically.

Implementation order:
1. Test deterministic city layout, street clearance, collision sliding and taxi routes; implement world generation and camera physics.
2. Implement native WebGPU instanced geometry, procedural materials, dusk sky, directional shadows and bloom; retain a single self-contained HTML build.
3. Add an accessible start/help UI, keyboard and touch controls, synthesized city ambience, quality levels and readable development build.
4. Run unit tests and build; exercise the actual compiled HTML in a headless browser, inspect screenshots, test navigation and errors; publish the completed fork when existing GitHub authorization permits.

Verification focus: blocked GPU, shader compilation errors, spawn inside geometry, diagonal tunnelling, stuck movement after losing focus, pointer-lock failure, resized canvas, taxi motion and no external runtime requests.
