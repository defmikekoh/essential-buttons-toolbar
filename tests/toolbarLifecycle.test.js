const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const source = fs.readFileSync(require.resolve('../scripts/content.js'), 'utf8')

function harness() {
    const elements = []
    const listeners = {}
    const observers = []
    const settings = { defaultPosition: 'right', toolbarWidth: 50, toolbarHeight: 42 }
    const document = {
        hidden: false,
        documentElement: { clientWidth: 360, clientHeight: 640 },
        addEventListener(name, fn) { listeners[name] = fn },
        getElementById(id) { return elements.find(el => el.id === id && el.isConnected) },
        createElement() {
            const values = {}
            const el = {
                isConnected: false, events: {},
                setAttribute(name, value) { this[name] = value },
                addEventListener(name, fn) { this.events[name] = fn },
                appendChild() {},
                remove() { this.isConnected = false; this.parentElement = null }
            }
            Object.defineProperty(el, 'style', {
                get: () => ({ setProperty: (k, v) => { values[k] = v }, ...values }),
                set() {}
            })
            elements.push(el)
            return el
        }
    }
    document.body = { insertAdjacentElement(position, el) {
        el.isConnected = true
        el.parentElement = position === 'afterend' ? document.documentElement : document.body
    } }
    const vv = { width: 360, height: 640, scale: 1, addEventListener() {}, removeEventListener() {} }
    const window = {
        location: { href: 'https://example.com/' }, visualViewport: vv,
        innerWidth: 360, innerHeight: 640,
        addEventListener(name, fn) { listeners[name] = fn },
        removeEventListener() {},
        matchMedia: () => ({ addEventListener() {}, removeEventListener() {} })
    }
    const context = vm.createContext({
        window, document, console,
        ToolbarGeometry: require('../scripts/toolbarGeometry'),
        MutationObserver: class {
            constructor(fn) { this.fn = fn; observers.push(this) }
            observe() { this.active = true }
            disconnect() { this.active = false }
        },
        browser: {
            extension: {}, storage: { sync: { get: async () => settings } },
            runtime: { getURL: s => s, onMessage: { addListener() {} } }
        }
    })
    vm.runInContext(source.replace(/initializeToolbar\(\)\s*$/, ''), context)
    return { context, document, window, vv, elements, listeners, observers, settings,
        run: code => vm.runInContext(code, context) }
}

test('sizes before iframe load and repairs removal without resetting chosen position', async () => {
    const h = harness()
    await h.run('initializeToolbar()')
    const first = h.document.getElementById('essBtnsToolbar')
    assert.equal(first.style.width, '42px')
    assert.equal(first.style.height, '320px')
    h.run("currentPosition = 'left'")
    first.remove()
    h.observers.find(o => o.active).fn()
    const replacement = h.document.getElementById('essBtnsToolbar')
    assert.notEqual(replacement, first)
    assert.equal(replacement.style.left, '0px')
    // A late event from a removed iframe must not touch the new document.
    first.events.load()
    h.listeners.pageshow()
    h.listeners.visibilitychange()
    assert.equal(h.elements.filter(e => e.isConnected).length, 1)
})

test('zero viewport sizes retain usable dimensions', async () => {
    const h = harness()
    await h.run('initializeToolbar()')
    h.vv.height = 0
    h.listeners.pageshow()
    assert.equal(h.document.getElementById('essBtnsToolbar').style.height, '320px')
    h.window.innerHeight = 0
    h.document.documentElement.clientHeight = 0
    h.listeners.pageshow()
    assert.equal(h.document.getElementById('essBtnsToolbar').style.height, '320px')
})

test('recovery preserves hidden mode and excluded pages', async () => {
    const h = harness()
    h.run('iframeHidden = true')
    await h.run('initializeToolbar()')
    h.document.getElementById('essUnhideIcon').remove()
    h.listeners.pageshow()
    assert.ok(h.document.getElementById('essUnhideIcon'))
    assert.equal(h.document.getElementById('essBtnsToolbar'), undefined)
    h.settings.excludedUrls = ['https://example.com/*']
    await h.run('initializeToolbar()')
    h.listeners.pageshow()
    assert.equal(h.elements.filter(e => e.isConnected).length, 0)
})

test('overlapping settings reads cannot restore stale configuration', async () => {
    const h = harness()
    h.context.pending = []
    h.run('browser.storage.sync.get = () => new Promise(resolve => pending.push(resolve))')
    const first = h.run('initializeToolbar()')
    const second = h.run('initializeToolbar()')
    h.context.pending[1]({ defaultPosition: 'left' })
    await second
    h.context.pending[0]({ defaultPosition: 'right' })
    await first
    assert.equal(h.run('currentPosition'), 'left')
    assert.equal(h.elements.filter(e => e.isConnected).length, 1)
})
