import { processContent, categorizeHtml} from './contentAnalyzer.js';

// Get references to elements
const video = document.getElementById('brainrot-video');
const playPauseBtn = document.getElementById('play-pause');
// const likeBtn = document.getElementById('like');
// const commentBtn = document.getElementById('comment');
// const closeBtn = document.getElementById('closeOverlay');
const textOverlay = document.getElementById('text-overlay');
const imageContainer = document.createElement('div');
imageContainer.id = 'image-container';
imageContainer.className = 'text-container images';

let textInterval;
let sentences = [];
let index = 0;
let isInitialized = false;
let images = [];
let screenshot = null;
let lastReceivedContent = null;

// Add positions object near the top with other constants
const positions = {
    // info: { x: 'right', y: 'top', margin: '20px' },
    interactive: { x: 'right', y: 'bottom', margin: '80px' },
    // input: { x: 'center', y: 'top', margin: '20px' },
    navigation: { x: 'left', y: 'top', margin: '20px' },
    // images: { x: 'left', y: 'bottom', margin: '80px' }
};

// Add pause state tracking
let isPaused = true;

// Add near the top with other state variables
let initialNonMainDisplayed = false;
let nonMainQueue = [];
let interactiveElements = [];
let mainContentComplete = false;
let centerTextActive = false;
let lastHeartTime = Date.now();
const HEART_TIMEOUT = 8000; // Show hearts if none shown for 8 seconds
let mainContentCount = 0;
let nonMainContentShown = 0;
const MIN_MAIN_CONTENT = 5;
const NON_MAIN_FALLBACK = 5;

// Add near the top with other state variables
let initialPlayButtonShown = false;

// Add near the top with other state variables
let closeButton = null;

// Add near the top with other state variables
let isSpeaking = false;
let currentUtterance = null;

// Add near the top with other constants
const alienColors = [
    '#00ff9f', // neon green
    '#00ffff', // cyan
    '#9400ff', // electric purple
    '#ff00ff', // magenta
    '#4d4dff', // bright blue
    '#7b61ff', // purple blue
    '#14f195', // matrix green
    '#00bfff', // deep sky blue
    '#bf00ff', // bright purple
    '#ff00c8'  // hot pink
];

// Add near the top with other constants
const heartColors = [
    '#ff66b2', // neon pink
    '#ff9ecd', // soft coral pink
    '#e0b0ff', // mauve
    '#c2a5ff', // periwinkle
    '#00ffff', // cyan
    '#84dfff', // light sky blue
    '#ff85a1', // salmon pink
    '#ffa6c9', // carnation pink
    '#b0e0e6', // powder blue
    '#e6e6fa', // lavender
    '#dda0dd', // plum
    '#f0f8ff'  // alice blue
];

// Add list of known words that should stay together
const knownWords = [
    'iOS',
    'iPhone',
    'iPad',
    'iPod',
    'iMac',
    'macOS',
    'watchOS',
    'tvOS',
    'iCloud',
    'iMessage',
    'iWork',
    'PowerPoint',
    'JavaScript',
    'TypeScript',
    'GitHub',
    'GitLab',
    'LinkedIn',
    'PayPal',
    'YouTube',
    'WhatsApp',
    'WeChat',
    'TikTok',
    'MacBook',
    'AirPods',
    'WiFi',
    'PlayStation',
    'Xbox'
];

// Add near the top with other state variables
let isMuted = false;

// Add function to get random start time
function getRandomStartTime() {
    const duration = video.duration || 30; // Fallback to 30 if duration not available
    const maxStart = Math.max(0, duration - 5); // Leave 5 seconds at end, ensure not negative
    return Math.random() * maxStart;
}

// Play/Pause functionality
playPauseBtn.addEventListener('click', function() {
    if (video.paused) {
        // If video ended, set new random start time before playing
        if (video.currentTime >= video.duration - 0.1) {
            video.currentTime = getRandomStartTime();
        }
        video.play();
        isPaused = false;
        startTextDisplay();
    } else {
        video.pause();
        isPaused = true;
        pauseTextDisplay();
    }
});

// Like button functionality
// likeBtn.addEventListener('click', function() {
//     alert('Liked!');
// });

// Comment button functionality
// commentBtn.addEventListener('click', function() {
//     alert('Comment section');
// });

// // Close button functionality
// closeBtn.addEventListener('click', function() {
//     window.close();
// });

// Add a flag to track if we've done the initial TTS
let hasPlayedInitialTTS = false;

// Initialize the overlay
document.addEventListener('DOMContentLoaded', async function() {
    // Wait for video metadata to load before setting random start
    video.addEventListener('loadedmetadata', function() {
        console.log('Video duration:', video.duration);
        const randomStart = getRandomStartTime();
        console.log('Setting random start time:', randomStart);
        video.currentTime = randomStart;
        // Ensure the time was set correctly
        setTimeout(() => {
            if (video.currentTime < 0.1) {
                console.log('Retrying random start time...');
                video.currentTime = getRandomStartTime();
            }
        }, 100);
    }, { once: true });

    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "getPageContent"}, async function(response) {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                return;
            }

            if (response && response.content) {
                console.log("Received page content:", response.content);
                // Add more detailed logging of main content
                const mainContent = response.content.filter(item => item.isMain);
                console.log("Main content elements:", mainContent.map(item => ({
                    index: item.index,
                    type: item.type,
                    textPreview: item.textContent?.slice(0, 50) + '...'
                })));
                
                let firstmaincontent = mainContent.length > 0 ? mainContent[0].index : 0;
                lastReceivedContent = response.content;

                createCategoryContainers();
                isInitialized = true;

                try {
                    chrome.runtime.sendMessage({action: "captureFullPage"}, async function(screenshotResponse) {
                        if (chrome.runtime.lastError) {
                            console.error(chrome.runtime.lastError);
                            return;
                        }

                        console.log('Screenshot captured successfully: ', screenshotResponse.screenshot.slice(0, 10));
                        screenshot = screenshotResponse.screenshot;
                        const { sentences: processedSentences, images: processedImages } = await processContent(response.content);
                        sentences = processedSentences;
                        images = processedImages;
                    });
                } catch (error) {
                    console.error('Something went wrong: ', error);
                    const { sentences: processedSentences, images: processedImages } = await processContent(response.content);
                    sentences = processedSentences;
                    images = processedImages;
                }

                // Show initial play button after content is loaded
                showInitialPlayButton();
            } else {
                console.error("Unexpected response format:", response);
            }
        });
    });
    displayOcrResults();
});

