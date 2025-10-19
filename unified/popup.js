// ============================================================================
// UNIFIED POPUP CONTROLLER FOR Nano Bot
// ============================================================================

// DOM Elements
const floatingToggle = document.getElementById("floating-toggle");
const documentFileInput = document.getElementById("document-file");
const parseDocumentButton = document.getElementById("parse-document");
const statusDiv = document.getElementById("status");

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize extension state from storage
chrome.storage.local.get(["floatingIndicatorEnabled"], (result) => {
    // Default floating indicator to false (user must enable)
    floatingToggle.checked = result.floatingIndicatorEnabled === true;
});


// ============================================================================
// FLOATING INDICATOR FUNCTIONALITY
// ============================================================================

floatingToggle.addEventListener("change", () => {
    const enabled = floatingToggle.checked;

    // Save state to chrome.storage.local
    chrome.storage.local.set({ floatingIndicatorEnabled: enabled });

    // Update floating indicator in the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab || !tab.id) return;

        // Send message to content script to toggle floating indicator
        chrome.tabs.sendMessage(tab.id, {
            action: 'toggleFloatingIndicator',
            enabled: enabled
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('Floating indicator toggle message failed:', chrome.runtime.lastError);
                // Fallback: inject content script if needed
                if (enabled) {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ["content.js"]
                    }).catch((err) => {
                        console.error("Failed to inject script for floating indicator:", err);
                    });
                }
            } else {
                console.log('Floating indicator toggle message sent successfully');
            }
        });
    });
});

// ============================================================================
// DOCUMENT PARSING FUNCTIONALITY
// ============================================================================

// Document parsing libraries
let pdfjsLib = null;
let mammothLib = null;

// Load PDF.js library
async function loadPDFJS() {
    if (pdfjsLib) return pdfjsLib;

    try {
        // Load PDF.js from extension resources
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('pdf.min.js');
        document.head.appendChild(script);

        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
        });

        // Configure PDF.js worker
        pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');

        return pdfjsLib;
    } catch (error) {
        console.error('Error loading PDF.js:', error);
        throw error;
    }
}

// Load Mammoth.js library for DOCX parsing
async function loadMammoth() {
    if (mammothLib) return mammothLib;

    try {
        // Load Mammoth from extension resources
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('mammoth.browser.min.js');
        document.head.appendChild(script);

        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
        });

        mammothLib = window.mammoth;
        return mammothLib;
    } catch (error) {
        console.error('Error loading Mammoth:', error);
        throw error;
    }
}

// Parse TXT file
async function parseTXT(file) {
    try {
        const text = await file.text();
        return text.trim();
    } catch (error) {
        console.error('Error parsing TXT:', error);
        throw error;
    }
}

// Parse DOCX file
async function parseDOCX(file) {
    try {
        const mammoth = await loadMammoth();
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value.trim();
    } catch (error) {
        console.error('Error parsing DOCX:', error);
        throw error;
    }
}

// Parse PDF file
async function parsePDF(file) {
    try {
        const pdfjs = await loadPDFJS();

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';

        // Extract text from all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            const pageText = textContent.items
                .map(item => item.str)
                .join(' ');

            fullText += pageText + '\n';
        }

        return fullText.trim();
    } catch (error) {
        console.error('Error parsing PDF:', error);
        throw error;
    }
}

// Parse document based on file type
async function parseDocument(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    switch (ext) {
        case 'txt':
            return await parseTXT(file);
        case 'docx':
            return await parseDOCX(file);
        case 'pdf':
            return await parsePDF(file);
        default:
            throw new Error(`Unsupported file type: ${ext}. Please upload a .txt, .docx, or .pdf file.`);
    }
}

// Show status message
function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    // Auto-hide after 3 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
}

// Handle document parsing button click
parseDocumentButton.addEventListener('click', async () => {
    // First, trigger file selection
    documentFileInput.click();
});

// Handle file selection and immediately parse
documentFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) {
        return; // User cancelled file selection
    }

    parseDocumentButton.disabled = true;
    parseDocumentButton.textContent = 'Parsing...';
    showStatus(`Selected: ${file.name} - Parsing document, please wait...`, 'info');

    try {
        const text = await parseDocument(file);

        if (text.trim()) {
            // Store the extracted text in chrome.storage.local (shared across extension contexts)
            chrome.storage.local.set({
                'uploadedFileName': file.name,
                'storedContent': text
            }, () => {
                showStatus(`Document parsed successfully!\nExtracted ${text.length} characters.`, 'success');
                console.log('Document text extracted:', text);

                // Clear the file input
                documentFileInput.value = '';
                parseDocumentButton.textContent = 'Add Document';

                // Notify content script to update UI
                chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                    if (tab.id) {
                        // Send message to content script
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'documentParsed',
                            fileName: file.name,
                            textLength: text.length
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.log('Document parsed message send failed:', chrome.runtime.lastError);
                            } else {
                                console.log('Document parsed message sent successfully');
                            }
                        });
                    }
                });
            });
        } else {
            showStatus('No text found in document', 'error');
            parseDocumentButton.textContent = 'Add Document';
        }
    } catch (error) {
        console.error('Document parsing error:', error);
        showStatus(`Error: ${error.message}`, 'error');
        parseDocumentButton.textContent = 'Add Document';
    } finally {
        parseDocumentButton.disabled = false;
    }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Handle popup window events
window.addEventListener('load', () => {
    console.log('Nano Bot popup loaded');

    // Ensure content script is injected on popup open
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab && tab.id) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["content.js"]
            }).catch((err) => {
                console.log('Content script already injected or injection failed:', err);
            });
        }
    });
});

// Handle popup close
window.addEventListener('beforeunload', () => {
    console.log('Nano Bot popup closing');
});
