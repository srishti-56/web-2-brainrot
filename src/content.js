console.log('Content script loaded');

function getAccessibleContent(element) {
    const accessibleContent = [];
    let processedElements = 0;
    let mainContentIndex = 0;
    let ariaContent = '';
    
    function extractAccessibleInfo(el, depth = 0) {


        if (el.tagName.toLowerCase() === 'noscript' || el.tagName.toLowerCase() === 'script' || el.tagName.toLowerCase() === 'style') {
            return; // Exit the function if the element is a <noscript> tag
        }

        processedElements++;
        const indent = '  '.repeat(depth);
        const info = {};
        
        // Add index to each element
        info.index = processedElements;
        
        // Determine if this is main content
        info.isMain = isMainContent(el);
        
        // Get ARIA label and description
        info.ariaLabel = el.getAttribute('aria-label');
        info.ariaDescription = el.getAttribute('aria-description');
        
        // Get role
        info.role = el.getAttribute('role');
        
        // Get accessible name
        info.accessibleName = el.getAttribute('title') || el.getAttribute('alt');
        
        // Get actual text content
        info.textContent = el.textContent.trim();

        // If textContent is empty, copy ariaLabel to textContent
        if (info.ariaLabel || info.ariaDescription) {
            ariaContent = info.ariaLabel || info.ariaDescription; // Prefer ariaLabel if both are present
            // append at beginning of textContent if not the same as textContent
            if (info.textContent !== ariaContent) {
                info.textContent = ariaContent + ' ' + info.textContent; 
            }
        }

        if (info.ariaLabel && info.ariaLabel.includes('likes')) {
            console.log('Found likes in element:', {
                tag: el.tagName.toLowerCase(),
                ariaLabel: info.ariaLabel,
                textContent: info.textContent.slice(0, 50) + (info.textContent.length > 50 ? '...' : ''),
                depth: depth // Optional: track the depth of the element in the DOM
            });
        }

        // Check if the current element is part of a group
        const isGroup = el.parentElement && el.parentElement.children.length > 1;

        // If it's a group and the ARIA label is more informative than the text
        if (isGroup && info.ariaLabel && info.ariaLabel.length > info.textContent.length) {
            // console.log(`${indent}Keeping ARIA label as it is more informative than text content.`);
            info.textContent = info.ariaLabel; // Use ARIA label as text content
            accessibleContent.push({
                type: el.tagName.toLowerCase(),
                index: info.index,
                isMain: info.isMain,
                ...info
            });
        }

        const hasChildren = el.children.length > 0;
        let remainingContent = info.textContent;
        
        // Process each child's content individually
        if (hasChildren) {
            // Special types handling remains the same...
            const specialTypes = ['button', 'nav', 'header', 'footer', 'section'];
            const specialRoles = ['group'];
            const parent = el.parentElement;

            if (parent && specialTypes.includes(parent.tagName.toLowerCase()) && (info.textContent.length < 100)) {
                // console.log(`${indent}Keeping parent ${parent.tagName.toLowerCase()} instead of child ${el.tagName.toLowerCase()}`);
                accessibleContent.push({
                    type: parent.tagName.toLowerCase(),
                    index: info.index,
                    isMain: info.isMain,
                    ...info
                });
                return;
            }

            // console.log(`${indent}Found all ${el.children.length} children's content:`);
            const maxChildren = 20;
            const children = Array.from(el.children);
            const childrenToProcess = children.slice(0, maxChildren);
            
            // Instead of trying to remove child text, we'll make a decision based on content length and structure
            const childTexts = childrenToProcess.map(child => {
                let processedText = child.textContent;
                if (child.textContent === '' && (child.ariaLabel || child.ariaDescription)) {
                    processedText = child.ariaLabel || child.ariaDescription;
                }
                return processedText.trim();
            }).filter(text => text.length > 0);

            // Compare parent's text with concatenated children's text
            const parentText = info.textContent.trim();
            const allChildrenText = childTexts.join(' ');

            // If parent text is significantly different from children's combined text,
            // or if parent text is more concise, keep the parent's content
            const shouldKeepParent = parentText.length < allChildrenText.length * 0.8 || 
                                   parentText.length < 100;

            remainingContent = shouldKeepParent ? parentText : '';
        }
        

        // Simplified image handling - only keep alt text
        if (el.tagName.toLowerCase() === 'img') {
            info.isImage = true;
            if (el.alt) {
                info.textContent ='image alt text: ' + el.alt; // Only keep alt text
            }
        }

        // When adding to accessibleContent, preserve all information including index and isMain
        if ((info.ariaLabel || info.ariaDescription || info.role || 
             info.accessibleName || remainingContent || 
             (info.isImage && info.textContent))) {
            
            if (hasChildren && remainingContent) {
                info.textContent = remainingContent;
                accessibleContent.push({
                    type: el.tagName.toLowerCase(),
                    index: info.index,
                    isMain: info.isMain,
                    ...info
                });
            } else if (!hasChildren || (info.isImage && info.textContent)) {
                accessibleContent.push({
                    type: el.tagName.toLowerCase(),
                    index: info.index,
                    isMain: info.isMain,
                    ...info
                });
            }
        } else {
            // console.log(`${indent}Skipping element - no unique accessibility info or content`);
        }
        
        // Process children recursively
        Array.from(el.children).forEach((child, index) => {
            extractAccessibleInfo(child, depth + 1);
        });
    }
    
    // Helper function to determine if element is likely main content
    function isMainContent(el) {
        // Check for common main content indicators
        const mainContentSelectors = [
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'h6',
            'main',
            'article',
            '[role="main"]',
            '#main-content',
            '.main-content',
            'article',
            '.post-content',
            '.content-main',
            'div'
        ];

        // Check if element matches any main content selectors
        const isMainElement = mainContentSelectors.some(selector => {
            try {
                return el.matches(selector);
            } catch {
                return false;
            }
        });

        // Check if element is within main content area
        const hasMainParent = el.closest('main, article, [role="main"]') !== null;

        // Check content length - longer content is more likely to be main content
        const hasSubstantialContent = el.textContent.length > 50;

        // Check for common interactive elements that aren't usually main content
        const isInteractive = el.tagName.toLowerCase() in {
            'button': true,
            'a': true,
            'input': true,
            'select': true,
            'textarea': true
        };

        // Check for navigation elements
        const isNavigation = el.tagName.toLowerCase() === 'nav' || 
                           el.getAttribute('role') === 'navigation';

        // Combine all factors to determine if this is main content
        return (isMainElement || hasMainParent) && 
               hasSubstantialContent && 
               !isInteractive && 
               !isNavigation;
    }

    console.log('Starting content extraction from body');
    extractAccessibleInfo(element);
    
    console.log('Content extraction summary:', {
        totalElementsProcessed: processedElements,
        elementsKept: accessibleContent.length
    });
    
    // Remove duplicate adjacent content and subset content
    const filteredContent = accessibleContent.reduce((acc, current, index, self) => {
        // Skip if this element's text is empty
        if (!current.textContent) {
            return acc;
        }

        // Clean and format the text content first
        current.textContent = splitCamelCase(current.textContent);

        // Get the last 5 elements
        const recentElements = acc.slice(-5);

        // Check for duplicates or subsets within recent elements
        if (isDuplicateOrSubset(current, recentElements)) {
            // console.log('Removing duplicate/subset:', {
            //     current: current.textContent.slice(0, 50),
            //     matchedWithin: recentElements.map(el => el.textContent.slice(0, 50))
            // });
            return acc;
        }

        acc.push(current);
        return acc;
    }, []);

    console.log('Final content stats:', {
        originalCount: accessibleContent.length,
        filteredCount: filteredContent.length,
        removedCount: accessibleContent.length - filteredContent.length
    });
    
    return filteredContent;
}

