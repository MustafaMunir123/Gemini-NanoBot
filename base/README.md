# AI Rewriter Extension

A floating widget Chrome extension that provides AI-powered text rewriting capabilities.

## Features

• **Floating Widget Interface** - Draggable widget that appears on any webpage
• **AI Text Rewriting** - Uses Chrome's Rewriter API for intelligent text transformation
• **Smart Input Detection** - Automatically detects and works with:
  - Regular input fields
  - Text areas
  - Gmail compose boxes (contenteditable)
  - Any editable elements
• **Tone Analysis** - Automatically determines appropriate tone (formal, casual, as-is)
• **Real-time Progress** - Shows progress during model loading and text processing
• **One-click Integration** - Rewrite text directly in focused input fields
• **Custom Instructions** - Specify how you want text to be rewritten

## Usage

1. Enable the widget from the extension popup
2. Click in any text field (Gmail, forms, etc.)
3. Enter text in the widget or use focused field text
4. Add custom instructions (e.g., "make it more formal")
5. Click "Rewrite" to transform the text
6. Drag the widget anywhere on the page

## Requirements

- Chrome browser with Rewriter API enabled
- LanguageModel API enabled (`#prompt-api-for-gemini-nano` flag)
