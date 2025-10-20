// ============================================================================
// BACKGROUND SERVICE WORKER FOR Nano Bot
// ============================================================================

console.log("Nano Bot background service worker loaded");

// ============================================================================
// EXTENSION INSTALLATION AND SETUP
// ============================================================================

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Nano Bot installed/updated:", details.reason);

  // Set default extension state
  chrome.storage.local.set(
    {
      voiceControlEnabled: true, // Default to enabled (auto-enables on first use)
      floatingIndicatorEnabled: false, // Default to disabled (user must enable)
    },
    () => {
      console.log("Default extension state set");
    }
  );
});

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

// Handle keyboard shortcut commands
chrome.commands.onCommand.addListener((command) => {
  console.log("Command received:", command);

  if (command === "toggle-recording") {
    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const tab = tabs[0];

        // Check if we can inject scripts into this tab
        if (
          tab.url.startsWith("chrome://") ||
          tab.url.startsWith("chrome-extension://") ||
          tab.url.startsWith("edge://") ||
          tab.url.startsWith("about:")
        ) {
          console.log("Cannot run on browser internal pages");
          return;
        }

        // Check if voice control is enabled
        chrome.storage.local.get(["voiceControlEnabled"], (result) => {
          if (result.voiceControlEnabled !== false) {
            // Send message to content script to handle the command
            chrome.tabs
              .sendMessage(tab.id, {
                action: "toggleVoiceRecording", // Changed to match your listener
              })
              .then((response) => {
                console.log("Command sent successfully:", response);
              })
              .catch((error) => {
                console.log(
                  "Message failed, attempting to inject script:",
                  error
                );

                // Fallback: inject content script if it's not loaded yet
                chrome.scripting
                  .executeScript({
                    target: { tabId: tab.id },
                    files: ["content.js"],
                  })
                  .then(() => {
                    console.log("Content script injected, retrying command");
                    // Wait a bit for script to initialize, then retry
                    setTimeout(() => {
                      chrome.tabs
                        .sendMessage(tab.id, {
                          action: "toggleVoiceRecording",
                        })
                        .catch((err) => {
                          console.error("Retry failed:", err);
                        });
                    }, 500);
                  })
                  .catch((err) => {
                    console.error("Failed to inject script:", err);
                  });
              });
          } else {
            console.log(
              "Voice control is disabled, ignoring keyboard shortcut"
            );
          }
        });
      }
    });
  }
});

// ============================================================================
// TAB AND CONTEXT MENU HANDLERS
// ============================================================================

// Handle tab updates (when user navigates to a new page)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only inject content script when the page is completely loaded
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    !tab.url.startsWith("chrome://")
  ) {
    console.log(
      "Tab updated, checking if content script needs injection:",
      tab.url
    );

    // Check extension state and inject content script if needed
    chrome.storage.local.get(
      ["voiceControlEnabled", "floatingIndicatorEnabled"],
      (result) => {
        const needsInjection =
          result.voiceControlEnabled !== false ||
          result.floatingIndicatorEnabled === true;

        if (needsInjection) {
          chrome.scripting
            .executeScript({
              target: { tabId: tabId },
              files: ["content.js"],
            })
            .catch((err) => {
              console.log(
                "Content script injection failed (likely already injected):",
                err
              );
            });
        }
      }
    );
  }
});

