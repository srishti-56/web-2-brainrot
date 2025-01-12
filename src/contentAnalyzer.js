// Content Analysis Module
function categorizeHtml(text, element) {
    console.log('Categorizing text:', text);
    
    const categorized = {
        info: [],
        interactive: [],
        input: [],
        navigation: [],
        images: []
    };

    try {
        const cleanText = (str) => str.replace(/\s+/g, ' ').trim();
        text = cleanText(text);

        // Use role and type information for better categorization
        const tagName = element.toUpperCase();
        const role = element.role;

        // Categorize based on role first
        if (role === 'button' || role === 'link' || role === 'textbox' || role === 'searchbox') {
            categorized.interactive.push(text);
        } else if (role === 'navigation' || role === 'menuitem') {
            categorized.navigation.push(text);
        } else if (role === 'textbox' || role === 'searchbox') {
            categorized.info.push(text);
        } else if (role === 'img' || role === 'figure') {
            categorized.navigation.push(text);
        } else if (tagName === 'BUTTON' || tagName === 'A' || tagName === 'INPUT') {
            categorized.interactive.push(text);
        } else if (tagName === 'P') {
            categorized.info.push(text);
        } else if (tagName === 'HEADER' || tagName === 'NAV') {
            categorized.navigation.push(text);
        } else if (text.match(/(click|follow|subscribe|like|share|search|type|enter)/i)) {
            categorized.interactive.push(text);
        } else if (text.match(/(search|input|type|form|enter)/i)) {
            categorized.navigation.push(text);
        } else if (text.match(/(menu|navigation|home|profile|settings)/i)) {
            categorized.navigation.push(text);
        } else if (text.length > 1 && text.length < 50) {
            // randomly categorize text into navigation or interactive
            const random = Math.random();
            if (random < 0.5) {
                categorized.navigation.push(text);
            } else {
                categorized.interactive.push(text);
            }
        }
        else {
            categorized.info.push(text);
        }
    } catch (error) {
        console.error('Error categorizing text:', error);
    }

    return  {
        navigation: categorized.navigation,
        interactive: categorized.interactive
    };
}

// Add near the top with other constants
const GMAIL_SKIP_PHRASES = [
    "If you're having trouble loading",
    "visit the Gmail help center",
    "Skip to content",
    "Using Gmail with screen readers",
    "Keyboard shortcuts",
    "Gmail (standard view) guide",
    "Main menu",
    "Loading...",
    "Search in mail",
    "Search in chat",
    "Search mail and chat",
    "Loading standard view.",
    "Loading basic HTML",
    "Personal messages and messages that don't appear in other tabs will be shown here",
    "Click to teach Gmail this conversation is not important"
];

// Modify the processContent function to filter out Gmail starter text
async function processContent(content) {
    console.log("Processing content:", content[0]);
    
    const sentences = [];
    content.forEach(item => {
        const text = item.ariaLabel || 
                    item.ariaDescription || 
                    item.accessibleName || 
                    item.textContent;
        
        if (text && text.trim().length > 0) {
            // Split long text into chunks of roughly 100 characters
            // but try to break at natural points like periods or commas
            const chunks = splitLongText(text);
            
            chunks.forEach((chunk, index) => {
                sentences.push({
                    text: chunk,
                    images: [],
                    context: item.type,
                    role: item.role,
                    type: item.type,
                    index: item.index + (index * 0.1), // Keep chunks together but ordered
                    isMain: item.isMain
                });
            });
        }
    });

    sentences.sort((a, b) => {
        if (a.isMain !== b.isMain) return b.isMain ? 1 : -1;
        return a.index - b.index;
    });

    // Add Gmail filter before processing sentences
    const filteredContent = sentences.filter(item => {
        if (!item.text) return false;
        
        // Check if the text contains any of the skip phrases
        return !GMAIL_SKIP_PHRASES.some(phrase => 
            item.text.toLowerCase().includes(phrase.toLowerCase())
        );
    });

    // Use filteredContent instead of sentences for the rest of the processing
    const processedSentences = filteredContent.map(item => ({
        text: item.text,
        isMain: item.isMain,
        type: item.type,
        context: item.context
    })).filter(sentence => {
        // Additional filtering for empty or whitespace-only sentences
        return sentence.text && sentence.text.trim().length > 0;
    });

    return { 
        sentences: processedSentences,
        images: [] 
    };
}

// Add new helper function to split long text
function splitLongText(text) {
    const MAX_LENGTH = 100;
    const chunks = [];
    
    if (text.length <= MAX_LENGTH) {
        return [text];
    }

    let currentChunk = '';
    const words = text.split(' ');

    for (const word of words) {
        if ((currentChunk + ' ' + word).length <= MAX_LENGTH) {
            currentChunk += (currentChunk ? ' ' : '') + word;
        } else {
            if (currentChunk) {
                chunks.push(currentChunk);
            }
            currentChunk = word;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    // Try to break at natural points
    return chunks.map(chunk => {
        const lastPeriod = chunk.lastIndexOf('.');
        const lastComma = chunk.lastIndexOf(',');
        const breakPoint = Math.max(lastPeriod, lastComma);
        
        if (breakPoint > chunk.length * 0.5) { // Only break if it's after halfway
            const nextChunkStart = chunk.slice(breakPoint + 1).trim();
            if (nextChunkStart) {
                chunks.push(nextChunkStart);
            }
            return chunk.slice(0, breakPoint + 1).trim();
        }
        return chunk;
    });
}

export { processContent, categorizeHtml };