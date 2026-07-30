//
// Variables
//
let currentUrl = window.location.href
let iframeVisible = true
let menuDivHidden = true
let iframeHidden
let unhideIcon
let dragging
let toolbarIframe
let iframeDocument
let toolbarDiv
let menuDiv
let toolbarButtons
let menuButtonFlag
let hideMethodInUse
let isThrottled
let prevScrollPos
let currentPosition
let viewportUpdateFrame = null
const settings = {}
const toolbarGeometry = globalThis.ToolbarGeometry
const isPrivate = browser.extension.inIncognitoContext
const buttonsToDisable = [
    'duplicateTabButton',
    'newTabButton',
    'settingsButton',
    'undoCloseTabButton',
    'closeAllTabsButton',
    'closeOtherTabsButton'
]

function getViewportMetrics() {
    const vv = window.visualViewport
    if (!vv) {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            scale: 1,
            offsetLeft: 0,
            offsetTop: 0
        }
    }
    return {
        width: vv.width,
        height: vv.height,
        scale: vv.scale || 1,
        offsetLeft: vv.offsetLeft || 0,
        offsetTop: vv.offsetTop || 0
    }
}

function setImportantStyle(element, property, value) {
    element.style.setProperty(property, value, 'important')
}

function protectInjectedElement(element, display) {
    const protectedStyles = {
        display,
        position: 'fixed',
        'z-index': '2147483647',
        margin: '0',
        padding: '0',
        'min-height': 'unset',
        'max-height': 'unset',
        'min-width': 'unset',
        'max-width': 'unset',
        border: '0',
        background: 'transparent',
        'border-radius': '0',
        transform: 'none',
        opacity: '1',
        visibility: 'visible',
        'pointer-events': 'auto',
        isolation: 'isolate'
    }

    Object.entries(protectedStyles).forEach(([property, value]) => {
        setImportantStyle(element, property, value)
    })
}

//
// Get settings
//
function getSettingsValues() {
    const keys = [
        'homepageURL',
        'newTabURL',
        'toolbarHeight',
        'toolbarWidth',
        'toolbarPositionPercent',
        'toolbarTransparency',
        'topBottomMargin',
        'defaultPosition',
        'theme',
        'iconTheme',
        'hideMethod',
        'pageUpDownScrollType',
        'pageUpDownScrollOverlap',
        'pageUpDownScrollOverlapLongpress',
        'excludedUrls',
        'checkboxStates',
        'buttonOrder',
        'buttonsInToolbarDiv'
    ]
    return browser.storage.sync.get(keys).then((result) => {
        keys.forEach((key) => {
            settings[key] = result[key]
        })
        currentPosition = toolbarGeometry.normalizePosition(
            settings.defaultPosition
        )
    })
}

//
// Toolbar
//
function appendToolbar() {
    return new Promise((resolve) => {
        if (document.body) {
            appendToolbarAndResolve(resolve)
            return
        }
        const observer = new MutationObserver(() => {
            if (document.body) {
                observer.disconnect()
                appendToolbarAndResolve(resolve)
            }
        })
        observer.observe(document.documentElement, {
            childList: true,
            subtree: false
        })
    })
}

