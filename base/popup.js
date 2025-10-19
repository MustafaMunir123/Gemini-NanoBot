const toggle = document.getElementById("widget-toggle");

// Initialize switch state from storage
chrome.storage.local.get(["widgetEnabled"], (result) => {
  // Default to true since Ctrl+Q auto-enables anyway
  toggle.checked = result.widgetEnabled !== false;
});

// Listen for switch changes
toggle.addEventListener("change", () => {
  const enabled = toggle.checked;

  // Save state to chrome.storage.local
  chrome.storage.local.set({ widgetEnabled: enabled });

  // Update widget immediately in the current tab
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab || !tab.id) return;

    if (enabled) {
      // Inject the content script
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        })
        .catch((err) => {
          console.error("Failed to inject script:", err);
        });
    } else {
      // Remove the widget and disable functionality
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: () => {
            const toast = document.getElementById("voice-toast");
            if (toast) toast.remove();
            window.__floatingWidgetInjected = false;
          },
        })
        .catch((err) => {
          console.error("Failed to remove script:", err);
        });
    }
  });
});
