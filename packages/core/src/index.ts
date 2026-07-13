/**
 * @dev-lines/core — a framework-agnostic layout debug overlay.
 *
 * Draws, on top of any page, without mutating it:
 *  - a viewport center cross (vertical + horizontal)
 *  - optional content-width edges (center ± contentWidth/2)
 *  - optional padding edges (paddingX in from each side)
 *  - depth-colored outlines around layout containers (flex/grid)
 *  - labels: per-box chips (tag · size · layout · custom name) and guide readouts
 *  - box model: padding + flex/grid gap bands on the hovered/locked box
 *  - inspect: lock onto a box and walk the tree with the arrow keys
 *  - hold Alt: spacing overlay from the hovered/locked box to its containing box
 *
 * Everything lives in one fixed overlay layer with pointer-events: none, so the
 * host app is never touched and teardown is total. The optional toolbar pill
 * (`toolbar: true`) is the one interactive element, mounted beside the overlay.
 *
 * Commands (when enabled): O toggle outlines · G toggle guides · L cycle labels ·
 * I lock/unlock inspect (arrows walk the tree) · B toggle box-model bands ·
 * C copy handle · Esc unlock/disable · hold Alt for distances.
 * Toggle the overlay with mod+shift+L.
 */

import { mountToolbar, type ToolbarHandle } from "./toolbar";

export type LabelField = "name" | "tag" | "size" | "display" | "depth";
export type LabelMode = "off" | "hover" | "all";

export interface LabelOptions {
  mode?: LabelMode;
  show?: LabelField[];
  guides?: boolean;
}

export interface DevLinesOptions {
  contentWidth?: number;
  paddingX?: number;
  lineColor?: string;
  paddingColor?: string;
  measureColor?: string;
  /** Color for flex/grid gap bands. Default "138 224 108" (green). */
  gapColor?: string;
  depthColors?: string[];
  sections?: boolean;
  sectionSelector?: string;
  labels?: LabelOptions;
  /** Attribute read for a box's explicit name. Default "data-devlines-name". */
  nameAttr?: string;
  /** Derive a name (id → aria-label → data-component/testid → heading) when none is set. Default true. */
  autoName?: boolean;
  /** Key to copy the hovered box's handle (name · selector · tag · size · display · padding · gap). Default "c". */
  copyKey?: string | null;
  /** Key to lock/unlock inspect on the hovered box. Arrow keys then walk the tree. Default "i". */
  inspectKey?: string | null;
  /** Show padding + gap bands on the hovered/locked box. Default true. */
  boxModel?: boolean;
  /** Key to toggle the box-model bands. Default "b". */
  boxModelKey?: string | null;
  /** Mount the on-page toolbar pill (power · guides · outlines · labels · copy · settings). Default false. */
  toolbar?: boolean;
  shortcut?: string | null;
  labelKey?: string | null;
  persist?: boolean;
  start?: boolean;
}

export interface DevLinesController {
  enable(): void;
  disable(): void;
  toggle(): void;
  isEnabled(): boolean;
  cycleLabels(mode?: LabelMode): void;
  toggleOutlines(on?: boolean): void;
  toggleGuides(on?: boolean): void;
  /** Toggle the padding/gap bands on the hovered/locked box. */
  toggleBoxModel(on?: boolean): void;
  /** Lock inspect onto an element (null unlocks; no argument toggles on the hovered box). */
  inspect(el?: Element | null): void;
  /** Live-update visual options (colors, contentWidth, paddingX, labels) and redraw. */
  update(options: Partial<DevLinesOptions>): void;
  /** Copy the locked/hovered (or last-hovered) box's handle for agent handoff. */
  copy(): void;
  getState(): {
    enabled: boolean;
    outlines: boolean;
    guides: boolean;
    labels: LabelMode;
    boxModel: boolean;
    inspected: Element | null;
  };
  refresh(): void;
  destroy(): void;
}

const STORAGE_KEY = "dev-lines:enabled";
const Z = 2147483600;