function appendToolbarAndResolve(resolve) {
    if (iframeHidden) {
        unhideIcon = document.createElement('div')
        unhideIcon.setAttribute('id', 'essUnhideIcon')
        const img = document.createElement('img')
        img.src = browser.runtime.getURL(
            `icons/${settings.iconTheme}/unhide.svg`
        )
        img.style =
            'pointer-events: none; height: 50%; width: 50%; margin: auto'
        unhideIcon.style =
            'display: flex; position: fixed; z-index: 2147483647; margin: 0; padding: 0; border: 2px solid #38373f !important; background: rgba(43, 42, 51, 0.8) !important; color-scheme: light; border-radius: 20%; box-sizing: border-box'
        protectInjectedElement(unhideIcon, 'flex')
        setImportantStyle(unhideIcon, 'border', '2px solid #38373f')
        setImportantStyle(
            unhideIcon,
            'background',
            'rgba(43, 42, 51, 0.8)'
        )
        setImportantStyle(unhideIcon, 'border-radius', '20%')
        setImportantStyle(unhideIcon, 'box-sizing', 'border-box')
        unhideIcon.appendChild(img)
        document.body.insertAdjacentElement('beforeend', unhideIcon)
        makeDraggable(unhideIcon)
        resolve()
    } else {
        toolbarIframe = document.createElement('iframe')
        toolbarIframe.style =
            'display: block !important; height: 0; position: fixed; z-index: 2147483647; margin: 0; padding: 0; min-height: unset; max-height: unset; min-width: unset; max-width: unset; border: 0; background: transparent; color-scheme: light; border-radius: 0'
        protectInjectedElement(toolbarIframe, 'block')
        setImportantStyle(toolbarIframe, 'height', '0')
        toolbarIframe.src = browser.runtime.getURL('pages/toolbar.html')
        toolbarIframe.setAttribute('id', 'essBtnsToolbar')
        document.body.insertAdjacentElement('afterend', toolbarIframe)
        window
            .matchMedia('(prefers-color-scheme: dark)')
            .addEventListener('change', () =>
                applyColorSchemeToIframe(toolbarIframe)
            )
        toolbarIframe.addEventListener('load', () => {
            iframeDocument =
                toolbarIframe.contentDocument ||
                toolbarIframe.contentWindow.document
            toolbarDiv = iframeDocument.getElementById('toolbar')
            menuDiv = iframeDocument.getElementById('menu')
            toolbarButtons = iframeDocument.querySelectorAll('.toolbar-button')
            applyColorSchemeToIframe(toolbarIframe)
            if (toolbarDiv && menuDiv) {
                styleToolbarDivs()
            }
            resolve()
        })
    }
}

function applyColorSchemeToIframe(iframe) {
    if (settings.theme === 'light') {
        iframe.style.colorScheme = 'light'
    } else if (settings.theme === 'dark') {
        iframe.style.colorScheme = 'dark'
    } else {
        const prefersDarkScheme = window.matchMedia(
            '(prefers-color-scheme: dark)'
        ).matches
        iframe.style.colorScheme = prefersDarkScheme ? 'dark' : 'light'
    }
}

function styleToolbarDivs() {
    toolbarDiv.style.opacity = settings.toolbarTransparency
    const isHorizontal =
        toolbarGeometry.isHorizontalPosition(currentPosition)
    toolbarDiv.classList.toggle('horizontal', isHorizontal)
    menuDiv.classList.toggle('horizontal', isHorizontal)
    toolbarDiv.classList.toggle('vertical', !isHorizontal)
    menuDiv.classList.toggle('vertical', !isHorizontal)

    if (isHorizontal) {
        toolbarDiv.style.height = '100%'
        menuDiv.style.height = '50%'
        toolbarDiv.style.width = ''
        menuDiv.style.width = ''
        toolbarButtons.forEach((toolbarButton) => {
            toolbarButton.style.height = '100%'
            toolbarButton.style.width = ''
        })
    } else {
        toolbarDiv.style.width = '100%'
        menuDiv.style.width = '50%'
        toolbarDiv.style.height = ''
        menuDiv.style.height = ''
        toolbarButtons.forEach((toolbarButton) => {
            toolbarButton.style.width = '100%'
            toolbarButton.style.height = ''
        })
    }

    applyToolbarEdgeStyles()
    if (isPrivate) {
        toolbarDiv.style.backgroundColor = `rgba(var(--private-background), ${settings.toolbarTransparency})`
    }
}

function applyToolbarEdgeStyles() {
    const position = toolbarGeometry.normalizePosition(currentPosition)
    const requestedWidth = Number(settings.toolbarWidth)
    const isFullLength =
        !Number.isFinite(requestedWidth) || requestedWidth >= 100
    const borderWidths = {
        top: isFullLength ? '0 0 2px' : '0 2px 2px',
        bottom: isFullLength ? '2px 0 0' : '2px 2px 0',
        left: isFullLength ? '0 2px 0 0' : '2px 2px 2px 0',
        right: isFullLength ? '0 0 0 2px' : '2px 0 2px 2px'
    }

    const positionedElements = [toolbarDiv, menuDiv]
    positionedElements.forEach((element) => {
        element.style.top = 'unset'
        element.style.right = 'unset'
        element.style.bottom = 'unset'
        element.style.left = 'unset'
        element.style.borderWidth = borderWidths[position]
    })

    if (position === 'top') {
        toolbarDiv.style.top = '0'
        menuDiv.style.bottom = '0'
    } else if (position === 'bottom') {
        toolbarDiv.style.bottom = '0'
        menuDiv.style.top = '0'
    } else if (position === 'left') {
        toolbarDiv.style.left = '0'
        menuDiv.style.right = '0'
    } else {
        toolbarDiv.style.right = '0'
        menuDiv.style.left = '0'
    }

    updateMoveToolbarIcon()
}

