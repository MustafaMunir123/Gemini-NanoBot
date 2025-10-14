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
      <span>Nano Bot</span>
      <button id="close-widget">×</button>
    </div>
    <div id="widget-content">
      <div class="input-group">
        <label>Input Text</label>
        <textarea id="inputText" placeholder="Enter text to write/rewrite..."></textarea>
      </div>
      <div class="input-group">
        <label>Instructions</label>
        <textarea id="instructions" placeholder="e.g. Make it more formal, Write a summary, Create a story"></textarea>
      </div>
      <button id="rewriteBtn">Process</button>
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
        e.target.classList.contains('editable') ||
        e.target.getAttribute('role') === 'textbox' ||
        e.target.getAttribute('aria-label')?.includes('Message Body')) {
        lastFocusedInput = e.target;
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

      if (element.isContentEditable || element.classList.contains('editable') ||
        element.getAttribute('role') === 'textbox') {
        // Use HTML formatting for DIV elements (like Gmail compose box)
        // Use textContent for INPUT/TEXTAREA elements
        if (element.tagName === 'DIV') {
          // For DIV elements: convert line breaks to HTML for proper formatting
          const htmlText = text.replace(/\n/g, '<br>');
          element.innerHTML = htmlText;
        } else {
          // For INPUT/TEXTAREA elements: use textContent to preserve plain text
          element.textContent = text;
        }

        // Dispatch multiple events to ensure the change is recognized
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('keyup', { bubbles: true }));

        // Focus the element to ensure it's active
        element.focus();
      } else {
        // For regular input/textarea elements
        element.value = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    function isValidInputField(element) {
      return element && (
        element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.isContentEditable ||
        element.classList.contains('editable') ||
        element.getAttribute('role') === 'textbox' ||
        element.getAttribute('aria-label')?.includes('Message Body')
      );
    }

    function validateInputForRewriting(inputText, activeElement, outputDiv) {
      // For rewriting operations, we need some text to work with
      if (!inputText || inputText.trim() === "") {
        const elementInfo = activeElement ? `${activeElement.tagName} ${activeElement.id}` : '';
        outputDiv.textContent = `Please enter some text or focus on a filled input field.${elementInfo}`;
        return false;
      }
      return true;
    }

    async function rewriteText(inputText, instructions, onProgress, validateInput = true) {
      // Check API availability
      if (!("Rewriter" in self) && !("Writer" in window)) {
        throw new Error("Neither Rewriter nor Writer API is available in this browser.");
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
            - "Draft a proposal for..."
            - "Create a poem about..."
            - "Write a report on..."
            - "Compose a message..."
            - "Generate a response..."
            
            REWRITING instructions ask to IMPROVE OR MODIFY EXISTING TEXT, such as:
            - "Make this more formal"
            - "Improve this text"
            - "Change the tone to..."
            - "Rewrite this paragraph"
            - "Make it more casual"
            - "Edit this content"
            - "Refine this text"
            - "Polish this writing"
            
            Key distinction: If the instruction asks to CREATE something new (even if it says "write"), it's WRITING. If it asks to IMPROVE existing text, it's REWRITING.
            
            Respond with exactly one word: either "WRITING" or "REWRITING"
            
            Instruction: "${instructions}"
            `;

      const instructionTypeResponse = await session.prompt(instructionTypePrompt, { outputLanguage: "en" });
      const instructionType = instructionTypeResponse.trim().toUpperCase();
      session.destroy();

      const isWriting = instructionType === "WRITING";

      // Validate input for rewriting operations only
      if (!isWriting && validateInput && (!inputText || inputText.trim() === "")) {
        throw new Error("Input text is required for rewriting operations. Please provide text to rewrite.");
      }

      if (onProgress) onProgress(`Detected instruction type: ${instructionType}\n\nPreparing ${isWriting ? 'Writer' : 'Rewriter'}...`);

      if (isWriting) {
        // Use Writer API for writing new content
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
              if (onProgress) onProgress(`Downloading Writer model... ${progress}%`);
            });
          },
        });

        // Perform writing
        if (onProgress) onProgress("Writing in progress...");

        let result;
        try {
          // Use the correct Writer API format: write(content, options)
          // The main content/prompt goes as the first parameter
          const writeOptions = {};

          // Add context if we have input text
          if (inputText && inputText.trim()) {
            writeOptions.context = inputText;
          }

          // Use instructions as the main content to write
          result = await writer.write(instructions, writeOptions);

        } catch (writeError) {
          console.error("Writer API error:", writeError);
          // Fallback: try with just the instructions as content
          result = await writer.write(instructions, {});
        }

        // Handle different result formats
        let finalResult = result;
        if (typeof result === 'object' && result !== null) {
          // If result is an object, try to extract the text content
          finalResult = result.text || result.content || result.result || JSON.stringify(result);
        }

        writer.destroy();
        return { result: finalResult, type: "WRITING" };
      } else {
        // Use Rewriter API for rewriting existing content
        if (!("Rewriter" in window)) {
          throw new Error("Rewriter API is not available in this browser.");
        }

        // Analyze tone for rewriting
        if (onProgress) onProgress("Analyzing instruction tone...");
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

        const toneResponse = await toneSession.prompt(tonePrompt, { outputLanguage: "en" });
        const toneText = toneResponse.trim().toLowerCase();
        toneSession.destroy();

        let tone = ["more-formal", "more-casual", "as-is"].includes(toneText) ? toneText : "as-is";
        if (onProgress) onProgress(`Detected tone: ${tone}\n\nPreparing Rewriter...`);

        // Create rewriter
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
              if (onProgress) onProgress(`Downloading Rewriter model... ${progress}%`);
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
        return { result, type: "REWRITING", tone };
      }
    }

    function textToSpeech(text) {
      // TTS not available in content scripts, just log to console
      console.log("TTS:", text);
    }

    document.getElementById("rewriteBtn").addEventListener("click", async () => {
      const inputTextBox = document.getElementById("inputText");
      const inputText = inputTextBox.value.trim();
      const instructions = document.getElementById("instructions").value.trim() || "improve this text";
      const outputDiv = document.getElementById("output");

      outputDiv.textContent = "";

      // Get active element and text
      const activeElement = lastFocusedInput;
      let textToRewrite = inputText;
      let isActiveInputField = false;

      if (isValidInputField(activeElement)) {
        const activeInputText = getTextFromElement(activeElement);

        // Set isActiveInputField to true if we have a valid input field, regardless of content
        isActiveInputField = true;

        if (activeInputText) {
          textToRewrite = activeInputText;
        }
      }

      try {
        const response = await rewriteText(
          textToRewrite,
          instructions,
          (progress) => {
            outputDiv.textContent = progress;
          },
          true // Enable validation
        );

        const { result, type, tone } = response;
        const typeLabel = type === "WRITING" ? "Written" : "Rewritten";
        const toneInfo = tone ? ` (Tone: ${tone})` : "";

        outputDiv.textContent = `✅ ${typeLabel} Text${toneInfo} -- ${activeElement ? activeElement.tagName : 'Manual'}:\n\n${result}`;
        console.log(`${typeLabel} output:`, result);

        console.log("Text insertion:", isActiveInputField ? "Will insert" : "No target found");

        if (isActiveInputField && activeElement) {
          setTextToElement(activeElement, result);
          textToSpeech(`Text ${type.toLowerCase()} successfully.`);
        } else {
          // Try to find any suitable input field if no active element
          const suitableInput = document.querySelector('input[type="text"], textarea, [contenteditable="true"]');
          if (suitableInput) {
            setTextToElement(suitableInput, result);
            textToSpeech(`Text ${type.toLowerCase()} successfully.`);
          }
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