function initializeVideoContainer() {
    console.log('Initializing video container');
    
    // Create video container if it doesn't exist
    let videoContainer = document.querySelector('.video-container');
    if (!videoContainer) {
        console.log('Creating video container');
        videoContainer = document.createElement('div');
        videoContainer.className = 'video-container';
        
        // Move the video element into the container
        const video = document.getElementById('brainrot-video');
        if (video) {
            console.log('Moving video into container');
            video.parentNode.insertBefore(videoContainer, video);
            videoContainer.appendChild(video);
        } else {
            console.error('Video element not found');
            return null;
        }
    }
    
    return videoContainer;
}

// Create containers when the overlay is initialized
function createCategoryContainers() {
    console.log('Creating category containers');
    
    const videoContainer = initializeVideoContainer();
    if (!videoContainer) {
        console.error('Failed to initialize video container');
        return;
    }
    
    const positions = {
        // info: { x: 'right', y: 'top', margin: '20px' },
        interactive: { x: 'right', y: 'bottom', margin: '80px' },
        // input: { x: 'center', y: 'top', margin: '20px' },
        navigation: { x: 'left', y: 'top', margin: '20px' },
        // images: { x: 'left', y: 'bottom', margin: '80px' }
    };

    // Remove existing containers if any
    document.querySelectorAll('.text-container').forEach(el => el.remove());

    // Create a wrapper for all containers
    const wrapper = document.createElement('div');
    wrapper.id = 'categories-wrapper';
    wrapper.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
        pointer-events: none;
        display: none; // hide by default
    `;
    
    // Create containers for each category
    Object.keys(positions).forEach(category => {
        const container = document.createElement('div');
        container.id = `${category}-container`;
        container.className = `text-container ${category}`;
        
        // Position based on category
        const pos = positions[category];
        container.style.cssText = `
            position: fixed;
            ${pos.x === 'right' ? `right: ${pos.margin}` : ''}
            ${pos.x === 'left' ? `left: ${pos.margin}` : ''}
            ${pos.x === 'center' ? 'left: 50%; transform: translateX(-50%);' : ''}
            ${pos.y === 'top' ? `top: ${pos.margin}` : ''}
            ${pos.y === 'bottom' ? `bottom: ${pos.margin}` : ''}
            z-index: 1000;
        `;
        
        // Add placeholder text
        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder';
        placeholder.textContent = `${category} container`;
        container.appendChild(placeholder);
        
        wrapper.appendChild(container);
        console.log(`Created ${category} container at ${pos.x} ${pos.y}`);
    });

    // Add wrapper to the video container
    videoContainer.appendChild(wrapper);
    console.log('Added categories wrapper to video container');
}

// Update displayNextSentence to respect pause state
async function displayNextComponent() {
    if (!sentences.length || isPaused) return;
    
    // Initialize mainContentCount if not done yet
    if (mainContentCount === 0) {
        mainContentCount = sentences.filter(s => s.isMain).length;
        console.log(`Main content count: ${mainContentCount}`);
    }
    
    if (!initialNonMainDisplayed) {
        // Get first few non-main sentences
        nonMainQueue = sentences.filter(s => !s.isMain).slice(0, 3);
        sentences = sentences.filter(s => s.isMain || !nonMainQueue.includes(s));
        
        // Display initial non-main content in center
        if (nonMainQueue.length > 0) {
            const container = document.createElement('div');
            container.className = 'initial-non-main';
            container.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                text-align: center;
                z-index: 1001;
                transition: all 2s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                display: flex;
                flex-direction: column;
                gap: 15px;
            `;
            
            // Add each non-main sentence
            nonMainQueue.forEach((sentence, index) => {
                const textDiv = document.createElement('div');
                textDiv.style.cssText = `
                    margin: 10px;
                    font-size: 24px;
                    color: white;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    white-space: nowrap;
                    animation: initialBounce 0.5s cubic-bezier(0.36, 0, 0.66, -0.56) ${index * 0.1}s forwards;
                    opacity: 0;
                    transform: translateY(20px);
                `;
                
                const alienEmoji = document.createElement('span');
                alienEmoji.textContent = '👾';
                const randomColor = alienColors[Math.floor(Math.random() * alienColors.length)];
                alienEmoji.style.cssText = `
                    font-size: 28px;
                    filter: drop-shadow(0 0 3px ${randomColor}) 
                            drop-shadow(0 0 5px rgba(255, 255, 255, 0.7));
                    animation: alienBounce 1s ease-in-out infinite;
                `;
                
                const textSpan = document.createElement('span');
                textSpan.textContent = sentence.text;
                
                textDiv.appendChild(alienEmoji);
                textDiv.appendChild(textSpan);
                container.appendChild(textDiv);
            });
            
            document.body.appendChild(container);
            
            // Animate to top-left corner after 2 seconds with bounce
            setTimeout(() => {
                container.style.top = '20px';
                container.style.left = '20px';
                container.style.transform = 'none scale(0.8)';
                container.style.fontSize = '16px';
                
                // Add bounce animation to container during transition
                container.style.animation = 'containerBounce 2s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards';
                
                // Remove after animation
                setTimeout(() => {
                    container.remove();
                    initialNonMainDisplayed = true;
                    displayNextComponent();
                }, 2000);
            }, 2000);
            
            return;
        } else {
            initialNonMainDisplayed = true;
        }
    }
    
    if (index < sentences.length) {
        const current = sentences[index];
        
        // Check if we need to show more non-main content
        if (mainContentCount < MIN_MAIN_CONTENT && !current.isMain) {
            nonMainContentShown++;
        }
        
        // Check if we should show thank you box
        if ((mainContentCount < MIN_MAIN_CONTENT && nonMainContentShown >= NON_MAIN_FALLBACK) ||
            (mainContentCount >= MIN_MAIN_CONTENT && !mainContentComplete && !centerTextActive)) {
            const remainingMain = sentences.slice(index).some(s => s.isMain);
            if (!remainingMain) {
                mainContentComplete = true;
                showInteractiveButtons();
                return;
            }
        }
        
        // Skip if text contains "image"
        if (current.text.toLowerCase() === 'image') {
            index++;
            displayNextComponent();
            return;
        }
        
        // Handle non-main content
        if (!current.isMain) {
            createBouncingGamebot(current.text);
        }
        
        // Handle main content
        if (current.isMain) {
            const categorized = categorizeHtml(current.text, current.type);
            
            // Check if it's been too long since last heart
            const timeSinceHeart = Date.now() - lastHeartTime;
            if (timeSinceHeart > HEART_TIMEOUT) {
                // Force this text to be interactive to trigger hearts
                categorized.interactive = [current.text];
                lastHeartTime = Date.now();
            }
            
            Object.keys(categorized).forEach(category => {
                const container = document.getElementById(`${category}-container`);
                if (container && categorized[category].length) {
                    const item = document.createElement('div');
                    item.className = 'item';
                    item.dataset.context = current.context;
                    item.textContent = categorized[category][0];
                    
                    container.appendChild(item);
                    
                    // Update lastHeartTime when hearts are shown
                    if (category === 'interactive') {
                        lastHeartTime = Date.now();
                        for (let i = 0; i < 3; i++) {
                            setTimeout(() => createFloatingHeart(categorized[category][0]), i * 100);
                        }
                    }
                    // Trigger gamebot for navigation content
                    if (category === 'navigation') {
                        createBouncingGamebot(categorized[category][0]);
                    }
                    
                    while (container.children.length > 5) {
                        container.removeChild(container.firstChild);
                    }
                }
            });
            
            // Display main content text in center with TTS
            textOverlay.innerHTML = '';
            centerTextActive = true;
            
            let processedText = current.text;
            if (!processedText.startsWith('#') && !processedText.startsWith('@')) {
                processedText = splitCamelCase(processedText);
            }
            
            const words = processedText.split(' ').filter(word => word.length > 0);
            
            // Calculate display time based on speech duration
            const wordsPerMinute = 150; // Average speaking rate
            const estimatedDuration = (words.length / wordsPerMinute) * 60 * 1000; // Convert to milliseconds
            const baseDisplayTime = Math.max(2000, estimatedDuration);
            
            const animationDuration = Math.min(1.5, baseDisplayTime / 1000);
            
            // Create and display words with animation
            words.forEach((word, index) => {
                const wordSpan = document.createElement('span');
                wordSpan.className = 'main-text-word';
                wordSpan.textContent = word;
                wordSpan.style.animationDelay = `${index * 0.2}s`;
                wordSpan.style.animationDuration = `${animationDuration}s`;
                textOverlay.appendChild(wordSpan);
                
                if (index < words.length - 1) {
                    textOverlay.appendChild(document.createTextNode(' '));
                }
            });

            // Speak the text
            try {
                if (currentUtterance) {
                    speechSynthesis.cancel(); // Cancel any ongoing speech
                }
                
                isSpeaking = true;
                await speakText(processedText);
                isSpeaking = false;
                
            } catch (error) {
                console.error('TTS error:', error);
                isSpeaking = false;
            }

            // Set timeout to mark center text as inactive
            setTimeout(() => {
                centerTextActive = false;
            }, baseDisplayTime + (words.length * 200)); // Account for word animation delays
        }
        
        index++;
        if (!isPaused) {
            // Wait for speech to finish before showing next component
            const checkSpeechComplete = () => {
                if (isSpeaking) {
                    setTimeout(checkSpeechComplete, 100);
                } else {
                    textInterval = setTimeout(() => {
                        displayNextComponent();
                    }, 500); // Small delay after speech ends
                }
            };
            checkSpeechComplete();
        }
    } else {
        index = 0;
        if (!isPaused) {
            textInterval = setTimeout(() => {
                displayNextComponent();
            }, 2000);
        }
    }
}

