// Content script for Perplexity AI pages
// Injects "Import to Branestawm" button to scrape AI responses

let importButton = null;
let isProcessing = false;

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePerplexityImport);
} else {
    initializePerplexityImport();
}

function initializePerplexityImport() {
    // Wait a bit for Perplexity to load content
    setTimeout(findAndInjectImportButton, 3000);
    
    // Watch for dynamic content changes (Perplexity is heavily dynamic)
    const observer = new MutationObserver((mutations) => {
        // Check if our button or wrapper was removed
        const existingButton = document.querySelector('#branestawm-import-btn');
        const existingWrapper = document.querySelector('#branestawm-import-wrapper');
        
        if (!existingButton && !existingWrapper) {
            console.log('🔄 Import button was removed, re-injecting...');
            importButton = null;
            setTimeout(findAndInjectImportButton, 1000);
        } else if (!importButton && existingButton) {
            // Reconnect to existing button
            importButton = existingButton;
            console.log('🔗 Reconnected to existing import button');
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });
    
    // Also try periodically in case mutations aren't caught
    setInterval(() => {
        const existingButton = document.querySelector('#branestawm-import-btn');
        if (!existingButton) {
            findAndInjectImportButton();
        } else if (!importButton) {
            importButton = existingButton;
        }
    }, 5000);
}

function findAndInjectImportButton() {
    if (!isPerplexityPage()) return;
    
    // Check if we already have a button in the DOM
    const existingButton = document.querySelector('#branestawm-import-btn');
    if (existingButton) {
        importButton = existingButton;
        return;
    }
    
    // If we have a reference to the button but it's not in DOM, reset it
    if (importButton && !document.contains(importButton)) {
        importButton = null;
    }
    
    // Look for Perplexity AI response
    const aiResponse = findPerplexityResponse();
    if (aiResponse) {
        console.log('✅ Found Perplexity response, injecting import button');
        injectImportButton(aiResponse);
    } else {
        console.log('❌ No suitable Perplexity response found for import');
    }
}

function isPerplexityPage() {
    return window.location.hostname.includes('perplexity.ai') && 
           (document.querySelector('[data-testid="copilot-answer"]') || 
            document.querySelector('.prose') || 
            document.querySelector('[role="main"]'));
}

function findPerplexityResponse() {
    // Try multiple selectors for Perplexity AI responses
    const selectors = [
        '[data-testid="copilot-answer"]', // Main Perplexity answer
        '.prose.prose-slate', // Answer content area
        '[data-testid="answer"]', // Alternative answer selector
        '.answer-content', // Answer content
        '.copilot-answer', // Copilot specific answer
        '.streaming-answer', // Streaming response
        '.markdown-content', // Markdown formatted content
        'main .prose', // Main prose content
        '[role="main"] .prose', // Main role prose
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim().length > 100) {
            console.log('🔍 Found Perplexity response with selector:', selector);
            return element;
        }
    }
    
    // Enhanced fallback: look for paragraphs that look like AI responses
    const allParagraphs = document.querySelectorAll('p, div[class*="my-"], div[class*="prose"], .text-content, [class*="answer"]');
    let bestMatch = null;
    let bestScore = 0;
    
    for (const element of allParagraphs) {
        const text = element.textContent.trim();
        if (text.length < 150) continue; // Too short
        
        // Skip elements that are clearly not responses
        if (element.querySelector('input, button, nav, select, textarea')) continue;
        if (element.closest('.sidebar, .header, .footer, nav')) continue;
        
        // Score based on content characteristics
        let score = 0;
        score += text.length > 300 ? 2 : 1; // Length bonus
        score += text.includes('.') ? 1 : 0; // Has sentences
        score += text.split(/[.!?]/).length > 3 ? 1 : 0; // Multiple sentences
        score += element.classList.toString().includes('animate') ? 1 : 0; // Animated content (like streaming)
        score += element.closest('[role="main"], main') ? 2 : 0; // In main content area
        
        if (score > bestScore) {
            bestScore = score;
            bestMatch = element;
        }
    }
    
    if (bestMatch && bestScore >= 3) {
        console.log('🔍 Found best Perplexity response candidate with score:', bestScore, bestMatch);
        return bestMatch;
    }
    
    console.log('❌ No suitable Perplexity response found on this page');
    return null;
}

