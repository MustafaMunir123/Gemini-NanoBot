const toggle = document.getElementById("widget-toggle");

// Initialize switch state from storage
chrome.storage.local.get(["widgetEnabled"], (result) => {
    toggle.checked = result.widgetEnabled === true;
});

// Listen for switch changes
toggle.addEventListener("change", () => {
    const enabled = toggle.checked;

    // Save state to chrome.storage.local
    chrome.storage.local.set({ widgetEnabled: enabled });

    // Update widget immediately in the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab.id) return;

        if (enabled) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["content.js"]
            });
        } else {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const widget = document.getElementById("floating-widget");
                    if (widget) widget.remove();
                    window.__floatingWidgetInjected = false;
                }
            });
        }
    });
});