// Update startTextDisplay to reset counters
function startTextDisplay() {
    if (isInitialized && !textInterval) {
        isPaused = false;
        mainContentCount = 0;
        nonMainContentShown = 0;
        displayNextComponent();
    }
}

function pauseTextDisplay() {
    isPaused = true;
    if (textInterval) {
        clearTimeout(textInterval);
        textInterval = null;
    }
}

// Add helper function to clear containers
function clearContainers() {
    Object.keys(positions).forEach(category => {
        const container = document.getElementById(`${category}-container`);
        if (container) {
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
            // Re-add placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'placeholder';
            placeholder.textContent = `${category} container`;
            container.appendChild(placeholder);
        }
    });
}

// document.getElementById('download-screenshot').addEventListener('click', () => {
//     downloadScreenshot();
// });

function downloadScreenshot() {
    chrome.storage.local.get('screenshot', (data) => {
        if (data.screenshot) {
            // Create a link element
            const link = document.createElement('a');
            link.href = data.screenshot; // Set the href to the screenshot data URL
            link.download = 'screenshot.jpeg'; // Set the desired file name

            // Append to the body (required for Firefox)
            document.body.appendChild(link);
            link.click(); // Trigger the download
            document.body.removeChild(link); // Clean up

            console.log('Screenshot downloaded as screenshot.jpeg');
        } else {
            console.error('No screenshot found in storage.');
        }
    });

    chrome.storage.local.get('accessibleContent', (data) => {
        // Now download the accessible content
        if (data.accessibleContent) {
            // Convert accessibleContent to a string format
            const contentString = data.accessibleContent.map(item => {
                return Object.entries(item).map(([key, value]) => `${key}: ${value}`).join('\n'); // Format each object
            }).join('\n\n'); // Separate objects with a blank line

            const blob = new Blob([contentString], { type: 'text/plain' }); // Keep as plain text
            const contentLink = document.createElement('a');
            contentLink.href = URL.createObjectURL(blob);
            contentLink.download = 'accessibleContent.txt'; // Keep file name as .txt

            // Append to the body (required for Firefox)
            document.body.appendChild(contentLink);
            contentLink.click(); // Trigger the download
            document.body.removeChild(contentLink); // Clean up

            console.log('Accessible content downloaded as accessibleContent.txt'); // Keep log message
        } else {
            console.error('No accessible content found in storage.');
        }
    });
}

