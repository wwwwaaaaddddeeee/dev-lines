/** Popup UI: reads state from the active tab's content script and sends commands. */
import type { LabelMode } from "@dev-lines/core";

interface State {
  enabled: boolean;
  outlines: boolean;
  guides: boolean;
  labels: LabelMode;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const dot = $("dot");
const toggleBtn = $<HTMLButtonElement>("toggle");
const controls = $<HTMLFieldSetElement>("controls");
const outlinesBtn = $<HTMLButtonElement>("outlines");
const guidesBtn = $<HTMLButtonElement>("guides");
const labelsSeg = $("labels");
const hint = $("hint");

let tabId: number | undefined;

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

function send(msg: unknown): Promise<State | undefined> {
  if (tabId == null) return Promise.resolve(undefined);
  return chrome.tabs.sendMessage(tabId, msg).catch(() => undefined);
}

function render(state?: State) {
  if (!state) {
    controls.disabled = true;
    toggleBtn.style.display = "none";
    dot.classList.remove("on");
    hint.innerHTML = '<span class="disabled">Not available on this page.</span>';
    return;
  }
  dot.classList.toggle("on", state.enabled);
  toggleBtn.textContent = state.enabled ? "Disable" : "Enable";
  toggleBtn.classList.toggle("off", !state.enabled);
  controls.disabled = !state.enabled;
  outlinesBtn.textContent = state.outlines ? "on" : "off";
  outlinesBtn.classList.toggle("on", state.outlines);
  guidesBtn.textContent = state.guides ? "on" : "off";
  guidesBtn.classList.toggle("on", state.guides);
  labelsSeg.querySelectorAll<HTMLButtonElement>("button").forEach((b) =>
    b.classList.toggle("on", b.dataset.mode === state.labels),
  );
}

async function init() {
  tabId = await activeTabId();
  render(await send({ type: "state" }));

  toggleBtn.addEventListener("click", async () => render(await send({ type: "toggle" })));
  outlinesBtn.addEventListener("click", async () => render(await send({ type: "outlines" })));
  guidesBtn.addEventListener("click", async () => render(await send({ type: "guides" })));
  labelsSeg.querySelectorAll<HTMLButtonElement>("button").forEach((b) =>
    b.addEventListener("click", async () => render(await send({ type: "labels", mode: b.dataset.mode as LabelMode }))),
  );
}

init();
