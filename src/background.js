console.log('Background script loaded');

// Remove the import and define OCR functions inline
async function performOcr(imageData) {
    try {
        // For now, just log the attempt and return dummy data
        // console.log('OCR attempted on image data');
        return { text: 'OCR processing placeholder' };
    } catch (error) {
        // console.error('OCR processing failed:', error);
        throw error;
    }
}

// Move overlay injection to a separate content script function
function injectOverlayScript(tab) {
    return chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
            // This code runs in the context of the web page
            const existingOverlay = document.querySelector('#brainrot-extension-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }

            const overlay = document.createElement('div');
            overlay.id = 'brainrot-extension-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.8);
                z-index: 9999;
                display: flex;
                justify-content: center;
                align-items: center;
            `;

            const iframe = document.createElement('iframe');
            iframe.src = chrome.runtime.getURL('overlay.html');
            iframe.style.cssText = `
                width: 80%;
                height: 80%;
                border: none;
            `;

            overlay.appendChild(iframe);
            document.body.appendChild(overlay);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                }
            });
        }
    });
}

// Listen for extension icon clicks
chrome.action.onClicked.addListener(async function(tab) {
    console.log('Extension icon clicked!');
    try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 100 });
        // console.log('Screenshot captured');

        try {
            const ocrResults = await performOcr(dataUrl);
            // console.log('OCR completed:', ocrResults);

            await chrome.storage.local.set({ 
                screenshot: dataUrl,
                ocrResults: ocrResults
            });
            // console.log('Screenshot and OCR results saved');
        } catch (error) {
            // console.error('OCR processing failed:', error);
            await chrome.storage.local.set({ screenshot: dataUrl });
        }

        await injectOverlayScript(tab);
    } catch (error) {
        console.error('Error:', error);
    }
});

// Handle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureFullPage') {
        chrome.storage.local.get('screenshot', (data) => {
            if (data.screenshot) {
                console.log('Screenshot found in storage');
                sendResponse({ screenshot: data.screenshot });
            } else {
                console.log('No screenshot found in storage');
                sendResponse({ screenshot: null, error: 'No screenshot found in storage' });
            }
        });
        return true; // Will respond asynchronously
    }
});

// Add message listener for closing the overlay
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "closeOverlay") {
        // Close the popup window
        chrome.windows.getCurrent((window) => {
            chrome.windows.remove(window.id);
        });
    }
});

// Update message listener in background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "forceCloseOverlay") {
        try {
            // Try to find and remove the overlay from all tabs
            chrome.tabs.query({active: true}, function(tabs) {
                tabs.forEach(tab => {
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        function: () => {
                            const overlay = document.querySelector('#brainrot-extension-overlay');
                            if (overlay) {
                                overlay.remove();
                            }
                        }
                    });
                });
            });
        } catch (error) {
            console.error('Force close failed:', error);
        }
    }
});