// Add OCR results display
function displayOcrResults() {
    chrome.storage.local.get(['ocrResults'], (data) => {
        if (data.ocrResults && typeof data.ocrResults === 'object') {
            const container = document.getElementById('info-container');
            const ocrDiv = document.createElement('div');
            ocrDiv.className = 'ocr-results';
            
            // Check if ocrResults is an array, if not, convert the text to a simple display
            if (Array.isArray(data.ocrResults)) {
                data.ocrResults.forEach(textLine => {
                    const textElement = document.createElement('div');
                    textElement.className = 'ocr-text';
                    textElement.textContent = textLine.text;
                    textElement.style.cssText = `
                        position: absolute;
                        top: ${textLine.frame?.top || 0}px;
                        left: ${textLine.frame?.left || 0}px;
                        width: ${textLine.frame?.width || 'auto'};
                        height: ${textLine.frame?.height || 'auto'};
                    `;
                    ocrDiv.appendChild(textElement);
                });
            } else {
                // Handle non-array OCR results (like our placeholder)
                const textElement = document.createElement('div');
                textElement.className = 'ocr-text';
                textElement.textContent = data.ocrResults.text || 'OCR results unavailable';
                ocrDiv.appendChild(textElement);
            }
            
            container.appendChild(ocrDiv);
        }
    });
}

// Add heart animation styles and functions after the existing imports
const styleSheet = document.createElement("style");
document.head.appendChild(styleSheet);

// Add heart animation function
function createFloatingHeart(text = '') {
    lastHeartTime = Date.now(); // Update the time whenever a heart is created
    const heartContainer = document.createElement('div');
    heartContainer.className = 'floating-heart';
    
    const heartEmoji = document.createElement('span');
    heartEmoji.textContent = '♥';
    
    // Apply random color with a silvery/neon glow
    const randomColor = heartColors[Math.floor(Math.random() * heartColors.length)];
    heartEmoji.style.cssText = `
        font-size: 32px;
        font-weight: bold;
        color: ${randomColor};
        filter: drop-shadow(0 0 3px ${randomColor}) 
                drop-shadow(0 0 5px rgba(255, 255, 255, 0.7));
    `;
    
    // Add text if provided
    if (text) {
        const textSpan = document.createElement('span');
        textSpan.className = 'heart-text';
        textSpan.textContent = text;
        heartContainer.appendChild(textSpan);
    }
    
    heartContainer.appendChild(heartEmoji);
    
    // Set initial position (bottom right)
    heartContainer.style.right = '80px';
    heartContainer.style.bottom = '80px';
    
    document.body.appendChild(heartContainer);
    
    // Random horizontal variation
    const randomX = Math.random() * 40 - 20; // -20 to +20 pixels
    
    // Animate the heart
    const animation = heartContainer.animate([
        { 
            transform: 'translate(0, 0) scale(1) rotate(0deg)',
            opacity: 1 
        },
        { 
            transform: `translate(${randomX}px, -200px) scale(1.5) rotate(${randomX}deg)`,
            opacity: 0.8
        },
        { 
            transform: `translate(${randomX * 1.5}px, -400px) scale(0.5) rotate(${randomX * 2}deg)`,
            opacity: 0 
        }
    ], {
        duration: 2000,
        easing: 'ease-out'
    });
    
    // Remove the heart element when animation completes
    animation.onfinish = () => heartContainer.remove();
}

// Add click handler for the video container to trigger hearts
document.addEventListener('DOMContentLoaded', function() {
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        videoContainer.addEventListener('click', function(e) {
            for (let i = 0; i < 3; i++) {
                setTimeout(() => createFloatingHeart(), i * 100);
            }
        });
    }
});

// Add gamebot animation function
function createBouncingGamebot(text = '') {
    const botContainer = document.createElement('div');
    botContainer.className = 'floating-gamebot';
    
    const alienEmoji = document.createElement('span');
    alienEmoji.textContent = '👾';  // Changed to alien emoji
    
    // Array of cyberpunk/alien colors
    const alienColors = [
        '#00ff9f', // neon green
        '#00ffff', // cyan
        '#9400ff', // electric purple
        '#ff00ff', // magenta
        '#4d4dff', // bright blue
        '#7b61ff', // purple blue
        '#14f195', // matrix green
        '#00bfff', // deep sky blue
        '#bf00ff', // bright purple
        '#ff00c8'  // hot pink
    ];
    
    // Apply random color with a neon glow
    const randomColor = alienColors[Math.floor(Math.random() * alienColors.length)];
    alienEmoji.style.cssText = `
        font-size: 32px;
        color: ${randomColor};
        filter: drop-shadow(0 0 3px ${randomColor}) 
                drop-shadow(0 0 5px rgba(255, 255, 255, 0.7))
                hue-rotate(${Math.random() * 360}deg);
    `;
    
    // Add text if provided
    if (text) {
        const textSpan = document.createElement('span');
        textSpan.className = 'bot-text';
        textSpan.textContent = text;
        botContainer.appendChild(textSpan);
    }
    
    botContainer.appendChild(alienEmoji);
    
    // Set initial position (top left)
    botContainer.style.left = '20px';
    botContainer.style.top = '20px';
    
    document.body.appendChild(botContainer);
    
    // Add a slight rotation to the bounce
    const animation = botContainer.animate([
        { 
            transform: 'translateY(0) rotate(0deg)',
            offset: 0
        },
        { 
            transform: 'translateY(-20px) rotate(10deg)',
            offset: 0.2
        },
        { 
            transform: 'translateY(0) rotate(-5deg)',
            offset: 0.4
        },
        { 
            transform: 'translateY(-10px) rotate(5deg)',
            offset: 0.6
        },
        { 
            transform: 'translateY(0) rotate(-2deg)',
            offset: 0.8
        },
        { 
            transform: 'translateY(-5px) rotate(0deg)',
            offset: 0.9
        },
        { 
            transform: 'translateY(0) rotate(0deg)',
            offset: 1
        }
    ], {
        duration: 1500,
        easing: 'ease-in-out'
    });
    
    // Fade out after bouncing
    const fadeOut = botContainer.animate([
        { opacity: 1 },
        { opacity: 0 }
    ], {
        delay: 1500,
        duration: 500,
        fill: 'forwards'
    });
    
    // Remove the element after animations complete
    fadeOut.onfinish = () => botContainer.remove();
}

