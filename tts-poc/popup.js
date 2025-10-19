const statusEl = document.getElementById("status");
const statusIcon = document.getElementById("statusIcon");
const resultEl = document.getElementById("result");

// Listen for messages from content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "status") {
    statusEl.textContent = msg.value;

    // Update icon based on status
    if (msg.value.includes("Listening")) {
      statusIcon.textContent = "🎤";
      statusIcon.classList.add("listening");
    } else {
      statusIcon.textContent = "🎤";
      statusIcon.classList.remove("listening");
    }
  }

  if (msg.type === "transcript") {
    resultEl.value = msg.value;
  }
});

// Initialize - check current status
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (
    tab &&
    tab.url &&
    !tab.url.startsWith("chrome://") &&
    !tab.url.startsWith("chrome-extension://")
  ) {
    chrome.scripting
      .executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (window.recognitionRunning) {
            chrome.runtime.sendMessage({
              type: "status",
              value: "🎤 Listening...",
            });
          }
        },
      })
      .catch((err) => console.log("Cannot access this page"));
  }
});
