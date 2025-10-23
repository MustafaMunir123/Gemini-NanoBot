# Nano Bot

Gemini Nano–powered voice-controlled assistant that can handle use cases like context-aware answering, cover letter generation and much more.

*Disclaimer: This extension is only tested in MacOS and Windows 10.*

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Setup](#setup)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Chrome Flags Configuration](#chrome-flags-configuration)
  - [APIs Used](#apis-used)
  - [State Management](#state-management)
- [Contribution Guide](#contribution-guide)
- [License](#license)

## Overview

Nano Bot is a cutting-edge Chrome extension that brings AI-powered writing assistance directly to any website. Built on Google's Gemini Nano models, it provides on-device AI processing without sending data to external servers, ensuring privacy and speed.

The extension operates through two main workflows:

1. **Voice Control Flow**: Hands-free text rewriting and generation using voice commands
2. **Floating Text Indicator Flow**: AI-powered proofreading and cover letter generation with document context

## Demo

Watch the video demonstration to see Nano Bot in action:

[![Nano Bot Demo](demo.mp4)](demo.mp4)

## Features

This tool helps in several day-to-day writing tasks which are:
1. ### Voice assisted Writing / Rewriting:
   Just speak naturally and let the AI understand nature of prompt (write or rewrite) and automatically puts the text in input box.
2. ### Grammar Correction:
    Press the floating button that instantly correct all grammar mistakes in just one click without leaving the input box.
3. ### Context Aware Answering:
    Attach any document, the bot parses the content and now it answers your Write/Rewrite queries from information present in document.
4. ### Cover Letter Writer:
     This powerful tool specifically designed for writing cover letter, effectively fetches Job-Description from webpage and write a tailored cover letter based on your attached resume.
5. ### Selected Text Operation:
     For easy-of-use you can select specific text and now bot rewrites / proofreads only the selected part.


## Setup

### Prerequisites

- **Chrome Canary** latest (recommended) with AI capabilities
- Go to `chrome://components` and search for `Optimization Guide On Device Model` and press check for updates.


### Installation

1. **Download Chrome Canary** (recommended):
   - Visit [Chrome Canary download page](https://www.google.com/chrome/canary/)
   - Download and install Chrome Canary for your operating system
   - Chrome Canary provides the latest AI features and better compatibility

2. **Clone or download this repository**:
   ```bash
   git clone https://github.com/your-username/Gemini-NanoBot.git
   cd Gemini-NanoBot/extension
   ```

3. **Load the extension in Chrome**:
   - Open Chrome Canary
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner
   - Click "Load unpacked" and select the `extension` folder
   - The Nano Bot extension should appear in your Chrome toolbar

### Chrome Flags Configuration

To enable all AI features, you need to activate specific Chrome flags:

1. **Open Chrome Flags**:
   - Navigate to `chrome://flags/` in Chrome Canary

2. **Enable the following flags**:
   ```
   #prompt-api-for-gemini-nano
   #writer-api-for-gemini-nano
   #rewriter-api-for-gemini-nano
   #proofreader-api-for-gemini-nano
   ```

4. **Restart Chrome**:
   - Restart chrome canary browser.

5. **Verify AI Model Status**:
   - Click on the Nano Bot extension icon
   - Click "Check AI Model Status" to verify all models are available
   - All models should show "✅ Available" status

### APIs Used
- **Chrome Extensions API**: For extension functionality and permissions
- **Chrome AI APIs**: Rewriter, Writer, Proofreader, and LanguageModel
- **Web Speech API**: For voice recognition
- **File APIs**: For document parsing and processing

### State Management
- **Chrome Storage API**: Persistent storage for extension settings and uploaded documents
- **Message passing**: Communication between popup, content script, and background
- **Event handling**: Proper cleanup and resource management

## Contribution Guide

We welcome contributions to Nano Bot! Here's how you can get involved:

### Getting Started

1. **Fork the repository**:
   ```bash
   git clone https://github.com/your-username/Gemini-NanoBot.git
   cd Gemini-NanoBot
   ```

2. **Set up development environment**:
   - Install Chrome Canary
   - Enable all required Chrome flags
   - Load the extension in developer mode

3. **Make your changes**:
   - Create a feature branch: `git checkout -b feature/your-feature-name`
   - Make your modifications
   - Test thoroughly on different websites and use cases

### Development Guidelines

1. **Code Style**:
   - Follow existing code patterns and structure
   - Use meaningful variable and function names
   - Add comments for complex logic
   - Maintain consistent indentation

2. **Testing**:
   - Test on multiple websites (Gmail, LinkedIn, job boards, etc.)
   - Verify voice control works with different accents and speech patterns
   - Test document parsing with various file formats and sizes
   - Ensure cross-platform compatibility

3. **Documentation**:
   - Update README.md for new features
   - Add inline comments for complex functions
   - Update troubleshooting section if needed

### Submitting Changes

1. **Create a Pull Request**:
   - Describe your changes clearly
   - Include screenshots or demos if applicable
   - Reference any related issues

2. **Pull Request Template**:
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Documentation update
   - [ ] Performance improvement

   ## Testing
   - [ ] Tested on multiple websites
   - [ ] Verified voice control functionality
   - [ ] Tested document parsing
   - [ ] Cross-platform compatibility verified

   ## Screenshots/Demo
   (if applicable)
   ```

### Areas for Contribution

- **New AI Features**: Additional text processing capabilities
- **UI/UX Improvements**: Better user interface and experience
- **Testing**: Automated tests and quality assurance
- **Accessibility**: Better support for users with disabilities

### Reporting Issues

When reporting issues, please include:
- Chrome version and operating system
- Steps to reproduce the issue
- Expected vs actual behavior
- Screenshots or error messages
- Whether Chrome flags are properly enabled

## License

This project is open source. Please check the original extension licenses for specific terms.

---