// packages/core/src/index.ts
var STORAGE_KEY = "dev-lines:enabled";
var Z = 2147483600;
var DEFAULT_DEPTH_COLORS = [
  "29 29 29",
  // #1d1d1d neutral (graphite)
  "155 164 183",
  // #9ba4b7 neutral (gray)
  "167 125 255",
  // #a77dff purple
  "245 104 104",
  // #f56868 coral
  "237 139 0",
  // #ed8b00 orange
  "241 223 56",
  // #f1df38 yellow
  "138 224 108"
  // #8ae06c green
];
var DEFAULTS = {
  lineColor: "245 104 104",
  // #f56868 coral
  paddingColor: "167 125 255",
  // #a77dff purple
  measureColor: "237 139 0",
  // #ed8b00 orange
  sections: true,
  shortcut: "mod+shift+l",
  labelKey: "l",
  copyKey: "c",
  nameAttr: "data-devlines-name",
  autoName: true,
  persist: true,
  start: false
};
var DEFAULT_LABELS = {
  mode: "hover",
  show: ["name", "tag", "size", "display"],
  guides: true
};
var isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
function createDevLines(options = {}) {
  if (!isBrowser) return noopController();
  const opts = { ...DEFAULTS, ...options };
  let depthColors = options.depthColors ?? DEFAULT_DEPTH_COLORS;
  const labels = { ...DEFAULT_LABELS, ...options.labels };
  let enabled = false;
  let root = null;
  let sectionsLayer = null;
  let guidesLayer = null;
  let labelsLayer = null;
  let measureLayer = null;
  let scheduled = false;
  let ro = null;
  let mo = null;
  let boxes = [];
  let pointer = null;
  let hoverBox = null;
  let lastHoverBox = null;
  let outlinesOn = opts.sections;
  let guidesOn = true;
  let altDown = false;
  const rgba = (t, a) => `rgb(${t} / ${a})`;
  const colorForDepth = (d) => depthColors[Math.min(d, depthColors.length - 1)];
  function line(css) {
    const el = document.createElement("div");
    Object.assign(el.style, { position: "absolute", ...css });
    return el;
  }
  function chip(text, colorTriplet, left, top) {
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
      transform: "translateZ(0)"
    });
    return el;
  }
  function buildGuides() {
    const layer = document.createElement("div");
    Object.assign(layer.style, { position: "absolute", inset: "0" });
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
  function isContainer(el) {
    if (el.getAttribute("data-devlines") === "outline") return true;
    const display = getComputedStyle(el).display;
    return display.includes("flex") || display.includes("grid");
  }
  function collect() {
    const out = [];
    const walk = (el, depth) => {
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
          boxShadow: `inset 0 0 0 1px ${rgba(color, 0.6)}`
        });
        sectionsLayer.appendChild(box);
      }
    }
    hoverBox = pointer ? boxAt(pointer.x, pointer.y) : null;
    drawLabels();
    drawMeasure();
  }
  function nameOf(el) {
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
    if (t) return t.length > 24 ? t.slice(0, 24) + "\u2026" : t;
    return null;
  }
  function selectorFor(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let node = el;
    while (node && node !== document.body) {
      const cur = node;
      if (cur.id) {
        parts.unshift(`#${CSS.escape(cur.id)}`);
        break;
      }
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
  function labelText(el, depth, rect) {
    const parts = [];
    for (const f of labels.show) {
      if (f === "name") {
        const nm = nameOf(el);
        if (nm) parts.push(nm);
      } else if (f === "tag") parts.push(`<${el.tagName.toLowerCase()}>`);
      else if (f === "size") parts.push(`${Math.round(rect.width)}\xD7${Math.round(rect.height)}`);
      else if (f === "display") {
        const d = getComputedStyle(el).display;
        parts.push(d.includes("grid") ? "grid" : d.includes("flex") ? "flex" : d);
      } else if (f === "depth") parts.push(`d${depth}`);
    }
    return parts.join(" \xB7 ");
  }
  function boxAt(x, y) {
    let best = null;
    for (const b of boxes) {
      const r = b.rect;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        if (!best || b.depth > best.depth) best = b;
      }
    }
    return best;
  }
  function ancestorOf(target) {
    let best = null;
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
        labelsLayer.appendChild(chip(`\u2212${Math.round(half)}`, opts.lineColor, cx - half + 4, 22));
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
  function measureSeg(x1, y1, x2, y2, value) {
    if (!measureLayer || value < 1) return;
    const horizontal = y1 === y2;
    measureLayer.appendChild(line({
      left: `${Math.min(x1, x2)}px`,
      top: `${Math.min(y1, y2)}px`,
      width: horizontal ? `${Math.abs(x2 - x1)}px` : "1px",
      height: horizontal ? "1px" : `${Math.abs(y2 - y1)}px`,
      background: rgba(opts.measureColor, 0.9)
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
    measureSeg(midX, c.top, midX, t.top, t.top - c.top);
    measureSeg(midX, t.bottom, midX, c.bottom, c.bottom - t.bottom);
    measureSeg(c.left, midY, t.left, midY, t.left - c.left);
    measureSeg(t.right, midY, c.right, midY, c.right - t.right);
  }
  function flashCopied(rect) {
    if (!root) return;
    const el = chip("copied \u2713", "34 197 94", rect.left, rect.top - 2);
    root.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
  function copyHandle() {
    const target = hoverBox ?? lastHoverBox;
    if (!target) return;
    const el = target.el;
    const name = nameOf(el);
    const text = `${name ? `"${name}" \u2014 ` : ""}${selectorFor(el)} (<${el.tagName.toLowerCase()}>)`;
    navigator.clipboard?.writeText(text).then(() => flashCopied(target.rect)).catch(() => {
    });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      drawSections();
    });
  }
  function onPointerMove(e) {
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
    Object.assign(root.style, { position: "fixed", inset: "0", zIndex: String(Z), pointerEvents: "none" });
    sectionsLayer = document.createElement("div");
    guidesLayer = buildGuides();
    labelsLayer = document.createElement("div");
    measureLayer = document.createElement("div");
    for (const l of [sectionsLayer, labelsLayer, measureLayer]) Object.assign(l.style, { position: "absolute", inset: "0" });
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
    if (opts.persist) try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
    }
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
    if (opts.persist) try {
      localStorage.setItem(STORAGE_KEY, "0");
    } catch {
    }
  }
  function toggle() {
    enabled ? disable() : enable();
  }
  function cycleLabels(mode) {
    const order = ["off", "hover", "all"];
    labels.mode = mode ?? order[(order.indexOf(labels.mode) + 1) % order.length];
    drawLabels();
  }
  function toggleOutlines(on) {
    outlinesOn = on ?? !outlinesOn;
    drawSections();
  }
  function toggleGuides(on) {
    guidesOn = on ?? !guidesOn;
    if (guidesLayer) guidesLayer.style.display = guidesOn ? "" : "none";
    drawLabels();
  }
  function update(next) {
    if (next.lineColor !== void 0) opts.lineColor = next.lineColor;
    if (next.paddingColor !== void 0) opts.paddingColor = next.paddingColor;
    if (next.measureColor !== void 0) opts.measureColor = next.measureColor;
    if (next.depthColors !== void 0) depthColors = next.depthColors;
    if (next.contentWidth !== void 0) opts.contentWidth = next.contentWidth;
    if (next.paddingX !== void 0) opts.paddingX = next.paddingX;
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
    return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  }
  function matchesShortcut(e, combo) {
    const parts = combo.toLowerCase().split("+");
    const key = parts[parts.length - 1];
    const mod = e.metaKey || e.ctrlKey;
    return e.key.toLowerCase() === key && parts.includes("mod") === mod && parts.includes("shift") === e.shiftKey && parts.includes("alt") === e.altKey;
  }
  function onKey(e) {
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
      disable();
    } else if (k === "o") {
      e.preventDefault();
      toggleOutlines();
    } else if (k === "g") {
      e.preventDefault();
      toggleGuides();
    } else if (opts.labelKey && k === opts.labelKey.toLowerCase()) {
      e.preventDefault();
      cycleLabels();
    } else if (opts.copyKey && k === opts.copyKey.toLowerCase()) {
      e.preventDefault();
      copyHandle();
    }
  }
  function onKeyUp(e) {
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
    } catch {
    }
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
    }
  };
}
function noopController() {
  return {
    enable() {
    },
    disable() {
    },
    toggle() {
    },
    isEnabled: () => false,
    cycleLabels() {
    },
    toggleOutlines() {
    },
    toggleGuides() {
    },
    update() {
    },
    copy() {
    },
    getState: () => ({ enabled: false, outlines: false, guides: false, labels: "off" }),
    refresh() {
    },
    destroy() {
    }
  };
}
export {
  createDevLines
};