// Add font loading
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

// Update splitCamelCase function
function splitCamelCase(str) {
    // Check if the string exactly matches any known word
    if (knownWords.includes(str)) {
        return str;
    }

    // Check if the string contains any known words and preserve them
    let processedStr = str;
    knownWords.forEach(word => {
        const regex = new RegExp(word, 'g');
        processedStr = processedStr.replace(regex, `___${word}___`);
    });

    // Apply normal camelCase splitting
    processedStr = processedStr
        .replace(/([a-z])([A-Z])/g, '$1 $2')  // split on camelCase
        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')  // split consecutive capitals
        .replace(/(\d)([a-zA-Z])/g, '$1 $2')  // split numbers followed by letters
        .replace(/([a-zA-Z])(\d)/g, '$1 $2')  // split letters followed by numbers
        .toLowerCase();

    // Restore known words
    knownWords.forEach(word => {
        const regex = new RegExp(`___${word}___`, 'gi');
        processedStr = processedStr.replace(regex, word);
    });

    return processedStr;
}

// Add TTS initialization function
function initializeTTS() {
    if ('speechSynthesis' in window) {
        // Load voices
        return new Promise((resolve) => {
            const voices = speechSynthesis.getVoices();
            if (voices.length > 0) {
                resolve(true);
            } else {
                // Wait for voices to be loaded
                speechSynthesis.onvoiceschanged = () => {
                    resolve(true);
                };
            }
        });
    }
    return Promise.resolve(false);
}

// Add function to speak text
function speakText(text) {
    return new Promise((resolve, reject) => {
        if (isMuted) {
            resolve(); // Resolve immediately if muted
            return;
        }
        
        if (!('speechSynthesis' in window)) {
            reject(new Error('Speech synthesis not supported'));
            return;
        }

        // Cancel any ongoing speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        currentUtterance = utterance;
        
        // Get available voices
        const voices = speechSynthesis.getVoices();
        
        // Try to find voices in this preference order
        const preferredVoice = voices.find(voice => 
            voice.name.includes('Zira')
        ) || voices.find(voice => 
            voice.name.includes('Google') && 
            voice.lang.includes('en-US') &&
            voice.name.toLowerCase().includes('female')
        ) || voices.find(voice => 
            voice.lang.includes('en') && 
            voice.name.toLowerCase().includes('female')
        ) || voices.find(voice => 
            voice.lang.includes('en')
        ) || voices[0];

        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        // Configure speech parameters
        utterance.rate = 1.0;     // Normal speed
        utterance.pitch = 1.2;    // Slightly higher pitch
        utterance.volume = 0.9;   // Slightly louder
        
        // Add some personality with variations
        const variations = {
            '!': { rate: 1.2, pitch: 1.3 },    // Excited
            '?': { rate: 1.1, pitch: 1.3 },    // Curious
            '.': { rate: 1.0, pitch: 1.2 }     // Normal
        };
        
        // Apply variations based on ending punctuation
        const lastChar = text.trim().slice(-1);
        if (variations[lastChar]) {
            utterance.rate = variations[lastChar].rate;
            utterance.pitch = variations[lastChar].pitch;
        }

        utterance.onend = () => {
            currentUtterance = null;
            resolve();
        };
        utterance.onerror = (err) => {
            currentUtterance = null;
            reject(err);
        };

        speechSynthesis.speak(utterance);
    });
}

