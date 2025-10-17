(() => {
  // Only inject if not already injected
  if (window.__floatingTextButtonInjected) return;

  // Check if extension is enabled
  chrome.storage.local.get(["extensionEnabled"], (result) => {
    if (!result.extensionEnabled) return;

    window.__floatingTextButtonInjected = true;

    const BUTTON_SIZE = 40;
    const MARGIN = 6;

    // Function to get extension ID and icon URL
    function getExtensionInfo() {
      // Try multiple methods to get extension ID
      let extensionId = null;

      // Method 1: Use chrome.runtime if available
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        extensionId = chrome.runtime.id;
        console.log('Got extension ID from chrome.runtime:', extensionId);
      }

      // Method 2: Try to find from script tags
      if (!extensionId) {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
          if (script.src && script.src.includes('content.js')) {
            const match = script.src.match(/chrome-extension:\/\/([^\/]+)/);
            if (match) {
              extensionId = match[1];
              console.log('Got extension ID from script src:', extensionId);
              break;
            }
          }
        }
      }

      // Method 3: Try to find from any chrome-extension URL in the page
      if (!extensionId) {
        const allScripts = document.querySelectorAll('script[src*="chrome-extension://"]');
        if (allScripts.length > 0) {
          const match = allScripts[0].src.match(/chrome-extension:\/\/([^\/]+)/);
          if (match) {
            extensionId = match[1];
            console.log('Got extension ID from any chrome-extension script:', extensionId);
          }
        }
      }

      return extensionId;
    }

    // Function to convert icon to base64 and store in localStorage
    async function storeIconInLocalStorage() {
      const storageKey = 'floating_circle_icon';

      // Check if icon is already stored
      if (localStorage.getItem(storageKey)) {
        console.log('Using cached icon from localStorage');
        return localStorage.getItem(storageKey);
      }

      try {
        const extensionId = getExtensionInfo();

        if (!extensionId) {
          throw new Error('Could not determine extension ID');
        }

        const iconUrl = `chrome-extension://${extensionId}/icon48.png`;
        console.log('Using icon URL:', iconUrl);

        const response = await fetch(iconUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch icon: ${response.status}`);
        }

        const blob = await response.blob();
        console.log('Icon blob size:', blob.size);

        // Convert to base64
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
          reader.onload = function () {
            const base64Data = reader.result;
            localStorage.setItem(storageKey, base64Data);
            console.log('Icon stored in localStorage, length:', base64Data.length);
            resolve(base64Data);
          };
          reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.warn('Failed to store icon in localStorage:', error);
        // Fallback: return URL directly
        const extensionId = getExtensionInfo();
        if (extensionId) {
          return `chrome-extension://${extensionId}/icon48.png`;
        }
        return null;
      }
    }

    const host = document.createElement('div');
    host.id = '__floating_text_button_host';
    host.style.position = 'absolute';
    host.style.top = '0';
    host.style.left = '0';
    host.style.zIndex = 2147483647;
    host.style.pointerEvents = 'none';
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });

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
      .hidden-file-input {
        display: none;
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

    const container = document.createElement('div');
    container.className = 'container';
    const icon = document.createElement('div');
    icon.className = 'icon';
    container.appendChild(icon);

    // Create file upload rectangle
    const fileUploadRectangle = document.createElement('div');
    fileUploadRectangle.className = 'file-upload-rectangle';

    const fileIcon = document.createElement('div');
    fileIcon.className = 'file-icon';
    fileIcon.textContent = '×';

    const fileText = document.createElement('span');
    fileText.textContent = 'No File';
    fileText.id = 'file-text-display';

    fileUploadRectangle.appendChild(fileIcon);
    fileUploadRectangle.appendChild(fileText);

    // Create cover letter rectangle
    const coverLetterRectangle = document.createElement('div');
    coverLetterRectangle.className = 'cover-letter-rectangle';

    const coverLetterIcon = document.createElement('div');
    coverLetterIcon.className = 'cover-letter-icon';
    coverLetterIcon.textContent = '✍';

    const coverLetterText = document.createElement('span');
    coverLetterText.textContent = 'Write Cover Letter';

    coverLetterRectangle.appendChild(coverLetterIcon);
    coverLetterRectangle.appendChild(coverLetterText);

    // No file input needed - just display

    // Initialize the icon from localStorage
    async function initializeIcon() {
      try {
        const iconData = await storeIconInLocalStorage();
        if (iconData) {
          icon.style.backgroundImage = `url(${iconData})`;
          console.log('Icon loaded successfully from localStorage');
        } else {
          throw new Error('No icon data available');
        }
      } catch (error) {
        console.warn('Failed to initialize icon:', error);
        // Fallback to chrome extension URL
        try {
          const extensionId = getExtensionInfo();
          if (extensionId) {
            icon.style.backgroundImage = `url(chrome-extension://${extensionId}/icon48.png)`;
            console.log('Using fallback chrome extension URL');
          } else {
            console.error('Could not determine extension ID for fallback');
          }
        } catch (fallbackError) {
          console.error('All icon loading methods failed:', fallbackError);
        }
      }
    }

    // Initialize the icon
    initializeIcon();

    // Update file button UI based on stored content
    function updateFileButtonUI() {
      console.log('updateFileButtonUI called - uploadedFileName:', uploadedFileName, 'storedContent length:', storedContent ? storedContent.length : 0);

      // Use shadow DOM to find the element
      const fileTextElement = shadow.getElementById('file-text-display');
      console.log('fileTextElement found:', !!fileTextElement);

      if (fileTextElement) {
        if (uploadedFileName && storedContent) {
          // Show filename with a clear indicator
          fileTextElement.textContent = `📎 ${uploadedFileName}`;
          console.log('Button updated to show filename with attachment icon:', uploadedFileName);
        } else {
          fileTextElement.textContent = 'No File';
          console.log('Button updated to show "No File"');
        }
      } else {
        console.error('fileTextElement not found in shadow DOM!');
      }
    }

    // Make updateFileButtonUI globally accessible for popup
    window.updateFileButtonUI = updateFileButtonUI;

    // Make validateTextSelection globally accessible for other flows
    window.validateTextSelection = validateTextSelection;

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'documentParsed') {
        console.log('Document parsed message received:', request);
        // Refresh the stored content and update UI
        checkStoredContent();
        sendResponse({ success: true });
      }
    });

    // Check for stored content on initialization
    function checkStoredContent() {
      chrome.storage.local.get(['uploadedFileName', 'storedContent'], (result) => {
        if (result.uploadedFileName && result.storedContent) {
          uploadedFileName = result.uploadedFileName;
          storedContent = result.storedContent;
          updateFileButtonUI();
          console.log('Found stored content:', result.storedContent.substring(0, 100) + '...');
          console.log('Stored filename:', result.uploadedFileName);
        }
      });
    }

    // Remove stored content and reset UI
    function removeStoredContent() {
      chrome.storage.local.remove(['uploadedFileName', 'storedContent'], () => {
        uploadedFileName = null;
        storedContent = null;
        updateFileButtonUI();
        console.log('Stored content removed and UI reset');
      });
    }

    shadow.appendChild(style);
    shadow.appendChild(container);
    shadow.appendChild(fileUploadRectangle);
    shadow.appendChild(coverLetterRectangle);

    let activeElement = null;
    let originalInputElement = null; // Keep reference to the original input
    let lastFocusedElement = null; // Track the last focused text element
    let visible = false;
    let proofreaderSession = null;
    let hideTimeout = null; // Debounce hiding
    let isProofreading = false; // Track if proofreading is in progress
    let uploadedFileName = null; // Track uploaded file name
    let storedContent = null; // Track stored content
    let lastSelection = null; // Store the last text selection before button click

    // Initialize stored content check after variables are declared
    checkStoredContent();

    function isTextEditable(el) {
      if (!el) return false;

      return el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable ||
        el.classList.contains('editable') ||
        el.getAttribute('role') === 'textbox' ||
        el.getAttribute('aria-label')?.includes('Message Body');
    }


    // Initialize Chrome AI Proofreader
    async function initializeProofreader() {
      try {
        console.log('Checking if Proofreader API is available...');
        console.log('typeof Proofreader:', typeof Proofreader);

        if (typeof Proofreader === 'undefined') {
          throw new Error('Chrome AI Proofreader API is not available');
        }

        if (!proofreaderSession) {
          const options = {
            expectedInputLanguages: ['en'],
          };

          console.log('Creating Chrome AI Proofreader session...');
          proofreaderSession = await Proofreader.create({
            monitor(m) {
              m.addEventListener('downloadprogress', (e) => {
                console.log(`Proofreader downloaded ${e.loaded * 100}%`);
              });
            },
            ...options,
          });
          console.log('Chrome AI Proofreader initialized successfully');
        }
        return proofreaderSession;
      } catch (error) {
        console.error('Failed to initialize Chrome AI Proofreader:', error);
        throw error;
      }
    }

    // Get text from the active element (based on working implementation)
    function getTextFromElement(el) {
      if (!el) return '';

      if (el.isContentEditable || el.classList.contains('editable')) {
        return el.textContent.trim() || el.innerText.trim();
      } else {
        return el.value.trim();
      }
    }

    // Set text to the active element (based on working implementation)
    function setTextToElement(el, text) {
      if (!el) {
        console.error('setTextToElement: No element provided');
        return;
      }

      console.log('setTextToElement: Setting text to element:', el.tagName, 'Text:', text);

      if (el.isContentEditable || el.classList.contains('editable') || el.getAttribute('role') === 'textbox') {
        // Use HTML formatting for DIV elements (like Gmail compose box)
        // Use textContent for INPUT/TEXTAREA elements
        if (el.tagName === 'DIV') {
          // For DIV elements: convert line breaks to HTML for proper formatting
          const htmlText = text.replace(/\n/g, '<br>');
          el.innerHTML = htmlText;
          console.log('setTextToElement: Set DIV innerHTML to:', el.innerHTML);
        } else {
          // For INPUT/TEXTAREA elements: use textContent to preserve plain text
          el.textContent = text;
          console.log('setTextToElement: Set contenteditable textContent to:', el.textContent);
        }

        // Dispatch multiple events to ensure the change is recognized
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('keyup', { bubbles: true }));

        // Focus the element to ensure it's active
        el.focus();
      } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        // For regular input/textarea elements
        el.value = text;
        console.log('setTextToElement: Set input/textarea value to:', el.value);

        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        console.error('setTextToElement: Unsupported element type:', el.tagName);
      }
    }

    // Replace selected text within an element with corrected text
    function replaceSelectedTextInElement(el, originalText, correctedText) {
      if (!el) {
        console.error('replaceSelectedTextInElement: No element provided');
        return;
      }

      console.log('replaceSelectedTextInElement: Replacing text in element:', el.tagName);
      console.log('Original text:', originalText);
      console.log('Corrected text:', correctedText);

      if (el.isContentEditable || el.classList.contains('editable') || el.getAttribute('role') === 'textbox') {
        // For contenteditable elements, get the current text content
        const currentText = el.textContent || el.innerText || '';

        // Replace the first occurrence of the original text with corrected text
        const newText = currentText.replace(originalText, correctedText);

        if (el.tagName === 'DIV') {
          // For DIV elements: convert line breaks to HTML for proper formatting
          const htmlText = newText.replace(/\n/g, '<br>');
          el.innerHTML = htmlText;
          console.log('replaceSelectedTextInElement: Set DIV innerHTML to:', el.innerHTML);
        } else {
          // For other contenteditable elements: use textContent
          el.textContent = newText;
          console.log('replaceSelectedTextInElement: Set contenteditable textContent to:', el.textContent);
        }

        // Dispatch multiple events to ensure the change is recognized
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('keyup', { bubbles: true }));

        // Focus the element to ensure it's active
        el.focus();
      } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        // For regular input/textarea elements
        const currentValue = el.value || '';

        // Replace the first occurrence of the original text with corrected text
        const newValue = currentValue.replace(originalText, correctedText);
        el.value = newValue;

        console.log('replaceSelectedTextInElement: Set input/textarea value to:', el.value);

        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        console.error('replaceSelectedTextInElement: Unsupported element type:', el.tagName);
      }
    }

    // No parsing functions needed - handled in popup




    // No file processing needed - handled in popup

    // Extract all plain text from the current webpage without modifying the DOM
    function extractWebpageText() {
      // Clone the body to avoid modifying the original page
      const bodyClone = document.body.cloneNode(true);

      // Remove script and style elements from the clone only
      const elementsToRemove = bodyClone.querySelectorAll('script, style, noscript');
      elementsToRemove.forEach(el => el.remove());

      // Get all text content from the cloned body
      const bodyText = bodyClone.innerText || bodyClone.textContent || '';

      // Clean up the text - remove extra whitespace and normalize
      const cleanText = bodyText
        .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
        .replace(/\n\s*\n/g, '\n')  // Remove empty lines
        .trim();

      return cleanText;
    }

    // Check if the extracted text contains a detailed job description using prompt API
    async function checkForJobDescription(text, storedContent) {
      try {
        console.log('Checking for job description in extracted text...');

        // Create a prompt to analyze the text
        const prompt = `Analyze the following text and determine if it contains a detailed job description. A job description typically includes:
        - Job title/position
        - Company information
        - Job responsibilities/duties
        - Required qualifications/skills
        - Experience requirements
        - Salary/benefits information
        - Application instructions
        
        Text to analyze:
        "${text.substring(0, 2000)}" // Limit to first 2000 characters for API efficiency
        
        Answer only "YES" if this contains a detailed job description, or "NO" if it does not.`;

        // Use LanguageModel API to analyze the text
        const response = await callLanguageModel(prompt, "job description analysis");
        const hasJobDescription = response.trim().toUpperCase();

        if (hasJobDescription === 'YES') {
          console.log('Job description found in the webpage');
          // Generate cover letter using job description and resume content
          generateCoverLetter(text, storedContent);
        } else {
          console.log('No job description found in the webpage');
          alert('No Job Description found on this page. Please navigate to a job posting page.');
        }

      } catch (error) {
        console.error('Error checking for job description:', error);
        alert('Error analyzing page content. Please try again.');
      }
    }

    // General method for LanguageModel API calls
    async function callLanguageModel(prompt, operationName = "LanguageModel operation") {
      try {
        // Check if LanguageModel is available
        const modelAvailability = await LanguageModel.availability();
        if (modelAvailability === "unavailable") {
          throw new Error("Language model unavailable. Enable #prompt-api-for-gemini-nano in chrome://flags.");
        }

        console.log(`Creating LanguageModel session for ${operationName}...`);

        // Create a session
        const session = await LanguageModel.create({
          outputLanguage: "en",
          monitor(m) {
            m.addEventListener("downloadprogress", (e) => {
              console.log(`Downloaded ${e.loaded * 100}%`);
            });
          },
        });

        // Get response from the model
        const response = await session.prompt(prompt, { outputLanguage: "en" });

        // Destroy the session
        session.destroy();

        console.log(`${operationName} completed successfully`);
        return response;

      } catch (error) {
        console.error(`Error with LanguageModel API for ${operationName}:`, error);
        throw error;
      }
    }

    // Generate cover letter using job description and resume content
    async function generateCoverLetter(jobDescriptionText, resumeContent) {
      try {
        console.log('Generating cover letter...');

        // Create the prompt template
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

Generate a complete cover letter that the candidate can use for this job application.`;

        console.log('Cover letter prompt created:', coverLetterPrompt);

        // Use LanguageModel to generate the cover letter
        const coverLetter = await callLanguageModel(coverLetterPrompt, "cover letter generation");

        console.log('Generated cover letter:', coverLetter);

        // Insert the generated cover letter into the focused input box
        insertCoverLetterIntoInput(coverLetter);

      } catch (error) {
        console.error('Error generating cover letter:', error);
        alert('Error generating cover letter. Please try again.');
      }
    }

    // Insert the generated cover letter into the focused input box
    function insertCoverLetterIntoInput(coverLetter) {
      try {
        // Use the last focused element or the original input element
        const targetElement = originalInputElement || lastFocusedElement;

        if (!targetElement || !isTextEditable(targetElement)) {
          console.error('No valid text input element found to insert cover letter');
          alert('No text input found. Please focus on a text field first.');
          return;
        }

        console.log('Inserting cover letter into element:', targetElement.tagName);

        // Use the existing setTextToElement function to insert the cover letter
        setTextToElement(targetElement, coverLetter);

        // Show success message
        alert('Cover letter generated and inserted successfully!');

        // Focus the element to ensure it's active
        targetElement.focus();

      } catch (error) {
        console.error('Error inserting cover letter:', error);
        alert('Error inserting cover letter. Please try again.');
      }
    }

    // Validate text selection from focused input element
    function validateTextSelection() {
      console.log('Validating text selection...');

      // Step 1: Check if some text is selected (current selection or stored selection)
      const selection = window.getSelection();
      let selectedText = selection.toString().trim();
      let focusedElement = originalInputElement || lastFocusedElement;

      // If no current selection, try to use the stored selection
      if (!selectedText && lastSelection && lastSelection.text) {
        console.log('Using stored selection:', lastSelection.text);
        selectedText = lastSelection.text;
        focusedElement = lastSelection.element;
      }

      // Step 2: Validate that we have a focused input element
      if (!focusedElement) {
        console.log('No focused input element found');
        return {
          isValid: false,
          error: 'No text input field is focused. Please focus on a text field first.',
          selectedText: null,
          focusedElement: null
        };
      }

      if (!isTextEditable(focusedElement)) {
        console.log('Focused element is not text editable');
        return {
          isValid: false,
          error: 'Focused element is not a text input field.',
          selectedText: null,
          focusedElement: null
        };
      }

      // Step 3: If no text is selected, use all text from the focused element
      if (!selectedText) {
        console.log('No text selected, using all text from focused element');
        const elementText = getTextFromElement(focusedElement);

        if (!elementText || elementText.trim().length === 0) {
          console.log('Focused element has no text content');
          return {
            isValid: false,
            error: 'No text found in the focused input field.',
            selectedText: null,
            focusedElement: null
          };
        }

        selectedText = elementText;
        console.log('Using all text from element:', selectedText);
      } else {
        // Step 4: If text is selected, validate that it's from the focused element
        const elementText = getTextFromElement(focusedElement);
        if (!elementText.includes(selectedText)) {
          console.log('Selected text is not from the focused input element');
          return {
            isValid: false,
            error: 'Selected text must be from the currently focused text input field.',
            selectedText: null,
            focusedElement: null
          };
        }
        console.log('Selected text validated:', selectedText);
      }

      console.log('Text validation passed');
      return {
        isValid: true,
        error: null,
        selectedText: selectedText,
        focusedElement: focusedElement
      };
    }

    // Perform proofreading and apply directly
    async function performAndApplyProofreading() {
      console.log('Starting proofreading...');

      // First validate text selection
      const validation = validateTextSelection();
      if (!validation.isValid) {
        alert(validation.error);
        return;
      }

      const selectedText = validation.selectedText;
      const focusedElement = validation.focusedElement;

      console.log('Text to proofread:', selectedText);

      // Set proofreading flag to prevent interference
      isProofreading = true;

      try {
        // Initialize proofreader if needed
        const session = await initializeProofreader();
        if (!session) {
          throw new Error('Failed to initialize proofreader');
        }

        // Perform proofreading on the text (selected or all)
        const proofreadResult = await session.proofread(selectedText);

        if (proofreadResult && proofreadResult.correctedInput) {
          const correctedText = proofreadResult.correctedInput;
          console.log('Proofreading completed - applying corrections');

          // Check if we're working with selected text or all text
          const elementText = getTextFromElement(focusedElement);
          const isSelectedText = lastSelection && lastSelection.text && elementText.includes(lastSelection.text);

          if (isSelectedText && correctedText !== selectedText) {
            // Apply corrections to selected text only
            console.log('Applying corrections to selected text');
            replaceSelectedTextInElement(focusedElement, selectedText, correctedText);
          } else if (!isSelectedText && correctedText !== selectedText) {
            // Apply corrections to all text in the element
            console.log('Applying corrections to all text in element');
            setTextToElement(focusedElement, correctedText);
          } else {
            console.log('No corrections needed');
          }

          // Clear the stored selection after successful proofreading
          lastSelection = null;
        }

      } catch (error) {
        console.error('Proofreading failed:', error);
        // Clear stored selection on error to prevent stale data
        lastSelection = null;
      } finally {
        // Clear proofreading flag
        isProofreading = false;

        // Destroy the proofreader session to free up resources
        if (proofreaderSession) {
          try {
            proofreaderSession.destroy();
            proofreaderSession = null;
          } catch (error) {
            console.warn('Error destroying proofreader session:', error);
          }
        }
      }
    }


    function showForElement(el) {
      if (!isTextEditable(el)) {
        return hide();
      }

      // Clear any pending hide timeout
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }

      // Clean up previous session if switching elements
      if (activeElement && activeElement !== el && proofreaderSession) {
        try {
          proofreaderSession.destroy();
          proofreaderSession = null;
        } catch (error) {
          console.warn('Error destroying proofreader session on element switch:', error);
        }
      }

      activeElement = el;
      originalInputElement = el; // Store reference to the original input element
      positionNearElement(el);
      container.classList.add('visible');
      visible = true;
    }

    function hide() {
      // Don't hide if proofreading is in progress
      if (isProofreading) {
        return;
      }

      // Clear any pending hide timeout
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }

      container.classList.remove('visible');
      fileUploadRectangle.classList.remove('visible');
      coverLetterRectangle.classList.remove('visible');
      visible = false;
      activeElement = null;
      originalInputElement = null; // Clear the original input reference

      // Clean up proofreader session when hiding
      if (proofreaderSession) {
        try {
          proofreaderSession.destroy();
          proofreaderSession = null;
        } catch (error) {
          console.warn('Error destroying proofreader session on hide:', error);
        }
      }
    }

    function positionNearElement(el) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const left = rect.right + window.scrollX - BUTTON_SIZE - MARGIN;
      const top = rect.bottom + window.scrollY - BUTTON_SIZE - MARGIN;
      host.style.left = left + 'px';
      host.style.top = top + 'px';
    }

    // Track text selection changes to preserve selection before button clicks
    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();

      if (selectedText && lastFocusedElement && isTextEditable(lastFocusedElement)) {
        // Check if the selection is within the focused element
        const elementText = getTextFromElement(lastFocusedElement);
        if (elementText.includes(selectedText)) {
          lastSelection = {
            text: selectedText,
            element: lastFocusedElement
          };
          console.log('Text selection captured:', selectedText);
        }
      }
    });

    // Track the last focused input/textarea/contenteditable (based on working implementation)
    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (isTextEditable(el)) {
        console.log('Text input focused, showing circle' + `${el}`,);
        lastFocusedElement = el; // Store the last focused element

        // Only show if not already visible or if it's a different element
        if (!visible || activeElement !== el) {
          showForElement(el);
        }
      }
    });

    document.addEventListener('focusout', (e) => {
      // Don't start hide timeout if proofreading is in progress
      if (isProofreading) {
        return;
      }

      // Don't hide if the focus is moving to our circle or shadow DOM
      if (e.relatedTarget && (e.relatedTarget === container || shadow.contains(e.relatedTarget))) {
        return;
      }

      // Clear any existing hide timeout
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }

      hideTimeout = setTimeout(() => {
        if (document.activeElement !== container &&
          !shadow.contains(document.activeElement) &&
          !isProofreading) {
          hide();
        }
        hideTimeout = null;
      }, 300);
    });
    container.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('Floating circle clicked - starting proofreading');

      // Clear any pending hide timeout when circle is clicked
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }

      // If we don't have an element reference, use the last focused element
      if (!originalInputElement && lastFocusedElement && isTextEditable(lastFocusedElement)) {
        originalInputElement = lastFocusedElement;
      }

      // Directly proofread and apply text
      performAndApplyProofreading();
    });

    let rectangleHideTimeout = null;

    // Add hover event handlers for the file upload rectangle and cover letter rectangle
    container.addEventListener('mouseenter', () => {
      if (visible) {
        console.log('Circle hovered - showing file upload rectangle and cover letter rectangle');
        // Clear any pending hide timeout
        if (rectangleHideTimeout) {
          clearTimeout(rectangleHideTimeout);
          rectangleHideTimeout = null;
        }
        fileUploadRectangle.classList.add('visible');
        coverLetterRectangle.classList.add('visible');
      }
    });

    container.addEventListener('mouseleave', () => {
      // Add a small delay before hiding to allow moving to rectangle
      rectangleHideTimeout = setTimeout(() => {
        fileUploadRectangle.classList.remove('visible');
        coverLetterRectangle.classList.remove('visible');
        rectangleHideTimeout = null;
      }, 150);
    });

    // Keep rectangle visible when hovering over it
    fileUploadRectangle.addEventListener('mouseenter', () => {
      // Clear any pending hide timeout
      if (rectangleHideTimeout) {
        clearTimeout(rectangleHideTimeout);
        rectangleHideTimeout = null;
      }
      fileUploadRectangle.classList.add('visible');
    });

    fileUploadRectangle.addEventListener('mouseleave', () => {
      // Add a small delay before hiding
      rectangleHideTimeout = setTimeout(() => {
        fileUploadRectangle.classList.remove('visible');
        coverLetterRectangle.classList.remove('visible');
        rectangleHideTimeout = null;
      }, 150);
    });

    // Keep cover letter rectangle visible when hovering over it
    coverLetterRectangle.addEventListener('mouseenter', () => {
      // Clear any pending hide timeout
      if (rectangleHideTimeout) {
        clearTimeout(rectangleHideTimeout);
        rectangleHideTimeout = null;
      }
      fileUploadRectangle.classList.add('visible');
      coverLetterRectangle.classList.add('visible');
    });

    coverLetterRectangle.addEventListener('mouseleave', () => {
      // Add a small delay before hiding
      rectangleHideTimeout = setTimeout(() => {
        fileUploadRectangle.classList.remove('visible');
        coverLetterRectangle.classList.remove('visible');
        rectangleHideTimeout = null;
      }, 150);
    });

    // Handle file display rectangle click (now just for removing stored content)
    fileUploadRectangle.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('File display rectangle clicked');

      if (uploadedFileName && storedContent) {
        // If file is already uploaded, remove it
        console.log('Removing stored content for file:', uploadedFileName);
        removeStoredContent();
      } else {
        // No file attached - just show message
        console.log('No file attached');
      }
    });

    // Handle cover letter rectangle click
    coverLetterRectangle.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log('Cover letter rectangle clicked');

      // Check if file data is present in local storage
      chrome.storage.local.get(['uploadedFileName', 'storedContent'], (result) => {
        if (!result.uploadedFileName || !result.storedContent) {
          // No file attached - show message
          alert('No file attached. Please upload a document first.');
          console.log('No file attached for cover letter generation');
          return;
        }

        console.log('File attached:', result.uploadedFileName);
        console.log('File content length:', result.storedContent.length);

        // Extract all plain text from current webpage
        const webpageText = extractWebpageText();
        console.log('Webpage text extracted:', webpageText);

        // Check if the content contains a detailed job description
        checkForJobDescription(webpageText, result.storedContent);
      });
    });

    // No file selection handler needed - files are uploaded via popup

  });
})();