function updateMoveToolbarIcon(button) {
    const moveToolbarButton =
        button ||
        iframeDocument?.querySelector('[data-button="moveToolbarButton"]')
    const chevronUp = moveToolbarButton?.querySelector(
        `svg.chevron-up.${settings.iconTheme}`
    )
    if (!chevronUp) return

    const rotations = {
        top: '180deg',
        bottom: '0deg',
        left: '90deg',
        right: '270deg'
    }
    chevronUp.style.transform = `rotate(${rotations[currentPosition]})`
}

function updateToolbarGeometry() {
    const metrics = getViewportMetrics()
    const toolbarThickness = calculateToolbarThickness()
    const requestedGap = Number(settings.topBottomMargin)
    const edgeGap =
        Number.isFinite(requestedGap) && requestedGap > 0
            ? Math.floor(requestedGap / metrics.scale)
            : 0

    if (iframeHidden) {
        setImportantStyle(unhideIcon, 'height', `${toolbarThickness}px`)
        setImportantStyle(unhideIcon, 'width', `${toolbarThickness}px`)
        setImportantStyle(unhideIcon, 'left', `${
            Math.round(
                metrics.offsetLeft +
                    metrics.width -
                    toolbarThickness * 1.5
            )
        }px`)
        currentPosition === 'top'
            ? setImportantStyle(unhideIcon, 'top', `${
                  Math.round(metrics.offsetTop + toolbarThickness * 1.5)
              }px`)
            : setImportantStyle(unhideIcon, 'top', `${
                  Math.round(
                      metrics.offsetTop +
                          metrics.height -
                          toolbarThickness * 2.5
                  )
              }px`)
        return
    }

    const rect = toolbarGeometry.calculateRect({
        viewport: metrics,
        position: currentPosition,
        thickness: toolbarThickness,
        lengthPercent: settings.toolbarWidth,
        positionPercent: settings.toolbarPositionPercent,
        edgeGap
    })
    setImportantStyle(toolbarIframe, 'width', `${rect.width}px`)
    setImportantStyle(toolbarIframe, 'height', `${rect.height}px`)
    setImportantStyle(toolbarIframe, 'left', `${rect.left}px`)
    setImportantStyle(toolbarIframe, 'top', `${rect.top}px`)
    setImportantStyle(toolbarIframe, 'right', 'unset')
    setImportantStyle(toolbarIframe, 'bottom', 'unset')
    setImportantStyle(toolbarIframe, 'transform', 'none')
    setImportantStyle(toolbarIframe, 'margin', '0')
}

function calculateToolbarThickness() {
    const metrics = getViewportMetrics()
    const requestedHeight = Number(settings.toolbarHeight)
    const toolbarHeight =
        Number.isFinite(requestedHeight) && requestedHeight > 0
            ? requestedHeight
            : 42
    const menuMultiplier = iframeHidden || menuDivHidden ? 1 : 2
    return Math.max(
        1,
        Math.floor((toolbarHeight / metrics.scale) * menuMultiplier)
    )
}

function closeMenu() {
    if (!menuDivHidden) {
        menuDivHidden = true
        menuDiv.style.display = 'none'
        if (menuDiv.classList.contains('horizontal')) {
            toolbarDiv.style.height = '100%'
        } else {
            toolbarDiv.style.width = '100%'
        }
        updateToolbarGeometry()
        menuButtonFlag.classList.remove('pressed')
    }
}