// Modify showInteractiveButtons to include TTS
function showInteractiveButtons() {
    if (!document.querySelector('.final-interactive')) {
        // Get video container dimensions
        const videoContainer = document.querySelector('.video-container');
        const videoRect = videoContainer.getBoundingClientRect();
        const maxWidth = Math.min(videoRect.width * 0.9, 500); // 90% of video width or 500px
        const maxHeight = videoRect.height * 0.8; // 80% of video height

        const container = document.createElement('div');
        container.className = 'final-interactive';
        container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            flex-direction: column;
            gap: clamp(10px, 2vh, 20px);
            z-index: 1001;
            padding: clamp(15px, 3vh, 30px);
            border-radius: 15px;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            border: 2px solid ${alienColors[0]};
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
            width: ${maxWidth}px;
            max-height: ${maxHeight}px;
            overflow-y: auto;
            overflow-x: hidden;
        `;

        // Add thank you text
        const thankYouMsg = document.createElement('div');
        thankYouMsg.style.cssText = `
            color: white;
            text-align: center;
            margin-bottom: clamp(15px, 3vh, 30px);
            font-family: 'Press Start 2P', 'Courier New', monospace;
            font-size: clamp(14px, 2.5vw, 20px);
            line-height: 1.6; 
            opacity: 0;
            animation: fadeIn 1s forwards; 
            text-shadow: 
                2px 2px 0 #000,
                -2px -2px 0 #000,
                2px -2px 0 #000,
                -2px 2px 0 #000,
                0 2px 0 #000,
                2px 0 0 #000,
                0 -2px 0 #000,
                -2px 0 0 #000;
        `;

        // const thankYouText = "Thank you for experiencing web2brainrot!";
        
        thankYouMsg.innerHTML = `
            <span style="
                font-size: clamp(12px, 2vw, 18px); 
                color: ${alienColors[0]};
                display: block;
                margin-top: clamp(10px, 2vh, 15px);
                text-shadow: 
                    1px 1px 0 #000,
                    -1px -1px 0 #000,
                    1px -1px 0 #000,
                    -1px 1px 0 #000;
            ">
                Thank you for experiencing web2brainrot!
            </span>
        `;

        // Initialize TTS and speak the thank you message only the first time
        if (!hasPlayedInitialTTS) {
            initializeTTS().then(success => {
                if (success) {
                    speakText(thankYouText);
                    hasPlayedInitialTTS = true;
                }
            });
        }

        container.appendChild(thankYouMsg);

        // Define the buttons
        const buttons = [
            { text: 'Support on Ko-fi', link: 'https://ko-fi.com/coffeeinspace' },
            { text: 'Follow on Twitter', link: 'https://x.com/coffeeinspace7' },
            { text: 'Keep Creating!', link: null }
        ];

        // Pre-generate random colors for aliens
        const randomAlienColors = buttons.map(() => 
            alienColors[Math.floor(Math.random() * alienColors.length)]
        );

        buttons.forEach((item, index) => {
            const button = document.createElement('button');
            button.className = 'interactive-button';
            const buttonColor = randomAlienColors[index];
            
            button.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 15px;
                background: rgba(0, 0, 0, 0.4);
                border: 2px solid ${buttonColor};
                border-radius: 10px;
                padding: clamp(8px, 2vh, 12px) clamp(15px, 3vw, 25px);
                color: white;
                cursor: pointer;
                transition: all 0.3s ease;
                width: 100%;
                font-family: 'Press Start 2P', 'Courier New', monospace;
                font-size: clamp(8px, 1.5vw, 14px);
                position: relative;
                overflow: hidden;
                animation: buttonAppear 0.5s ${index * 0.2}s backwards;
                text-shadow: 
                    1px 1px 0 #000,
                    -1px -1px 0 #000,
                    1px -1px 0 #000,
                    -1px 1px 0 #000;
                white-space: nowrap;
                text-overflow: ellipsis;
            `;

            // Add alien emoji with random color
            const alien = document.createElement('span');
            alien.textContent = '👾';
            alien.style.cssText = `
                font-size: clamp(12px, 2vw, 20px);
                animation: alienBounce 1s ease-in-out infinite;
                color: ${buttonColor};
                filter: drop-shadow(0 0 3px ${buttonColor}) 
                        drop-shadow(0 0 5px rgba(255, 255, 255, 0.7))
                        hue-rotate(${Math.random() * 360}deg);
            `;

            // Add heart emoji (initially hidden)
            const heart = document.createElement('span');
            heart.textContent = '♥';
            heart.style.cssText = `
                font-size: clamp(14px, 2.5vw, 24px);
                opacity: 0;
                position: absolute;
                right: 15px;
                color: ${heartColors[Math.floor(Math.random() * heartColors.length)]};
                filter: drop-shadow(0 0 3px ${buttonColor});
                transition: opacity 0.3s ease;
            `;

            const text = document.createElement('span');
            text.textContent = item.text;
            text.style.flex = '1';
            text.style.textAlign = 'center';

            button.appendChild(alien);
            button.appendChild(text);
            button.appendChild(heart);

            // Hover effects with random color transitions
            button.addEventListener('mouseenter', () => {
                const newColor = alienColors[Math.floor(Math.random() * alienColors.length)];
                button.style.transform = 'scale(1.05)';
                button.style.backgroundColor = `${buttonColor}22`;
                button.style.borderColor = newColor;
                heart.style.opacity = '1';
                alien.style.color = newColor;
                alien.style.filter = `drop-shadow(0 0 3px ${newColor}) 
                                     drop-shadow(0 0 5px rgba(255, 255, 255, 0.7))
                                     hue-rotate(${Math.random() * 360}deg)`;
            });

            button.addEventListener('mouseleave', () => {
                button.style.transform = 'scale(1)';
                button.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
                button.style.borderColor = buttonColor;
                heart.style.opacity = '0';
                alien.style.color = buttonColor;
                alien.style.filter = `drop-shadow(0 0 3px ${buttonColor}) 
                                     drop-shadow(0 0 5px rgba(255, 255, 255, 0.7))
                                     hue-rotate(${Math.random() * 360}deg)`;
            });

            button.addEventListener('click', () => {
                if (item.link) {
                    window.open(item.link, '_blank');
                } else {
                    // This is the "Keep Creating" button
                    // Show floating hearts with message
                    for (let i = 0; i < 5; i++) {
                        setTimeout(() => createFloatingHeart("Keep creating!"), i * 100);
                    }
                    // Keep everything else as is, don't remove the overlay
                }
            });

            container.appendChild(button);
        });

        document.body.appendChild(container);

        // Add resize observer to handle video container size changes
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const newWidth = Math.min(entry.contentRect.width * 0.9, 500);
                const newHeight = entry.contentRect.height * 0.8;
                container.style.width = `${newWidth}px`;
                container.style.maxHeight = `${newHeight}px`;
            }
        });

        resizeObserver.observe(videoContainer);
    }
}

// Add loop handling to maintain random starts
video.addEventListener('ended', function() {
    video.currentTime = getRandomStartTime();
    if (!isPaused) {
        video.play();
    }
});

