# Harness 0.2.2-rc.3 compatibility

This release is based on beta.9 plus the public maintenance-channel documentation commit. It contains only the rc.3 compatibility update; unpublished feature work is excluded.

## Changes

- Pin the official DSH SDK and peer requirements to 0.2.2-rc.3, Cordis to 4.1.0, Schemastery to 3.19.0 and the development Cordis group plugin to 1.1.0. Regenerate the lockfile without inherited rc.2 peers.
- Require Node.js >=24.9.0, matching the upstream CLI.
- Explicitly type the layout snapshot selector with the public PanelInfo type.
- Adapt the compatibility regression test to the upstream engines.dsh precedence and requirements result field.
- Remove the unused, discontinued subagent-in-process-driver development dependency.

## Validation

The prebuilt beta.10 package was installed using the official rc.3 CLI without a version exemption. With explicit test library and state directories, the Web profile started successfully and an authenticated request returned HTTP 200. Uninstall removed the plugin dependency and preserved a fictional content file. This is a startup/install smoke test, not a browser-interaction or old-profile migration test.

The initial typecheck reproduced the layout selector type failure; the explicit PanelInfo annotation resolved it. Packaging and identity tests were updated for beta.10. Release-check subprocess fixtures use a 30-second timeout because repeated real Git/npm startup exceeded the previous 5-second limit; their assertions were retained.

Complete source checks and the clean-tree release gate must pass before publishing.

Not covered: Electron visual interaction, Windows, third-party desktop wrappers, real model calls, optional paid media extensions. Old Harness 0.2.0-rc.2 users should retain beta.9. Compatibility with arbitrary later versions is not claimed.
