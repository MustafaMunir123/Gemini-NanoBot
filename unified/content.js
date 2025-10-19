(() => {
    // Only inject if not already injected
    if (window.__aiTextAssistantInjected) return;
    window.__aiTextAssistantInjected = true;

    console.log("AI Text Assistant Pro loaded");

    // ============================================================================
    // SHARED UTILITIES AND CONFIGURATION
    // ============================================================================

    // Extension state management
    const extensionState = {
        voiceControlEnabled: false,
        floatingIndicatorEnabled: false,
        isVoiceListening: false,
        isProofreading: false
    };

    // Shared DOM utilities
    const DOMUtils = {
        isTextEditable(el) {
            if (!el) return false;
            return el.tagName === "INPUT" ||
                el.tagName === "TEXTAREA" ||
                el.isContentEditable ||
                el.classList.contains('editable') ||
                el.getAttribute('role') === 'textbox' ||
                el.getAttribute('aria-label')?.includes('Message Body');
        },

        getTextFromElement(el) {
            if (!el) return '';
            if (el.isContentEditable || el.classList.contains('editable')) {
                return el.textContent.trim() || el.innerText.trim();
            } else {
                return el.value.trim();
            }
        },

        setTextToElement(el, text) {
            if (!el) {
                console.error('setTextToElement: No element provided');
                return;
            }

            if (el.isContentEditable || el.classList.contains('editable') || el.getAttribute('role') === 'textbox') {
                if (el.tagName === 'DIV') {
                    const htmlText = text.replace(/\n/g, '<br>');
                    el.innerHTML = htmlText;
                } else {
                    el.textContent = text;
                }

                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('keyup', { bubbles: true }));
                el.focus();
            } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.value = text;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        },

        replaceSelectedTextInElement(el, originalText, correctedText) {
            if (!el) {
                console.error('replaceSelectedTextInElement: No element provided');
                return;
            }

            if (el.isContentEditable || el.classList.contains('editable') || el.getAttribute('role') === 'textbox') {
                const currentText = el.textContent || el.innerText || '';
                const newText = currentText.replace(originalText, correctedText);

                if (el.tagName === 'DIV') {
                    const htmlText = newText.replace(/\n/g, '<br>');
                    el.innerHTML = htmlText;
                } else {
                    el.textContent = newText;
                }

                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('keyup', { bubbles: true }));
                el.focus();
            } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                const currentValue = el.value || '';
                const newValue = currentValue.replace(originalText, correctedText);
                el.value = newValue;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    };

    // Shared notification system
    const NotificationSystem = {
        activeToasts: new Map(),

        createToastContainer() {
            let toastContainer = document.getElementById('ai-text-assistant-toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'ai-text-assistant-toast-container';
                toastContainer.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 999999;
          pointer-events: none;
        `;
                document.body.appendChild(toastContainer);
            }
            return toastContainer;
        },

        showToast(message, type = 'success', duration = 3000) {
            // Only play sound for success and error
            if (type === 'success' || type === 'error') {
                this.playNotificationSound(type);
            }

            const toastContainer = this.createToastContainer();

            // Remove existing toast with same message if it exists
            if (this.activeToasts.has(message)) {
                const existingToast = this.activeToasts.get(message);
                this.removeToast(existingToast);
            }

            // Set default duration based on type if not specified or if 0
            if (duration === 0) {
                if (type === 'info') {
                    duration = 4000; // Info toasts stay a bit longer
                } else if (type === 'success') {
                    duration = 3000; // Success toasts
                } else if (type === 'error') {
                    duration = 5000; // Error toasts stay longer for user to read
                } else {
                    duration = 3000; // Default fallback
                }
            }

            const toast = document.createElement('div');
            toast.style.cssText = `
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#007bff'};
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        max-width: 300px;
        word-wrap: break-word;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        pointer-events: auto;
        cursor: pointer;
        position: relative;
      `;

            const closeBtn = document.createElement('span');
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
        position: absolute;
        top: 5px;
        right: 8px;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        opacity: 0.8;
      `;
            closeBtn.addEventListener('click', () => this.removeToast(toast));

            toast.appendChild(document.createTextNode(message));
            toast.appendChild(closeBtn);
            toastContainer.appendChild(toast);

            this.activeToasts.set(message, toast);

            setTimeout(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(0)';
            }, 10);

            // Always set up auto-removal timeout
            const autoRemoveTimeout = setTimeout(() => {
                this.removeToast(toast);
                this.activeToasts.delete(message);
            }, duration);

            toast.addEventListener('click', () => {
                if (autoRemoveTimeout) {
                    clearTimeout(autoRemoveTimeout);
                }
                this.removeToast(toast);
                this.activeToasts.delete(message);
            });
        },

        removeToast(toastElement) {
            toastElement.style.opacity = '0';
            toastElement.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toastElement.parentNode) {
                    toastElement.parentNode.removeChild(toastElement);
                }
            }, 300);
        },

        playNotificationSound(type) {
            try {
                const extensionId = this.getExtensionInfo();
                if (!extensionId) return;

                const audioFileName = type === 'error' ? 'error.mp3' : 'success.mp3';
                const audio = new Audio();
                audio.src = `chrome-extension://${extensionId}/${audioFileName}`;
                audio.volume = 0.7;
                audio.play().catch(error => {
                    console.warn('Could not play notification sound:', error);
                });
            } catch (error) {
                console.warn('Error playing notification sound:', error);
            }
        },

        getExtensionInfo() {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                return chrome.runtime.id;
            }
            return null;
        }
    };

    // ============================================================================
    // VOICE CONTROL FLOW (Extension 1 functionality)
    // ============================================================================

    const VoiceControlFlow = {
        recognition: null,
        recognizedText: "",
        lastFocusedInput: null,
        lastSelection: null,

        init() {
            this.setupSpeechRecognition();
            this.setupKeyboardShortcut();
            this.setupFocusTracking();
        },

        setupSpeechRecognition() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.warn("Speech recognition not supported in this browser");
                return;
            }

            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = false;
            this.recognition.lang = "en-US";

            this.recognition.onstart = () => {
                console.log("Voice recognition started");
                NotificationSystem.showToast("🎤 Speak now", 'info', 4000);
            };

            this.recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map((result) => result[0].transcript)
                    .join("");
                this.recognizedText = transcript;
                console.log("Recognized:", transcript);
            };

            this.recognition.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
                NotificationSystem.showToast(`Voice recognition failed`, 'error');
                extensionState.isVoiceListening = false;
            };

            this.recognition.onend = () => {
                console.log("Voice recognition ended");
                if (extensionState.isVoiceListening) {
                    try {
                        this.recognition.start();
                    } catch (e) {
                        console.error("Failed to restart recognition:", e);
                        extensionState.isVoiceListening = false;
                    }
                }
            };
        },

        setupKeyboardShortcut() {
            document.addEventListener("keydown", async (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "q") {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();

                    if (!extensionState.voiceControlEnabled) {
                        NotificationSystem.showToast("Voice control is disabled", 'error');
                        return;
                    }

                    if (!this.recognition) {
                        NotificationSystem.showToast("Speech recognition not supported", 'error');
                        return;
                    }

                    chrome.storage.local.set({ voiceControlEnabled: true });

                    if (!extensionState.isVoiceListening) {
                        extensionState.isVoiceListening = true;
                        this.recognizedText = "";
                        try {
                            this.recognition.start();
                        } catch (error) {
                            console.error("Failed to start recognition:", error);
                            NotificationSystem.showToast("Failed to start mic", 'error');
                            extensionState.isVoiceListening = false;
                        }
                    } else {
                        extensionState.isVoiceListening = false;
                        this.recognition.stop();
                        setTimeout(() => {
                            this.processVoiceCommand();
                        }, 500);
                    }
                }
            }, true);
        },

        setupFocusTracking() {
            document.addEventListener("focusin", (e) => {
                if (DOMUtils.isTextEditable(e.target)) {
                    this.lastFocusedInput = e.target;
                }
            }, true);

            // Track text selection for selective rewriting
            document.addEventListener('selectionchange', () => {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();

                if (selectedText && this.lastFocusedInput && DOMUtils.isTextEditable(this.lastFocusedInput)) {
                    const elementText = DOMUtils.getTextFromElement(this.lastFocusedInput);
                    if (elementText.includes(selectedText)) {
                        this.lastSelection = {
                            text: selectedText,
                            element: this.lastFocusedInput
                        };
                    }
                } else {
                    this.lastSelection = null;
                }
            });
        },

        validateTextSelection() {
            const selection = window.getSelection();
            let selectedText = selection.toString().trim();
            let focusedElement = this.lastFocusedInput;

            if (!selectedText && this.lastSelection && this.lastSelection.text) {
                selectedText = this.lastSelection.text;
                focusedElement = this.lastSelection.element;
            }

            if (!focusedElement) {
                return {
                    isValid: false,
                    error: 'No text input field is focused',
                    selectedText: null,
                    focusedElement: null
                };
            }

            if (!selectedText) {
                const elementText = DOMUtils.getTextFromElement(focusedElement);

                if (!elementText || elementText.trim().length === 0) {
                    return {
                        isValid: false,
                        error: 'No text found in the input field',
                        selectedText: null,
                        focusedElement: null
                    };
                }

                selectedText = elementText;
            } else {
                const elementText = DOMUtils.getTextFromElement(focusedElement);
                if (!elementText.includes(selectedText)) {
                    return {
                        isValid: false,
                        error: 'Selected text must be from the focused field',
                        selectedText: null,
                        focusedElement: null
                    };
                }
            }

            return {
                isValid: true,
                selectedText: selectedText,
                focusedElement: focusedElement
            };
        },

        async processVoiceCommand() {
            if (!this.recognizedText) {
                NotificationSystem.showToast("No speech detected", 'error');
                return;
            }

            const validation = this.validateTextSelection();
            if (!validation.isValid) {
                NotificationSystem.showToast(validation.error, 'error');
                return;
            }

            const selectedText = validation.selectedText;
            const focusedElement = validation.focusedElement;

            NotificationSystem.showToast("Processing...", 'info', 4000);

            try {
                const response = await this.rewriteText(selectedText, this.recognizedText);

                const { result, type } = response;
                NotificationSystem.showToast(
                    `${type === "WRITING" ? "Written" : "Rewritten"} successfully`,
                    'success'
                );

                const elementText = DOMUtils.getTextFromElement(focusedElement);
                const isSelectedText = this.lastSelection && this.lastSelection.text && elementText.includes(this.lastSelection.text);

                if (isSelectedText && result !== selectedText) {
                    DOMUtils.replaceSelectedTextInElement(focusedElement, selectedText, result);
                } else if (!isSelectedText && result !== selectedText) {
                    DOMUtils.setTextToElement(focusedElement, result);
                } else {
                    NotificationSystem.showToast('No changes needed', 'success');
                }

                this.recognizedText = "";
                this.lastSelection = null;
            } catch (err) {
                console.error(err);
                NotificationSystem.showToast(`Error: ${err.message}`, 'error');
                this.lastSelection = null;
            }
        },

        async rewriteText(inputText, instructions) {
            if (!("Rewriter" in self) && !("Writer" in window)) {
                throw new Error("Neither Rewriter nor Writer API is available in this browser.");
            }

            if (typeof LanguageModel === "undefined") {
                throw new Error("Prompt (language model) API not available in this browser.");
            }

            const modelAvailability = await LanguageModel.availability();
            if (modelAvailability === "unavailable") {
                throw new Error("Language model unavailable. Enable #prompt-api-for-gemini-nano in chrome://flags.");
            }

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

            const instructionTypeResponse = await session.prompt(instructionTypePrompt, { outputLanguage: "en" });
            const instructionType = instructionTypeResponse.trim().toUpperCase();
            session.destroy();

            const isWriting = instructionType === "WRITING";

            if (isWriting) {
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
                            console.log(`Downloading Writer model... ${Math.floor((e.loaded / e.total) * 100)}%`);
                        });
                    },
                });

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
                    finalResult = result.text || result.content || result.result || JSON.stringify(result);
                }

                writer.destroy();
                return { result: finalResult, type: "WRITING" };
            } else {
                if (!("Rewriter" in window)) {
                    throw new Error("Rewriter API is not available in this browser.");
                }

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
                            console.log(`Downloading model... ${Math.floor((e.loaded / e.total) * 100)}%`);
                        });
                    },
                });

                const result = await rewriter.rewrite(inputText, {
                    outputLanguage: "en",
                    context: instructions || "Rewrite the text clearly.",
                });

                rewriter.destroy();
                return { result, type: "REWRITING", tone };
            }
        }
    };

    // ============================================================================
    // FLOATING TEXT INDICATOR FLOW (Extension 2 functionality)
    // ============================================================================

    const FloatingIndicatorFlow = {
        host: null,
        shadow: null,
        container: null,
        fileUploadRectangle: null,
        coverLetterRectangle: null,
        activeElement: null,
        originalInputElement: null,
        lastFocusedElement: null,
        visible: false,
        proofreaderSession: null,
        hideTimeout: null,
        uploadedFileName: null,
        storedContent: null,
        lastSelection: null,
        buttonsVisible: false,
        buttonHideTimeout: null,

        init() {
            this.createFloatingUI();
            this.setupEventListeners();
            this.checkStoredContent();
        },

        createFloatingUI() {
            const BUTTON_SIZE = 40;
            const MARGIN = 6;

            this.host = document.createElement('div');
            this.host.id = '__ai_text_assistant_floating_host';
            this.host.style.position = 'absolute';
            this.host.style.top = '0';
            this.host.style.left = '0';
            this.host.style.zIndex = 2147483647;
            this.host.style.pointerEvents = 'none';
            document.documentElement.appendChild(this.host);

            this.shadow = this.host.attachShadow({ mode: 'closed' });

            const style = document.createElement('style');
            style.textContent = `
        .container {
          position: absolute;
          width: ${BUTTON_SIZE}px;
          height: ${BUTTON_SIZE}px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.12s ease, opacity 0.12s ease;
          transform: scale(0.9);
          opacity: 0;
          pointer-events: auto;
          cursor: pointer;
        }
        .container.visible {
          transform: scale(1);
          opacity: 1;
        }
        .icon {
          width: 22px;
          height: 22px;
          background-repeat: no-repeat;
          background-position: center;
          background-size: contain;
        }
        .file-upload-rectangle {
          position: absolute;
          right: ${BUTTON_SIZE - 8}px;
          top: 50%;
          transform: translateY(-50%) translateX(2px);
          background: white;
          border-radius: 6px;
          padding: 6px 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          opacity: 0;
          transition: all 0.2s ease;
          pointer-events: none;
          white-space: nowrap;
          font-size: 11px;
          color: #333;
          border: 1px solid #e0e0e0;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          z-index: 1;
        }
        .file-upload-rectangle.visible {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
          pointer-events: auto;
        }
        .file-upload-rectangle:hover {
          background: #ffcccb;
          transform: translateY(-50%) translateX(0) scale(1.02);
        }
        .file-icon {
          width: 12px;
          height: 12px;
          background: #f44336;
          border-radius: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 7px;
          font-weight: bold;
        }
        .file-icon.attached {
          background: #FF9800;
        }
        .file-upload-rectangle.attached {
          background: #FFF3E0;
          border-color: #FF9800;
          color: #E65100;
        }
        .file-upload-rectangle.attached:hover {
          background: #ffcccb;
          transform: translateY(-50%) translateX(0) scale(1.02);
        }
        .cover-letter-rectangle {
          position: absolute;
          right: ${BUTTON_SIZE - 8}px;
          top: 50%;
          transform: translateY(-50%) translateX(2px);
          background: white;
          border-radius: 6px;
          padding: 6px 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          opacity: 0;
          transition: all 0.2s ease;
          pointer-events: none;
          white-space: nowrap;
          font-size: 11px;
          color: #333;
          border: 1px solid #e0e0e0;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          z-index: 1;
          margin-top: 30px;
        }
        .cover-letter-rectangle.visible {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
          pointer-events: auto;
        }
        .cover-letter-rectangle:hover {
          background: #f5f5f5;
          transform: translateY(-50%) translateX(0) scale(1.02);
        }
        .cover-letter-icon {
          width: 12px;
          height: 12px;
          background: #2196F3;
          border-radius: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 7px;
          font-weight: bold;
        }
      `;

            this.container = document.createElement('div');
            this.container.className = 'container';
            const icon = document.createElement('div');
            icon.className = 'icon';
            this.container.appendChild(icon);

            this.fileUploadRectangle = document.createElement('div');
            this.fileUploadRectangle.className = 'file-upload-rectangle';

            const fileIcon = document.createElement('div');
            fileIcon.className = 'file-icon';
            fileIcon.textContent = '×';

            const fileText = document.createElement('span');
            fileText.textContent = 'No File';
            fileText.id = 'file-text-display';

            this.fileUploadRectangle.appendChild(fileIcon);
            this.fileUploadRectangle.appendChild(fileText);

            this.coverLetterRectangle = document.createElement('div');
            this.coverLetterRectangle.className = 'cover-letter-rectangle';

            const coverLetterIcon = document.createElement('div');
            coverLetterIcon.className = 'cover-letter-icon';
            coverLetterIcon.textContent = '✍';

            const coverLetterText = document.createElement('span');
            coverLetterText.textContent = 'Write Cover Letter';

            this.coverLetterRectangle.appendChild(coverLetterIcon);
            this.coverLetterRectangle.appendChild(coverLetterText);

            this.initializeIcon(icon);
            this.shadow.appendChild(style);
            this.shadow.appendChild(this.container);
            this.shadow.appendChild(this.fileUploadRectangle);
            this.shadow.appendChild(this.coverLetterRectangle);
        },

        async initializeIcon(icon) {
            try {
                const extensionId = NotificationSystem.getExtensionInfo();
                if (extensionId) {
                    icon.style.backgroundImage = `url(chrome-extension://${extensionId}/icon48.png)`;
                }
            } catch (error) {
                console.warn('Failed to initialize icon:', error);
            }
        },

        setupEventListeners() {
            // Focus tracking
            document.addEventListener('focusin', (e) => {
                const el = e.target;
                if (DOMUtils.isTextEditable(el)) {
                    this.lastFocusedElement = el;

                    if (!this.visible || this.activeElement !== el) {
                        this.showForElement(el);
                    }
                }
            });

            document.addEventListener('focusout', (e) => {
                if (extensionState.isProofreading) return;

                // Don't hide if clicking on buttons
                if (e.relatedTarget && (
                    e.relatedTarget === this.container ||
                    e.relatedTarget === this.fileUploadRectangle ||
                    e.relatedTarget === this.coverLetterRectangle ||
                    this.shadow.contains(e.relatedTarget)
                )) {
                    return;
                }

                if (this.hideTimeout) {
                    clearTimeout(this.hideTimeout);
                }

                this.hideTimeout = setTimeout(() => {
                    if (!this.buttonsVisible && !extensionState.isProofreading) {
                        this.hide();
                    }
                    this.hideTimeout = null;
                }, 300);
            });

            // Selection tracking
            document.addEventListener('selectionchange', () => {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();

                if (selectedText && this.lastFocusedElement && DOMUtils.isTextEditable(this.lastFocusedElement)) {
                    const elementText = DOMUtils.getTextFromElement(this.lastFocusedElement);
                    if (elementText.includes(selectedText)) {
                        this.lastSelection = {
                            text: selectedText,
                            element: this.lastFocusedElement
                        };
                    }
                }
            });

            // Container click for proofreading
            this.container.addEventListener('click', (e) => {
                e.stopPropagation();

                if (this.hideTimeout) {
                    clearTimeout(this.hideTimeout);
                    this.hideTimeout = null;
                }

                if (!this.originalInputElement && this.lastFocusedElement && DOMUtils.isTextEditable(this.lastFocusedElement)) {
                    this.originalInputElement = this.lastFocusedElement;
                }

                this.performAndApplyProofreading();
            });

            // Hover effects with proper button management
            this.container.addEventListener('mouseenter', () => {
                if (this.visible) {
                    if (this.buttonHideTimeout) {
                        clearTimeout(this.buttonHideTimeout);
                        this.buttonHideTimeout = null;
                    }

                    setTimeout(() => {
                        this.showButtons();
                    }, 300);
                }
            });

            this.container.addEventListener('mouseleave', () => {
                this.scheduleButtonHide();
            });

            // Keep buttons visible when hovering over them
            this.fileUploadRectangle.addEventListener('mouseenter', () => {
                if (this.buttonHideTimeout) {
                    clearTimeout(this.buttonHideTimeout);
                    this.buttonHideTimeout = null;
                }
                this.buttonsVisible = true;
            });

            this.fileUploadRectangle.addEventListener('mouseleave', () => {
                this.scheduleButtonHide();
            });

            this.coverLetterRectangle.addEventListener('mouseenter', () => {
                if (this.buttonHideTimeout) {
                    clearTimeout(this.buttonHideTimeout);
                    this.buttonHideTimeout = null;
                }
                this.buttonsVisible = true;
            });

            this.coverLetterRectangle.addEventListener('mouseleave', () => {
                this.scheduleButtonHide();
            });

            // File upload rectangle click
            this.fileUploadRectangle.addEventListener('click', (e) => {
                e.stopPropagation();

                if (this.uploadedFileName && this.storedContent) {
                    this.removeStoredContent();
                }
            });

            // Cover letter rectangle click
            this.coverLetterRectangle.addEventListener('click', (e) => {
                e.stopPropagation();

                chrome.storage.local.get(['uploadedFileName', 'storedContent'], (result) => {
                    if (!result.uploadedFileName || !result.storedContent) {
                        NotificationSystem.showToast('No file attached. Please upload a document first.', 'error');
                        return;
                    }

                    const webpageText = this.extractWebpageText();
                    this.checkForJobDescription(webpageText, result.storedContent);
                });
            });
        },

        showButtons() {
            this.buttonsVisible = true;
            this.fileUploadRectangle.classList.add('visible');
            this.coverLetterRectangle.classList.add('visible');
        },

        scheduleButtonHide() {
            if (this.buttonHideTimeout) {
                clearTimeout(this.buttonHideTimeout);
            }

            this.buttonHideTimeout = setTimeout(() => {
                this.buttonsVisible = false;
                this.fileUploadRectangle.classList.remove('visible');
                this.coverLetterRectangle.classList.remove('visible');
                this.buttonHideTimeout = null;
            }, 200);
        },

        showForElement(el) {
            if (!DOMUtils.isTextEditable(el)) {
                return this.hide();
            }

            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
            }

            if (this.activeElement && this.activeElement !== el && this.proofreaderSession) {
                try {
                    this.proofreaderSession.destroy();
                    this.proofreaderSession = null;
                } catch (error) {
                    console.warn('Error destroying proofreader session on element switch:', error);
                }
            }

            this.activeElement = el;
            this.originalInputElement = el;
            this.positionNearElement(el);
            this.container.classList.add('visible');
            this.visible = true;
        },

        hide() {
            if (extensionState.isProofreading || this.buttonsVisible) return;

            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
                this.hideTimeout = null;
            }

            this.container.classList.remove('visible');
            this.fileUploadRectangle.classList.remove('visible');
            this.coverLetterRectangle.classList.remove('visible');
            this.visible = false;
            this.buttonsVisible = false;
            this.activeElement = null;
            this.originalInputElement = null;

            if (this.proofreaderSession) {
                try {
                    this.proofreaderSession.destroy();
                    this.proofreaderSession = null;
                } catch (error) {
                    console.warn('Error destroying proofreader session on hide:', error);
                }
            }
        },

        positionNearElement(el) {
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const left = rect.right + window.scrollX - 40 - 6;
            const top = rect.bottom + window.scrollY - 40 - 6;
            this.host.style.left = left + 'px';
            this.host.style.top = top + 'px';
        },

        async performAndApplyProofreading() {
            const validation = this.validateTextSelection();
            if (!validation.isValid) {
                NotificationSystem.showToast(validation.error, 'error');
                return;
            }

            const selectedText = validation.selectedText;
            const focusedElement = validation.focusedElement;

            extensionState.isProofreading = true;

            try {
                const session = await this.initializeProofreader();
                if (!session) {
                    throw new Error('Failed to initialize proofreader');
                }

                const proofreadResult = await session.proofread(selectedText);

                if (proofreadResult && proofreadResult.correctedInput) {
                    const correctedText = proofreadResult.correctedInput;

                    const elementText = DOMUtils.getTextFromElement(focusedElement);
                    const isSelectedText = this.lastSelection && this.lastSelection.text && elementText.includes(this.lastSelection.text);

                    if (isSelectedText && correctedText !== selectedText) {
                        DOMUtils.replaceSelectedTextInElement(focusedElement, selectedText, correctedText);
                        NotificationSystem.showToast('Text corrected successfully', 'success');
                    } else if (!isSelectedText && correctedText !== selectedText) {
                        DOMUtils.setTextToElement(focusedElement, correctedText);
                        NotificationSystem.showToast('Text corrected successfully', 'success');
                    } else {
                        NotificationSystem.showToast('No corrections needed', 'success');
                    }

                    this.lastSelection = null;
                }

            } catch (error) {
                console.error('Proofreading failed:', error);
                NotificationSystem.showToast('Proofreading failed', 'error');
                this.lastSelection = null;
            } finally {
                extensionState.isProofreading = false;

                if (this.proofreaderSession) {
                    try {
                        this.proofreaderSession.destroy();
                        this.proofreaderSession = null;
                    } catch (error) {
                        console.warn('Error destroying proofreader session:', error);
                    }
                }
            }
        },

        async initializeProofreader() {
            try {
                if (typeof Proofreader === 'undefined') {
                    throw new Error('Chrome AI Proofreader API is not available');
                }

                if (!this.proofreaderSession) {
                    const options = {
                        expectedInputLanguages: ['en'],
                    };

                    this.proofreaderSession = await Proofreader.create({
                        monitor(m) {
                            m.addEventListener('downloadprogress', (e) => {
                                console.log(`Proofreader downloaded ${e.loaded * 100}%`);
                            });
                        },
                        ...options,
                    });
                }
                return this.proofreaderSession;
            } catch (error) {
                console.error('Failed to initialize Chrome AI Proofreader:', error);
                throw error;
            }
        },

        validateTextSelection() {
            const selection = window.getSelection();
            let selectedText = selection.toString().trim();
            let focusedElement = this.originalInputElement || this.lastFocusedElement;

            if (!selectedText && this.lastSelection && this.lastSelection.text) {
                selectedText = this.lastSelection.text;
                focusedElement = this.lastSelection.element;
            }

            if (!focusedElement) {
                return {
                    isValid: false,
                    error: 'No text input field is focused',
                    selectedText: null,
                    focusedElement: null
                };
            }

            if (!DOMUtils.isTextEditable(focusedElement)) {
                return {
                    isValid: false,
                    error: 'Focused element is not a text input field',
                    selectedText: null,
                    focusedElement: null
                };
            }

            if (!selectedText) {
                const elementText = DOMUtils.getTextFromElement(focusedElement);

                if (!elementText || elementText.trim().length === 0) {
                    return {
                        isValid: false,
                        error: 'No text found in the input field',
                        selectedText: null,
                        focusedElement: null
                    };
                }

                selectedText = elementText;
            } else {
                const elementText = DOMUtils.getTextFromElement(focusedElement);
                if (!elementText.includes(selectedText)) {
                    return {
                        isValid: false,
                        error: 'Selected text must be from the focused field',
                        selectedText: null,
                        focusedElement: null
                    };
                }
            }

            return {
                isValid: true,
                error: null,
                selectedText: selectedText,
                focusedElement: focusedElement
            };
        },

        extractWebpageText() {
            const bodyClone = document.body.cloneNode(true);
            const elementsToRemove = bodyClone.querySelectorAll('script, style, noscript');
            elementsToRemove.forEach(el => el.remove());

            const bodyText = bodyClone.innerText || bodyClone.textContent || '';
            const cleanText = bodyText
                .replace(/\s+/g, ' ')
                .replace(/\n\s*\n/g, '\n')
                .trim();

            return cleanText;
        },

        async checkForJobDescription(text, storedContent) {
            try {
                NotificationSystem.showToast('Analyzing page...', 'info', 4000);

                const prompt = `Analyze the following text and determine if it contains a detailed job description. A job description typically includes:
        - Job title/position
        - Company information
        - Job responsibilities/duties
        - Required qualifications/skills
        - Experience requirements
        - Salary/benefits information
        - Application instructions
        
        Text to analyze:
        "${text.substring(0, 2000)}"
        
        Answer only "YES" if this contains a detailed job description, or "NO" if it does not.`;

                const response = await this.callLanguageModel(prompt, "job description analysis");
                const hasJobDescription = response.trim().toUpperCase();

                if (hasJobDescription === 'YES') {
                    this.generateCoverLetter(text, storedContent);
                } else {
                    NotificationSystem.showToast('No job description found on this page', 'error');
                }

            } catch (error) {
                console.error('Error checking for job description:', error);
                NotificationSystem.showToast('Error analyzing page content', 'error');
            }
        },

        async callLanguageModel(prompt, operationName = "LanguageModel operation") {
            try {
                const modelAvailability = await LanguageModel.availability();
                if (modelAvailability === "unavailable") {
                    throw new Error("Language model unavailable. Enable #prompt-api-for-gemini-nano in chrome://flags.");
                }

                const session = await LanguageModel.create({
                    outputLanguage: "en",
                    monitor(m) {
                        m.addEventListener("downloadprogress", (e) => {
                            console.log(`Downloaded ${e.loaded * 100}%`);
                        });
                    },
                });

                const response = await session.prompt(prompt, { outputLanguage: "en" });
                session.destroy();

                return response;

            } catch (error) {
                console.error(`Error with LanguageModel API for ${operationName}:`, error);
                throw error;
            }
        },

        async generateCoverLetter(jobDescriptionText, resumeContent) {
            try {
                NotificationSystem.showToast('Generating cover letter...', 'info', 4000);

                const coverLetterPrompt = `# Job Description from Webpage

${jobDescriptionText}

# Resume Content

${resumeContent}

# Instructions

Please generate a professional cover letter that:
1. Addresses the specific requirements mentioned in the job description
2. Highlights relevant experience and skills from the resume that match the job requirements
3. Demonstrates understanding of the role and company
4. Is well-structured with proper greeting, body paragraphs, and closing
5. Is professional, engaging, and tailored to this specific position
6. Is approximately 3-4 paragraphs in length
7. Must include info from resume like name, address, phone number, email, etc. instead of using place holders like [Name], [Address], [Phone Number], [Email] NO BRACKETS.

Generate a complete cover letter that the candidate can use for this job application.`;

                const coverLetter = await this.callLanguageModel(coverLetterPrompt, "cover letter generation");

                this.insertCoverLetterIntoInput(coverLetter);

            } catch (error) {
                console.error('Error generating cover letter:', error);
                NotificationSystem.showToast('Error generating cover letter', 'error');
            }
        },

        insertCoverLetterIntoInput(coverLetter) {
            try {
                const targetElement = this.originalInputElement || this.lastFocusedElement;

                if (!targetElement || !DOMUtils.isTextEditable(targetElement)) {
                    NotificationSystem.showToast('No text input found', 'error');
                    return;
                }

                DOMUtils.setTextToElement(targetElement, coverLetter);
                NotificationSystem.showToast('Cover letter generated successfully', 'success');
                targetElement.focus();

            } catch (error) {
                console.error('Error inserting cover letter:', error);
                NotificationSystem.showToast('Error inserting cover letter', 'error');
            }
        },

        checkStoredContent() {
            chrome.storage.local.get(['uploadedFileName', 'storedContent'], (result) => {
                if (result.uploadedFileName && result.storedContent) {
                    this.uploadedFileName = result.uploadedFileName;
                    this.storedContent = result.storedContent;
                    this.updateFileButtonUI();
                }
            });
        },

        updateFileButtonUI() {
            const fileTextElement = this.shadow.getElementById('file-text-display');

            if (fileTextElement) {
                if (this.uploadedFileName && this.storedContent) {
                    fileTextElement.textContent = `📎 ${this.uploadedFileName}`;
                } else {
                    fileTextElement.textContent = 'No File';
                }
            }
        },

        removeStoredContent() {
            chrome.storage.local.remove(['uploadedFileName', 'storedContent'], () => {
                this.uploadedFileName = null;
                this.storedContent = null;
                this.updateFileButtonUI();
                NotificationSystem.showToast('File removed', 'success');
            });
        }
    };

    // ============================================================================
    // EXTENSION INITIALIZATION AND STATE MANAGEMENT
    // ============================================================================

    // Initialize extension state from storage
    chrome.storage.local.get(['voiceControlEnabled', 'floatingIndicatorEnabled'], (result) => {
        extensionState.voiceControlEnabled = result.voiceControlEnabled !== false;
        extensionState.floatingIndicatorEnabled = result.floatingIndicatorEnabled === true;

        // Initialize flows based on state
        if (extensionState.voiceControlEnabled) {
            VoiceControlFlow.init();
        }

        if (extensionState.floatingIndicatorEnabled) {
            FloatingIndicatorFlow.init();
        }
    });

    // Listen for state changes from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'toggleVoiceControl') {
            extensionState.voiceControlEnabled = request.enabled;
            if (request.enabled) {
                VoiceControlFlow.init();
            }
            sendResponse({ success: true });
        } else if (request.action === 'toggleFloatingIndicator') {
            extensionState.floatingIndicatorEnabled = request.enabled;
            if (request.enabled) {
                FloatingIndicatorFlow.init();
            } else {
                if (FloatingIndicatorFlow.host) {
                    FloatingIndicatorFlow.host.remove();
                }
            }
            sendResponse({ success: true });
        } else if (request.action === 'documentParsed') {
            FloatingIndicatorFlow.checkStoredContent();
            sendResponse({ success: true });
        }
    });

    // Make functions globally accessible for popup communication
    window.updateFileButtonUI = () => FloatingIndicatorFlow.updateFileButtonUI();
    window.validateTextSelection = () => FloatingIndicatorFlow.validateTextSelection();
    window.showToast = (message, type) => NotificationSystem.showToast(message, type);

    console.log("AI Text Assistant Pro - Both flows initialized and ready");
})();