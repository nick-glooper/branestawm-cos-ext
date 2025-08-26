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
    const observer = new MutationObserver(() => {
        if (!importButton) {
            setTimeout(findAndInjectImportButton, 1000);
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function findAndInjectImportButton() {
    if (importButton || !isPerplexityPage()) return;
    
    // Look for Perplexity AI response
    const aiResponse = findPerplexityResponse();
    if (aiResponse) {
        injectImportButton(aiResponse);
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
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim().length > 100) {
            console.log('🔍 Found Perplexity response with selector:', selector);
            return element;
        }
    }
    
    // Fallback: look for the main content area with substantial text
    const mainContent = document.querySelector('main [role="main"], main .prose, .main-content');
    if (mainContent) {
        // Look for the first substantial text block within main content
        const textBlocks = mainContent.querySelectorAll('div, p, section');
        for (const block of textBlocks) {
            if (block.textContent.trim().length > 200 && 
                !block.querySelector('input, button, nav') &&
                !block.classList.contains('sidebar')) {
                console.log('🔍 Found potential Perplexity response:', block);
                return block;
            }
        }
    }
    
    console.log('❌ No Perplexity response found on this page');
    return null;
}

function injectImportButton(aiResponse) {
    // Create import button
    importButton = document.createElement('button');
    importButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
        </svg>
        Import to Branestawm
    `;
    
    importButton.style.cssText = `
        background: #20808d;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 18px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        margin: 16px 0;
        transition: background 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        box-shadow: 0 2px 8px rgba(32, 128, 141, 0.2);
        position: relative;
        z-index: 1000;
    `;
    
    importButton.addEventListener('mouseenter', () => {
        importButton.style.background = '#1a6d78';
    });
    
    importButton.addEventListener('mouseleave', () => {
        importButton.style.background = '#20808d';
    });
    
    importButton.addEventListener('click', handleImportClick);
    
    // Try to insert button in a good location
    const targetContainer = aiResponse.parentElement || aiResponse;
    
    // Look for a good insertion point
    const insertionPoints = [
        targetContainer.querySelector('.answer-footer'),
        targetContainer.querySelector('.sources'),
        aiResponse.nextElementSibling,
        aiResponse
    ];
    
    let inserted = false;
    for (const point of insertionPoints) {
        if (point) {
            if (point === aiResponse) {
                // Insert after the response
                targetContainer.insertBefore(importButton, aiResponse.nextSibling);
            } else {
                // Insert before the point
                point.parentNode.insertBefore(importButton, point);
            }
            inserted = true;
            break;
        }
    }
    
    if (!inserted) {
        // Fallback: append to parent
        targetContainer.appendChild(importButton);
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