// Handle tab activation (when user switches to a tab)
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log("Tab activated:", activeInfo.tabId);

  // Get the tab details
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab && tab.url && !tab.url.startsWith("chrome://")) {
      // Check extension state and inject content script if needed
      chrome.storage.local.get(
        ["voiceControlEnabled", "floatingIndicatorEnabled"],
        (result) => {
          const needsInjection =
            result.voiceControlEnabled !== false ||
            result.floatingIndicatorEnabled === true;

          if (needsInjection) {
            chrome.scripting
              .executeScript({
                target: { tabId: activeInfo.tabId },
                files: ["content.js"],
              })
              .catch((err) => {
                console.log(
                  "Content script injection failed (likely already injected):",
                  err
                );
              });
          }
        }
      );
    }
  });
});

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request);

  switch (request.action) {
    case "getExtensionState":
      // Return current extension state
      chrome.storage.local.get(
        ["voiceControlEnabled", "floatingIndicatorEnabled"],
        (result) => {
          sendResponse({
            voiceControlEnabled: result.voiceControlEnabled !== false,
            floatingIndicatorEnabled: result.floatingIndicatorEnabled === true,
          });
        }
      );
      return true; // Keep message channel open for async response

    case "updateExtensionState":
      // Update extension state
      const updates = {};
      if (request.voiceControlEnabled !== undefined) {
        updates.voiceControlEnabled = request.voiceControlEnabled;
      }
      if (request.floatingIndicatorEnabled !== undefined) {
        updates.floatingIndicatorEnabled = request.floatingIndicatorEnabled;
      }

      chrome.storage.local.set(updates, () => {
        console.log("Extension state updated:", updates);
        sendResponse({ success: true });
      });
      return true; // Keep message channel open for async response

    case "injectContentScript":
      // Inject content script into specified tab
      if (request.tabId) {
        chrome.scripting
          .executeScript({
            target: { tabId: request.tabId },
            files: ["content.js"],
          })
          .then(() => {
            console.log("Content script injected into tab:", request.tabId);
            sendResponse({ success: true });
          })
          .catch((err) => {
            console.error("Failed to inject content script:", err);
            sendResponse({ success: false, error: err.message });
          });
      } else {
        sendResponse({ success: false, error: "No tab ID provided" });
      }
      return true; // Keep message channel open for async response
    case "toggleVoiceRecording":
      this.handleVoiceToggle();
      sendResponse({ success: true });
      return true;
    default:
      console.log("Unknown message action:", request.action);
      sendResponse({ success: false, error: "Unknown action" });
      break;
  }
});

// ============================================================================
// STORAGE CHANGE HANDLERS
// ============================================================================

// Handle storage changes (when extension state is updated)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local") {
    console.log("Storage changed:", changes);

    // If voice control or floating indicator state changed, notify all tabs
    if (changes.voiceControlEnabled || changes.floatingIndicatorEnabled) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.url && !tab.url.startsWith("chrome://")) {
            chrome.tabs.sendMessage(
              tab.id,
              {
                action: "extensionStateChanged",
                voiceControlEnabled: changes.voiceControlEnabled?.newValue,
                floatingIndicatorEnabled:
                  changes.floatingIndicatorEnabled?.newValue,
              },
              (response) => {
                if (chrome.runtime.lastError) {
                  console.log(
                    "State change message failed for tab:",
                    tab.id,
                    chrome.runtime.lastError
                  );
                }
              }
            );
          }
        });
      });
    }
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Handle runtime errors
chrome.runtime.onStartup.addListener(() => {
  console.log("Nano Bot background service worker started");
});

// Handle service worker suspension
self.addEventListener("beforeunload", () => {
  console.log("Nano Bot background service worker suspending");
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Function to get all tabs that need content script injection
function getTabsNeedingInjection() {
  return new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => {
      const validTabs = tabs.filter(
        (tab) =>
          tab.url &&
          !tab.url.startsWith("chrome://") &&
          !tab.url.startsWith("chrome-extension://") &&
          !tab.url.startsWith("moz-extension://")
      );
      resolve(validTabs);
    });
  });
}

// Function to inject content script into all valid tabs
async function injectIntoAllTabs() {
  const tabs = await getTabsNeedingInjection();
  console.log(`Injecting content script into ${tabs.length} tabs`);

  for (const tab of tabs) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      console.log(`Content script injected into tab ${tab.id}: ${tab.url}`);
    } catch (err) {
      console.log(`Failed to inject into tab ${tab.id}:`, err);
    }
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize the background service worker
console.log("Nano Bot background service worker initialized successfully");