function makeDraggable(element) {
    element.addEventListener('mousedown', handleDragStart)
    element.addEventListener('touchstart', handleDragStart)
    function handleDragStart() {
        unhideToolbar()
        document.body.style.overflow = 'hidden'
        document.body.style.touchAction = 'none'
        document.body.style.userSelect = 'none'
        const elWidth = element.getBoundingClientRect().width
        const elHeight = element.getBoundingClientRect().height
        const moveHandler = (event) => {
            //event.preventDefault()
            dragging = true
            const clientX = event.clientX || event.touches[0].clientX
            const clientY = event.clientY || event.touches[0].clientY
            const xPos = clientX - elWidth / 2
            const yPos = clientY - elHeight / 2
            element.style.left = `${xPos}px`
            element.style.top = `${yPos}px`
        }
        document.addEventListener('mousemove', moveHandler)
        document.addEventListener('touchmove', moveHandler)
        document.addEventListener('mouseup', handleDragEnd)
        document.addEventListener('touchend', handleDragEnd)
        function handleDragEnd() {
            dragging = false
            document.body.style.overflow = ''
            document.body.style.touchAction = ''
            document.body.style.userSelect = ''
            document.removeEventListener('mousemove', moveHandler)
            document.removeEventListener('touchmove', moveHandler)
        }
    }
}

function unhideToolbar() {
    setTimeout(function () {
        if (!dragging) {
            iframeHidden = false
            initializeToolbar()
        }
    }, 200)
}

