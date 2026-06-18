const DEFAULTS = { drilldown: true, markdown: true, hideAddComment: true };

chrome.storage.local.get(DEFAULTS, (cfg) => {
  Object.keys(DEFAULTS).forEach((key) => {
    const el = document.getElementById(key);
    el.checked = Boolean(cfg[key]);
    el.addEventListener('change', () => {
      chrome.storage.local.set({ [key]: el.checked }, reloadActiveThread);
    });
  });
});

// Re-run the content script by reloading the thread that's currently open.
function reloadActiveThread() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.id != null && /:\/\/news\.ycombinator\.com\/item/.test(tab.url || '')) {
      chrome.tabs.reload(tab.id);
    }
  });
}
