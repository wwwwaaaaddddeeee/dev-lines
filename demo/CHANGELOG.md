# Changelog

All notable changes to **dev-lines**. Format follows [Keep a Changelog](https://keepachangelog.com); versioning is [SemVer](https://semver.org).

## [0.2.0] — 2026-07-13

### Added
- **Inspect mode** — press `I` to lock onto the hovered box; the arrow keys walk the tree (↑ parent, ↓ first child, ←/→ siblings); `Esc` unlocks. The locked box keeps its label and gets a solid ring; `C` and `Alt` target it.
- **Box model** — the hovered/locked box shows its padding and flex/grid gaps as tinted bands, DevTools-style. Toggle with `B`, configure via `boxModel` / `gapColor`.
- **On-page toolbar** — the pill from lines.wiki now ships inside the engine: `toolbar: true` mounts power · guides · outlines · labels · copy · settings, with live color controls. No keyboard needed.
- **Richer agent handoff** — `C` now copies a two-line handle: `"Name" — selector (<tag>)` plus `size · display · padding · gap`, ready to paste to an AI coding agent.
- New controller methods: `inspect(el?)`, `toggleBoxModel(on?)`; `getState()` now reports `boxModel` and the `inspected` element.
- `update()` now also applies `labels`, `gapColor`, `sectionSelector`, `nameAttr`, `autoName`, and `boxModel` live.

### Fixed
- The overlay no longer observes its own DOM writes — previously the MutationObserver scheduled a redraw for every frame the overlay was enabled.
- Alt-distances no longer stick when the window loses focus mid-hold (Alt+Tab).

## [0.1.0] — 2026-05-30

First npm release of `@dev-lines/core`.

### Added
- **Agent handoff** — every box gets a name: yours via `data-devlines-name` (or a custom `nameAttr`), or auto-derived from `id` / `aria-label` / `data-component` / nearest heading when unset. Press `C` to copy a box's handle — `"Name" — selector (<tag>)` — to hand an AI agent the exact region to change.
- **React wrapper** — `<DevLines />`, shipped as the `@dev-lines/core/react` subpath. Creates the overlay on mount, tears it down on unmount, re-inits on prop changes. React is an optional peer dependency.
- **Distances** — hold `Alt` to measure the gaps from the hovered box to its containing box (amber readouts).
- **Layer toggles** — `O` outlines, `G` guides, `Esc` to disable.
- **Labels** — `hover` / `all` modes showing tag · size · layout, plus custom region names via `data-devlines-name`, and px readouts on the guides. Cycle with `L`.
- **MIT license.**

## [0.0.1] — 2026-05-27

### Added
- **Core engine** — viewport center cross, content-width edges, and padding edges.
- **Depth-colored outlines** around auto-detected flex/grid layout containers.
- `data-devlines="outline" | "ignore"` to force-include or skip elements; `sectionSelector` to target a custom set.
- Keyboard toggle (`mod+shift+L`) and persisted on/off state across reloads.
- Framework-agnostic, **zero dependencies**, non-invasive overlay that never mutates the host page.
