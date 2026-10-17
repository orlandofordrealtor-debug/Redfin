# Motion Studio

A Three.js motion graphics studio for team and social video, built on four reference looks:
Premium Clay, Holographic Globe, Glass Explainer and Glass Studio.

## Status

**Phase 0: Intake.** `brief.html` is the interactive production brief. It is published as a private
artifact: https://claude.ai/artifact/B2SDPxnCCfCq7GbKj5THng

Answers save to the artifact's database (`brief/answers`), and uploads are recorded in `media`,
so Claude can read the finished brief directly.

## Standards locked into every template

- Three.js + custom shaders
- Professional, sleek, showreel-grade finish
- 3D camera moves + moving elements
- Deterministic rendering: every animation driven by a time value `t`, rendered frame by frame to MP4 (Playwright + ffmpeg)
- Verification loop: still frames from every scene are checked before the full render
