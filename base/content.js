(() => {
  // Only inject if not already injected
  if (window.__floatingWidgetInjected) return;

  // Read switch state from chrome.storage
  chrome.storage.local.get(["widgetEnabled"], (result) => {
    if (!result.widgetEnabled) return;

    window.__floatingWidgetInjected = true;

    // Debug: Check if AIRewriter is available
    console.log('AIRewriter available:', typeof AIRewriter !== 'undefined');

    // Create the floating widget
    const widget = document.createElement("div");
    widget.id = "floating-widget";
    widget.innerHTML = `
    <div id="widget-header">
      <span>AI Rewriter</span>
      <button id="close-widget">×</button>
    </div>
    <div id="widget-content">
      <div class="input-group">
        <label>Input Text</label>
        <textarea id="inputText" placeholder="Enter text to rewrite..."></textarea>
      </div>
      <div class="input-group">
        <label>Instructions</label>
        <textarea id="instructions" placeholder="e.g. Make it more formal"></textarea>
      </div>
      <button id="rewriteBtn">Rewrite</button>
      <div id="output"></div>
    </div>
  `;
    document.body.appendChild(widget);

    // Styles
    const style = document.createElement("style");
    style.textContent = `
    #floating-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 320px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999999;
      font-family: sans-serif;
      user-select: none;
    }
    #widget-header {
      background: #007bff;
      color: white;
      padding: 8px;
      border-top-left-radius: 12px;
      border-top-right-radius: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
    }
    #widget-header button {
      background: transparent;
      border: none;
      color: white;
      font-size: 16px;
      cursor: pointer;
    }
    #widget-content {
      padding: 12px;
    }
    .input-group {
      margin-bottom: 10px;
    }
    .input-group label {
      display: block;
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 4px;
      color: #333;
    }
    .input-group textarea {
      width: 100%;
      height: 60px;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 6px;
      font-size: 12px;
      resize: vertical;
      box-sizing: border-box;
    }
    #rewriteBtn {
      width: 100%;
      padding: 8px;
      border-radius: 6px;
      border: none;
      background: #007bff;
      color: white;
      cursor: pointer;
      font-size: 13px;
      transition: 0.2s;
      margin-bottom: 10px;
    }
    #rewriteBtn:hover {
      background: #0056b3;
    }
    #output {
      font-size: 12px;
      white-space: pre-wrap;
      max-height: 120px;
      overflow-y: auto;
      border: 1px solid #eee;
      border-radius: 6px;
      padding: 8px;
      background: #f9f9f9;
    }
  `;
    document.head.appendChild(style);

    // Close button
    document.getElementById("close-widget").addEventListener("click", () => {
      widget.remove();
      window.__floatingWidgetInjected = false;
    });

    // Initialize AI Rewriter (inline implementation)
    let lastFocusedInput = null;

    // Track the last focused input/textarea/contenteditable
    document.addEventListener("focusin", (e) => {
      if (e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable ||
        e.target.classList.contains('editable')) {
        lastFocusedInput = e.target;
        console.log("Tracking focused input:", lastFocusedInput);
      }
    });

    function getTextFromElement(element) {
      if (element.isContentEditable || element.classList.contains('editable')) {
        return element.textContent.trim() || element.innerText.trim();
      } else {
        return element.value.trim();
      }
    }

    function setTextToElement(element, text) {
      if (element.isContentEditable || element.classList.contains('editable')) {
        element.textContent = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        element.value = text;
      }
    }

    function isValidInputField(element) {
      return element && (
        element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.isContentEditable ||
        element.classList.contains('editable')
      );
    }

    async function rewriteText(inputText, instructions, onProgress) {
      // Check API availability
      if (!("Rewriter" in window)) {
        throw new Error("Rewriter API is not available in this browser.");
      }

      if (typeof LanguageModel === "undefined") {
        throw new Error("Prompt (language model) API not available in this browser.");
      }

      // Check model availability
      if (onProgress) onProgress("Checking model availability...");
      const modelAvailability = await LanguageModel.availability();
      if (modelAvailability === "unavailable") {
        throw new Error("Language model unavailable. Enable #prompt-api-for-gemini-nano in chrome://flags.");
      }

      // Analyze tone
      if (onProgress) onProgress("Analyzing instruction tone...");
      const session = await LanguageModel.create({
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

      const toneResponse = await session.prompt(tonePrompt, { outputLanguage: "en" });
      const toneText = toneResponse.trim().toLowerCase();
      session.destroy();

      let tone = ["more-formal", "more-casual", "as-is"].includes(toneText) ? toneText : "as-is";
      if (onProgress) onProgress(`Detected tone: ${tone}\n\nPreparing Rewriter...`);

      // Create rewriter
      const availability = await Rewriter.availability();
      if (availability === "unavailable") {
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

      // Perform rewrite
      if (onProgress) onProgress("Rewriting in progress...");
      const result = await rewriter.rewrite(inputText, {
        outputLanguage: "en",
        context: instructions || "Rewrite the text clearly.",
      });

      rewriter.destroy();
      return { result, tone };
    }

    function textToSpeech(text) {
      // TTS not available in content scripts, just log to console
      console.log("TTS:", text);
    }

    document.getElementById("rewriteBtn").addEventListener("click", async () => {
      const inputTextBox = document.getElementById("inputText");
      const inputText = inputTextBox.value.trim();
      const instructions = document.getElementById("instructions").value.trim() || "make it formal";
      const outputDiv = document.getElementById("output");

      outputDiv.textContent = "";

      // Get active element and text
      const activeElement = lastFocusedInput;
      let textToRewrite = inputText;
      let isActiveInputField = false;

      if (isValidInputField(activeElement)) {
        const activeInputText = getTextFromElement(activeElement);

        if (activeInputText) {
          textToRewrite = activeInputText;
          isActiveInputField = true;
          console.log("Using last focused input:", activeElement);
          console.log("Value of active input:", activeInputText);
        } else {
          textToSpeech("Active input is empty.");
          outputDiv.textContent = `Active input is empty.${activeElement.tagName} ${activeElement.id}`;
          return;
        }
      }

      if (!textToRewrite) {
        outputDiv.textContent = `Please enter some text or focus on a filled input field.${activeElement ? activeElement.tagName : ''} ${activeElement ? activeElement.id : ''}`;
        return;
      }

      try {
        const { result, tone } = await rewriteText(
          textToRewrite,
          instructions,
          (progress) => {
            outputDiv.textContent = progress;
          }
        );

        outputDiv.textContent = `✅ Rewritten Text (Tone: ${tone} -- ${activeElement ? activeElement.tagName : 'Manual'}):\n\n${result}`;
        console.log("Rewritten output:", result);

        if (isActiveInputField && activeElement) {
          setTextToElement(activeElement, result);
          textToSpeech("Text rewritten successfully.");
        }

      } catch (err) {
        console.error(err);
        outputDiv.textContent = "Error: " + err.message;
      }
    });

    // Draggable functionality
    let isDragging = false, offsetX, offsetY;
    const header = document.getElementById("widget-header");

    header.addEventListener("mousedown", (e) => {
      isDragging = true;
      offsetX = e.clientX - widget.getBoundingClientRect().left;
      offsetY = e.clientY - widget.getBoundingClientRect().top;
      document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
      if (isDragging) {
        widget.style.left = e.clientX - offsetX + "px";
        widget.style.top = e.clientY - offsetY + "px";
        widget.style.bottom = "auto";
        widget.style.right = "auto";
      }
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
      document.body.style.userSelect = "auto";
    });
  });
})();
