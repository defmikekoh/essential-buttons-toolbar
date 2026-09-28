# Signed Firefox prereleases

The `Sign Firefox XPI prerelease` GitHub Actions workflow is manual and runs only
on `fork/main`. It runs Node tests, builds and validates the package, submits it
to Mozilla for unlisted signing, and publishes the signed XPI to the rolling
`firefox-test-latest` GitHub prerelease. It does not publish an AMO store listing.

## One-time setup

1. Commit and push the workflow and its helper/tests to `fork/main`.
2. Make `fork/main` the repository's default branch in GitHub Settings → General.
   GitHub requires a manually dispatched workflow to exist on the default branch;
   this fork currently uses `main` as its GitHub default. Alternatively, keep an
   identical workflow on `main` and select `fork/main` when running it.
3. Enable Actions if GitHub has disabled them for the fork.
4. Add repository Actions secrets `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` using
   [Mozilla API credentials](https://addons.mozilla.org/developers/addon/api/key/).
   Use the account that owns the fork add-on ID. Secrets in AFFO do not automatically
   become available to Essential, and GitHub cannot reveal their stored values.

## Make a release

1. Commit and push your changes to `fork/main`.
2. In Actions, select **Sign Firefox XPI prerelease** → **Run workflow** and
   select `fork/main`. There is no version input. CLI equivalent:

   ```sh
   gh workflow run xpi-prerelease.yml --repo defmikekoh/essential-buttons-toolbar --ref fork/main
   ```

3. Download the versioned `.xpi` from the workflow summary or the
   [Firefox test prerelease](https://github.com/defmikekoh/essential-buttons-toolbar/releases/tag/firefox-test-latest).
   The five newest signed XPI release assets remain available.

The workflow automatically increments the fourth component, starting after the
source manifest and all previously reserved builds: `1.9.5.8` → `1.9.5.9` →
`1.9.5.10`. Only the staged manifest changes; no version-bump commit is needed.

Before signing, it creates a `firefox-build/<version>` reservation tag pointing to
the source commit. These tags record used version numbers even if signing times
out or publishing fails. After creating the new tag, it retains only the five highest version tags.
The highest reservation is always retained, so failed attempts cannot cause reuse.
Do not manually delete the retained tags. A rerun reads them and reserves a fresh version. Failed attempts may leave gaps.
The workflow serializes release jobs; a conflicting tag creation aborts signing.

The signed XPI is also retained as a 30-day Actions artifact before publishing to
Releases. If publishing fails, you can recover that artifact or rerun the job to
sign a newer version automatically. No push-triggered release is configured.

If versions were submitted to AMO outside this workflow, set the source manifest
at least as high as the largest submitted version once before using automation.
See [versioning](VERSIONING.md) for handling a new upstream base.

`npm run build` remains a local unsigned build for temporary developer installs
and automated tests. Normal Firefox distribution needs the Mozilla-signed XPI.
The rolling GitHub download does not configure automatic add-on updates; those
would require a separate self-hosted update manifest or store distribution.

References: [manual workflow requirements](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch),
[Mozilla signing command](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign).
