# @dev-lines/core

A framework-agnostic **layout debug overlay**. Draws guides, depth-colored section outlines, labels, and spacing distances *on top of* any page — without mutating your DOM. The whole overlay lives in one fixed, `pointer-events: none` layer, so your app is never touched and teardown is total.

> See the lines. Before you ship the bug. → **[lines.wiki](https://lines.wiki)**

- 🎯 Viewport center cross + optional content-width and padding guides
- 🌈 Depth-colored outlines around every flex/grid container (up to 12 depths)
- 🏷️ Labels: name · tag · size · layout, per-box or all-at-once
- 📏 Hold **Alt** for spacing distances from a box to its container
- 📋 Press **C** to copy a box's handle (name · selector · tag) for handing to an AI agent
- ⚡ Zero dependencies. React optional.

## Install

```bash
npm i -D @dev-lines/core
```

## Usage (vanilla)

```js
import { createDevLines } from "@dev-lines/core";

const dl = createDevLines({ contentWidth: 1280, paddingX: 24 });
dl.enable();
```

Toggle anytime with **⌘/Ctrl + Shift + L**. Once enabled:

| Key | Action |
|-----|--------|
| `O` | toggle outlines |
| `G` | toggle guides |
| `L` | cycle labels (off → hover → all) |
| `C` | copy hovered box's handle |
| `Alt` (hold) | show spacing distances |
| `Esc` | disable |

## Usage (React)

```tsx
import { DevLines } from "@dev-lines/core/react";

export default function App() {
  return (
    <>
      {process.env.NODE_ENV === "development" && <DevLines contentWidth={1280} paddingX={24} />}
      {/* your app */}
    </>
  );
}
```

The overlay mounts for the lifetime of the component and tears down completely on unmount.

## Options

All optional. Colors are space-separated RGB triplets (e.g. `"245 104 104"`).

| Option | Default | Description |
|--------|---------|-------------|
| `contentWidth` | — | Draw content-width edges at center ± width/2 |
| `paddingX` | — | Draw padding edges this many px from each side |
| `lineColor` | `"245 104 104"` | Center/width guide color (coral) |
| `paddingColor` | `"167 125 255"` | Padding guide color (purple) |
| `measureColor` | `"237 139 0"` | Alt-distance color (orange) |
| `depthColors` | 12-color palette | Outline colors per nesting depth |
| `sections` | `true` | Start with outlines on |
| `sectionSelector` | — | Outline only elements matching this selector |
| `labels` | `{ mode: "hover", show: ["name","tag","size","display"] }` | Label config |
| `nameAttr` | `"data-devlines-name"` | Attribute read for a box's explicit name |
| `autoName` | `true` | Derive names from id / aria-label / component / heading |
| `copyKey` | `"c"` | Key to copy a box handle (`null` to disable) |
| `shortcut` | `"mod+shift+l"` | Toggle shortcut (`null` to disable) |
| `labelKey` | `"l"` | Cycle-labels key (`null` to disable) |
| `persist` | `true` | Remember on/off across reloads via localStorage |
| `start` | `false` | Enable immediately on create |

## Controller API

`createDevLines(options)` returns:

```ts
interface DevLinesController {
  enable(): void;
  disable(): void;
  toggle(): void;
  isEnabled(): boolean;
  cycleLabels(mode?: "off" | "hover" | "all"): void;
  toggleOutlines(on?: boolean): void;
  toggleGuides(on?: boolean): void;
  update(options): void;   // live-update colors / contentWidth / paddingX and redraw
  copy(): void;            // copy hovered box's handle
  getState(): { enabled, outlines, guides, labels };
  refresh(): void;
  destroy(): void;
}
```

## Naming boxes

Give any element an explicit label with `data-devlines-name="Hero"`, or force an outline on a non-flex/grid element with `data-devlines="outline"`. Mark elements to skip with `data-devlines="ignore"`.

## License

MIT © [wa-de](https://www.wa-de.org)