// Add the fadeIn animation to overlay.css first
const fadeInAnimation = document.createElement('style');
fadeInAnimation.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
`;
document.head.appendChild(fadeInAnimation);

// Add reset for hasPlayedInitialTTS when extension is first loaded
document.addEventListener('DOMContentLoaded', function() {
    hasPlayedInitialTTS = false;
    // ... rest of existing DOMContentLoaded code ...
});

// Add after createCategoryContainers function
function showInitialPlayButton() {
    if (initialPlayButtonShown) return;
    initialPlayButtonShown = true;

    const playButtonContainer = document.createElement('div');
    playButtonContainer.className = 'initial-play-button-container';
    playButtonContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 1002;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        animation: fadeIn 0.5s ease-out;
    `;

    const playButton = document.createElement('button');
    playButton.className = 'initial-play-button';
    playButton.style.cssText = `
        background: rgba(0, 0, 0, 0.6);
        border: 3px solid ${alienColors[0]};
        border-radius: 50%;
        width: 100px;
        height: 100px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
        animation: pulseGlow 2s infinite;
    `;

    // Add play triangle
    const playIcon = document.createElement('div');
    playIcon.style.cssText = `
        width: 0;
        height: 0;
        border-style: solid;
        border-width: 20px 0 20px 35px;
        border-color: transparent transparent transparent ${alienColors[0]};
        margin-left: 8px;
    `;

    // Add text below button
    const playText = document.createElement('div');
    playText.textContent = "Click to start";
    playText.style.cssText = `
        color: white;
        font-family: 'Press Start 2P', cursive;
        font-size: 16px;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;

    playButton.appendChild(playIcon);
    playButtonContainer.appendChild(playButton);
    playButtonContainer.appendChild(playText);

    // Add hover effects
    playButton.addEventListener('mouseenter', () => {
        playButton.style.transform = 'scale(1.1)';
        const newColor = alienColors[Math.floor(Math.random() * alienColors.length)];
        playButton.style.borderColor = newColor;
        playIcon.style.borderColor = `transparent transparent transparent ${newColor}`;
    });

    playButton.addEventListener('mouseleave', () => {
        playButton.style.transform = 'scale(1)';
        playButton.style.borderColor = alienColors[0];
        playIcon.style.borderColor = `transparent transparent transparent ${alienColors[0]}`;
    });

    // Add click handler
    playButton.addEventListener('click', () => {
        // Fade out animation
        playButtonContainer.style.animation = 'fadeOut 0.5s ease-out forwards';
        
        // Remove after animation
        setTimeout(async () => {
            playButtonContainer.remove();
            
            // Reinitialize content if needed
            if (!sentences.length) {
                try {
                    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
                        chrome.tabs.sendMessage(tabs[0].id, {action: "getPageContent"}, async function(response) {
                            if (chrome.runtime.lastError) {
                                console.error(chrome.runtime.lastError);
                                return;
                            }

                            if (response && response.content) {
                                const { sentences: processedSentences, images: processedImages } = await processContent(response.content);
                                sentences = processedSentences;
                                images = processedImages;
                                
                                // If video is playing, pause it first then play
                                if (!video.paused) {
                                    playPauseBtn.click(); // First click to pause
                                    setTimeout(() => playPauseBtn.click(), 10); // Second click to play
                                } else {
                                    playPauseBtn.click(); // Single click to play
                                }
                            }
                        });
                    });
                } catch (error) {
                    console.error('Error reinitializing content:', error);
                }
            } else {
                // If video is playing, pause it first then play
                if (!video.paused) {
                    playPauseBtn.click(); // First click to pause
                    setTimeout(() => playPauseBtn.click(), 10); // Second click to play
                } else {
                    playPauseBtn.click(); // Single click to play
                }
            }
        }, 500);
    });

    document.body.appendChild(playButtonContainer);
}

// Add new animation keyframes to the styleSheet
styleSheet.textContent += `
    @keyframes pulseGlow {
        0% {
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
        }
        50% {
            box-shadow: 0 0 30px ${alienColors[0]}66;
        }
        100% {
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
        }
    }

    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;

// Add after createCategoryContainers function
function createCloseButton() {
    const button = document.createElement('button');
    button.className = 'close-button';
    button.style.cssText = `
        position: fixed;
        top: 15px;
        right: 15px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.6);
        border: 2px solid ${alienColors[0]};
        color: white;
        font-size: 20px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1003;
        transition: all 0.3s ease;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
    `;

    // Create X symbol
    const closeSymbol = document.createElement('div');
    closeSymbol.style.cssText = `
        position: relative;
        width: 20px;
        height: 20px;
    `;

    // Create the X lines
    const line1 = document.createElement('div');
    const line2 = document.createElement('div');
    
    const lineStyle = `
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 2px;
        background-color: ${alienColors[0]};
        transform-origin: center;
        transition: all 0.3s ease;
    `;

    line1.style.cssText = lineStyle + 'transform: translate(-50%, -50%) rotate(45deg);';
    line2.style.cssText = lineStyle + 'transform: translate(-50%, -50%) rotate(-45deg);';

    closeSymbol.appendChild(line1);
    closeSymbol.appendChild(line2);
    button.appendChild(closeSymbol);

    // Add hover effects
    button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.1)';
        const newColor = alienColors[Math.floor(Math.random() * alienColors.length)];
        button.style.borderColor = newColor;
        line1.style.backgroundColor = newColor;
        line2.style.backgroundColor = newColor;
    });

    button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.borderColor = alienColors[0];
        line1.style.backgroundColor = alienColors[0];
        line2.style.backgroundColor = alienColors[0];
    });

    // Update click handler with multiple close methods
    button.addEventListener('click', () => {
        try {
            // Try to send message to content script first
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (chrome.runtime.lastError) {
                    console.error('Chrome runtime error:', chrome.runtime.lastError);
                    closeOverlayDirectly();
                    return;
                }

                chrome.tabs.sendMessage(tabs[0].id, {action: "removeOverlay"}, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending message:', chrome.runtime.lastError);
                        closeOverlayDirectly();
                    }
                });
            });
        } catch (error) {
            console.error('Error in close handler:', error);
            closeOverlayDirectly();
        }
    });

    document.body.appendChild(button);
    closeButton = button;
}

// Add direct close method as fallback
function closeOverlayDirectly() {
    try {
        // Try to find and remove the overlay directly
        const overlay = window.parent.document.querySelector('#brainrot-extension-overlay');
        if (overlay) {
            overlay.remove();
            return;
        }

        // If we can't find the overlay, try to close the window
        window.close();
    } catch (error) {
        console.error('Error in direct close:', error);
        // Last resort: try to close through background script
        try {
            chrome.runtime.sendMessage({action: "forceCloseOverlay"});
        } catch (e) {
            console.error('All close methods failed:', e);
        }
    }
}

