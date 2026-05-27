/**
 * Content script: holds a dev-lines controller for this page and responds to
 * commands from the popup / background. The overlay only renders when enabled,
 * so sitting idle on every page is cheap.
 *
 * The extension owns the toggle shortcut (via the commands API), so the core's
 * own toggle combo is disabled here; in-overlay keys (O/G/L/Esc/Alt) stay live.
 */
import { createDevLines, type LabelMode } from "@dev-lines/core";

const dl = createDevLines({ persist: true, shortcut: null, labelKey: "l" });

type Msg =
  | { type: "toggle" }
  | { type: "outlines"; on?: boolean }
  | { type: "guides"; on?: boolean }
  | { type: "labels"; mode?: LabelMode }
  | { type: "state" };

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  switch (msg?.type) {
    case "toggle": dl.toggle(); break;
    case "outlines": dl.toggleOutlines(msg.on); break;
    case "guides": dl.toggleGuides(msg.on); break;
    case "labels": dl.cycleLabels(msg.mode); break;
    case "state": break;
  }
  sendResponse(dl.getState());
  return true;
});