//
// Buttons
//
const buttonElements = {
    homeButton: {
        behavior: function () {
            window.stop()
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                browser.runtime.sendMessage({
                    action: 'updateTab',
                    url: settings.homepageURL
                })
            }, 100)
        }
    },
    duplicateTabButton: {
        behavior: function (e) {
            e.preventDefault()
            let updatedUrl = window.location.href
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                browser.runtime.sendMessage({
                    action: 'duplicateTab',
                    url: updatedUrl
                })
            }, 100)
        }
    },
    menuButton: {
        behavior: function () {
            if (menuDivHidden) {
                this.classList.add('pressed')
                menuDivHidden = false
                if (menuDiv.classList.contains('horizontal')) {
                    toolbarDiv.style.height = '50%'
                } else {
                    toolbarDiv.style.width = '50%'
                }
                menuDiv.style.display = 'flex'
                menuButtonFlag = this
                updateToolbarGeometry()
            } else {
                closeMenu()
            }
        }
    },
    closeTabButton: {
        behavior: function () {
            window.stop()
            this.classList.add('pressed')
            setTimeout(async () => {
                this.classList.remove('pressed')
                try {
                    const response = await browser.runtime.sendMessage({
                        action: 'closeTab'
                    })
                    if (!response?.ok) {
                        console.error(
                            'Failed to close tab from toolbar',
                            response?.error || 'Unknown error'
                        )
                    }
                } catch (error) {
                    console.error('Failed to close tab from toolbar', error)
                }
            }, 100)
        }
    },
    newTabButton: {
        behavior: function () {
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                browser.runtime.sendMessage({
                    action: 'createTab',
                    url: settings.newTabURL
                })
            }, 100)
        }
    },
    hideButton: {
        behavior: function () {
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                iframeHidden = true
                initializeToolbar()
            }, 100)
        }
    },
    moveToolbarButton: {
        behavior: function () {
            this.classList.add('pressed')
            setTimeout(() => {
                closeMenu()
                currentPosition =
                    toolbarGeometry.getOppositePosition(currentPosition)
                applyToolbarEdgeStyles()
                updateToolbarGeometry()
                this.classList.remove('pressed')
            }, 100)
        }
    },
    // devToolsButton: {
    //     behavior: function () {
    //         this.classList.add('pressed')
    //         const bookmarkletCode = "(function () { var script = document.createElement('script'); script.src='https://cdn.jsdelivr.net/npm/eruda'; document.body.append(script); script.onload = function () { eruda.init(); } })();"
    //         const bookmarkletAnchor = document.createElement('a')
    //         bookmarkletAnchor.href = 'javascript:' + bookmarkletCode
    //         document.body.appendChild(bookmarkletAnchor)
    //         bookmarkletAnchor.click()
    //         document.body.removeChild(bookmarkletAnchor)
    //         setTimeout(() => {
    //             this.classList.remove('pressed')
    //             //closeMenu()
    //         }, 100)
    //     },
    // },
    goBackButton: {
        behavior: function () {
            window.stop()
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                browser.runtime.sendMessage({ action: 'goBack' })
            }, 100)
        }
    },
    goForwardButton: {
        behavior: function () {
            window.stop()
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                browser.runtime.sendMessage({ action: 'goForward' })
            }, 100)
        }
    },
    reloadButton: {
        behavior: function () {
            window.stop()
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                browser.runtime.sendMessage({ action: 'reload' })
            }, 100)
        }
    },
    settingsButton: {
        behavior: function () {
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                browser.runtime.sendMessage({ action: 'openSettings' })
            }, 100)
        }
    },
    undoCloseTabButton: {
        behavior: function () {
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                browser.runtime.sendMessage({ action: 'undoCloseTab' })
            }, 100)
        }
    },
    scrollTopButton: {
        behavior: function () {
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                findScrollableElement().scrollTo({ top: 0, behavior: 'smooth' })
            }, 100)
        }
    },
    scrollBottomButton: {
        behavior: function () {
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                const element = findScrollableElement()
                element.scrollTo({
                    top: element.scrollHeight,
                    behavior: 'smooth'
                })
            }, 100)
        }
    },
    pageUpButton: {
        behavior: function () {
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                const element = findScrollableElement()
                const overlapSetting = settings.pageUpDownScrollOverlap || 80
                const offset = Math.max(window.innerHeight - overlapSetting, 10)
                const targetTop = Math.max(0, element.scrollTop - offset)
                element.scrollTo({
                    top: targetTop,
                    behavior: settings.pageUpDownScrollType
                })
            }, 100)
        },
        longPressBehavior: function () {
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                const element = findScrollableElement()
                const overlapSetting =
                    settings.pageUpDownScrollOverlapLongpress || 60
                const offset = Math.max(window.innerHeight - overlapSetting, 10)
                const targetTop = Math.max(0, element.scrollTop - offset)
                element.scrollTo({
                    top: targetTop,
                    behavior: settings.pageUpDownScrollType
                })
            }, 100)
        }
    },
    pageDownButton: {
        behavior: function () {
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                const element = findScrollableElement()
                const overlapSetting = settings.pageUpDownScrollOverlap || 80
                const offset = Math.max(window.innerHeight - overlapSetting, 10)
                const targetTop = Math.min(
                    element.scrollHeight,
                    element.scrollTop + offset
                )
                element.scrollTo({
                    top: targetTop,
                    behavior: settings.pageUpDownScrollType
                })
            }, 100)
        },
        longPressBehavior: function () {
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                const element = findScrollableElement()
                const overlapSetting =
                    settings.pageUpDownScrollOverlapLongpress || 60
                const offset = Math.max(window.innerHeight - overlapSetting, 10)
                const targetTop = Math.min(
                    element.scrollHeight,
                    element.scrollTop + offset
                )
                element.scrollTo({
                    top: targetTop,
                    behavior: settings.pageUpDownScrollType
                })
            }, 100)
        }
    },
    closeAllTabsButton: {
        behavior: function () {
            window.stop()
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                browser.runtime.sendMessage({
                    action: 'closeAllTabs',
                    url: settings.homepageURL
                })
            }, 100)
        }
    },
    closeOtherTabsButton: {
        behavior: function () {
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                browser.runtime.sendMessage({ action: 'closeOtherTabs' })
            }, 100)
        }
    },
    toggleDesktopSiteButton: {
        behavior: function () {
            window.stop()
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                browser.storage.local.get('isDesktopSite').then((result) => {
                    if (!result.isDesktopSite) {
                        browser.storage.local
                            .set({ isDesktopSite: true })
                            .then(() => {
                                browser.runtime.sendMessage({
                                    action: 'toggleDesktopSite'
                                })
                            })
                    } else {
                        browser.storage.local
                            .set({ isDesktopSite: false })
                            .then(() => {
                                browser.runtime.sendMessage({
                                    action: 'toggleDesktopSite'
                                })
                            })
                    }
                })
            }, 100)
        }
    },
    openWithButton: {
        behavior: function () {
            window.stop()
            this.classList.add('pressed')
            const currentUrl = window.location.href
            const scheme = currentUrl.split(':').shift()
            const shortUrl = currentUrl.split(':').pop()
            const intentUrl = `intent:${shortUrl}#Intent;action=android.intent.action.VIEW;scheme=${scheme};end`
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                browser.runtime.sendMessage({
                    action: 'updateTab',
                    url: intentUrl
                })
            }, 100)
        }
    },
    copyLinkButton: {
        behavior: function () {
            this.classList.add('pressed')
            const currentUrl = window.location.href
            navigator.clipboard
                .writeText(currentUrl)
                .then(() => {
                    //text copied notification
                })
                .catch((err) => {
                    //error notification. Create function notify(text) 3s.
                })
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
            }, 100)
        }
    },
    addTopSiteButton: {
        behavior: function () {
            this.classList.add('pressed')
            triggerAddTopSitePrompt()
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
            }, 100)
        }
    },
    shareButton: {
        behavior: function () {
            this.classList.add('pressed')
            setTimeout(() => {
                this.classList.remove('pressed')
                closeMenu()
                navigator.share({
                    title: document.title,
                    url: window.location.href
                })
            }, 100)
        }
    }
    // Add more buttons
}

