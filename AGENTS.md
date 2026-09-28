# AGENTS.md

## Project

Essential Buttons Toolbar and Homepage is a Firefox Manifest V2 extension, primarily for Android. It injects an iframe toolbar at `document_start` and provides settings, a homepage, and tab actions. Source files run directly; there is no bundler or transpilation step. The background script is non-persistent.

## Commands and workspace

- `npm test` — Node's built-in test runner; covers geometry, toolbar lifecycle, button dispatch, and Close/Undo behavior.
- `npm run build` (or `npm run build:xpi`) — Packages `ztemp/essential-buttons-toolbar.xpi`; does not run tests or sign the extension.
- No lint command is currently configured. Follow the existing four-space indentation and mostly semicolon-free style.
- Use `ztemp/` for scratch scripts, profiles, screenshots, and builds. `ztemp/` and `zothercode/` are globally gitignored; the latter may contain related checkouts or symlinks.

## Main files

- `manifest.json` — Permissions, content-script order, background registration, and extension identity.
- `scripts/content.js` — Toolbar creation/recovery, iframe button wiring, hiding, scrolling, and runtime messaging.
- `scripts/toolbarGeometry.js` — Pure positioning helpers shared with Node tests; loaded before `content.js`.
- `pages/toolbar.html` / `styles/toolbar.css` — Toolbar/menu markup, icons, and iframe styles.
- `scripts/background.js` — Default settings, install/update migration, tab actions, and Close/Undo history.
- `scripts/settings.js` / `pages/settings.html` — Settings UI and live toolbar reload requests.
- `scripts/homepage.js` / `pages/homepage.html` — Homepage, top sites, wallpaper, and import/export.
- `scripts/topSitePrompt.js` — Dynamically imported top-site prompt; preserve its module loading path.

## Toolbar invariants

- Insert the visible iframe beside `body`, directly under `html`. The unhide icon belongs inside `body`.
- Set outer iframe geometry before insertion; do not wait for iframe or page `load` to make it nonzero. Wire internal controls after the iframe document loads.
- Preserve removal/reparenting recovery and `pageshow`/visibility checks. Recovery must respect exclusions and hidden mode, retain the chosen edge, and avoid duplicate surfaces.
- Disconnect obsolete observers/listeners and ignore stale iframe load events or settings reads during reinitialization.
- Use visual viewport dimensions, scale, and offsets. Transient zero dimensions must not collapse an existing toolbar; retain usable measurements.
- Keep important inline style protection against host-page CSS. Test all four edges when changing geometry.
- Dispatch browser actions immediately; visual button-feedback timers must not delay them.

## Settings and state

- User preferences live in `browser.storage.sync`; defaults and migrations are in `scripts/background.js`.
- `browser.storage.local` holds state such as `topSites`, wallpaper data, `isDesktopSite`, `senderURL`, and `lastClosedTabURL` (an array despite its singular name).
- Preserve existing settings during updates. Keep defaults, settings UI, readers, and migrations aligned when changing keys.
- Close/Undo uses ordered history persistence with a bounded storage wait. Do not make closing tabs depend indefinitely on storage or overwrite newer history with a stale read.

## Verification and device safety

- Run relevant Node tests for behavior changes and build the XPI for packaging changes. Documentation-only edits need no browser run.
- For toolbar lifecycle changes, verify real Firefox iframe loading, working buttons, removal/reparenting recovery, and hidden-icon recovery after body replacement. Node DOM mocks alone do not verify extension iframe behavior.
- Treat Android Firefox as the primary target; desktop Firefox is useful for faster shared-logic checks. Do not assume the emulator is faster than the Note10 without measuring.
- Use Selenium/geckodriver for repeatable Firefox checks. Do not launch an uncontrolled `web-ext run` session.
- Android Selenium/geckodriver clears the selected browser package data when creating a session. Disposable Firefox Nightly testing is authorized on Note10 `RF8M81WSL1V`, package `org.mozilla.fenix`; do not extend this permission to other packages, devices, or Android users/work profiles.
- Preserve existing sessions for ordinary inspection. For Note10 tests, record `stay_on_while_plugged_in`, keep the device awake on USB throughout, and restore and verify the exact original value in cleanup.
- When available, consult the sibling AFFO project's `.agents/skills/desktop-testing/SKILL.md` for Firefox harness details and the `android-use` / `firefox-extension-debug` skills for device procedures. AFFO-specific selectors, storage seeds, and build paths do not apply to Essential.