// Add this function to update the controls position
function updateControlsPosition() {
    const controls = document.getElementById('controls');
    if (controls) {
        controls.style.cssText = `
            position: absolute;
            bottom: 30px; /* Move up from default 20px */
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
    }
}

// Modify the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', async function() {
    // First create the interaction buttons container
    const interactionButtons = document.getElementById('interaction-buttons');
    
    // Update play/pause button first
    updatePlayPauseButton();
    
    // Then create and add mute button
    createMuteButton();
    
    // Create close button last (it's positioned absolutely anyway)
    createCloseButton();
    
    // Update controls position
    updateControlsPosition();
    
    // ... rest of existing DOMContentLoaded code ...
});

// Add cleanup for close button in case needed
function cleanup() {
    if (closeButton) {
        closeButton.remove();
        closeButton = null;
    }
    // ... any other cleanup code ...
}

// Modify createMuteButton function to add back the click handler and mute state management
function createMuteButton() {
    const button = document.createElement('button');
    button.className = 'mute-button';
    button.id = 'mute-button';
    button.style.cssText = `
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        padding: 8px;
        margin: 0 5px;
    `;

    // Create speaker icon
    const speakerIcon = document.createElement('div');
    speakerIcon.className = 'speaker-icon';
    speakerIcon.style.cssText = `
        position: relative;
        width: 20px;
        height: 20px;
    `;

    // Create speaker base
    const base = document.createElement('div');
    base.style.cssText = `
        position: absolute;
        left: 0;
        top: 50%;
        width: 12px;
        height: 12px;
        background-color: ${alienColors[0]};
        transform: translateY(-50%);
        clip-path: polygon(0 40%, 100% 0, 100% 100%, 0 60%);
        transition: all 0.3s ease;
    `;

    // Create sound waves
    const waves = document.createElement('div');
    waves.className = 'sound-waves';
    waves.style.cssText = `
        position: absolute;
        left: 14px;
        top: 50%;
        width: 12px;
        height: 12px;
        transform: translateY(-50%);
        transition: all 0.3s ease;
    `;

    // Create wave lines
    const createWave = (rotation) => {
        const wave = document.createElement('div');
        wave.style.cssText = `
            position: absolute;
            left: 0;
            top: 50%;
            width: 8px;
            height: 2.5px;
            background-color: ${alienColors[0]};
            transform: translateY(-50%) rotate(${rotation}deg);
            transform-origin: left center;
            transition: all 0.3s ease;
        `;
        return wave;
    };

    const wave1 = createWave(-30);
    const wave2 = createWave(0);
    const wave3 = createWave(30);

    waves.appendChild(wave1);
    waves.appendChild(wave2);
    waves.appendChild(wave3);

    speakerIcon.appendChild(base);
    speakerIcon.appendChild(waves);
    button.appendChild(speakerIcon);

    // Update hover effects to match other control buttons
    button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.1)';
        const newColor = alienColors[Math.floor(Math.random() * alienColors.length)];
        base.style.backgroundColor = newColor;
        [wave1, wave2, wave3].forEach(wave => {
            wave.style.backgroundColor = newColor;
        });
    });

    button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        base.style.backgroundColor = alienColors[0];
        [wave1, wave2, wave3].forEach(wave => {
            wave.style.backgroundColor = alienColors[0];
        });
    });

    // Add back the mute state management
    const updateMuteState = () => {
        waves.style.opacity = isMuted ? '0' : '1';
        const slashLine = button.querySelector('.mute-slash');
        if (isMuted && !slashLine) {
            const slash = document.createElement('div');
            slash.className = 'mute-slash';
            slash.style.cssText = `
                position: absolute;
                width: 24px;
                height: 2.5px;
                background-color: ${alienColors[0]};
                transform: rotate(45deg);
                transition: all 0.3s ease;
            `;
            button.appendChild(slash);
        } else if (!isMuted && slashLine) {
            slashLine.remove();
        }
    };

    // Add click handler
    button.addEventListener('click', () => {
        isMuted = !isMuted;
        if (isMuted && currentUtterance) {
            speechSynthesis.cancel();
        }
        updateMuteState();
    });

    // Set initial state
    updateMuteState();

    // Add to interaction buttons instead of body
    const interactionButtons = document.getElementById('interaction-buttons');
    interactionButtons.insertBefore(button, document.getElementById('download-screenshot'));
    return button;
}

// Add this function after createMuteButton
function updatePlayPauseButton() {
    const playPauseBtn = document.getElementById('play-pause');
    playPauseBtn.innerHTML = ''; // Clear existing content
    playPauseBtn.style.cssText = `
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        padding: 8px;
        margin: 0 5px;
    `;

    // Create play/pause icon container
    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
        position: relative;
        width: 15px;
        height: 15px;
    `;

    // Create play/pause shapes
    const createBar = () => {
        const bar = document.createElement('div');
        bar.style.cssText = `
            position: absolute;
            width: 4px;
            height: 15px;
            background-color: ${alienColors[0]};
            transition: all 0.3s ease;
        `;
        return bar;
    };

    const leftBar = createBar();
    const rightBar = createBar();
    
    // Position bars for pause state
    leftBar.style.left = '0';
    rightBar.style.right = '0';

    // Create play triangle
    const playTriangle = document.createElement('div');
    playTriangle.style.cssText = `
        position: absolute;
        width: 0;
        height: 0;
        border-style: solid;
        border-width: 7.5px 0 7.5px 13px;
        border-color: transparent transparent transparent ${alienColors[0]};
        left: 1px;
        display: none;
        transition: all 0.3s ease;
    `;

    iconContainer.appendChild(leftBar);
    iconContainer.appendChild(rightBar);
    iconContainer.appendChild(playTriangle);
    playPauseBtn.appendChild(iconContainer);

    // Update icon based on play state
    const updatePlayState = () => {
        if (video.paused) {
            leftBar.style.display = 'none';
            rightBar.style.display = 'none';
            playTriangle.style.display = 'block';
        } else {
            leftBar.style.display = 'block';
            rightBar.style.display = 'block';
            playTriangle.style.display = 'none';
        }
    };

    // Add hover effects
    playPauseBtn.addEventListener('mouseenter', () => {
        playPauseBtn.style.transform = 'scale(1.1)';
        const newColor = alienColors[Math.floor(Math.random() * alienColors.length)];
        leftBar.style.backgroundColor = newColor;
        rightBar.style.backgroundColor = newColor;
        playTriangle.style.borderColor = `transparent transparent transparent ${newColor}`;
    });

    playPauseBtn.addEventListener('mouseleave', () => {
        playPauseBtn.style.transform = 'scale(1)';
        leftBar.style.backgroundColor = alienColors[0];
        rightBar.style.backgroundColor = alienColors[0];
        playTriangle.style.borderColor = `transparent transparent transparent ${alienColors[0]}`;
    });

    // Update initial state
    updatePlayState();

    // Add state change listener
    video.addEventListener('play', updatePlayState);
    video.addEventListener('pause', updatePlayState);

    return playPauseBtn;
}
