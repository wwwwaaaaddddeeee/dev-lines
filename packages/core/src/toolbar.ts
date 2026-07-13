/**
 * The on-page toolbar pill — power · guides · outlines · labels · copy · settings —
 * ported 1:1 from the lines.wiki landing design. Opt in with `toolbar: true`.
 *
 * Lives OUTSIDE the overlay root: it must accept pointer events and survive
 * disable(). Marked data-devlines="ignore" so it is never outlined, and the
 * engine's MutationObserver skips it so toolbar state changes never reflow
 * the overlay.
 */
import type { LabelMode } from "./index";

export interface ToolbarAPI {
  toggle(): void;
  enable(): void;
  toggleGuides(): void;
  toggleOutlines(): void;
  cycleLabels(mode?: LabelMode): void;
  copy(): void;
  update(next: { lineColor?: string; paddingColor?: string; depthColors?: string[] }): void;
  getState(): { enabled: boolean; outlines: boolean; guides: boolean; labels: LabelMode };
  colors(): { line: string; padding: string; depth: string[] };
}

export interface ToolbarHandle {
  el: HTMLElement;
  sync(): void;
  destroy(): void;
}

const EASE = "cubic-bezier(0.215, 0.61, 0.355, 1)";

const STYLE = `
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

const ICONS = {
  power: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 2v6"/><path d="M4.4 4.4a5 5 0 1 0 7.2 0"/></svg>',
  guides: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1v14M1 8h14"/></svg>',
  outlines: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/></svg>',
  labels: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.6 6.4 7 2h6.5v6.5L9 13z"/><circle cx="10.4" cy="5.6" r="1" fill="currentColor" stroke="none"/></svg>',
  copy: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M3 10.5V3.5a1 1 0 0 1 1-1h7"/></svg>',
  more: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>',
};

const toTriplet = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};
const toHex = (triplet: string) =>
  "#" + triplet.trim().split(/\s+/).map((x) => (+x).toString(16).padStart(2, "0")).join("");

export function mountToolbar(api: ToolbarAPI): ToolbarHandle {
  const style = document.createElement("style");
  style.setAttribute("data-devlines-toolbar", "");
  style.textContent = STYLE;
  document.head.appendChild(style);

  const el = document.createElement("div");
  el.className = "dvl-toolbar";
  el.setAttribute("data-devlines", "ignore");
  el.innerHTML = `
    <button class="dvl-btn dvl-power" title="Toggle dev-lines (⌘/Ctrl+Shift+L)">${ICONS.power}</button>
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
      <div class="dvl-keys"><b>O</b> outlines · <b>G</b> guides · <b>L</b> labels · <b>I</b> inspect · <b>B</b> boxes · <b>C</b> copy · <b>Alt</b> dist · <b>Esc</b> off</div>
    </div>`;
  document.body.appendChild(el);

  const q = <T extends HTMLElement>(sel: string) => el.querySelector(sel) as T;
  const power = q<HTMLButtonElement>(".dvl-power");
  const guides = q<HTMLButtonElement>(".dvl-guides");
  const outlines = q<HTMLButtonElement>(".dvl-outlines");
  const labels = q<HTMLButtonElement>(".dvl-labels");
  const copy = q<HTMLButtonElement>(".dvl-copy");
  const more = q<HTMLButtonElement>(".dvl-more");
  const menu = q<HTMLDivElement>(".dvl-menu");
  const seg = q<HTMLSpanElement>(".dvl-seg");
  const cLine = q<HTMLInputElement>(".dvl-c-line");
  const cPad = q<HTMLInputElement>(".dvl-c-pad");
  const cDepth = q<HTMLSpanElement>(".dvl-depth");

  const ensureOn = () => { if (!api.getState().enabled) api.enable(); };

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
  guides.addEventListener("click", () => { ensureOn(); api.toggleGuides(); });
  outlines.addEventListener("click", () => { ensureOn(); api.toggleOutlines(); });
  labels.addEventListener("click", () => { ensureOn(); api.cycleLabels(); });
  copy.addEventListener("click", () => { ensureOn(); api.copy(); });
  more.addEventListener("click", () => { menu.hidden = !menu.hidden; });
  seg.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => { ensureOn(); api.cycleLabels(b.dataset.mode as LabelMode); }));

  const palette = api.colors();
  cLine.value = toHex(palette.line);
  cPad.value = toHex(palette.padding);
  for (const t of palette.depth) {
    const input = document.createElement("input");
    input.type = "color";
    input.value = toHex(t);
    cDepth.appendChild(input);
  }
  cLine.addEventListener("input", () => { ensureOn(); api.update({ lineColor: toTriplet(cLine.value) }); });
  cPad.addEventListener("input", () => { ensureOn(); api.update({ paddingColor: toTriplet(cPad.value) }); });
  cDepth.addEventListener("input", () => {
    ensureOn();
    api.update({ depthColors: Array.from(cDepth.querySelectorAll("input"), (i) => toTriplet(i.value)) });
  });

  const onDocClick = (e: MouseEvent) => { if (!el.contains(e.target as Node)) menu.hidden = true; };
  document.addEventListener("click", onDocClick);

  sync();

  return {
    el,
    sync,
    destroy() {
      document.removeEventListener("click", onDocClick);
      el.remove();
      style.remove();
    },
  };
}
