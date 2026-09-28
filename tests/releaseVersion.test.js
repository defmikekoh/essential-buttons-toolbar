const assert = require('node:assert/strict')
const test = require('node:test')
const { nextReleaseVersion, reserveVersion } = require('../.github/scripts/prepare-release.cjs')

test('starts after source version and increments numerically across reserved builds', () => {
    assert.equal(nextReleaseVersion('1.9.5.8', []), '1.9.5.9')
    assert.equal(nextReleaseVersion('1.9.5.8', ['1.9.5.9', '1.9.5.10']), '1.9.5.11')
    assert.equal(nextReleaseVersion('1.9.5.20', ['1.9.5.10']), '1.9.5.21')
    assert.equal(nextReleaseVersion('1.9.6.0', ['1.9.5.99']), '1.9.6.1')
})

test('refuses older upstream bases, invalid versions and exhausted components', () => {
    assert.throws(() => nextReleaseVersion('1.9.5.8', ['1.10.0.1']), /newer upstream/)
    assert.throws(() => nextReleaseVersion('1.9.5.999999999', []), /Invalid/)
    for (const version of ['1.9.5', '1.9.5-fork.9', '1.9.5.09', '../x', '1.9.5.9\n']) {
        assert.throws(() => nextReleaseVersion(version, []), /Invalid/)
        assert.throws(() => nextReleaseVersion('1.9.5.8', [version]), /Invalid/)
    }
})

test('reserves before signing, so reruns advance even without a published release', () => {
    const refs = []
    const gh = args => {
        if (!args.includes('POST')) return refs.join('\n')
        const ref = args.find(arg => arg.startsWith('ref=')).slice(4)
        assert.ok(!refs.includes(ref))
        assert.ok(args.includes('sha=commit'))
        refs.push(ref)
        return '{}'
    }
    assert.equal(reserveVersion('1.9.5.8', 'owner/repo', 'commit', gh), '1.9.5.9')
    assert.equal(reserveVersion('1.9.5.8', 'owner/repo', 'commit', gh), '1.9.5.10')
})

test('API failures or reservation conflicts abort instead of issuing a version', () => {
    assert.throws(() => reserveVersion('1.9.5.8', 'owner/repo', 'commit', () => {
        throw new Error('network failure')
    }), /network failure/)
    assert.throws(() => reserveVersion('1.9.5.8', 'owner/repo', 'commit', args => {
        if (args.includes('POST')) throw new Error('tag already exists')
        return ''
    }), /tag already exists/)
})
