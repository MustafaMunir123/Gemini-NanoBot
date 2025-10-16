(() => {
  if (window.__floatingTextButtonInjected) return;
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
        left: ${BUTTON_SIZE + 2}px;
        top: 50%;
        transform: translateY(-50%) translateX(-8px);
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
        background: #f5f5f5;
        transform: translateY(-50%) translateX(0) scale(1.02);
      }
      .file-icon {
        width: 12px;
        height: 12px;
        background: #4CAF50;
        border-radius: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 7px;
        font-weight: bold;
      }
      .hidden-file-input {
        display: none;
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
  fileIcon.textContent = '+';

  const fileText = document.createElement('span');
  fileText.textContent = 'Add File';

  fileUploadRectangle.appendChild(fileIcon);
  fileUploadRectangle.appendChild(fileText);

  // Create hidden file input
  const hiddenFileInput = document.createElement('input');
  hiddenFileInput.type = 'file';
  hiddenFileInput.className = 'hidden-file-input';
  hiddenFileInput.accept = '.txt';
  hiddenFileInput.multiple = false;

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


  shadow.appendChild(style);
  shadow.appendChild(container);
  shadow.appendChild(fileUploadRectangle);
  shadow.appendChild(hiddenFileInput);

  let activeElement = null;
  let originalInputElement = null; // Keep reference to the original input
  let lastFocusedElement = null; // Track the last focused text element
  let visible = false;
  let proofreaderSession = null;
  let hideTimeout = null; // Debounce hiding
  let isProofreading = false; // Track if proofreading is in progress

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

  // Process uploaded file and extract text
  async function processUploadedFile(file) {
    console.log('Processing uploaded file:', file.name, 'Type:', file.type);

    try {
      const text = await file.text();

      if (text.trim()) {
        console.log('Extracted text from file:', text.substring(0, 100) + '...');
        console.log('Full extracted text:', text);
        console.log('Text length:', text.length, 'characters');
        console.log('File content extracted successfully - check console for full text');
      } else {
        console.log('No text content found in file');
        alert('No readable text found in the file. Please try a different file or ensure the file contains text content.');
      }
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error reading file. Please make sure it\'s a valid text file.');
    }
  }

  // Perform proofreading and apply directly
  async function performAndApplyProofreading() {
    console.log('Starting proofreading...');
    if (!originalInputElement) {
      console.error('No original input element found');
      return;
    }

    const text = getTextFromElement(originalInputElement);
    console.log('Text to proofread:', text);
    if (!text.trim()) {
      console.log('No text to proofread - skipping proofreading');
      return;
    }

    // Set proofreading flag to prevent interference
    isProofreading = true;

    try {
      // Initialize proofreader if needed
      const session = await initializeProofreader();
      if (!session) {
        throw new Error('Failed to initialize proofreader');
      }

      // Perform proofreading
      const proofreadResult = await session.proofread(text);

      if (proofreadResult && proofreadResult.correctedInput) {
        const correctedText = proofreadResult.correctedInput;
        console.log('Proofreading completed - applying corrections');

        // Apply the corrected text directly
        if (correctedText !== text) {
          setTextToElement(originalInputElement, correctedText);
        } else {
          console.log('No corrections needed');
        }
      }

    } catch (error) {
      console.error('Proofreading failed:', error);
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

  // Track the last focused input/textarea/contenteditable (based on working implementation)
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (isTextEditable(el)) {
      console.log('Text input focused, showing circle');
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

  // Add hover event handlers for the file upload rectangle
  container.addEventListener('mouseenter', () => {
    if (visible) {
      console.log('Circle hovered - showing file upload rectangle');
      // Clear any pending hide timeout
      if (rectangleHideTimeout) {
        clearTimeout(rectangleHideTimeout);
        rectangleHideTimeout = null;
      }
      fileUploadRectangle.classList.add('visible');
    }
  });

  container.addEventListener('mouseleave', () => {
    // Add a small delay before hiding to allow moving to rectangle
    rectangleHideTimeout = setTimeout(() => {
      fileUploadRectangle.classList.remove('visible');
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
      rectangleHideTimeout = null;
    }, 150);
  });

  // Handle file upload rectangle click
  fileUploadRectangle.addEventListener('click', (e) => {
    e.stopPropagation();
    console.log('File upload rectangle clicked');
    hiddenFileInput.click();
  });

  // Handle file selection
  hiddenFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log('File selected:', file.name);
      processUploadedFile(file);
    }
  });


})();
