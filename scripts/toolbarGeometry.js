;(function (root) {
    const validPositions = new Set(['top', 'bottom', 'left', 'right'])

    function clamp(value, minimum, maximum, fallback) {
        const number = Number(value)
        return Math.max(
            minimum,
            Math.min(maximum, Number.isFinite(number) ? number : fallback)
        )
    }

    function normalizePosition(position) {
        return validPositions.has(position) ? position : 'bottom'
    }

    function getOppositePosition(position) {
        const oppositePositions = {
            top: 'bottom',
            bottom: 'top',
            left: 'right',
            right: 'left'
        }
        return oppositePositions[normalizePosition(position)]
    }

    function isHorizontalPosition(position) {
        const normalizedPosition = normalizePosition(position)
        return (
            normalizedPosition === 'top' ||
            normalizedPosition === 'bottom'
        )
    }

    function calculateRect({
        viewport,
        position,
        thickness,
        lengthPercent,
        positionPercent,
        edgeGap
    }) {
        const normalizedPosition = normalizePosition(position)
        const requestedWidth = Number(viewport.width)
        const requestedHeight = Number(viewport.height)
        const requestedOffsetLeft = Number(viewport.offsetLeft)
        const requestedOffsetTop = Number(viewport.offsetTop)
        const requestedThickness = Number(thickness)
        const width =
            Number.isFinite(requestedWidth) && requestedWidth > 0
                ? requestedWidth
                : 0
        const height =
            Number.isFinite(requestedHeight) && requestedHeight > 0
                ? requestedHeight
                : 0
        const offsetLeft = Number.isFinite(requestedOffsetLeft)
            ? requestedOffsetLeft
            : 0
        const offsetTop = Number.isFinite(requestedOffsetTop)
            ? requestedOffsetTop
            : 0
        const safeThickness =
            Number.isFinite(requestedThickness) && requestedThickness > 0
                ? requestedThickness
                : 0
        const safeLengthPercent = clamp(lengthPercent, 0, 100, 100)
        const safePositionPercent = clamp(positionPercent, 0, 100, 50)
        const requestedGap = Math.max(0, Number(edgeGap) || 0)

        if (isHorizontalPosition(normalizedPosition)) {
            const renderedThickness = Math.min(safeThickness, height)
            const toolbarWidth = Math.round(
                (safeLengthPercent / 100) * width
            )
            const left =
                offsetLeft +
                Math.round(
                    (safePositionPercent / 100) *
                        Math.max(0, width - toolbarWidth)
                )
            const gap = Math.min(
                requestedGap,
                Math.max(0, height - renderedThickness)
            )
            const top =
                normalizedPosition === 'top'
                    ? offsetTop + gap
                    : offsetTop + height - renderedThickness - gap

            return {
                width: toolbarWidth,
                height: renderedThickness,
                left: Math.round(left),
                top: Math.round(top)
            }
        }

        const renderedThickness = Math.min(safeThickness, width)
        const toolbarHeight = Math.round(
            (safeLengthPercent / 100) * height
        )
        const top =
            offsetTop +
            Math.round(
                (safePositionPercent / 100) *
                    Math.max(0, height - toolbarHeight)
            )
        const gap = Math.min(
            requestedGap,
            Math.max(0, width - renderedThickness)
        )
        const left =
            normalizedPosition === 'left'
                ? offsetLeft + gap
                : offsetLeft + width - renderedThickness - gap

        return {
            width: renderedThickness,
            height: toolbarHeight,
            left: Math.round(left),
            top: Math.round(top)
        }
    }

    const toolbarGeometry = Object.freeze({
        calculateRect,
        getOppositePosition,
        isHorizontalPosition,
        normalizePosition
    })

    root.ToolbarGeometry = toolbarGeometry
    if (typeof module === 'object' && module.exports) {
        module.exports = toolbarGeometry
    }
})(globalThis)
