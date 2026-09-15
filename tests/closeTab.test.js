const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const source = fs.readFileSync(require.resolve('../scripts/background.js'), 'utf8')
const flush = () => new Promise(setImmediate)

function deferred() {
    let resolve, reject
    const promise = new Promise((yes, no) => { resolve = yes; reject = no })
    return { promise, resolve, reject }
}

function harness({ write, read, removeTab } = {}) {
    let listener
    const removed = [], created = [], writes = [], warnings = []
    const timers = new Map()
    const disk = {}
    const event = { addListener() {} }
    const browser = {
        runtime: { getURL: p => p, onInstalled: event, onMessage: { addListener(fn) { listener = fn } } },
        browserAction: { onClicked: event },
        tabs: {
            onActivated: event,
            async remove(id) { if (removeTab) await removeTab(id); removed.push(id) },
            async create({ url }) { created.push(url) },
            query(options, callback) { callback([{ id: 1, url: 'a' }, { id: 2, url: 'b' }]) }
        },
        storage: { local: {
            async get(key) { return key === 'isDesktopSite' ? {} : read ? read() : { ...disk } },
            async set(value) {
                writes.push(value.lastClosedTabURL)
                if (write) await write(value)
                Object.assign(disk, value)
            },
            async remove(key) { writes.push(null); delete disk[key] }
        } }
    }
    vm.runInNewContext(source, {
        browser,
        setTimeout(fn, ms) { const id = {}; timers.set(id, { fn, ms }); return id },
        clearTimeout(id) { timers.delete(id) },
        console: { warn(...args) { warnings.push(args) }, error(...args) { warnings.push(args) } }
    })
    function send(action, tab = { id: 1, url: 'a' }) {
        const responses = []
        listener({ action, url: 'home' }, { tab }, response => responses.push(response))
        return responses
    }
    function expireStorageWaits() {
        for (const [id, timer] of timers) {
            if (timer.ms === 100) { timers.delete(id); timer.fn() }
        }
    }
    return { send, expireStorageWaits, removed, created, writes, disk, warnings, timers }
}

test('normal close persists Undo before removal without waiting for a timer', async () => {
    const h = harness()
    const responses = h.send('closeTab')
    await flush()
    assert.deepEqual(h.removed, [1])
    assert.equal(h.disk.lastClosedTabURL, 'a')
    assert.equal(responses[0].ok, true)
    assert.equal(h.timers.size, 0)
})

test('failed storage does not block Close and Undo uses the in-memory URL', async () => {
    const h = harness({ write: () => Promise.reject(new Error('storage failed')) })
    h.send('closeTab')
    await flush()
    assert.deepEqual(h.removed, [1])
    assert.equal(h.warnings.length, 1)
    h.send('undoCloseTab')
    await flush()
    assert.deepEqual(h.created, ['a'])
})

test('stalled storage has a bounded wait; later writes and Undo remain ordered', async () => {
    const pending = deferred()
    const h = harness({ write: () => pending.promise })
    h.send('closeTab')
    await flush()
    assert.deepEqual(h.removed, [])
    h.expireStorageWaits()
    await flush()
    h.send('closeTab', { id: 2, url: 'b' })
    h.expireStorageWaits()
    await flush()
    assert.deepEqual(h.removed, [1, 2])
    h.send('undoCloseTab')
    h.send('undoCloseTab')
    await flush()
    assert.deepEqual(h.created, ['b'], 'Undo consumes only the latest history once')
    assert.deepEqual(h.writes, ['a'], 'do not start overlapping storage writes')
    pending.resolve()
    await flush()
    assert.deepEqual(h.writes, ['a', 'b', null])
    assert.equal(h.disk.lastClosedTabURL, undefined, 'late writes cannot resurrect undone history')
})

test('a rejected late write does not poison subsequent history writes', async () => {
    const pending = deferred()
    let first = true
    const h = harness({ write: () => { if (first) { first = false; return pending.promise } } })
    h.send('closeTab')
    await flush()
    h.expireStorageWaits()
    h.send('closeTab', { id: 2, url: 'b' })
    pending.reject(new Error('late failure'))
    await flush()
    assert.equal(h.disk.lastClosedTabURL, 'b')
    assert.deepEqual(h.removed, [1, 2])
})

test('Undo loads persisted history after background startup', async () => {
    const h = harness({ read: async () => ({ lastClosedTabURL: ['a', 'b'] }) })
    h.send('undoCloseTab')
    await flush()
    assert.deepEqual(h.created, ['a', 'b'])
})

test('an initial Undo read cannot replace a newer close with stale history', async () => {
    const pending = deferred()
    const h = harness({ read: () => pending.promise })
    h.send('undoCloseTab')
    await flush()
    h.send('closeTab', { id: 2, url: 'b' })
    await flush()
    pending.resolve({ lastClosedTabURL: 'old' })
    await flush()
    assert.deepEqual(h.created, ['b'])
})

for (const action of ['closeAllTabs', 'closeOtherTabs']) {
    test(`${action} also proceeds when storage stalls`, async () => {
        const h = harness({ write: () => new Promise(() => {}) })
        h.send(action)
        await flush()
        h.expireStorageWaits()
        await flush()
        assert.deepEqual(Array.from(h.removed[0]), action === 'closeAllTabs' ? [1, 2] : [2])
    })
}

test('Close needs a valid tab ID, but not a URL', async () => {
    const h = harness()
    h.send('closeTab', { id: 0 })
    const responses = h.send('closeTab', {})
    await flush()
    assert.deepEqual(h.removed, [0])
    assert.equal(responses[0].ok, false)
})

test('tab removal errors are still reported', async () => {
    const h = harness({ removeTab: async () => { throw new Error('removal failed') } })
    const responses = h.send('closeTab')
    await flush()
    assert.equal(responses[0].ok, false)
    assert.match(responses[0].error, /removal failed/)
})
