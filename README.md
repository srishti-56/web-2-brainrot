# Web2BrainRot Chrome Extension

A Chrome extension that creates an interactive overlay for web content analysis and display. The extension processes webpage content and categorizes text into different sections while providing video playback controls.

## Project Structure

### Main Files

- `manifest.json` - The extension configuration file that defines permissions, resources, and metadata
- `overlay.html` - The main HTML template for the extension's overlay interface
- `overlay.css` - Styles for the overlay interface
- `overlay.js` - UI controller for the overlay interface
- `contentAnalyzer.js` - Content analysis and categorization logic
- `background.js` - Background script handling extension initialization
- `content.js` - Content script for webpage interaction
- `textProcessor.js` - Text processing utilities

### Assets
- `/assets`
  - `128.png`, `48.png` - Extension icons
  - `minecraft-gameplay.mp4` - Sample video file
  - `web2brainrot-logo.png` - Extension logo

### Data Samples
- `/data-samples` - Contains sample data files for testing
  - `substack-homepage-innertext.txt`
  - `sample_html_page.html`

## Core Files Explained

### overlay.js
The main interface controller that handles UI and display logic:

#### Event Listeners
- `playPauseBtn.addEventListener('click')` - Toggles video playback and text display
- `likeBtn.addEventListener('click')` - Handles like button interaction
- `commentBtn.addEventListener('click')` - Handles comment button interaction
- `closeBtn.addEventListener('click')` - Closes the overlay
- `gptDetectionBtn.addEventListener('click')` - Toggles GPT analysis mode

#### UI Management Functions
- `initializeVideoContainer()` - Creates and sets up the video container
- `createCategoryContainers()` - Creates containers for different content categories
- `clearContainers()` - Cleans up category containers
- `startTextDisplay()` - Initiates text display sequence
- `pauseTextDisplay()` - Pauses text display sequence
- `displayNextSentence()` - Controls the display of processed text

### contentAnalyzer.js
Core content analysis to processes webpage content:

#### Analysis Functions
- `analyzeTextWithGPT(text, element)` - Performs GPT-based text analysis
- `categorizeText(text, element, useGPT)` - Categorizes text based on context and content
- `processContent(content)` - Main content processing pipeline

### background.js
Handles extension initialization and overlay injection:

#### Core Functions
- `chrome.action.onClicked.addListener()` - Main extension click handler
- `injectOverlay()` - Creates and injects the overlay interface
  - Removes existing overlay if present
  - Creates overlay container
  - Sets up iframe
  - Handles click-outside behavior

### content.js
Manages communication between webpage and extension:

#### Message Handling
- `chrome.runtime.onMessage.addListener()` - Main message handler
  - Handles 'getPageContent' action
  - Clones and processes page content
  - Sends response with page content and base URL

#### Helper Functions
The content script primarily uses inline functions within the message listener to:
- Clone DOM content
- Process page structure
- Handle message responses

## Technical Details

### State Management
overlay.js maintains several important state variables:
- `isPaused` - Controls text display flow
- `isInitialized` - Tracks overlay initialization
- `useGPTAnalysis` - Toggles GPT analysis mode
- `lastReceivedContent` - Stores last processed content
- `sentences` - Holds processed text segments
- `index` - Tracks current display position

### Content Categories
Text is categorized into five main types:
1. Info - Informational content
2. Interactive - Clickable elements
3. Input - Form elements
4. Navigation - Menu items
5. Images - Image-related content

### Positioning System
Content containers are positioned using the `positions` object:

## Setup and Development

1. Clone the repository
2. Load the extension in Chrome:
   - Open Chrome Extensions (chrome://extensions/)
   - Enable Developer Mode
   - Click "Load unpacked"
   - Select the extension directory

## Usage

1. Click the extension icon on any webpage
2. Use the overlay controls to:
   - Play/pause content analysis
   - Toggle GPT detection
   - View categorized content
   - Interact with media controls

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

[Add your license information here] 