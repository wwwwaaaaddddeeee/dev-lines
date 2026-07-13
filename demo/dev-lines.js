// src/toolbar.ts
var EASE = "cubic-bezier(0.215, 0.61, 0.355, 1)";
var STYLE = `
.dvl-toolbar { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); z-index: 2147483601;
  display: flex; align-items: center; gap: 2px; background: #fff; border: 1px solid #ececec;
  border-radius: 999px; padding: 5px; box-shadow: 0 6px 22px rgb(0 0 0 / .08);
  font-family: "Geist", system-ui, sans-serif; font-size: 15px; line-height: 1.5; letter-spacing: -0.01em; color: #0a0a0a; }
.dvl-toolbar, .dvl-toolbar * { box-sizing: border-box; }
.dvl-btn { all: unset; cursor: pointer; width: 28px; height: 28px; border-radius: 999px; position: relative;
  display: grid; place-items: center; color: #9ca3af; transition: background .12s, color .12s, transform .12s ${EASE}; }
.dvl-btn:hover { background: #fafafa; color: #6b7280; }
.dvl-btn:active { transform: scale(.92); }
.dvl-btn.active { background: rgb(113 113 122 / .12); color: rgb(113 113 122); }
.dvl-btn.dvl-power.active { background: rgb(113 113 122); color: #fff; }
.dvl-btn.dim { opacity: .35; pointer-events: none; }
.dvl-btn .dvl-dot { position: absolute; bottom: 3px; right: 4px; width: 4px; height: 4px; border-radius: 50%; background: rgb(113 113 122); display: none; }
.dvl-btn.active .dvl-dot { display: block; }
.dvl-sep { width: 1px; height: 18px; background: #ececec; margin: 0 3px; }
.dvl-menu { position: absolute; bottom: calc(100% + 7px); top: auto; left: 0; width: 222px; background: #fff;
  border: 1px solid #ececec; border-radius: 12px; box-shadow: 0 10px 28px rgb(0 0 0 / .12); padding: 12px;
  transform-origin: bottom left; animation: dvl-menu-in .18s ${EASE}; }
.dvl-menu[hidden] { display: none; }
@keyframes dvl-menu-in { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }
.dvl-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; font-size: 12px; color: #6b7280; }
.dvl-faint { color: #9ca3af; }
.dvl-seg { display: inline-flex; gap: 2px; background: #fafafa; border: 1px solid #ececec; border-radius: 7px; padding: 2px; }
.dvl-seg button { all: unset; cursor: pointer; font: 11px "Geist Mono", ui-monospace, monospace; padding: 2px 7px; border-radius: 5px; color: #9ca3af; }
.dvl-seg button.on { background: #fff; color: #0a0a0a; box-shadow: 0 1px 2px rgb(0 0 0 / .08); }
.dvl-sw { display: flex; gap: 5px; }
.dvl-sw input[type=color] { -webkit-appearance: none; appearance: none; width: 16px; height: 16px;
  border: none; border-radius: 4px; padding: 0; cursor: pointer; background: none; box-shadow: inset 0 0 0 1px rgb(0 0 0 / .12); }
.dvl-sw input[type=color]::-webkit-color-swatch-wrapper { padding: 0; }
.dvl-sw input[type=color]::-webkit-color-swatch { border: none; border-radius: 4px; }
.dvl-depth { flex-wrap: wrap; justify-content: flex-end; max-width: 156px; }
.dvl-keys { margin-top: 8px; padding-top: 9px; border-top: 1px solid #ececec; font: 11px/1.8 "Geist Mono", ui-monospace, monospace; color: #9ca3af; }
.dvl-keys b { color: #6b7280; font-weight: 600; }
`;
var ICONS = {
  power: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 2v6"/><path d="M4.4 4.4a5 5 0 1 0 7.2 0"/></svg>',
  guides: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1v14M1 8h14"/></svg>',
  outlines: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/></svg>',
  labels: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.6 6.4 7 2h6.5v6.5L9 13z"/><circle cx="10.4" cy="5.6" r="1" fill="currentColor" stroke="none"/></svg>',
  copy: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M3 10.5V3.5a1 1 0 0 1 1-1h7"/></svg>',
  more: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>'
};
var toTriplet = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16 & 255} ${n >> 8 & 255} ${n & 255}`;
};
var toHex = (triplet) => "#" + triplet.trim().split(/\s+/).map((x) => (+x).toString(16).padStart(2, "0")).join("");
function mountToolbar(api) {
  const style = document.createElement("style");
  style.setAttribute("data-devlines-toolbar", "");
  style.textContent = STYLE;
  document.head.appendChild(style);
  const el = document.createElement("div");
  el.className = "dvl-toolbar";
  el.setAttribute("data-devlines", "ignore");
  el.innerHTML = `
    <button class="dvl-btn dvl-power" title="Toggle dev-lines (\u2318/Ctrl+Shift+L)">${ICONS.power}</button>
    <span class="dvl-sep"></span>
    <button class="dvl-btn dvl-guides" title="Guides (G)">${ICONS.guides}</button>
    <button class="dvl-btn dvl-outlines" title="Outlines (O)">${ICONS.outlines}</button>
    <button class="dvl-btn dvl-labels" title="Labels (L)">${ICONS.labels}<span class="dvl-dot"></span></button>
    <button class="dvl-btn dvl-copy" title="Copy handle (C)">${ICONS.copy}</button>
    <span class="dvl-sep"></span>
    <button class="dvl-btn dvl-more" title="Settings">${ICONS.more}</button>
    <div class="dvl-menu" hidden>
      <div class="dvl-row"><span>Labels</span>
        <span class="dvl-seg">
          <button data-mode="off">off</button><button data-mode="hover">hover</button><button data-mode="all">all</button>
        </span>
      </div>
      <div class="dvl-row"><span>Distances</span><span class="dvl-faint">hold Alt</span></div>
      <div class="dvl-row"><span>Guide colors</span><span class="dvl-sw">
        <input type="color" class="dvl-c-line" title="Center &amp; width" />
        <input type="color" class="dvl-c-pad" title="Padding" />
      </span></div>
      <div class="dvl-row"><span>Depth palette</span><span class="dvl-sw dvl-depth"></span></div>
      <div class="dvl-keys"><b>O</b> outlines \xB7 <b>G</b> guides \xB7 <b>L</b> labels \xB7 <b>I</b> inspect \xB7 <b>B</b> boxes \xB7 <b>C</b> copy \xB7 <b>Alt</b> dist \xB7 <b>Esc</b> off</div>
    </div>`;
  document.body.appendChild(el);
  const q = (sel) => el.querySelector(sel);
  const power = q(".dvl-power");
  const guides = q(".dvl-guides");
  const outlines = q(".dvl-outlines");
  const labels = q(".dvl-labels");
  const copy = q(".dvl-copy");
  const more = q(".dvl-more");
  const menu = q(".dvl-menu");
  const seg = q(".dvl-seg");
  const cLine = q(".dvl-c-line");
  const cPad = q(".dvl-c-pad");
  const cDepth = q(".dvl-depth");
  const ensureOn = () => {
    if (!api.getState().enabled) api.enable();
  };
  function sync() {
    const s = api.getState();
    power.classList.toggle("active", s.enabled);
    guides.classList.toggle("active", s.enabled && s.guides);
    outlines.classList.toggle("active", s.enabled && s.outlines);
    labels.classList.toggle("active", s.enabled && s.labels !== "off");
    labels.title = "Labels: " + s.labels + " (L)";
    for (const b of [guides, outlines, labels, copy]) b.classList.toggle("dim", !s.enabled);
    seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.mode === s.labels));
  }
  power.addEventListener("click", () => api.toggle());
  guides.addEventListener("click", () => {
    ensureOn();
    api.toggleGuides();
  });
  outlines.addEventListener("click", () => {
    ensureOn();
    api.toggleOutlines();
  });
  labels.addEventListener("click", () => {
    ensureOn();
    api.cycleLabels();
  });
  copy.addEventListener("click", () => {
    ensureOn();
    api.copy();
  });
  more.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
  });
  seg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    ensureOn();
    api.cycleLabels(b.dataset.mode);
  }));
  const palette = api.colors();
  cLine.value = toHex(palette.line);
  cPad.value = toHex(palette.padding);
  for (const t of palette.depth) {
    const input = document.createElement("input");
    input.type = "color";
    input.value = toHex(t);
    cDepth.appendChild(input);
  }
  cLine.addEventListener("input", () => {
    ensureOn();
    api.update({ lineColor: toTriplet(cLine.value) });
  });
  cPad.addEventListener("input", () => {
    ensureOn();
    api.update({ paddingColor: toTriplet(cPad.value) });
  });
  cDepth.addEventListener("input", () => {
    ensureOn();
    api.update({ depthColors: Array.from(cDepth.querySelectorAll("input"), (i) => toTriplet(i.value)) });
  });
  const onDocClick = (e) => {
    if (!el.contains(e.target)) menu.hidden = true;
  };
  document.addEventListener("click", onDocClick);
  sync();
  return {
    el,
    sync,
    destroy() {
      document.removeEventListener("click", onDocClick);
      el.remove();
      style.remove();
    }
  };
}

// src/index.ts
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
  gapColor: "138 224 108",
  // #8ae06c green
  sections: true,
  shortcut: "mod+shift+l",
  labelKey: "l",
  copyKey: "c",
  inspectKey: "i",
  boxModel: true,
  boxModelKey: "b",
  toolbar: false,
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
  let boxLayer = null;
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
  let lockedEl = null;
  let lockedBox = null;
  let tb = null;
  let outlinesOn = opts.sections;
  let guidesOn = true;
  let boxModelOn = opts.boxModel;
  let altDown = false;
  const rgba = (t, a) => `rgb(${t} / ${a})`;
  const colorForDepth = (d) => depthColors[Math.min(d, depthColors.length - 1)];
  const notify = () => tb?.sync();
  const focusBox = () => lockedBox ?? hoverBox;
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
        boxShadow: locked ? `inset 0 0 0 1.5px ${rgba(color, 1)}, 0 0 0 1px ${rgba(color, 0.3)}` : `inset 0 0 0 1px ${rgba(color, 0.6)}`
      });
      sectionsLayer.appendChild(box);
    }
    hoverBox = pointer ? boxAt(pointer.x, pointer.y) : null;
    drawBoxModel();
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
  function displayOf(el) {
    const d = getComputedStyle(el).display;
    return d.includes("grid") ? "grid" : d.includes("flex") ? "flex" : d;
  }
  function labelText(el, depth, rect) {
    const parts = [];
    for (const f of labels.show) {
      if (f === "name") {
        const nm = nameOf(el);
        if (nm) parts.push(nm);
      } else if (f === "tag") parts.push(`<${el.tagName.toLowerCase()}>`);
      else if (f === "size") parts.push(`${Math.round(rect.width)}\xD7${Math.round(rect.height)}`);
      else if (f === "display") parts.push(displayOf(el));
      else if (f === "depth") parts.push(`d${depth}`);
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
  function parentBoxOf(target) {
    let best = null;
    for (const b of boxes) {
      if (b === target || !b.el.contains(target.el)) continue;
      if (!best || best.el.contains(b.el)) best = b;
    }
    return best;
  }
  function childBoxesOf(target) {
    return boxes.filter((b) => b !== target && target.el.contains(b.el) && parentBoxOf(b) === target);
  }
  function navigate(key) {
    const cur = lockedBox;
    if (!cur) return;
    let next = null;
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
  function inspect(el) {
    if (el === void 0) {
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
    } else {
      if (lockedBox) labelsLayer.appendChild(chip(labelText(lockedBox.el, lockedBox.depth, lockedBox.rect), colorForDepth(lockedBox.depth), lockedBox.rect.left, lockedBox.rect.top));
      if (labels.mode === "hover" && hoverBox && hoverBox !== lockedBox) {
        labelsLayer.appendChild(chip(labelText(hoverBox.el, hoverBox.depth, hoverBox.rect), colorForDepth(hoverBox.depth), hoverBox.rect.left, hoverBox.rect.top));
      }
    }
  }
  function drawBoxModel() {
    if (!boxLayer) return;
    boxLayer.replaceChildren();
    const b = focusBox();
    if (!boxModelOn || !outlinesOn || !b) return;
    const r = b.rect;
    const cs = getComputedStyle(b.el);
    const band = (x, y, w, h, color, alpha) => {
      if (w < 0.5 || h < 0.5) return;
      boxLayer.appendChild(line({ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, background: rgba(color, alpha) }));
    };
    const pt = parseFloat(cs.paddingTop) || 0, pr = parseFloat(cs.paddingRight) || 0, pb = parseFloat(cs.paddingBottom) || 0, pl = parseFloat(cs.paddingLeft) || 0;
    band(r.left, r.top, r.width, pt, opts.paddingColor, 0.16);
    band(r.left, r.bottom - pb, r.width, pb, opts.paddingColor, 0.16);
    band(r.left, r.top + pt, pl, r.height - pt - pb, opts.paddingColor, 0.16);
    band(r.right - pr, r.top + pt, pr, r.height - pt - pb, opts.paddingColor, 0.16);
    if (!cs.display.includes("flex") && !cs.display.includes("grid")) return;
    const rowGap = parseFloat(cs.rowGap) || 0;
    const colGap = parseFloat(cs.columnGap) || 0;
    if (rowGap < 1 && colGap < 1) return;
    const kids = [];
    for (const k of b.el.children) {
      if (k.getAttribute("data-devlines") === "ignore") continue;
      const kr = k.getBoundingClientRect();
      if (kr.width > 0 && kr.height > 0) kids.push(kr);
    }
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
    const target = focusBox();
    if (!altDown || !target || !outlinesOn) return;
    const t = target.rect;
    const anc = ancestorOf(target);
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
  function paddingShorthand(cs) {
    const v = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map((s) => `${Math.round(parseFloat(s) || 0)}px`);
    if (v.every((s) => s === "0px")) return null;
    if (v[0] === v[1] && v[1] === v[2] && v[2] === v[3]) return v[0];
    if (v[0] === v[2] && v[1] === v[3]) return `${v[0]} ${v[1]}`;
    return v.join(" ");
  }
  function gapShorthand(cs) {
    if (!cs.display.includes("flex") && !cs.display.includes("grid")) return null;
    const rg = Math.round(parseFloat(cs.rowGap) || 0);
    const cg = Math.round(parseFloat(cs.columnGap) || 0);
    if (!rg && !cg) return null;
    return rg === cg ? `${rg}px` : `${rg}px ${cg}px`;
  }
  function copyHandle() {
    const target = focusBox() ?? lastHoverBox;
    if (!target) return;
    const el = target.el;
    const name = nameOf(el);
    const cs = getComputedStyle(el);
    const facts = [`${Math.round(target.rect.width)}\xD7${Math.round(target.rect.height)}`, displayOf(el)];
    const pad = paddingShorthand(cs);
    if (pad) facts.push(`padding ${pad}`);
    const gap = gapShorthand(cs);
    if (gap) facts.push(`gap ${gap}`);
    const text = `${name ? `"${name}" \u2014 ` : ""}${selectorFor(el)} (<${el.tagName.toLowerCase()}>)
