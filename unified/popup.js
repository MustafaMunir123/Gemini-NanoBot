// ============================================================================
// UNIFIED POPUP CONTROLLER FOR Nano Bot
// ============================================================================

// DOM Elements
const floatingToggle = document.getElementById("floating-toggle");
const documentFileInput = document.getElementById("document-file");
const parseDocumentButton = document.getElementById("parse-document");
const statusDiv = document.getElementById("status");
const checkStatusButton = document.getElementById("check-status");
const modelStatusDiv = document.getElementById("model-status");
const aiModelStatusMessage = document.getElementById("ai-model-status-message");
const howToButton = document.getElementById("how-to-button");

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

    chrome.storage.local.set({ floatingIndicatorEnabled: enabled });

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab || !tab.id) return;

        chrome.tabs.sendMessage(tab.id, {
            action: 'toggleFloatingIndicator',
            enabled: enabled
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('Floating indicator toggle message failed:', chrome.runtime.lastError);
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

// ============================================================================
// AI MODEL STATUS CHECKING
// ============================================================================

// Helper function to show status in AI Model Status section
function showAIModelStatus(message, type = 'info') {
    aiModelStatusMessage.textContent = message;
    aiModelStatusMessage.className = `status ${type}`;
    aiModelStatusMessage.style.display = 'block';

    // Auto-hide after 5 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            aiModelStatusMessage.style.display = 'none';
        }, 5000);
    }
}

// Check AI model status
checkStatusButton.addEventListener('click', async () => {
    checkStatusButton.disabled = true;
    checkStatusButton.textContent = 'Checking...';
    modelStatusDiv.style.display = 'block';

    // Reset all status indicators
    const statusElements = {
        languageModel: document.getElementById('language-model-status'),
        writer: document.getElementById('writer-status'),
        rewriter: document.getElementById('rewriter-status'),
        proofreader: document.getElementById('proofreader-status')
    };

    // Set all to checking state
    Object.values(statusElements).forEach(element => {
        element.textContent = '⏳ Checking...';
        element.className = 'status-indicator checking';
    });

    try {
        // Get the current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            throw new Error('No active tab found');
        }

        // Send message to content script to check AI model status
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'checkAIModelStatus'
        });

        if (response && response.success) {
            const results = response.results;

            // Update status indicators based on results
            if (results.languageModel) {
                statusElements.languageModel.textContent = '✅ Available';
                statusElements.languageModel.className = 'status-indicator success';
            } else {
                statusElements.languageModel.textContent = '❌ Unavailable';
                statusElements.languageModel.className = 'status-indicator error';
            }

            if (results.writer) {
                statusElements.writer.textContent = '✅ Available';
                statusElements.writer.className = 'status-indicator success';
            } else {
                statusElements.writer.textContent = '❌ Unavailable';
                statusElements.writer.className = 'status-indicator error';
            }

            if (results.rewriter) {
                statusElements.rewriter.textContent = '✅ Available';
                statusElements.rewriter.className = 'status-indicator success';
            } else {
                statusElements.rewriter.textContent = '❌ Unavailable';
                statusElements.rewriter.className = 'status-indicator error';
            }

            if (results.proofreader) {
                statusElements.proofreader.textContent = '✅ Available';
                statusElements.proofreader.className = 'status-indicator success';
            } else {
                statusElements.proofreader.textContent = '❌ Unavailable';
                statusElements.proofreader.className = 'status-indicator error';
            }

            // Check if all models are available (exclude missingFlags from the check)
            const modelResults = {
                languageModel: results.languageModel,
                writer: results.writer,
                rewriter: results.rewriter,
                proofreader: results.proofreader
            };
            const allAvailable = Object.values(modelResults).every(status => status === true);
            if (allAvailable) {
                showAIModelStatus('All AI models are ready! 🎉', 'success');
            } else {
                // Generate specific flag guidance
                let flagMessage = 'Enable these Chrome flags:\n';
                if (results.missingFlags && results.missingFlags.length > 0) {
                    results.missingFlags.forEach(flag => {
                        flagMessage += `• ${flag}\n`;
                    });
                    flagMessage += '\nRestart Chrome after enabling flags.';
                } else {
                    flagMessage = 'Some AI models are not available. Check chrome://flags for AI-related flags.';
                }
                showAIModelStatus(flagMessage, 'error');
            }

        } else {
            throw new Error('Failed to check AI model status');
        }

    } catch (error) {
        console.error('Error checking AI model status:', error);

        // Set all to error state
        Object.values(statusElements).forEach(element => {
            element.textContent = '❌ Error';
            element.className = 'status-indicator error';
        });

        showAIModelStatus('Error checking AI model status. Make sure the extension is enabled on this page and try refreshing.', 'error');
    } finally {
        checkStatusButton.disabled = false;
        checkStatusButton.textContent = 'Check AI Model Status';
    }
});

// ============================================================================
// HOW TO BUTTON FUNCTIONALITY
// ============================================================================

// Handle How To button click
howToButton.addEventListener('click', () => {
    try {
        // Create a download link for the howTo.pdf file
        const downloadLink = document.createElement('a');
        downloadLink.href = chrome.runtime.getURL('howTo.pdf');
        downloadLink.download = 'howTo.pdf';
        downloadLink.target = '_blank';

        // Trigger the download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        console.log('How To PDF download initiated');
    } catch (error) {
        console.error('Error downloading How To PDF:', error);
        showStatus('Error downloading How To guide', 'error');
    }
});
