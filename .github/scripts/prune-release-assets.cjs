const { execFileSync } = require('node:child_process')

function obsoleteAssets(assets) {
    return assets.filter(asset => asset.name.endsWith('.xpi'))
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
        .slice(5)
}

function pruneAssets(repo, gh) {
    const release = JSON.parse(gh(['api', `repos/${repo}/releases/tags/firefox-test-latest`]))
    const pages = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${repo}/releases/${release.id}/assets?per_page=100`]))
    for (const asset of obsoleteAssets(pages.flat())) {
        gh(['api', '--method', 'DELETE', `repos/${repo}/releases/assets/${asset.id}`])
    }
}

if (require.main === module) {
    const repo = process.env.GITHUB_REPOSITORY
    if (!repo) throw new Error('GITHUB_REPOSITORY is required')
    pruneAssets(repo, args => execFileSync('gh', args, { encoding: 'utf8' }))
}

module.exports = { obsoleteAssets, pruneAssets }