function splitCamelCase(text) {
    return text
        // Split when going from lowercase to uppercase (byLearn -> by Learn)
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        // Handle special currency cases
        .replace(/(\$)(\d)/g, '$ $2')
        // Handle date formats
        .replace(/(\d+)-([A-Za-z]+)/g, '$1-$2 ')
        // Clean up multiple spaces
        .replace(/\s+/g, ' ')
        .trim();
}

function isDuplicateOrSubset(current, recentElements) {
    // First clean the current text
    const currentText = current.textContent.toLowerCase().trim();
    
    // Break current text into meaningful chunks (split by common separators)
    const currentChunks = currentText.split(/[\s,.-]+/).filter(chunk => chunk.length > 3);
    
    return recentElements.some(prev => {
        if (!prev.textContent) return false;
        
        const prevText = prev.textContent.toLowerCase().trim();
        
        // Check for exact duplicates
        if (prevText === currentText) {
            return true;
        }
        
        // Break previous text into chunks
        const prevChunks = prevText.split(/[\s,.-]+/).filter(chunk => chunk.length > 3);
        
        // Check for significant chunk overlap
        const duplicateChunks = currentChunks.filter(chunk => 
            prevChunks.some(prevChunk => 
                prevChunk.includes(chunk) || chunk.includes(prevChunk)
            )
        );
        
        // If more than 50% of the chunks are duplicates, consider it a duplicate
        const duplicationRatio = duplicateChunks.length / Math.min(currentChunks.length, prevChunks.length);
        
        return duplicationRatio > 0.5;
    });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("Received message in content.js:", request);

    if (request.action === "getPageContent") {
        console.log("Requesting page content...");

        // Get accessibility information from the page
        const accessibleContent = getAccessibleContent(document.body);
        // After processing and filtering accessibleContent
        chrome.storage.local.set({ accessibleContent: accessibleContent }, () => {
            console.log('Accessible content saved to local storage.');
        });
        console.log("Final accessible content:", {
            itemCount: accessibleContent.length,
            sample: accessibleContent.slice(0, 3).map(item => ({
                type: item.type,
                content: item.textContent.slice(0, 50) + (item.textContent.length > 50 ? '...' : '')
            }))
        });

        sendResponse({
            content: accessibleContent,
            baseUrl: document.baseURI
        });
    } else {
        console.warn("Unknown action received:", request.action);
    }
});

// Add message listener for removing overlay
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "removeOverlay") {
        const overlay = document.querySelector('#brainrot-extension-overlay');
        if (overlay) {
            overlay.remove();
        }
        sendResponse({success: true});
    }
});