function triggerAddTopSitePrompt() {
    ;(async () => {
        try {
            const { createPrompt } = await import(
                browser.runtime.getURL('scripts/topSitePrompt.js')
            )
            createPrompt()
        } catch (error) {
            console.error('Error importing or executing createPrompt:', error)
        }
    })()
}

function toggleButtonVisibility() {
    if (iframeHidden) return
    const fragment = document.createDocumentFragment()
    settings.buttonOrder.forEach((buttonId) => {
        const button = iframeDocument.querySelector(
            `[data-button="${buttonId}"]`
        )
        if (button && settings.checkboxStates[buttonId]) {
            if (isPrivate && buttonsToDisable.includes(buttonId)) return
            const svgs = button.querySelectorAll('svg')
            switch (buttonId) {
                case 'duplicateTabButton':
                    showSVG(svgs, settings.iconTheme)
                    button.href = currentUrl
                    button.addEventListener('touchstart', function () {
                        if (currentUrl !== window.location.href) {
                            currentUrl = window.location.href
                            button.href = currentUrl
                        }
                    })
                    break
                case 'moveToolbarButton':
                    showSVG(svgs, settings.iconTheme)
                    updateMoveToolbarIcon(button)
                    break
                case 'toggleDesktopSiteButton':
                    browser.storage.local
                        .get('isDesktopSite')
                        .then((result) => {
                            const isDesktopSite = result.isDesktopSite
                            const toggleClass = isDesktopSite
                                ? 'smartphone'
                                : 'toggleDesktopSiteButton'
                            showSVG(svgs, settings.iconTheme, toggleClass)
                        })
                    break
                default:
                    showSVG(svgs, settings.iconTheme)
                    break
            }
            button.style.display = 'flex'
            fragment.appendChild(button)
            if (buttonElements[buttonId] && buttonElements[buttonId].behavior) {
                button.removeEventListener(
                    'click',
                    buttonElements[buttonId].behavior
                )

                // Add longpress detection for Page Up/Down buttons
                if (
                    buttonId === 'pageUpButton' ||
                    buttonId === 'pageDownButton'
                ) {
                    let longPressTimer = null
                    let isLongPress = false

                    const startLongPress = () => {
                        longPressTimer = setTimeout(() => {
                            isLongPress = true
                            if (buttonElements[buttonId].longPressBehavior) {
                                buttonElements[buttonId].longPressBehavior.call(
                                    button
                                )
                            }
                        }, 500)
                    }

                    const cancelLongPress = () => {
                        if (longPressTimer) {
                            clearTimeout(longPressTimer)
                            longPressTimer = null
                        }
                        if (!isLongPress) {
                            buttonElements[buttonId].behavior.call(button)
                        }
                        isLongPress = false
                    }

                    // Remove existing longpress event listeners if they exist
                    button.removeEventListener(
                        'mousedown',
                        button._longPressStart
                    )
                    button.removeEventListener(
                        'touchstart',
                        button._longPressStart
                    )
                    button.removeEventListener('mouseup', button._longPressEnd)
                    button.removeEventListener('touchend', button._longPressEnd)

                    // Add longpress detection
                    button._longPressStart = (e) => {
                        if (e.type === 'touchstart') {
                            e.preventDefault()
                        }
                        isLongPress = false
                        startLongPress()
                    }

                    button._longPressEnd = () => {
                        cancelLongPress()
                    }

                    button.addEventListener('mousedown', button._longPressStart)
                    button.addEventListener(
                        'touchstart',
                        button._longPressStart
                    )
                    button.addEventListener('mouseup', button._longPressEnd)
                    button.addEventListener('touchend', button._longPressEnd)
                    //button.addEventListener('mouseleave', button._longPressEnd)
                } else {
                    button.addEventListener(
                        'click',
                        buttonElements[buttonId].behavior
                    )
                }
                buttonElements[buttonId].element = button
            }
        }
    })
    iframeDocument.body.appendChild(fragment)
}

