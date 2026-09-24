// Toolbar click: focus the SimpleCMS tab if one is already open, otherwise open one.
// (One editor tab at a time keeps autosave from two tabs overwriting each other.)
// Needs no permissions: runtime.getContexts only sees this extension's own pages.
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('editor.html');
  try {
    const tabs = await chrome.runtime.getContexts({ contextTypes: ['TAB'] });
    const open = tabs.find(c => c.documentUrl && c.documentUrl.startsWith(url));
    if (open) {
      await chrome.tabs.update(open.tabId, { active: true });
      await chrome.windows.update(open.windowId, { focused: true });
      return;
    }
  } catch (e) { /* fall through and open a new tab */ }
  chrome.tabs.create({ url });
});
