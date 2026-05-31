/**
 * @dev-lines/core — a framework-agnostic layout debug overlay.
 *
 * Draws, on top of any page, without mutating it:
 *  - a viewport center cross (vertical + horizontal)
 *  - optional content-width edges (center ± contentWidth/2)
 *  - optional padding edges (paddingX in from each side)
 *  - depth-colored outlines around layout containers (flex/grid)
 *  - labels: per-box chips (tag · size · layout · custom name) and guide readouts
 *  - hold Alt: spacing overlay from the hovered box to its containing box
 *
 * Everything lives in one fixed overlay layer with pointer-events: none, so the
 * host app is never touched and teardown is total.
 *
 * Commands (when enabled): O toggle outlines · G toggle guides · L cycle labels ·
 * Esc disable · hold Alt for distances. Toggle the overlay with mod+shift+L.
 */

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
  depthColors?: string[];
  sections?: boolean;
  sectionSelector?: string;
  labels?: LabelOptions;
  /** Attribute read for a box's explicit name. Default "data-devlines-name". */
  nameAttr?: string;
  /** Derive a name (id → aria-label → data-component/testid → heading) when none is set. Default true. */
  autoName?: boolean;
  /** Key to copy the hovered box's handle (name · selector · tag) for handing to an agent. Default "c". */
  copyKey?: string | null;
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
  /** Live-update visual options (colors, contentWidth, paddingX) and redraw. */
  update(options: Partial<DevLinesOptions>): void;
  /** Copy the hovered (or last-hovered) box's handle for agent handoff. */
  copy(): void;
  getState(): { enabled: boolean; outlines: boolean; guides: boolean; labels: LabelMode };
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
  sections: true,
  shortcut: "mod+shift+l" as string | null,
  labelKey: "l" as string | null,
  copyKey: "c" as string | null,
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

  let enabled = false;
  let root: HTMLDivElement | null = null;
  let sectionsLayer: HTMLDivElement | null = null;
  let guidesLayer: HTMLDivElement | null = null;
  let labelsLayer: HTMLDivElement | null = null;
  let measureLayer: HTMLDivElement | null = null;
  let scheduled = false;
  let ro: ResizeObserver | null = null;
  let mo: MutationObserver | null = null;
  let boxes: { el: Element; depth: number; rect: DOMRect }[] = [];
  let pointer: { x: number; y: number } | null = null;
  let hoverBox: (typeof boxes)[number] | null = null;
  let lastHoverBox: (typeof boxes)[number] | null = null;

  // runtime layer toggles
  let outlinesOn = opts.sections;
  let guidesOn = true;
  let altDown = false;

  const rgba = (t: string, a: number) => `rgb(${t} / ${a})`;
  // clamp to the last color beyond the palette length (max-N colors, no cycling)
  const colorForDepth = (d: number) => depthColors[Math.min(d, depthColors.length - 1)];

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
      if (el === root || el.getAttribute("data-devlines") === "ignore") return;
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
        const color = colorForDepth(depth);
        const box = document.createElement("div");
        Object.assign(box.style, {
          position: "absolute",
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          boxShadow: `inset 0 0 0 1px ${rgba(color, 0.6)}`,
        } as CSSStyleDeclaration);
        sectionsLayer.appendChild(box);
      }
    }
    hoverBox = pointer ? boxAt(pointer.x, pointer.y) : null;
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

  function labelText(el: Element, depth: number, rect: DOMRect): string {
    const parts: string[] = [];
    for (const f of labels.show) {
      if (f === "name") {
        const nm = nameOf(el);
        if (nm) parts.push(nm);
      } else if (f === "tag") parts.push(`<${el.tagName.toLowerCase()}>`);
      else if (f === "size") parts.push(`${Math.round(rect.width)}×${Math.round(rect.height)}`);
      else if (f === "display") {
        const d = getComputedStyle(el).display;
        parts.push(d.includes("grid") ? "grid" : d.includes("flex") ? "flex" : d);
      } else if (f === "depth") parts.push(`d${depth}`);
    }
    return parts.join(" · ");
  }

  function boxAt(x: number, y: number) {
    let best: (typeof boxes)[number] | null = null;
    for (const b of boxes) {
      const r = b.rect;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        if (!best || b.depth > best.depth) best = b;
      }
    }
    return best;
  }

  /** Closest containing box of lower depth, or null (→ viewport). */
  function ancestorOf(target: (typeof boxes)[number]) {
    let best: (typeof boxes)[number] | null = null;
    for (const b of boxes) {
      if (b === target || b.depth >= target.depth) continue;
      const r = b.rect, t = target.rect;
      if (r.left <= t.left && r.top <= t.top && r.right >= t.right && r.bottom >= t.bottom) {
        if (!best || b.depth > best.depth) best = b;
      }
    }
    return best;
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
    } else if (labels.mode === "hover" && hoverBox) {
      labelsLayer.appendChild(chip(labelText(hoverBox.el, hoverBox.depth, hoverBox.rect), colorForDepth(hoverBox.depth), hoverBox.rect.left, hoverBox.rect.top));
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
    if (!altDown || !hoverBox || !outlinesOn) return;
    const t = hoverBox.rect;
    const anc = ancestorOf(hoverBox);
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

  /** Copy the hovered box's handle for handing to an agent. */
  function copyHandle() {
    const target = hoverBox ?? lastHoverBox;
    if (!target) return;
    const el = target.el;
    const name = nameOf(el);
    const text = `${name ? `"${name}" — ` : ""}${selectorFor(el)} (<${el.tagName.toLowerCase()}>)`;
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
    drawLabels();
    drawMeasure();
  }

  function enable() {
    if (enabled) return;
    enabled = true;
    root = document.createElement("div");
    root.setAttribute("data-devlines", "ignore");
    Object.assign(root.style, { position: "fixed", inset: "0", zIndex: String(Z), pointerEvents: "none" } as CSSStyleDeclaration);

    sectionsLayer = document.createElement("div");
    guidesLayer = buildGuides();
    labelsLayer = document.createElement("div");
    measureLayer = document.createElement("div");
    for (const l of [sectionsLayer, labelsLayer, measureLayer]) Object.assign(l.style, { position: "absolute", inset: "0" } as CSSStyleDeclaration);
    guidesLayer.style.display = guidesOn ? "" : "none";

    root.append(sectionsLayer, guidesLayer, labelsLayer, measureLayer);
    document.body.appendChild(root);

    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    window.addEventListener("pointermove", onPointerMove, true);
    ro = new ResizeObserver(schedule);
    ro.observe(document.documentElement);
    mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });

    drawSections();
    if (opts.persist) try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
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
    root?.remove();
    root = sectionsLayer = guidesLayer = labelsLayer = measureLayer = null;
    boxes = [];
    if (opts.persist) try { localStorage.setItem(STORAGE_KEY, "0"); } catch {}
  }

  function toggle() {
    enabled ? disable() : enable();
  }

  function cycleLabels(mode?: LabelMode) {
    const order: LabelMode[] = ["off", "hover", "all"];
    labels.mode = mode ?? order[(order.indexOf(labels.mode) + 1) % order.length];
    drawLabels();
  }

  function toggleOutlines(on?: boolean) {
    outlinesOn = on ?? !outlinesOn;
    drawSections();
  }

  function toggleGuides(on?: boolean) {
    guidesOn = on ?? !guidesOn;
    if (guidesLayer) guidesLayer.style.display = guidesOn ? "" : "none";
    drawLabels();
  }

  function update(next: Partial<DevLinesOptions>) {
    if (next.lineColor !== undefined) opts.lineColor = next.lineColor;
    if (next.paddingColor !== undefined) opts.paddingColor = next.paddingColor;
    if (next.measureColor !== undefined) opts.measureColor = next.measureColor;
    if (next.depthColors !== undefined) depthColors = next.depthColors;
    if (next.contentWidth !== undefined) opts.contentWidth = next.contentWidth;
    if (next.paddingX !== undefined) opts.paddingX = next.paddingX;
    // guides are built once; rebuild the layer so new colors/widths take effect.
    if (root && guidesLayer) {
      const fresh = buildGuides();
      fresh.style.display = guidesOn ? "" : "none";
      root.replaceChild(fresh, guidesLayer);
      guidesLayer = fresh;
    }
    drawSections();
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
    if (k === "escape") { e.preventDefault(); disable(); }
    else if (k === "o") { e.preventDefault(); toggleOutlines(); }
    else if (k === "g") { e.preventDefault(); toggleGuides(); }
    else if (opts.labelKey && k === opts.labelKey.toLowerCase()) { e.preventDefault(); cycleLabels(); }
    else if (opts.copyKey && k === opts.copyKey.toLowerCase()) { e.preventDefault(); copyHandle(); }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.key === "Alt" && altDown) {
      altDown = false;
      drawMeasure();
    }
  }

  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKeyUp);

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
    update,
    copy: copyHandle,
    getState: () => ({ enabled, outlines: outlinesOn, guides: guidesOn, labels: labels.mode }),
    refresh: drawSections,
    destroy() {
      disable();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}

function noopController(): DevLinesController {
  return {
    enable() {}, disable() {}, toggle() {}, isEnabled: () => false,
    cycleLabels() {}, toggleOutlines() {}, toggleGuides() {}, update() {}, copy() {},
    getState: () => ({ enabled: false, outlines: false, guides: false, labels: "off" }),
    refresh() {}, destroy() {},
  };
}