function showSVG(svgs, theme, additionalClass) {
    svgs.forEach((svg) => {
        if (
            svg.classList.contains(theme) &&
            (!additionalClass || svg.classList.contains(additionalClass))
        ) {
            svg.style.display = 'flex'
        }
    })
}

function appendButtons() {
    if (iframeHidden) return
    let buttonsAppended = 0
    const toolbarFragment = document.createDocumentFragment()
    const menuFragment = document.createDocumentFragment()
    settings.buttonOrder.forEach((buttonId) => {
        const button = iframeDocument.querySelector(
            `[data-button="${buttonId}"]`
        )
        if (button && settings.checkboxStates[buttonId]) {
            if (isPrivate && buttonsToDisable.includes(buttonId)) {
                buttonsAppended++
                return
            }
            if (buttonsAppended < settings.buttonsInToolbarDiv) {
                toolbarFragment.appendChild(button)
            } else {
                menuFragment.appendChild(button)
            }
            buttonsAppended++
        }
    })
    toolbarDiv.appendChild(toolbarFragment)
    menuDiv.appendChild(menuFragment)
}

function findScrollableElement() {
    const candidates = document.querySelectorAll('main, div, section')
    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = document.documentElement.clientHeight
    if (document.documentElement.scrollHeight > viewportHeight) {
        return document.documentElement
    }
    if (document.body.scrollHeight > document.body.clientHeight) {
        return document.body
    }
    for (const el of candidates) {
        if (
            el.scrollHeight > viewportHeight * 0.95 &&
            el.clientWidth > viewportWidth * 0.8 &&
            (getComputedStyle(el).overflowY === 'auto' ||
                getComputedStyle(el).overflowY === 'scroll')
        ) {
            return el
        }
    }
    return document.documentElement
}

//
// Hide on scroll method
//
function handleScroll() {
    let currentScrollPos = window.scrollY
    if (!isThrottled) {
        isThrottled = true
        setTimeout(function () {
            isThrottled = false
        }, 100)
        if (Math.abs(prevScrollPos - currentScrollPos) <= 5) {
            return
        }
        if (prevScrollPos > currentScrollPos && !iframeVisible) {
            setImportantStyle(toolbarIframe, 'display', 'block')
            iframeVisible = true
        } else if (prevScrollPos < currentScrollPos && iframeVisible) {
            setImportantStyle(toolbarIframe, 'display', 'none')
            iframeVisible = false
        }
    }
    prevScrollPos = currentScrollPos
}

function handleTouchStart(event) {
    prevTouchY = event.touches[0].clientY
}

function handleTouchMove(event) {
    let currentTouchY = event.touches[0].clientY
    if (!isThrottled) {
        isThrottled = true
        setTimeout(function () {
            isThrottled = false
        }, 100)
        if (Math.abs(prevTouchY - currentTouchY) <= 5) {
            return
        }
        if (prevTouchY < currentTouchY && !iframeHidden && !iframeVisible) {
            setImportantStyle(toolbarIframe, 'display', 'block')
            iframeVisible = true
        } else if (prevTouchY > currentTouchY && iframeVisible) {
            setImportantStyle(toolbarIframe, 'display', 'none')
            iframeVisible = false
        }
    }
    prevTouchY = currentTouchY
}

