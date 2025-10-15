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
    `;

  const container = document.createElement('div');
  container.className = 'container';
  const icon = document.createElement('div');
  icon.className = 'icon';
  container.appendChild(icon);

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

  let activeElement = null;
  let originalInputElement = null; // Keep reference to the original input
  let lastFocusedElement = null; // Track the last focused text element
  let visible = false;
  let proofreaderSession = null;
  let currentCorrectedText = null;
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


  // Perform proofreading and apply directly
  async function performAndApplyProofreading() {
    console.log('performAndApplyProofreading called');
    console.log('originalInputElement:', originalInputElement);

    if (!originalInputElement) {
      console.error('No original input element found');
      return;
    }

    const text = getTextFromElement(originalInputElement);
    console.log('Text to proofread:', text);

    if (!text.trim()) {
      console.log('No text to proofread');
      return;
    }

    // Set proofreading flag to prevent interference
    isProofreading = true;
    console.log('Proofreading started, preventing hide timeout');

    try {
      console.log('Initializing proofreader...');
      // Initialize proofreader if needed
      const session = await initializeProofreader();
      if (!session) {
        throw new Error('Failed to initialize proofreader');
      }

      console.log('Session created, performing proofreading...');
      // Perform proofreading
      const proofreadResult = await session.proofread(text);

      console.log('Proofread result:', proofreadResult);

      if (proofreadResult && proofreadResult.correctedInput) {
        const correctedText = proofreadResult.correctedInput;
        console.log('Corrected text:', correctedText);

        // Apply the corrected text directly
        if (correctedText !== text) {
          console.log('Applying corrected text to input field');
          setTextToElement(originalInputElement, correctedText);
          console.log('Text applied successfully');
        } else {
          console.log('No corrections needed');
        }
      } else {
        console.log('No corrections found or invalid result');
      }

    } catch (error) {
      console.error('Proofreading failed:', error);
    } finally {
      // Clear proofreading flag
      isProofreading = false;
      console.log('Proofreading completed, allowing hide timeout');

      // Destroy the proofreader session to free up resources
      if (proofreaderSession) {
        try {
          proofreaderSession.destroy();
          console.log('Proofreader session destroyed');
          proofreaderSession = null;
        } catch (error) {
          console.warn('Error destroying proofreader session:', error);
        }
      }
    }
  }


  function showForElement(el) {
    console.log('showForElement called with:', el);
    if (!isTextEditable(el)) {
      console.log('Element is not text editable, hiding');
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
        console.log('Proofreader session destroyed on element switch');
        proofreaderSession = null;
      } catch (error) {
        console.warn('Error destroying proofreader session on element switch:', error);
      }
    }

    activeElement = el;
    originalInputElement = el; // Store reference to the original input element
    console.log('Set originalInputElement to:', originalInputElement);
    positionNearElement(el);
    container.classList.add('visible');
    visible = true;
  }

  function hide() {
    // Don't hide if proofreading is in progress
    if (isProofreading) {
      console.log('Cannot hide while proofreading is in progress');
      return;
    }

    // Clear any pending hide timeout
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

    container.classList.remove('visible');
    visible = false;
    activeElement = null;
    originalInputElement = null; // Clear the original input reference

    // Clean up proofreader session when hiding
    if (proofreaderSession) {
      try {
        proofreaderSession.destroy();
        console.log('Proofreader session destroyed on hide');
        proofreaderSession = null;
      } catch (error) {
        console.warn('Error destroying proofreader session on hide:', error);
      }
    }

    // Reset corrected text
    currentCorrectedText = null;
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
    console.log('focusin event on:', el);
    if (isTextEditable(el)) {
      console.log('Element is text editable, showing circle');
      lastFocusedElement = el; // Store the last focused element

      // Only show if not already visible or if it's a different element
      if (!visible || activeElement !== el) {
        showForElement(el);
      } else {
        console.log('Circle already visible for this element');
      }
    } else {
      console.log('Element is not text editable');
    }
  });

  document.addEventListener('focusout', (e) => {
    console.log('focusout event on:', e.target);

    // Don't start hide timeout if proofreading is in progress
    if (isProofreading) {
      console.log('Proofreading in progress, skipping hide timeout');
      return;
    }

    // Clear any existing hide timeout
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }

    // Don't hide immediately, wait a bit to see if focus moves to our widget
    hideTimeout = setTimeout(() => {
      // Only hide if focus didn't move to our widget and not proofreading
      if (document.activeElement !== container &&
        !shadow.contains(document.activeElement) &&
        !isProofreading) {
        console.log('Focus moved away from input, hiding circle');
        hide();
      } else {
        console.log('Focus is on our widget or proofreading, keeping circle visible');
      }
      hideTimeout = null;
    }, 300);
  });
  container.addEventListener('click', (e) => {
    e.stopPropagation();
    console.log('Floating circle clicked - starting proofreading');
    console.log('activeElement:', activeElement);
    console.log('originalInputElement:', originalInputElement);

    // If we don't have an element reference, try to find the last focused element
    if (!originalInputElement && !activeElement) {
      console.log('No element reference found, trying to find last focused element');
      console.log('lastFocusedElement:', lastFocusedElement);

      // First try the last focused element if it has text
      if (lastFocusedElement && isTextEditable(lastFocusedElement)) {
        const text = getTextFromElement(lastFocusedElement);
        if (text.trim()) {
          originalInputElement = lastFocusedElement;
          console.log('Using last focused element with text:', lastFocusedElement);
        }
      }

      // If last focused element doesn't have text, try to find elements with content
      if (!originalInputElement) {
        const contentEditableElements = document.querySelectorAll('[contenteditable="true"]');
        const textInputs = document.querySelectorAll('input[type="text"], input[type="email"], textarea');

        // First try contenteditable elements (like Gmail compose)
        for (const input of contentEditableElements) {
          if (input.offsetParent !== null && input.textContent.trim()) {
            originalInputElement = input;
            console.log('Found contenteditable element with text:', input);
            break;
          }
        }

        // If no contenteditable with text, try regular inputs with content
        if (!originalInputElement) {
          for (const input of textInputs) {
            if (input.offsetParent !== null && input.value.trim()) {
              originalInputElement = input;
              console.log('Found input element with text:', input);
              break;
            }
          }
        }
      }

      // If still no element, use the last focused element as last resort
      if (!originalInputElement && lastFocusedElement) {
        originalInputElement = lastFocusedElement;
        console.log('Using last focused element as fallback:', lastFocusedElement);
      }
    }

    // Directly proofread and apply text
    performAndApplyProofreading();
  });


})();
