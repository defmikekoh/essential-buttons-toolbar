const assert = require('node:assert/strict')
const test = require('node:test')
const toolbarGeometry = require('../scripts/toolbarGeometry')

const visualViewport = {
    width: 360,
    height: 640,
    offsetLeft: 240,
    offsetTop: 80
}

test('anchors a right toolbar inside an offset visual viewport', () => {
    assert.deepEqual(
        toolbarGeometry.calculateRect({
            viewport: visualViewport,
            position: 'right',
            thickness: 42,
            lengthPercent: 50,
            positionPercent: 25,
            edgeGap: 12
        }),
        {
            width: 42,
            height: 320,
            left: 546,
            top: 160
        }
    )
})

test('anchors a left toolbar with the requested inward gap', () => {
    assert.deepEqual(
        toolbarGeometry.calculateRect({
            viewport: visualViewport,
            position: 'left',
            thickness: 42,
            lengthPercent: 50,
            positionPercent: 25,
            edgeGap: 12
        }),
        {
            width: 42,
            height: 320,
            left: 252,
            top: 160
        }
    )
})

test('positions horizontal toolbars by visual viewport percentage', () => {
    const commonOptions = {
        viewport: visualViewport,
        thickness: 42,
        lengthPercent: 80,
        positionPercent: 25,
        edgeGap: 12
    }

    assert.deepEqual(
        toolbarGeometry.calculateRect({
            ...commonOptions,
            position: 'top'
        }),
        {
            width: 288,
            height: 42,
            left: 258,
            top: 92
        }
    )
    assert.deepEqual(
        toolbarGeometry.calculateRect({
            ...commonOptions,
            position: 'bottom'
        }),
        {
            width: 288,
            height: 42,
            left: 258,
            top: 666
        }
    )
})

test('moving the toolbar uses explicit opposite-side state', () => {
    assert.equal(toolbarGeometry.getOppositePosition('top'), 'bottom')
    assert.equal(toolbarGeometry.getOppositePosition('bottom'), 'top')
    assert.equal(toolbarGeometry.getOppositePosition('left'), 'right')
    assert.equal(toolbarGeometry.getOppositePosition('right'), 'left')
})

test('defaults invalid settings and keeps oversized toolbars visible', () => {
    assert.deepEqual(
        toolbarGeometry.calculateRect({
            viewport: {
                width: 30,
                height: 20,
                offsetLeft: 5,
                offsetTop: 10
            },
            position: 'invalid',
            thickness: 42,
            lengthPercent: undefined,
            positionPercent: undefined,
            edgeGap: 100
        }),
        {
            width: 30,
            height: 20,
            left: 5,
            top: 10
        }
    )
})
