const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

// Send message to content script to start recognition
startBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: startRecognition
  });
});

// Send message to content script to stop recognition
stopBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: stopRecognition
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "status") statusEl.textContent = msg.value;
  if (msg.type === "transcript") resultEl.value = msg.value;
});

// These functions will run in the content script context
function startRecognition() {
  if (window.recognitionRunning) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.error("SpeechRecognition not supported");
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
    chrome.runtime.sendMessage({ type: "status", value: "Idle" });
    window.recognitionRunning = false;
  };

  recognition.onerror = (e) => {
    console.error("Recognition error:", e.error);
    chrome.runtime.sendMessage({ type: "status", value: "Error: " + e.error });
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    chrome.runtime.sendMessage({ type: "transcript", value: transcript });
  };

  recognition.start();
  window.recognition = recognition;
  window.recognitionRunning = true;
}

function stopRecognition() {
  if (window.recognition && window.recognitionRunning) {
    window.recognition.stop();
  }
}
