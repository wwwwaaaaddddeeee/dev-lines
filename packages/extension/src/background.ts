/** Service worker: routes the keyboard command to the active tab's content script. */
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle" && tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: "toggle" }).catch(() => {});
  }
});