// dev-lines core palette — depth clamps to the last color beyond this.
const DEFAULT_DEPTH_COLORS = [
  "29 29 29", // #1d1d1d neutral (graphite)
  "155 164 183", // #9ba4b7 neutral (gray)
  "167 125 255", // #a77dff purple
  "245 104 104", // #f56868 coral
  "237 139 0", // #ed8b00 orange
  "241 223 56", // #f1df38 yellow
  "138 224 108", // #8ae06c green
];

const DEFAULTS = {
  lineColor: "245 104 104", // #f56868 coral
  paddingColor: "167 125 255", // #a77dff purple
  measureColor: "237 139 0", // #ed8b00 orange
  gapColor: "138 224 108", // #8ae06c green
  sections: true,
  shortcut: "mod+shift+l" as string | null,
  labelKey: "l" as string | null,
  copyKey: "c" as string | null,
  inspectKey: "i" as string | null,
  boxModel: true,
  boxModelKey: "b" as string | null,
  toolbar: false,
  nameAttr: "data-devlines-name",
  autoName: true,
  persist: true,
  start: false,
};

const DEFAULT_LABELS: Required<LabelOptions> = {
  mode: "hover",
  show: ["name", "tag", "size", "display"],
  guides: true,
};

const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

export function createDevLines(options: DevLinesOptions = {}): DevLinesController {
  if (!isBrowser) return noopController();

  const opts = { ...DEFAULTS, ...options };
  let depthColors = options.depthColors ?? DEFAULT_DEPTH_COLORS;
  const labels: Required<LabelOptions> = { ...DEFAULT_LABELS, ...options.labels };

  type Box = { el: Element; depth: number; rect: DOMRect };

  let enabled = false;
  let root: HTMLDivElement | null = null;
  let sectionsLayer: HTMLDivElement | null = null;
  let boxLayer: HTMLDivElement | null = null;
  let guidesLayer: HTMLDivElement | null = null;
  let labelsLayer: HTMLDivElement | null = null;
  let measureLayer: HTMLDivElement | null = null;
  let scheduled = false;
  let ro: ResizeObserver | null = null;
  let mo: MutationObserver | null = null;
  let boxes: Box[] = [];
  let pointer: { x: number; y: number } | null = null;
  let hoverBox: Box | null = null;
  let lastHoverBox: Box | null = null;
  let lockedEl: Element | null = null;
  let lockedBox: Box | null = null;
  let tb: ToolbarHandle | null = null;

  // runtime layer toggles
  let outlinesOn = opts.sections;
  let guidesOn = true;
  let boxModelOn = opts.boxModel;
  let altDown = false;

  const rgba = (t: string, a: number) => `rgb(${t} / ${a})`;
  // clamp to the last color beyond the palette length (max-N colors, no cycling)
  const colorForDepth = (d: number) => depthColors[Math.min(d, depthColors.length - 1)];
  const notify = () => tb?.sync();
  /** The box the overlay is focused on: the inspect lock wins over hover. */
  const focusBox = () => lockedBox ?? hoverBox;

  function line(css: Partial<CSSStyleDeclaration>): HTMLDivElement {
    const el = document.createElement("div");
    Object.assign(el.style, { position: "absolute", ...css });
    return el;
  }

  function chip(text: string, colorTriplet: string, left: number, top: number): HTMLDivElement {
    const el = document.createElement("div");
    el.textContent = text;
    Object.assign(el.style, {
      position: "absolute",
      left: `${Math.max(0, left)}px`,
      top: `${Math.max(0, top)}px`,
      font: '500 10px/1.4 "Geist Mono", ui-monospace, monospace',
      letterSpacing: "0.01em",
      color: "#fff",
      background: rgba(colorTriplet, 0.92),
      padding: "1px 5px",
      borderRadius: "4px",
      whiteSpace: "nowrap",
      pointerEvents: "none",
      transform: "translateZ(0)",
    } as CSSStyleDeclaration);
    return el;
  }

  function buildGuides(): HTMLDivElement {
    const layer = document.createElement("div");
    Object.assign(layer.style, { position: "absolute", inset: "0" } as CSSStyleDeclaration);
    const c = rgba(opts.lineColor, 0.75);
    layer.appendChild(line({ top: "0", bottom: "0", left: "50%", width: "1px", transform: "translateX(-50%)", background: c }));
    layer.appendChild(line({ left: "0", right: "0", top: "50%", height: "1px", transform: "translateY(-50%)", background: c }));
    if (opts.contentWidth && opts.contentWidth > 0) {
      const half = opts.contentWidth / 2;
      layer.appendChild(line({ top: "0", bottom: "0", left: "50%", width: "1px", transform: `translateX(${-half}px)`, background: c }));
      layer.appendChild(line({ top: "0", bottom: "0", left: "50%", width: "1px", transform: `translateX(${half}px)`, background: c }));
    }
    if (opts.paddingX && opts.paddingX > 0) {
      const p = rgba(opts.paddingColor, 0.75);
      layer.appendChild(line({ top: "0", bottom: "0", left: `${opts.paddingX}px`, width: "1px", background: p }));
      layer.appendChild(line({ top: "0", bottom: "0", right: `${opts.paddingX}px`, width: "1px", background: p }));
    }
    return layer;
  }

  function isContainer(el: Element): boolean {
    if (el.getAttribute("data-devlines") === "outline") return true;
    const display = getComputedStyle(el).display;
    return display.includes("flex") || display.includes("grid");
  }

  function collect(): { el: Element; depth: number }[] {
    const out: { el: Element; depth: number }[] = [];
    const walk = (el: Element, depth: number) => {
      if (el === root || el === tb?.el || el.getAttribute("data-devlines") === "ignore") return;
      const hit = isContainer(el);
      if (hit) out.push({ el, depth });
      const next = hit ? depth + 1 : depth;
      for (const child of el.children) walk(child, next);
    };
    if (opts.sectionSelector) {
      document.querySelectorAll(opts.sectionSelector).forEach((el) => out.push({ el, depth: 0 }));
    } else {
      for (const child of document.body.children) walk(child, 0);
    }
    return out;
  }

  function drawSections() {
    if (!sectionsLayer) return;
    sectionsLayer.replaceChildren();
    boxes = [];
    if (outlinesOn) {
      for (const { el, depth } of collect()) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        boxes.push({ el, depth, rect });
      }
    }
    // re-resolve the inspect lock against the fresh box list; clear it if the
    // element left the page (or outlines were turned off).
    lockedBox = lockedEl ? boxes.find((b) => b.el === lockedEl) ?? null : null;
    if (lockedEl && !lockedBox) lockedEl = null;
    for (const b of boxes) {
      const color = colorForDepth(b.depth);
      const box = document.createElement("div");
      const locked = b === lockedBox;
      Object.assign(box.style, {
        position: "absolute",
        left: `${b.rect.left}px`,
        top: `${b.rect.top}px`,
        width: `${b.rect.width}px`,
        height: `${b.rect.height}px`,
        boxShadow: locked
          ? `inset 0 0 0 1.5px ${rgba(color, 1)}, 0 0 0 1px ${rgba(color, 0.3)}`
          : `inset 0 0 0 1px ${rgba(color, 0.6)}`,
      } as CSSStyleDeclaration);
      sectionsLayer.appendChild(box);
    }
    hoverBox = pointer ? boxAt(pointer.x, pointer.y) : null;
    drawBoxModel();
    drawLabels();
    drawMeasure();
  }

  /** Resolve a human name for a box: explicit attr → id → aria-label → component → heading. */
  function nameOf(el: Element): string | null {
    const explicit = el.getAttribute(opts.nameAttr);
    if (explicit) return explicit;
    if (!opts.autoName) return null;
    if (el.id) return el.id;
    const aria = el.getAttribute("aria-label");
    if (aria) return aria;
    const comp = el.getAttribute("data-component") || el.getAttribute("data-testid");
    if (comp) return comp;
    const h = el.querySelector("h1,h2,h3,h4,h5,h6");
    const t = h?.textContent?.trim();
    if (t) return t.length > 24 ? t.slice(0, 24) + "…" : t;
    return null;
  }

  /** A stable-ish CSS selector for the element, for agent handoff. */
  function selectorFor(el: Element): string {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body) {
      const cur: Element = node;
      if (cur.id) { parts.unshift(`#${CSS.escape(cur.id)}`); break; }
      let sel = cur.tagName.toLowerCase();
      const parent = cur.parentElement;
      if (parent) {
        const sameTag = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
        if (sameTag.length > 1) sel += `:nth-of-type(${sameTag.indexOf(cur) + 1})`;
      }
      parts.unshift(sel);
      node = parent;
    }
    return parts.join(" > ") || el.tagName.toLowerCase();
  }

  function displayOf(el: Element): string {
    const d = getComputedStyle(el).display;
    return d.includes("grid") ? "grid" : d.includes("flex") ? "flex" : d;
  }

  function labelText(el: Element, depth: number, rect: DOMRect): string {
    const parts: string[] = [];
    for (const f of labels.show) {
      if (f === "name") {
        const nm = nameOf(el);
        if (nm) parts.push(nm);
      } else if (f === "tag") parts.push(`<${el.tagName.toLowerCase()}>`);
      else if (f === "size") parts.push(`${Math.round(rect.width)}×${Math.round(rect.height)}`);
      else if (f === "display") parts.push(displayOf(el));
      else if (f === "depth") parts.push(`d${depth}`);
    }
    return parts.join(" · ");
  }

  function boxAt(x: number, y: number) {
    let best: Box | null = null;
    for (const b of boxes) {
      const r = b.rect;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        if (!best || b.depth > best.depth) best = b;
      }
    }
    return best;
  }

  /** Closest containing box of lower depth, or null (→ viewport). */
  function ancestorOf(target: Box) {
    let best: Box | null = null;
    for (const b of boxes) {
      if (b === target || b.depth >= target.depth) continue;
      const r = b.rect, t = target.rect;
      if (r.left <= t.left && r.top <= t.top && r.right >= t.right && r.bottom >= t.bottom) {
        if (!best || b.depth > best.depth) best = b;
      }
    }
    return best;
  }

  /** Nearest boxed DOM ancestor (for inspect navigation). */
  function parentBoxOf(target: Box): Box | null {
    let best: Box | null = null;
    for (const b of boxes) {
      if (b === target || !b.el.contains(target.el)) continue;
      if (!best || best.el.contains(b.el)) best = b;
    }
    return best;
  }

  /** Direct boxed children (document order — the boxes list is a DFS walk). */
  function childBoxesOf(target: Box): Box[] {
    return boxes.filter((b) => b !== target && target.el.contains(b.el) && parentBoxOf(b) === target);
  }

  function navigate(key: string) {
    const cur = lockedBox;
    if (!cur) return;
    let next: Box | null | undefined = null;
    if (key === "arrowup") next = parentBoxOf(cur);
    else if (key === "arrowdown") next = childBoxesOf(cur)[0];
    else {
      const parent = parentBoxOf(cur);
      const sibs = parent ? childBoxesOf(parent) : boxes.filter((b) => !parentBoxOf(b));
      const i = sibs.indexOf(cur);
      if (i !== -1 && sibs.length > 1) {
        next = sibs[(i + (key === "arrowright" ? 1 : -1) + sibs.length) % sibs.length];
      }
    }
    if (next) inspect(next.el);
  }

  function inspect(el?: Element | null) {
    if (el === undefined) {
      lockedEl = lockedEl ? null : (hoverBox ?? lastHoverBox)?.el ?? null;
    } else {
      lockedEl = el;
    }
    if (enabled) drawSections();
    notify();
  }

  function drawLabels() {
    if (!labelsLayer) return;
    labelsLayer.replaceChildren();
    if (labels.guides && guidesOn) {
      const cx = window.innerWidth / 2;
      labelsLayer.appendChild(chip(`${Math.round(cx)}`, opts.lineColor, cx + 4, 4));
      if (opts.contentWidth && opts.contentWidth > 0) {
        const half = opts.contentWidth / 2;
        labelsLayer.appendChild(chip(`−${Math.round(half)}`, opts.lineColor, cx - half + 4, 22));
        labelsLayer.appendChild(chip(`+${Math.round(half)}`, opts.lineColor, cx + half + 4, 22));
      }
      if (opts.paddingX && opts.paddingX > 0) {
        labelsLayer.appendChild(chip(`${Math.round(opts.paddingX)}`, opts.paddingColor, opts.paddingX + 4, 4));
        labelsLayer.appendChild(chip(`${Math.round(opts.paddingX)}`, opts.paddingColor, window.innerWidth - opts.paddingX + 4, 4));
      }
    }
    if (!outlinesOn) return;
    if (labels.mode === "all") {
      for (const b of boxes) labelsLayer.appendChild(chip(labelText(b.el, b.depth, b.rect), colorForDepth(b.depth), b.rect.left, b.rect.top));
    } else {
      // the locked box is always labelled; hover keeps working alongside it.
      if (lockedBox) labelsLayer.appendChild(chip(labelText(lockedBox.el, lockedBox.depth, lockedBox.rect), colorForDepth(lockedBox.depth), lockedBox.rect.left, lockedBox.rect.top));
      if (labels.mode === "hover" && hoverBox && hoverBox !== lockedBox) {
        labelsLayer.appendChild(chip(labelText(hoverBox.el, hoverBox.depth, hoverBox.rect), colorForDepth(hoverBox.depth), hoverBox.rect.left, hoverBox.rect.top));
      }
    }
  }

  /** Padding + flex/grid gap bands for the focused (locked or hovered) box. */
  function drawBoxModel() {
    if (!boxLayer) return;
    boxLayer.replaceChildren();
    const b = focusBox();
    if (!boxModelOn || !outlinesOn || !b) return;
    const r = b.rect;
    const cs = getComputedStyle(b.el);
    const band = (x: number, y: number, w: number, h: number, color: string, alpha: number) => {
      if (w < 0.5 || h < 0.5) return;
      boxLayer!.appendChild(line({ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, background: rgba(color, alpha) }));
    };
    const pt = parseFloat(cs.paddingTop) || 0, pr = parseFloat(cs.paddingRight) || 0,
          pb = parseFloat(cs.paddingBottom) || 0, pl = parseFloat(cs.paddingLeft) || 0;
    band(r.left, r.top, r.width, pt, opts.paddingColor, 0.16);
    band(r.left, r.bottom - pb, r.width, pb, opts.paddingColor, 0.16);
    band(r.left, r.top + pt, pl, r.height - pt - pb, opts.paddingColor, 0.16);
    band(r.right - pr, r.top + pt, pr, r.height - pt - pb, opts.paddingColor, 0.16);

    if (!cs.display.includes("flex") && !cs.display.includes("grid")) return;
    const rowGap = parseFloat(cs.rowGap) || 0;
    const colGap = parseFloat(cs.columnGap) || 0;
    if (rowGap < 1 && colGap < 1) return;
    const kids: DOMRect[] = [];
    for (const k of b.el.children) {
      if (k.getAttribute("data-devlines") === "ignore") continue;
      const kr = k.getBoundingClientRect();
      if (kr.width > 0 && kr.height > 0) kids.push(kr);
    }
    // tint the space between adjacent children when it matches the computed gap
    if (colGap >= 1) {
      const byX = [...kids].sort((a, b2) => a.left - b2.left);
      for (let i = 0; i < byX.length; i++) {
        for (let j = i + 1; j < byX.length; j++) {
          const a = byX[i], c = byX[j];
          const w = c.left - a.right;
          if (w < 1 || w > colGap + 1) continue;
          const y1 = Math.max(a.top, c.top), y2 = Math.min(a.bottom, c.bottom);
          if (y2 - y1 >= 1) band(a.right, y1, w, y2 - y1, opts.gapColor, 0.22);
        }
      }
    }
    if (rowGap >= 1) {
      const byY = [...kids].sort((a, b2) => a.top - b2.top);
      for (let i = 0; i < byY.length; i++) {
        for (let j = i + 1; j < byY.length; j++) {
          const a = byY[i], c = byY[j];
          const h = c.top - a.bottom;
          if (h < 1 || h > rowGap + 1) continue;
          const x1 = Math.max(a.left, c.left), x2 = Math.min(a.right, c.right);
          if (x2 - x1 >= 1) band(x1, a.bottom, x2 - x1, h, opts.gapColor, 0.22);
        }
      }
    }
  }

  function measureSeg(x1: number, y1: number, x2: number, y2: number, value: number) {
    if (!measureLayer || value < 1) return;
    const horizontal = y1 === y2;
    measureLayer.appendChild(line({
      left: `${Math.min(x1, x2)}px`,
      top: `${Math.min(y1, y2)}px`,
      width: horizontal ? `${Math.abs(x2 - x1)}px` : "1px",
      height: horizontal ? "1px" : `${Math.abs(y2 - y1)}px`,
      background: rgba(opts.measureColor, 0.9),
    }));
    const mx = horizontal ? (x1 + x2) / 2 : x1 + 3;
    const my = horizontal ? y1 + 3 : (y1 + y2) / 2;
    measureLayer.appendChild(chip(`${Math.round(value)}`, opts.measureColor, mx, my));
  }

  function drawMeasure() {
    if (!measureLayer) return;
    measureLayer.replaceChildren();
    const target = focusBox();
    if (!altDown || !target || !outlinesOn) return;
    const t = target.rect;
    const anc = ancestorOf(target);
    const c = anc ? anc.rect : new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const midX = (t.left + t.right) / 2;
    const midY = (t.top + t.bottom) / 2;
    measureSeg(midX, c.top, midX, t.top, t.top - c.top); // top gap
    measureSeg(midX, t.bottom, midX, c.bottom, c.bottom - t.bottom); // bottom gap
    measureSeg(c.left, midY, t.left, midY, t.left - c.left); // left gap
    measureSeg(t.right, midY, c.right, midY, c.right - t.right); // right gap
  }

  function flashCopied(rect: DOMRect) {
    if (!root) return;
    const el = chip("copied ✓", "34 197 94", rect.left, rect.top - 2);
    root.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  /** "24px" | "24px 32px" | "1px 2px 3px 4px" — or null when there's no padding. */
  function paddingShorthand(cs: CSSStyleDeclaration): string | null {
    const v = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft]
      .map((s) => `${Math.round(parseFloat(s) || 0)}px`);
    if (v.every((s) => s === "0px")) return null;
    if (v[0] === v[1] && v[1] === v[2] && v[2] === v[3]) return v[0];
    if (v[0] === v[2] && v[1] === v[3]) return `${v[0]} ${v[1]}`;
    return v.join(" ");
  }

  function gapShorthand(cs: CSSStyleDeclaration): string | null {
    if (!cs.display.includes("flex") && !cs.display.includes("grid")) return null;
    const rg = Math.round(parseFloat(cs.rowGap) || 0);
    const cg = Math.round(parseFloat(cs.columnGap) || 0);
    if (!rg && !cg) return null;
    return rg === cg ? `${rg}px` : `${rg}px ${cg}px`;
  }

  /** Copy the focused box's handle for handing to an agent. */
  function copyHandle() {
    const target = focusBox() ?? lastHoverBox;
    if (!target) return;
    const el = target.el;
    const name = nameOf(el);
    const cs = getComputedStyle(el);
    const facts = [`${Math.round(target.rect.width)}×${Math.round(target.rect.height)}`, displayOf(el)];
    const pad = paddingShorthand(cs);
    if (pad) facts.push(`padding ${pad}`);
    const gap = gapShorthand(cs);
    if (gap) facts.push(`gap ${gap}`);
    const text = `${name ? `"${name}" — ` : ""}${selectorFor(el)} (<${el.tagName.toLowerCase()}>)\n${facts.join(" · ")}`;
    navigator.clipboard?.writeText(text).then(() => flashCopied(target.rect)).catch(() => {});
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      drawSections();
    });
  }

  function onPointerMove(e: PointerEvent) {
    pointer = { x: e.clientX, y: e.clientY };
    hoverBox = boxAt(e.clientX, e.clientY);
    if (hoverBox) lastHoverBox = hoverBox;
    drawBoxModel();
    drawLabels();
    drawMeasure();
  }

  /** True for nodes the overlay itself owns (the root layer or the toolbar). */
  function ownNode(n: Node | null): boolean {
    if (!n) return false;
    if (root && (n === root || root.contains(n))) return true;
    if (tb && (n === tb.el || tb.el.contains(n))) return true;
    return false;
  }

  function enable() {
    if (enabled) return;
    enabled = true;
    root = document.createElement("div");
    root.setAttribute("data-devlines", "ignore");
    Object.assign(root.style, { position: "fixed", inset: "0", zIndex: String(Z), pointerEvents: "none" } as CSSStyleDeclaration);

    sectionsLayer = document.createElement("div");
    boxLayer = document.createElement("div");
    guidesLayer = buildGuides();
    labelsLayer = document.createElement("div");
    measureLayer = document.createElement("div");
    for (const l of [sectionsLayer, boxLayer, labelsLayer, measureLayer]) Object.assign(l.style, { position: "absolute", inset: "0" } as CSSStyleDeclaration);
    guidesLayer.style.display = guidesOn ? "" : "none";

    root.append(sectionsLayer, boxLayer, guidesLayer, labelsLayer, measureLayer);
    document.body.appendChild(root);

    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    window.addEventListener("pointermove", onPointerMove, true);
    ro = new ResizeObserver(schedule);
    ro.observe(document.documentElement);
    // watch the page, but never the overlay's own layers or the toolbar —
    // redrawing on our own mutations would loop the redraw every frame.
    mo = new MutationObserver((records) => {
      for (const rec of records) {
        if (ownNode(rec.target)) continue;
        if (rec.type === "childList") {
          const nodes = [...rec.addedNodes, ...rec.removedNodes];
          if (nodes.length && nodes.every((n) => ownNode(n))) continue;
        }
        schedule();
        return;
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });

    drawSections();
    if (opts.persist) try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    notify();
  }

  function disable() {
    if (!enabled) return;
    enabled = false;
    altDown = false;
    window.removeEventListener("scroll", schedule, true);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("pointermove", onPointerMove, true);
    ro?.disconnect();
    mo?.disconnect();
    ro = mo = null;
    pointer = hoverBox = lastHoverBox = null;
    lockedEl = null;
    lockedBox = null;
    root?.remove();
    root = sectionsLayer = boxLayer = guidesLayer = labelsLayer = measureLayer = null;
    boxes = [];
    if (opts.persist) try { localStorage.setItem(STORAGE_KEY, "0"); } catch {}
    notify();
  }

  function toggle() {
    enabled ? disable() : enable();
  }

  function cycleLabels(mode?: LabelMode) {
    const order: LabelMode[] = ["off", "hover", "all"];
    labels.mode = mode ?? order[(order.indexOf(labels.mode) + 1) % order.length];
    drawLabels();
    notify();
  }

  function toggleOutlines(on?: boolean) {
    outlinesOn = on ?? !outlinesOn;
    drawSections();
    notify();
  }

  function toggleGuides(on?: boolean) {
    guidesOn = on ?? !guidesOn;
    if (guidesLayer) guidesLayer.style.display = guidesOn ? "" : "none";
    drawLabels();
    notify();
  }

  function toggleBoxModel(on?: boolean) {
    boxModelOn = on ?? !boxModelOn;
    drawBoxModel();
    notify();
  }

  function update(next: Partial<DevLinesOptions>) {
    if (next.lineColor !== undefined) opts.lineColor = next.lineColor;
    if (next.paddingColor !== undefined) opts.paddingColor = next.paddingColor;
    if (next.measureColor !== undefined) opts.measureColor = next.measureColor;
    if (next.gapColor !== undefined) opts.gapColor = next.gapColor;
    if (next.depthColors !== undefined) depthColors = next.depthColors;
    if (next.contentWidth !== undefined) opts.contentWidth = next.contentWidth;
    if (next.paddingX !== undefined) opts.paddingX = next.paddingX;
    if (next.sectionSelector !== undefined) opts.sectionSelector = next.sectionSelector;
    if (next.nameAttr !== undefined) opts.nameAttr = next.nameAttr;
    if (next.autoName !== undefined) opts.autoName = next.autoName;
    if (next.labels !== undefined) Object.assign(labels, next.labels);
    if (next.boxModel !== undefined) boxModelOn = next.boxModel;
    // guides are built once; rebuild the layer so new colors/widths take effect.
    if (root && guidesLayer) {
      const fresh = buildGuides();
      fresh.style.display = guidesOn ? "" : "none";
      root.replaceChild(fresh, guidesLayer);
      guidesLayer = fresh;
    }
    drawSections();
    notify();
  }

  function typingInField() {
    const t = document.activeElement;
    return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || (t as HTMLElement).isContentEditable);
  }

  function matchesShortcut(e: KeyboardEvent, combo: string): boolean {
    const parts = combo.toLowerCase().split("+");
    const key = parts[parts.length - 1];
    const mod = e.metaKey || e.ctrlKey;
    return e.key.toLowerCase() === key && parts.includes("mod") === mod && parts.includes("shift") === e.shiftKey && parts.includes("alt") === e.altKey;
  }

  function onKey(e: KeyboardEvent) {
    if (typingInField()) return;
    if (opts.shortcut && matchesShortcut(e, opts.shortcut)) {
      e.preventDefault();
      toggle();
      return;
    }
    if (!enabled) return;
    if (e.key === "Alt" && !altDown) {
      altDown = true;
      drawMeasure();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "escape") {
      e.preventDefault();
      if (lockedEl) inspect(null);
      else disable();
    }
    else if (k === "o") { e.preventDefault(); toggleOutlines(); }
    else if (k === "g") { e.preventDefault(); toggleGuides(); }
    else if (opts.labelKey && k === opts.labelKey.toLowerCase()) { e.preventDefault(); cycleLabels(); }
    else if (opts.copyKey && k === opts.copyKey.toLowerCase()) { e.preventDefault(); copyHandle(); }
    else if (opts.inspectKey && k === opts.inspectKey.toLowerCase()) { e.preventDefault(); inspect(); }
    else if (opts.boxModelKey && k === opts.boxModelKey.toLowerCase()) { e.preventDefault(); toggleBoxModel(); }
    else if (lockedBox && (k === "arrowup" || k === "arrowdown" || k === "arrowleft" || k === "arrowright")) {
      e.preventDefault();
      navigate(k);
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.key === "Alt" && altDown) {
      altDown = false;
      drawMeasure();
    }
  }

  // Alt can't un-stick itself if focus leaves mid-hold (Alt+Tab) — the keyup
  // lands in another window, so release the measure overlay on blur.
  function onBlur() {
    if (altDown) {
      altDown = false;
      drawMeasure();
    }
  }

  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  if (opts.toolbar) {
    tb = mountToolbar({
      toggle,
      enable,
      toggleGuides,
      toggleOutlines,
      cycleLabels,
      copy: copyHandle,
      update,
      getState: () => ({ enabled, outlines: outlinesOn, guides: guidesOn, labels: labels.mode }),
      colors: () => ({ line: opts.lineColor, padding: opts.paddingColor, depth: depthColors }),
    });
  }

  let startOn = opts.start;
  if (opts.persist) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "1") startOn = true;
      else if (saved === "0") startOn = false;
    } catch {}
  }
  if (startOn) enable();

  return {
    enable,
    disable,
    toggle,
    isEnabled: () => enabled,
    cycleLabels,
    toggleOutlines,
    toggleGuides,
    toggleBoxModel,
    inspect,
    update,
    copy: copyHandle,
    getState: () => ({ enabled, outlines: outlinesOn, guides: guidesOn, labels: labels.mode, boxModel: boxModelOn, inspected: lockedEl }),
    refresh: drawSections,
    destroy() {
      disable();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      tb?.destroy();
      tb = null;
    },
  };
}

function noopController(): DevLinesController {
  return {
    enable() {}, disable() {}, toggle() {}, isEnabled: () => false,
    cycleLabels() {}, toggleOutlines() {}, toggleGuides() {}, toggleBoxModel() {}, inspect() {}, update() {}, copy() {},
    getState: () => ({ enabled: false, outlines: false, guides: false, labels: "off", boxModel: false, inspected: null }),
    refresh() {}, destroy() {},
  };
}
