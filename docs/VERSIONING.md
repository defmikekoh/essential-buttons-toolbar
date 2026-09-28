# Fork versioning

Use `UPSTREAM_MAJOR.UPSTREAM_MINOR.UPSTREAM_PATCH.FORK_REVISION` in `manifest.json`.
For example, `1.9.5.8` means fork revision 8 based on upstream 1.9.5. Keep this
numeric format: Firefox supports one to four numeric components, and AMO does
not accept SemVer suffixes such as `-fork.8` or `+build.8` in the manifest version.

- The signing workflow increments the fourth component automatically using the
  source version and `firefox-build/<version>` reservation tags (only the highest five are retained).
  Starting from `1.9.5.8`, the first generated version is `1.9.5.9`. No input or
  version-bump commit is required for each release; failed attempts can leave gaps.
- Change the first three components only after actually incorporating that upstream
  release. For example, after merging upstream 1.9.6, set the source to
  `1.9.6.0`; automation begins with `1.9.6.1`. Old-base reruns are rejected.
- Keep every distributed version greater than the preceding version for this add-on
  ID. Do not reset a fourth component while retaining the same first three.
- Keep the fork's existing Gecko ID. Changing it creates a different add-on rather
  than updating the installed fork.
- Use release titles to describe the fork, for example “Essential fork 1.9.5.9”.
  Four-part extension versions are not strict Semantic Versioning; that is fine.
- The source `manifest.json` provides the upstream base and minimum fork revision.
  The staged manifest and version tag identify each distributed build. The private
  `package.json` version is tooling metadata, not the distributed add-on version.

There is no universal fork-versioning standard. Independent three-part versions
are also reasonable for a substantially diverged project, with upstream ancestry
recorded separately. Keeping the upstream prefix is useful for this small fork.

Upstream baseline: [1.9.5, commit 62fa6e8](https://github.com/KristhianX/essential-buttons-toolbar/commit/62fa6e8761506ef51e9b1d6fda84e3fc21fc94d3).
Version rules: [Mozilla manifest version documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/version).
