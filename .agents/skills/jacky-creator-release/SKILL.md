---
name: jacky-creator-release
description: "Run Jacky Creator's branch-to-release workflow: verify feature branches, merge approved changes into main, synchronize version and release documentation, build and inspect the plugin tarball, publish GitHub Beta and npm artifacts, update the awesome-dsh-plugin marketplace entry, and re-read remote state. Use when testing a new feature for release, preparing a beta, merging a release candidate, or maintaining GitHub/npm/plugin-market distribution."
---

# Jacky Creator Release

## Workflow

1. Start on the feature branch. Run `git status --short --branch -uall`, inspect the diff from the latest release tag, and run `pnpm check`.
2. Before merging, run `pnpm release:check` and stop on any failure. Preserve unrelated worktree changes and never reset or stash user files.
3. Merge the approved branch into `main` only after re-reading `HEAD`, status, and the target remote SHA. Resolve conflicts explicitly and rerun all gates after the merge.
4. Choose the lane and version. Beta releases use the next `0.1.0-beta.N` version; stable releases require the project's documented cross-platform evidence. Update `package.json`, `README.md`, `docs/installation.md`, `docs/distribution.md`, and `CHANGELOG.md` together.
5. Build with `pnpm check`, then run `pnpm release:check`. Inspect `npm pack --dry-run --ignore-scripts --json` and verify runtime files, user docs, Hero assets, and absence of caches or private paths.
6. Commit only intended files, push `main`, create the matching GitHub prerelease and `.tgz`, publish the same package to npm, and update `awesome-dsh-plugin/data/plugins/Jackywxsz__DSH-Creator.yml` with the exact Release tarball URL.
7. Re-read GitHub branch, tag, Release assets/body, npm registry metadata and integrity, marketplace YAML, and required CI runs. Report each surface as done, not applicable, or blocked.

## Release Invariants

- GitHub tag, Release asset, npm version, README links, installation docs, distribution docs, and marketplace tarball must all name the same version.
- Build the published archive from the verified tree. Include prebuilt Host, Client, Typert, Bundle Patch, user documentation, and Hero assets.
- Never publish a dirty tree, floating source install, stable artifact from beta evidence, or a package containing local paths, credentials, caches, screenshots, or user content.
- Public publishing is irreversible. Require explicit authorization for push, tag, GitHub Release, npm publish, and marketplace updates.