function hideOnScroll() {
    if (hideMethodInUse === 'scroll') {
        window.removeEventListener('scroll', handleScroll)
    } else if (hideMethodInUse === 'touch') {
        window.removeEventListener('touchstart', handleTouchStart)
        window.removeEventListener('touchmove', handleTouchMove)
    }
    if (iframeHidden) return
    if (settings.hideMethod === 'scroll') {
        hideMethodInUse = 'scroll'
        isThrottled = false
        prevScrollPos = window.scrollY
        window.addEventListener('scroll', handleScroll)
    } else if (settings.hideMethod === 'touch') {
        hideMethodInUse = 'touch'
        isThrottled = false
        let prevTouchY
        window.addEventListener('touchstart', handleTouchStart)
        window.addEventListener('touchmove', handleTouchMove)
    }
}

//
// Initialize toolbar
//
function scheduleToolbarGeometryUpdate() {
    if (viewportUpdateFrame !== null) return
    viewportUpdateFrame = window.requestAnimationFrame(() => {
        viewportUpdateFrame = null
        updateToolbarGeometry()
    })
}

function addViewportListeners() {
    window.addEventListener('resize', scheduleToolbarGeometryUpdate)
    window.visualViewport?.addEventListener(
        'resize',
        scheduleToolbarGeometryUpdate
    )
    window.visualViewport?.addEventListener(
        'scroll',
        scheduleToolbarGeometryUpdate
    )
}

function removeViewportListeners() {
    window.removeEventListener('resize', scheduleToolbarGeometryUpdate)
    window.visualViewport?.removeEventListener(
        'resize',
        scheduleToolbarGeometryUpdate
    )
    window.visualViewport?.removeEventListener(
        'scroll',
        scheduleToolbarGeometryUpdate
    )
    if (viewportUpdateFrame !== null) {
        window.cancelAnimationFrame(viewportUpdateFrame)
        viewportUpdateFrame = null
    }
}

function removeToolbar() {
    const targetElement =
        document.getElementById('essUnhideIcon') ||
        document.getElementById('essBtnsToolbar')
    closeMenu()
    removeViewportListeners()
    window.removeEventListener('load', checkExistenceAndHeight)
    if (targetElement) {
        targetElement.remove()
    }
}

function checkExistenceAndHeight() {
    setTimeout(function () {
        const targetElement =
            document.getElementById('essUnhideIcon') ||
            document.getElementById('essBtnsToolbar')
        if (
            !targetElement ||
            (targetElement.id === 'essBtnsToolbar' &&
                targetElement.parentElement.tagName.toLowerCase() !== 'html')
        ) {
            initializeToolbar()
            return
        }
        const expectedThickness = calculateToolbarThickness()
        const targetRect = targetElement.getBoundingClientRect()
        const actualThickness =
            iframeHidden ||
            toolbarGeometry.isHorizontalPosition(currentPosition)
                ? targetRect.height
                : targetRect.width
        if (actualThickness !== expectedThickness) {
            updateToolbarGeometry()
        }
        window.removeEventListener('load', checkExistenceAndHeight)
    }, 2000)
}

async function initializeToolbar() {
    const problematicUrls = ['https://gaming.amazon.com']
    removeToolbar()
    getSettingsValues().then(async () => {
        const isCurrentPageExcluded = [
            ...(settings.excludedUrls || []),
            ...problematicUrls
        ].some((excludedUrl) => {
            const pattern = new RegExp(
                '^' + excludedUrl.replace(/\*/g, '.*') + '$'
            )
            return pattern.test(currentUrl)
        })
        if (!isCurrentPageExcluded) {
            await appendToolbar()
            updateToolbarGeometry()
            window.addEventListener('load', checkExistenceAndHeight)
            toggleButtonVisibility()
            appendButtons()
            hideOnScroll()
            addViewportListeners()
        }
    })
}

browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'reloadToolbar') {
        initializeToolbar()
    }
})

initializeToolbar()