function injectImportButton(aiResponse) {
    // Create import button
    importButton = document.createElement('button');
    importButton.id = 'branestawm-import-btn';
    importButton.className = 'branestawm-import-button';
    importButton.setAttribute('data-branestawm', 'import-button');
    importButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
        </svg>
        Import to Branestawm
    `;
    
    importButton.style.cssText = `
        background: #20808d !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 10px 18px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        margin: 16px 0 !important;
        transition: background 0.2s ease !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif !important;
        box-shadow: 0 2px 8px rgba(32, 128, 141, 0.2) !important;
        position: sticky !important;
        top: 20px !important;
        z-index: 10000 !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        width: fit-content !important;
        min-width: 200px !important;
        max-width: 300px !important;
    `;
    
    importButton.addEventListener('mouseenter', () => {
        importButton.style.background = '#1a6d78';
    });
    
    importButton.addEventListener('mouseleave', () => {
        importButton.style.background = '#20808d';
    });
    
    importButton.addEventListener('click', handleImportClick);
    
    // Find a stable container to insert the button
    let container = null;
    
    // Try to find a stable parent container
    const candidateContainers = [
        document.querySelector('main'),
        document.querySelector('[role="main"]'),
        document.querySelector('.prose')?.parentElement,
        aiResponse.closest('div[class*="container"]'),
        aiResponse.closest('div[class*="content"]'),
        aiResponse.parentElement,
        aiResponse
    ];
    
    for (const candidate of candidateContainers) {
        if (candidate && candidate !== aiResponse) {
            container = candidate;
            break;
        }
    }
    
    // If no good container found, use the response element
    if (!container) container = aiResponse;
    
    // Create a wrapper div to contain our button and make it less likely to be removed
    const buttonWrapper = document.createElement('div');
    buttonWrapper.id = 'branestawm-import-wrapper';
    buttonWrapper.setAttribute('data-branestawm', 'wrapper');
    buttonWrapper.style.cssText = `
        position: relative !important;
        z-index: 10000 !important;
        margin: 20px 0 !important;
        padding: 10px !important;
        background: rgba(255, 255, 255, 0.02) !important;
        border-radius: 12px !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        backdrop-filter: blur(10px) !important;
    `;
    
    buttonWrapper.appendChild(importButton);
    
    // Insert the wrapper after the AI response
    if (container === aiResponse) {
        container.parentNode.insertBefore(buttonWrapper, container.nextSibling);
    } else {
        container.appendChild(buttonWrapper);
    }
    
    console.log('✅ Import button injected successfully');
}

function handleImportClick() {
    if (isProcessing) return;
    
    isProcessing = true;
    importButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px; animation: spin 1s linear infinite;">
            <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
        </svg>
        Importing...
    `;
    
    // Find Perplexity response again
    const aiResponse = findPerplexityResponse();
    if (!aiResponse) {
        showError('Could not find Perplexity response to import');
        return;
    }
    
    // Extract content
    const content = extractPerplexityContent(aiResponse);
    const searchQuery = extractSearchQuery();
    
    // Send to Branestawm extension
    sendToExtension(content, searchQuery);
}

function extractPerplexityContent(aiResponse) {
    // Clean up the content
    const cloned = aiResponse.cloneNode(true);
    
    // Remove unwanted elements
    const unwanted = cloned.querySelectorAll(
        'script, style, .hidden, [style*="display: none"], button, input, nav, .sidebar, .toolbar'
    );
    unwanted.forEach(el => el.remove());
    
    // Get text content and preserve some formatting
    let content = '';
    
    // Try to preserve paragraph structure
    const paragraphs = cloned.querySelectorAll('p, div[class*="paragraph"], .prose > div');
    if (paragraphs.length > 0) {
        content = Array.from(paragraphs)
            .map(p => p.textContent.trim())
            .filter(text => text.length > 0)
            .join('\n\n');
    } else {
        // Fallback to all text content
        content = cloned.textContent || cloned.innerText || '';
    }
    
    // Clean up whitespace
    content = content
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();
    
    // Try to find and add sources
    const sources = document.querySelectorAll('[data-testid="source"], .source, a[href*="source"], .citation');
    if (sources.length > 0) {
        const sourceList = Array.from(sources)
            .map(source => {
                if (source.href) return source.href;
                if (source.textContent) return source.textContent.trim();
                return null;
            })
            .filter(Boolean)
            .slice(0, 5); // Limit to 5 sources
        
        if (sourceList.length > 0) {
            content += '\n\nSources:\n' + sourceList.map(s => `• ${s}`).join('\n');
        }
    }
    
    return content;
}

function extractSearchQuery() {
    // Try to get search query from various sources
    const querySelectors = [
        'input[placeholder*="search"], input[type="search"]',
        '.search-input input',
        '[data-testid="search-input"]',
        'textarea[placeholder*="Ask"]'
    ];
    
    for (const selector of querySelectors) {
        const input = document.querySelector(selector);
        if (input && input.value) {
            return input.value;
        }
    }
    
    // Try URL or page title
    const urlQuery = new URLSearchParams(window.location.search).get('q');
    if (urlQuery) return urlQuery;
    
    // Fallback to page title or generic
    return document.title.includes('Perplexity') ? 'Perplexity search' : document.title;
}

function sendToExtension(content, searchQuery) {
    const importData = {
        type: 'IMPORT_SEARCH_RESULTS',
        source: 'Perplexity AI',
        query: searchQuery,
        content: content,
        url: window.location.href,
        timestamp: new Date().toISOString()
    };
    
    // Send message to extension
    chrome.runtime.sendMessage(importData, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Failed to send to extension:', chrome.runtime.lastError);
            showError('Failed to connect to Branestawm extension');
        } else if (response && response.success) {
            showSuccess('Content imported to Branestawm successfully!');
        } else {
            showError('Failed to import content to Branestawm');
        }
        
        resetButton();
    });
}

function showSuccess(message) {
    importButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
            <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
        </svg>
        Imported!
    `;
    importButton.style.background = '#16a34a';
}

function showError(message) {
    importButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
            <path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/>
        </svg>
        Error
    `;
    importButton.style.background = '#dc2626';
}

function resetButton() {
    setTimeout(() => {
        if (importButton) {
            importButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                </svg>
                Import to Branestawm
            `;
            importButton.style.background = '#20808d';
            isProcessing = false;
        }
    }, 3000);
}

// Add CSS for loading animation
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);