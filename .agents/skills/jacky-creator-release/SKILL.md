---
name: jacky-creator-release
description: "Run and strongly accept Jacky Creator's branch-to-release workflow: verify feature branches, merge approved changes, synchronize every version surface, build one immutable artifact, publish GitHub/npm/marketplace surfaces, and prove the installed result. Use when preparing or finishing a release, recovering a failed publication, checking whether a release is really live, or applying reusable last-mile release controls to another project."
---

# Jacky Creator Release

## Completion Contract

A release is complete only when every applicable surface is recorded as `done`, `not applicable`, or `blocked with owner and next action`. A successful source push, GitHub Release, npm publish, or marketplace PR alone is not a completed release.

Before any public publish, marketplace update, or recovery from a failed release command, read [references/last-mile-release.md](references/last-mile-release.md). Apply its generic control plane first, then the project mapping below.

## Workflow

1. Freeze the candidate. On the feature branch, run `git status --short --branch -uall`, fetch the live target remote, inspect the diff from the latest release tag, and run `pnpm check`. Never infer remote state only from a cached tracking ref.
2. Run `pnpm release:check` before merging and stop on any failure. Preserve unrelated worktree changes; never reset or stash user files without authorization.
3. Merge the approved branch into `main` only after re-reading the candidate SHA, target SHA, worktree status, and CI. Resolve conflicts explicitly and rerun all gates after the merge.
4. Choose the lane and version. Beta releases use the next `0.1.0-beta.N`; stable releases require the documented cross-platform evidence. Search the whole repository for stale versioned URLs and update every current user-facing surface, including `package.json`, `README.md`, `docs/installation.md`, `docs/distribution.md`, implementation/status docs, tests, and `CHANGELOG.md`.
5. Build once with `pnpm check`, run `pnpm release:check`, and create the final tarball from that verified tree. Inspect `npm pack --dry-run --ignore-scripts --json`; verify runtime files, user docs, Hero assets, and absence of credentials, caches, private paths, or internal-only files.
6. Preflight identities, permissions, transports, exact artifact paths, and destination state before the first public write. Use real resolved paths, never documentation placeholders. For fork-based marketplace work, branch from the live upstream default branch and verify that the chosen Git transport can update workflow-bearing history.
7. Commit only intended files and push `main`. Create an annotated or signed version tag, then the matching GitHub prerelease and Release asset. Publish the exact same tarball to npm. Update `awesome-dsh-plugin/data/plugins/Jackywxsz__DSH-Creator.yml` with the exact Release tarball URL.
8. Strongly accept the release by re-reading live GitHub branch/tag/Release data, CI, npm metadata and integrity, marketplace PR diff/checks/merge state/live entry, documentation links, and a clean-profile install/restart/upgrade/uninstall smoke test. Compare the downloaded GitHub and npm tarballs byte-for-byte.
9. Report a final ledger for source, tag, Release notes, Release asset, npm, README/docs, marketplace PR, marketplace live entry, CI, and installed runtime. Do not say “发布完成” while any required row is merely submitted, waiting, or unverified.

## Release Invariants

- GitHub tag, Release asset, npm version, README links, installation docs, distribution docs, and marketplace tarball must all name the same version.
- The version tag must resolve to an annotated or signed tag object, not a lightweight commit ref.
- Build the published archive from the verified tree. Include prebuilt Host, Client, Typert, Bundle Patch, user documentation, and Hero assets.
- GitHub Release and npm must distribute the same bytes and therefore the same cryptographic digest.
- Never publish a dirty tree, floating source install, stable artifact from beta evidence, or a package containing local paths, credentials, caches, screenshots, or user content.
- Web login, passkey enrollment, CLI login, OTP, registry publish permission, and Git push permission are separate capabilities. Prove the capability required by the next command without exposing credentials.
- Public publishing is irreversible. Require explicit authorization for push, tag, GitHub Release, npm publish, and marketplace updates.
