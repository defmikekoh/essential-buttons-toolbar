const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')

const source = fs.readFileSync(require.resolve('../scripts/content.js'), 'utf8')

test('browser actions dispatch before feedback timers run, including repeated clicks', async () => {
    const messages = []
    const timers = new Map()
    let timerId = 0
    const context = vm.createContext({
        window: { location: { href: 'https://example.com/' }, stop() {} },
        browser: {
            extension: {},
            runtime: {
                onMessage: { addListener() {} },
                sendMessage(message) {
                    messages.push(message)
                    return Promise.resolve({ ok: true })
                }
            }
        },
        setTimeout(fn) { timers.set(++timerId, fn); return timerId },
        clearTimeout(id) { timers.delete(id) },
        console
    })
    // Exercise the real handlers without initializing an iframe in Node.
    vm.runInContext(source.replace(/initializeToolbar\(\)\s*$/, ''), context)
    const buttons = vm.runInContext('buttonElements', context)
    const actions = {
        homeButton: 'updateTab', duplicateTabButton: 'duplicateTab',
        closeTabButton: 'closeTab', newTabButton: 'createTab',
        goBackButton: 'goBack', goForwardButton: 'goForward',
        reloadButton: 'reload', settingsButton: 'openSettings',
        undoCloseTabButton: 'undoCloseTab', closeAllTabsButton: 'closeAllTabs',
        closeOtherTabsButton: 'closeOtherTabs', openWithButton: 'updateTab'
    }
    for (const [name, action] of Object.entries(actions)) {
        const classes = new Set()
        const button = { classList: { add: c => classes.add(c), remove: c => classes.delete(c) } }
        for (let click = 0; click < 2; click++) {
            const before = messages.length
            const result = buttons[name].behavior.call(button, { preventDefault() {} })
            assert.equal(messages.length, before + 1, name)
            assert.equal(messages.at(-1).action, action, name)
            assert.ok(classes.has('pressed'), name)
            await result
        }
        assert.equal(timers.size, 1, 'a repeated click renews feedback')
        for (const fn of timers.values()) fn()
        timers.clear()
        assert.ok(!classes.has('pressed'))
    }
})
