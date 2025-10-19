// Listen for keyboard command (Ctrl+T)
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-recording") {
    // Open the popup
    chrome.action.openPopup().catch(() => {
      // If popup can't be opened programmatically, fallback to just toggling
      console.log("Popup cannot be opened programmatically");
    });

    // Toggle recording
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
            func: toggleRecognition,
          })
          .catch((err) => {
            console.log("Cannot access this page:", err);
          });
      } else {
        console.log("Extension cannot run on this page");
      }
    });
  }
});

// Toggle function that runs in content script context
function toggleRecognition() {
  if (window.recognitionRunning) {
    // Stop recording
    if (window.recognition) {
      window.recognition.stop();
    }
  } else {
    // Start recording
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("SpeechRecognition not supported");
      chrome.runtime.sendMessage({
        type: "status",
        value: "❌ Not Supported",
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      chrome.runtime.sendMessage({ type: "status", value: "🎤 Listening..." });
    };

    recognition.onend = () => {
      chrome.runtime.sendMessage({ type: "status", value: "Ready" });
      window.recognitionRunning = false;
    };

    recognition.onerror = (e) => {
      console.error("Recognition error:", e.error);
      chrome.runtime.sendMessage({
        type: "status",
        value: "❌ Error: " + e.error,
      });
      window.recognitionRunning = false;
    };

    let fullTranscript = "";
    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        fullTranscript += finalTranscript;
      }

      const displayText = fullTranscript + interimTranscript;
      chrome.runtime.sendMessage({ type: "transcript", value: displayText });
    };

    recognition.start();
    window.recognition = recognition;
    window.recognitionRunning = true;
  }
}
