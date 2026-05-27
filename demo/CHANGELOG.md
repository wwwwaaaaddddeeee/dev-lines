# Changelog

All notable changes to **dev-lines**. Format follows [Keep a Changelog](https://keepachangelog.com); versioning is [SemVer](https://semver.org).

## [Unreleased]

### Added
- **Agent handoff** — every box gets a name: yours via `data-devlines-name` (or a custom `nameAttr`), or auto-derived from `id` / `aria-label` / `data-component` / nearest heading when unset. Press `C` to copy a box's handle — `"Name" — selector (<tag>)` — to hand an AI agent the exact region to change.
- **React wrapper** — `<DevLines />`, shipped as the `dev-lines/react` subpath. Creates the overlay on mount, tears it down on unmount, re-inits on prop changes. React is an optional peer dependency.
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