${facts.join(" \xB7 ")}`;
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
    drawBoxModel();
    drawLabels();
    drawMeasure();
  }
  function ownNode(n) {
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
    Object.assign(root.style, { position: "fixed", inset: "0", zIndex: String(Z), pointerEvents: "none" });
    sectionsLayer = document.createElement("div");
    boxLayer = document.createElement("div");
    guidesLayer = buildGuides();
    labelsLayer = document.createElement("div");
    measureLayer = document.createElement("div");
    for (const l of [sectionsLayer, boxLayer, labelsLayer, measureLayer]) Object.assign(l.style, { position: "absolute", inset: "0" });
    guidesLayer.style.display = guidesOn ? "" : "none";
    root.append(sectionsLayer, boxLayer, guidesLayer, labelsLayer, measureLayer);
    document.body.appendChild(root);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    window.addEventListener("pointermove", onPointerMove, true);
    ro = new ResizeObserver(schedule);
    ro.observe(document.documentElement);
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
    if (opts.persist) try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
    }
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
    if (opts.persist) try {
      localStorage.setItem(STORAGE_KEY, "0");
    } catch {
    }
    notify();
  }
  function toggle() {
    enabled ? disable() : enable();
  }
  function cycleLabels(mode) {
    const order = ["off", "hover", "all"];
    labels.mode = mode ?? order[(order.indexOf(labels.mode) + 1) % order.length];
    drawLabels();
    notify();
  }
  function toggleOutlines(on) {
    outlinesOn = on ?? !outlinesOn;
    drawSections();
    notify();
  }
  function toggleGuides(on) {
    guidesOn = on ?? !guidesOn;
    if (guidesLayer) guidesLayer.style.display = guidesOn ? "" : "none";
    drawLabels();
    notify();
  }
  function toggleBoxModel(on) {
    boxModelOn = on ?? !boxModelOn;
    drawBoxModel();
    notify();
  }
  function update(next) {
    if (next.lineColor !== void 0) opts.lineColor = next.lineColor;
    if (next.paddingColor !== void 0) opts.paddingColor = next.paddingColor;
    if (next.measureColor !== void 0) opts.measureColor = next.measureColor;
    if (next.gapColor !== void 0) opts.gapColor = next.gapColor;
    if (next.depthColors !== void 0) depthColors = next.depthColors;
    if (next.contentWidth !== void 0) opts.contentWidth = next.contentWidth;
    if (next.paddingX !== void 0) opts.paddingX = next.paddingX;
    if (next.sectionSelector !== void 0) opts.sectionSelector = next.sectionSelector;
    if (next.nameAttr !== void 0) opts.nameAttr = next.nameAttr;
    if (next.autoName !== void 0) opts.autoName = next.autoName;
    if (next.labels !== void 0) Object.assign(labels, next.labels);
    if (next.boxModel !== void 0) boxModelOn = next.boxModel;
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
      if (lockedEl) inspect(null);
      else disable();
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
    } else if (opts.inspectKey && k === opts.inspectKey.toLowerCase()) {
      e.preventDefault();
      inspect();
    } else if (opts.boxModelKey && k === opts.boxModelKey.toLowerCase()) {
      e.preventDefault();
      toggleBoxModel();
    } else if (lockedBox && (k === "arrowup" || k === "arrowdown" || k === "arrowleft" || k === "arrowright")) {
      e.preventDefault();
      navigate(k);
    }
  }
  function onKeyUp(e) {
    if (e.key === "Alt" && altDown) {
      altDown = false;
      drawMeasure();
    }
  }
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
      colors: () => ({ line: opts.lineColor, padding: opts.paddingColor, depth: depthColors })
    });
  }
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
    toggleBoxModel() {
    },
    inspect() {
    },
    update() {
    },
    copy() {
    },
    getState: () => ({ enabled: false, outlines: false, guides: false, labels: "off", boxModel: false, inspected: null }),
    refresh() {
    },
    destroy() {
    }
  };
}
export {
  createDevLines
};
