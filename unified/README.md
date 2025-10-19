# AI Text Assistant Pro

A unified Chrome extension that combines voice-controlled text rewriting and floating text proofreading with cover letter generation capabilities.

## Features

### 🎤 Voice Control Flow
- **Voice-activated text rewriting**: Press `Ctrl+Q` (or `Cmd+Q` on Mac) to start/stop voice input
- **AI-powered text processing**: Uses Chrome's Rewriter and Writer APIs for intelligent text improvement
- **Smart instruction analysis**: Automatically detects whether you want to write new content or rewrite existing text
- **Universal compatibility**: Works with any text input field on any website
- **Auto-enable**: Automatically enables on first use

### 🔵 Floating Text Indicator Flow
- **Smart proofreading**: AI-powered text correction using Chrome's Proofreader API
- **Cover letter generation**: Automatically generates tailored cover letters from job descriptions and uploaded resumes
- **Document context**: Upload PDF, DOCX, or TXT files to provide context for AI operations
- **Visual feedback**: Floating circle appears next to text inputs with hover options
- **Manual control**: Enable/disable via extension popup

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `unified` folder
5. The extension will appear in your Chrome toolbar

## Usage

### Voice Control
1. **Enable**: Voice control is enabled by default, or toggle it in the extension popup
2. **Activate**: Press `Ctrl+Q` (or `Cmd+Q` on Mac) to start voice input
3. **Speak**: Give voice commands like:
   - "Make this more formal"
   - "Write an email to my boss about the project"
   - "Improve this text"
   - "Create a summary of this content"
4. **Process**: Press `Ctrl+Q` again to stop and process your command

### Floating Text Indicator
1. **Enable**: Toggle "Enable Floating Circle" in the extension popup
2. **Upload context**: Click "Add Document" to upload a resume or document
3. **Use**: Click on any text input field to see the floating circle
4. **Proofread**: Click the circle to proofread selected or all text
5. **Generate cover letter**: Hover over the circle and click "Write Cover Letter" (requires uploaded document and job description page)

## Requirements

- Chrome browser with AI APIs enabled
- Enable `#prompt-api-for-gemini-nano` in `chrome://flags/` for full functionality
- Microphone permission for voice control
- Active internet connection for AI processing

## File Structure

```
unified/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for background tasks
├── content.js            # Main content script with both flows
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality and document parsing
├── icon48.png            # Extension icon (48x48)
├── icon128.png           # Extension icon (128x128)
├── error.mp3             # Error notification sound
├── success.mp3           # Success notification sound
├── pdf.min.js            # PDF parsing library
├── pdf.worker.min.js     # PDF.js worker
├── mammoth.browser.min.js # DOCX parsing library
└── README.md             # This file
```

## Technical Details

### Architecture
- **Modular design**: Both flows are implemented as separate modules within the same content script
- **Shared utilities**: Common functions for DOM manipulation, notifications, and state management
- **Optimized performance**: Efficient resource management and cleanup
- **Independent operation**: Each flow can be enabled/disabled independently

### APIs Used
- **Chrome Extensions API**: For extension functionality and permissions
- **Chrome AI APIs**: Rewriter, Writer, Proofreader, and LanguageModel
- **Web Speech API**: For voice recognition
- **File APIs**: For document parsing and processing

### State Management
- **Chrome Storage API**: Persistent storage for extension settings and uploaded documents
- **Message passing**: Communication between popup, content script, and background
- **Event handling**: Proper cleanup and resource management

## Troubleshooting

### Voice Control Not Working
- Check microphone permissions in Chrome settings
- Ensure `#prompt-api-for-gemini-nano` is enabled in `chrome://flags/`
- Verify the extension is enabled in the popup

### Floating Circle Not Appearing
- Enable "Floating Text Indicator" in the extension popup
- Refresh the page after enabling
- Check that you're on a valid webpage (not chrome:// pages)

### Document Parsing Issues
- Ensure file is in supported format (PDF, DOCX, TXT)
- Check file size (large files may take longer to process)
- Verify file is not corrupted or password-protected

### AI Features Not Working
- Enable `#prompt-api-for-gemini-nano` in `chrome://flags/`
- Restart Chrome after enabling the flag
- Check internet connection
- Verify you're using a supported Chrome version

## Development

### Building from Source
1. Clone the repository
2. All source files are already included - no build process required
3. Load the `unified` folder as an unpacked extension

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source. Please check the original extension licenses for specific terms.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Chrome extension documentation
3. Check Chrome AI API documentation
4. Create an issue in the repository

---

**Note**: This extension requires Chrome with AI capabilities enabled. Some features may not work in all Chrome versions or configurations.
