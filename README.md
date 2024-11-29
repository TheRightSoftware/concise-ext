# Concise - Chrome Extension

Concise is a Chrome extension that helps you quickly understand any webpage by converting long articles into 4-5 key bullet points.

## Features

- Convert any webpage into concise bullet points
- Highlight important information automatically
- Support for clipboard text when page content isn't accessible
- Easy copy-paste functionality
- Persistent settings across tabs
- Cache system for faster repeated access

## Prerequisites

Before installing the extension, you'll need:
1. Google Chrome browser
2. HuggingFace API key (free)
3. Basic understanding of Chrome extensions

## Installation

1. Get your HuggingFace API key:
   - Go to https://huggingface.co/
   - Sign up for a free account
   - Navigate to Settings → Access Tokens
   - Create a new token with "read" access
   - Copy your API key (starts with "hf_")

2. Install the extension:
   - Download this repository as ZIP or clone it:
     ```bash
     git clone https://github.com/TheRightSoftware/concise-ext.git
     ```
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `concise-ext` folder

3. Configure the extension:
   - Click the Concise icon in your Chrome toolbar
   - Enter your HuggingFace API key
   - Click "Save API Key"
   - Wait for validation confirmation

## Usage

### Basic Usage
1. Navigate to any webpage you want to summarize
2. Click the Concise icon in your toolbar
3. Click "Summarize This Page"
4. View your bullet-point summary

### Advanced Features
- **Refresh**: Click the refresh icon to get a new summary
- **Copy**: Use the "Copy to Clipboard" button to share
- **Clipboard Mode**: If a page can't be accessed directly, copy its text and use the extension
- **Highlights**: Important information is automatically bold for quick scanning

## Development

Built with:
- HTML/CSS for the interface
- JavaScript for functionality
- Chrome Extensions API
- HuggingFace's bart-large-cnn model

To contribute:
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Troubleshooting

Common issues and solutions:
1. **Extension not appearing**: Ensure it's enabled in Chrome extensions
2. **API key not working**: Verify you have the correct permissions
3. **No summary generated**: Check if the page has enough content
4. **Can't access page**: Try using clipboard mode

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Created By

[The Right Software](https://therightsw.com)