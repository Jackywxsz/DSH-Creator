# Last-mile Release Control Plane

Use this checklist for any release with more than one public distribution surface. Replace project-specific commands and names, but preserve the ordering and evidence rules.

## 1. Freeze facts before writes

Record the candidate commit, live target-branch commit, version, package name, tag, artifact filename, registry, release repository, marketplace repository, and required CI checks. Fetch or query the live remote; a local `origin/main` ref is not proof of remote state.

Discover version surfaces with a repository-wide search. A fixed allowlist of README and package files is insufficient: implementation notes, examples, tests, generated metadata, marketplace manifests, and fallback download commands may also pin a version.

## 2. Preflight capabilities

Prove each capability needed by the next write:

- GitHub identity, repository permissions, branch protection, and CI requirements.
- Registry identity, package maintainer rights, publish policy, and required 2FA or automation token mode.
- Git push transport. OAuth credentials that can push normal files may still be forbidden to create or update workflow files; use a credential with the required scope or an already-authorized SSH transport.
- Marketplace topology. Verify upstream default branch, fork parent, fork freshness, target file path, and whether the account can push upstream or must open a fork PR.
- Artifact path. Resolve it, verify it exists, and hash it. Never execute an example path such as `/path/to/package.tgz`.

Browser login and passkeys do not imply that a CLI publish command has an OTP. Never ask the user to paste passwords, OTPs, recovery codes, or tokens into chat. If interactive authentication is unavoidable, ask the user to perform only that step, then continue the remaining verification automatically.

## 3. Source and artifact gates

1. Require a clean candidate tree and review the full release diff.
2. Run the project's type checks, tests, build, package-policy gate, and adversarial release review.
3. Create one final immutable artifact after all source and version changes.
4. Inspect its file list, entry points, executable/runtime assets, user documentation, metadata, and forbidden content.
5. Install that artifact into a clean, disposable profile or environment. Exercise installation, startup, the primary user path, upgrade, uninstall, and data-retention behavior as applicable.
6. Create an annotated or signed tag for the frozen commit. Verify the remote tag object type and target SHA before creating the Release.

Do not rebuild separately for different channels. Upload and publish the same artifact to every channel.

## 4. Publish with immediate readback

After each write, read the public system of record before continuing:

1. Push branch/commit; read the live branch SHA and CI.
2. Push tag; verify tag type and target.
3. Create Release; read title, notes, prerelease state, target, asset name, size, and digest.
4. Publish registry package; read version, dist-tags, repository, file count, integrity, and tarball URL.
5. Download Release and registry artifacts independently and compare cryptographic digests and bytes.
6. Open the marketplace change from the live upstream base. Require a minimal diff, successful checks, mergeability, merge, and final live-entry readback. “PR opened” is not “marketplace updated.”
7. Open every documented install URL and run the canonical install command where the runtime is available.

## 5. Failure routing

| Symptom | Likely cause | Required response |
| --- | --- | --- |
| `ENOENT` for a tarball | Example/incorrect path or artifact not built | Resolve the actual artifact path and verify it exists before retrying. |
| npm cache `EPERM` | Cache contains files owned by another user | Use an isolated temporary cache for the release; repair the global cache separately with explicit authorization. |
| Registry `E401`/`E403` | CLI identity or maintainer permission missing | Re-check CLI identity and package access; do not infer it from browser login. |
| Registry `EOTP` | Publish requires a compatible second factor | Use the account's supported interactive publish flow, granular automation token, or trusted publishing; never collect the secret in chat. |
| Upstream write returns `404`/permission error | No upstream push access or wrong repository | Query repository permissions and switch to a fork PR when required. |
| PR reports “no commits” | Fork/base is stale or the target file/path was absent | Fetch live upstream, create a fresh branch from its default branch, then apply the minimal change. |
| Push rejects workflow changes | OAuth credential lacks workflow permission | Use an appropriately scoped credential or authorized SSH transport; do not weaken or delete workflows. |
| Release CLI cannot find the tag/repository | CLI inferred the wrong repository | Pass the repository explicitly and re-read the resulting public URL. |

After any failure, return to the relevant preflight gate. Do not repeat the same command unchanged.

## 6. Final strong-acceptance ledger

The final report must include evidence and one state for each applicable row:

- source commit and protected-branch CI;
- version consistency across package, lockfile, docs, examples, tests, and changelog;
- annotated/signed tag and target SHA;
- Release notes and immutable asset digest;
- registry version, dist-tag, integrity, and byte identity with the Release asset;
- canonical install command and clean-runtime smoke result;
- marketplace diff, CI, merge state, and live entry;
- known gaps, owner, next action, and rollback path.

Allowed states are `done`, `not applicable`, and `blocked`. `Submitted`, `opened`, `uploaded`, `logged in`, and `command exited` are evidence events, not completion states.
