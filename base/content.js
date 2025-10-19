(() => {
  // Only inject if not already injected
  if (window.__floatingWidgetInjected) return;

  window.__floatingWidgetInjected = true;

  // Debug: Check if AIRewriter is available
  console.log("AIRewriter available:", typeof AIRewriter !== "undefined");

  // Create toast notification element
  const toast = document.createElement("div");
  toast.id = "voice-toast";
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #007bff;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 999999;
    font-family: sans-serif;
    font-size: 14px;
    display: none;
    align-items: center;
    gap: 10px;
  `;
  document.body.appendChild(toast);

  // Function to show toast
  function showToast(message, duration = 3000, isListening = false) {
    toast.textContent = message;
    if (isListening) {
      toast.style.background = "#dc3545"; // Red when listening
      toast.innerHTML = `🎤 ${message}`;
    } else {
      toast.style.background = "#007bff"; // Blue for other messages
    }
    toast.style.display = "flex";

    if (duration > 0) {
      setTimeout(() => {
        toast.style.display = "none";
      }, duration);
    }
  }

  // Speech Recognition setup
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;
  let recognizedText = "";

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      console.log("Voice recognition started");
      showToast("Mic is ON - Speak now", 0, true);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");
      recognizedText = transcript;
      console.log("Recognized:", transcript);
      showToast(`Heard: "${transcript}"`, 2000, true);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      showToast(`Error: ${event.error}`, 3000);
      isListening = false;
    };

    recognition.onend = () => {
      console.log("Voice recognition ended");
      if (isListening) {
        // Restart if still in listening mode
        try {
          recognition.start();
        } catch (e) {
          console.error("Failed to restart recognition:", e);
          isListening = false;
        }
      }
    };
  }

  // Track the last focused input/textarea/contenteditable
  let lastFocusedInput = null;

  document.addEventListener(
    "focusin",
    (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable ||
        e.target.classList.contains("editable") ||
        e.target.getAttribute("role") === "textbox" ||
        e.target.getAttribute("aria-label")?.includes("Message Body")
      ) {
        lastFocusedInput = e.target;
        console.log(
          "Focused element:",
          e.target.tagName,
          e.target.id || e.target.className
        );
      }
    },
    true
  ); // Use capture phase to catch events earlier

  function getTextFromElement(element) {
    if (element.isContentEditable || element.classList.contains("editable")) {
      return element.textContent.trim() || element.innerText.trim();
    } else {
      return element.value.trim();
    }
  }

  function setTextToElement(element, text) {
    if (
      element.isContentEditable ||
      element.classList.contains("editable") ||
      element.getAttribute("role") === "textbox"
    ) {
      if (element.tagName === "DIV") {
        const htmlText = text.replace(/\n/g, "<br>");
        element.innerHTML = htmlText;
      } else {
        element.textContent = text;
      }

      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("keyup", { bubbles: true }));
      element.focus();
    } else {
      element.value = text;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function isValidInputField(element) {
    return (
      element &&
      (element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.isContentEditable ||
        element.classList.contains("editable") ||
        element.getAttribute("role") === "textbox" ||
        element.getAttribute("aria-label")?.includes("Message Body"))
    );
  }

  async function rewriteText(inputText, instructions, onProgress) {
    // Check API availability
    if (!("Rewriter" in self) && !("Writer" in window)) {
      throw new Error(
        "Neither Rewriter nor Writer API is available in this browser."
      );
    }

    if (typeof LanguageModel === "undefined") {
      throw new Error(
        "Prompt (language model) API not available in this browser."
      );
    }

    // Check model availability
    if (onProgress) onProgress("Checking model availability...");
    const modelAvailability = await LanguageModel.availability();
    if (modelAvailability === "unavailable") {
      throw new Error(
        "Language model unavailable. Enable #prompt-api-for-gemini-nano in chrome://flags."
      );
    }

    // Analyze instruction type (WRITING vs REWRITING)
    if (onProgress) onProgress("Analyzing instruction type...");
    const session = await LanguageModel.create({
      outputLanguage: "en",
      monitor(m) {
        m.addEventListener("downloadprogress", (e) => {
          console.log(`Downloaded ${e.loaded * 100}%`);
        });
      },
    });

    const instructionTypePrompt = `
          You are an instruction analyzer. Based on the following user instruction, determine whether it is asking for WRITING new content or REWRITING existing content.
          
          WRITING instructions ask to CREATE NEW CONTENT from scratch, such as:
          - "Write an email to..."
          - "Create a story about..."
          - "Compose a letter..."
          - "Generate content about..."
          - "Write a summary of..."
          
          REWRITING instructions ask to IMPROVE OR MODIFY EXISTING TEXT, such as:
          - "Make this more formal"
          - "Improve this text"
          - "Change the tone to..."
          - "Rewrite this paragraph"
          
          Key distinction: If the instruction asks to CREATE something new, it's WRITING. If it asks to IMPROVE existing text, it's REWRITING.
          
          Respond with exactly one word: either "WRITING" or "REWRITING"
          
          Instruction: "${instructions}"
          `;

    const instructionTypeResponse = await session.prompt(
      instructionTypePrompt,
      { outputLanguage: "en" }
    );
    const instructionType = instructionTypeResponse.trim().toUpperCase();
    session.destroy();

    const isWriting = instructionType === "WRITING";

    if (onProgress) onProgress(`Detected: ${instructionType}`);

    if (isWriting) {
      // Use Writer API
      if (!("Writer" in window)) {
        throw new Error("Writer API is not available in this browser.");
      }

      const writerAvailability = await Writer.availability();
      if (writerAvailability === "unavailable") {
        throw new Error("Writer API unavailable.");
      }

      const writer = await Writer.create({
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (e) => {
            const progress = Math.floor((e.loaded / e.total) * 100);
            if (onProgress)
              onProgress(`Downloading Writer model... ${progress}%`);
          });
        },
      });

      if (onProgress) onProgress("Writing in progress...");

      let result;
      try {
        const writeOptions = {};
        if (inputText && inputText.trim()) {
          writeOptions.context = inputText;
        }
        result = await writer.write(instructions, writeOptions);
      } catch (writeError) {
        console.error("Writer API error:", writeError);
        result = await writer.write(instructions, {});
      }

      let finalResult = result;
      if (typeof result === "object" && result !== null) {
        finalResult =
          result.text ||
          result.content ||
          result.result ||
          JSON.stringify(result);
      }

      writer.destroy();
      return { result: finalResult, type: "WRITING" };
    } else {
      // Use Rewriter API
      if (!("Rewriter" in window)) {
        throw new Error("Rewriter API is not available in this browser.");
      }

      if (onProgress) onProgress("Analyzing tone...");
      const toneSession = await LanguageModel.create({
        outputLanguage: "en",
        monitor(m) {
          m.addEventListener("downloadprogress", (e) => {
            console.log(`Downloaded ${e.loaded * 100}%`);
          });
        },
      });

      const tonePrompt = `
            You are a tone analyzer. Based on the following user instruction, determine whether it suggests a tone change.
            Respond with exactly one label from the following list:
            "more-formal", "more-casual", or "as-is".
            If no tone suggestion is found, respond strictly with "as-is".
            
            Instruction: "${instructions}"
            `;

      const toneResponse = await toneSession.prompt(tonePrompt, {
        outputLanguage: "en",
      });
      const toneText = toneResponse.trim().toLowerCase();
      toneSession.destroy();

      let tone = ["more-formal", "more-casual", "as-is"].includes(toneText)
        ? toneText
        : "as-is";
      if (onProgress) onProgress(`Tone: ${tone}`);

      const rewriterAvailability = await Rewriter.availability();
      if (rewriterAvailability === "unavailable") {
        throw new Error("Rewriter API unavailable.");
      }

      const rewriter = await Rewriter.create({
        outputLanguage: "en",
        tone: tone,
        format: "plain-text",
        length: "as-is",
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (e) => {
            const progress = Math.floor((e.loaded / e.total) * 100);
            if (onProgress) onProgress(`Downloading model... ${progress}%`);
          });
        },
      });

      if (onProgress) onProgress("Rewriting in progress...");
      const result = await rewriter.rewrite(inputText, {
        outputLanguage: "en",
        context: instructions || "Rewrite the text clearly.",
      });

      rewriter.destroy();
      return { result, type: "REWRITING", tone };
    }
  }

  // Process the voice command
  async function processVoiceCommand() {
    if (!recognizedText) {
      showToast("No speech detected. Please try again.", 3000);
      return;
    }

    showToast("Processing...", 0);

    const activeElement = lastFocusedInput;
    let textToRewrite = "";
    let isActiveInputField = false;

    if (isValidInputField(activeElement)) {
      const activeInputText = getTextFromElement(activeElement);
      isActiveInputField = true;
      if (activeInputText) {
        textToRewrite = activeInputText;
      }
    }

    try {
      const response = await rewriteText(
        textToRewrite,
        recognizedText,
        (progress) => {
          showToast(progress, 0);
        }
      );

      const { result, type } = response;
      showToast(
        `✅ ${type === "WRITING" ? "Written" : "Rewritten"} successfully!`,
        3000
      );

      if (isActiveInputField && activeElement) {
        setTextToElement(activeElement, result);
      } else {
        const suitableInput = document.querySelector(
          'input[type="text"], textarea, [contenteditable="true"]'
        );
        if (suitableInput) {
          setTextToElement(suitableInput, result);
        } else {
          showToast("No input field found to insert text", 3000);
        }
      }

      // Reset recognized text
      recognizedText = "";
    } catch (err) {
      console.error(err);
      showToast(`Error: ${err.message}`, 5000);
    }
  }

  // Keyboard shortcut handler (Ctrl+Q) - Use capture phase to catch events first
  document.addEventListener(
    "keydown",
    async (e) => {
      // Check if Ctrl+Q is pressed (also handle Cmd+Q for Mac)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "q") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        console.log("Ctrl+Q detected, current listening state:", isListening);

        if (!SpeechRecognition) {
          showToast("Speech recognition not supported in this browser", 3000);
          return;
        }

        // Auto-enable the extension if not already enabled
        chrome.storage.local.set({ widgetEnabled: true });

        if (!isListening) {
          // Start listening
          isListening = true;
          recognizedText = "";
          try {
            recognition.start();
            console.log("Starting voice recognition...");
          } catch (error) {
            console.error("Failed to start recognition:", error);
            showToast("Failed to start mic", 3000);
            isListening = false;
          }
        } else {
          // Stop listening and process
          console.log("Stopping voice recognition...");
          isListening = false;
          recognition.stop();
          toast.style.display = "none";

          // Wait a bit for final recognition results
          setTimeout(() => {
            processVoiceCommand();
          }, 500);
        }
      }
    },
    true
  ); // Use capture phase to intercept before other handlers

  console.log(
    "Voice-controlled Nano Bot loaded. Press Ctrl+Q to start voice input (works anywhere, including input fields)."
  );
})();
