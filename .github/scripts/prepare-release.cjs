const fs = require('node:fs')
const { execFileSync } = require('node:child_process')
const TAG_PREFIX = 'refs/tags/firefox-build/'

function parseVersion(version) {
    if (typeof version !== 'string' || !/^(0|[1-9][0-9]{0,8})(\.(0|[1-9][0-9]{0,8})){3}$/.test(version) || version.trim() !== version) {
        throw new Error(`Invalid four-part Firefox version: ${version}`)
    }
    return version.split('.').map(Number)
}

function compare(a, b) {
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return a[i] - b[i]
    }
    return 0
}

function nextReleaseVersion(current, reservedVersions) {
    const source = parseVersion(current)
    let revision = source[3]
    for (const version of reservedVersions) {
        const reserved = parseVersion(version)
        const baseOrder = compare(reserved.slice(0, 3), source.slice(0, 3))
        if (baseOrder > 0) throw new Error('A newer upstream base has already been reserved; run the workflow from current fork/main')
        if (baseOrder === 0) revision = Math.max(revision, reserved[3])
    }
    const next = [...source.slice(0, 3), revision + 1].join('.')
    parseVersion(next)
    return next
}

function reserveVersion(current, repo, sha, gh) {
    const refs = gh(['api', '--paginate', `repos/${repo}/git/matching-refs/tags/firefox-build/`, '--jq', '.[].ref'])
        .trim().split('\n').filter(Boolean)
    const versions = refs.map(ref => {
        if (!ref.startsWith(TAG_PREFIX)) throw new Error(`Unexpected reservation ref: ${ref}`)
        return ref.slice(TAG_PREFIX.length)
    })
    const version = nextReleaseVersion(current, versions)
    // Persist before submission: a timeout or failed publish must never reuse
    // an AMO version. Creating an existing tag fails rather than overwriting it.
    gh(['api', '--method', 'POST', `repos/${repo}/git/refs`,
        '-f', `ref=${TAG_PREFIX}${version}`, '-f', `sha=${sha}`])
    return version
}

if (require.main === module) {
    const file = process.argv[2]
    const { GITHUB_REPOSITORY: repo, GITHUB_SHA: sha, GITHUB_ENV: envFile, GITHUB_OUTPUT: outputFile } = process.env
    if (!file || !repo || !sha || !envFile || !outputFile) throw new Error('Staged manifest path and GitHub Actions environment are required')
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!manifest.browser_specific_settings?.gecko?.id) throw new Error('The fork Gecko ID is required for signing')
    manifest.version = reserveVersion(manifest.version, repo, sha, args =>
        execFileSync('gh', args, { encoding: 'utf8' }))
    fs.writeFileSync(file, JSON.stringify(manifest, null, 4) + '\n')
    fs.appendFileSync(envFile, `RELEASE_VERSION=${manifest.version}\n`)
    fs.appendFileSync(outputFile, `version=${manifest.version}\n`)
    console.log(`Reserved Firefox version ${manifest.version}`)
}

module.exports = { nextReleaseVersion, reserveVersion }
