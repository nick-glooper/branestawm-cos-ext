// Content script for Google Search pages
// Injects "Import to Branestawm" button to scrape AI Overview content

let importButton = null;
let isProcessing = false;

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGoogleImport);
} else {
    initializeGoogleImport();
}

function initializeGoogleImport() {
    // Wait a bit for Google to load AI Overview
    setTimeout(findAndInjectImportButton, 2000);
    
    // Also watch for dynamic content changes
    const observer = new MutationObserver(() => {
        if (!importButton) {
            findAndInjectImportButton();
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function findAndInjectImportButton() {
    if (importButton || !isGoogleSearchResultsPage()) return;
    
    // Look for Google AI Overview container
    const aiOverview = findAIOverview();
    if (aiOverview) {
        injectImportButton(aiOverview);
    }
}

function isGoogleSearchResultsPage() {
    return window.location.hostname.includes('google.com') && 
           window.location.pathname.includes('/search') &&
           document.querySelector('#search') !== null;
}

function findAIOverview() {
    // Try multiple selectors for Google AI Overview
    const selectors = [
        '[data-snc="ih6Jnb_4Hk7"]', // Common AI Overview selector
        '.yp', // Another AI Overview selector
        '[data-attrid="wa:/description"]', // Knowledge panel descriptions
        '.kno-rdesc', // Knowledge panel content
        '.LGOjhe', // Featured snippet
        '.hgKElc', // Featured snippet text
        '.X5LH0c', // AI-generated answer
        '.IZ6rdc', // Search generative experience
        '.ujudUb', // Another SGE selector
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim().length > 100) {
            console.log('🔍 Found AI Overview with selector:', selector);
            return element;
        }
    }
    
    // Fallback: look for any element that looks like an AI summary
    const potentialElements = document.querySelectorAll('[data-attrid], [data-snc], .X5LH0c, .LGOjhe');
    for (const element of potentialElements) {
        if (element.textContent.trim().length > 200 && 
            element.textContent.toLowerCase().includes('according to') ||
            element.textContent.toLowerCase().includes('based on') ||
            element.querySelector('cite, .source, [href]')) {
            console.log('🔍 Found potential AI Overview:', element);
            return element;
        }
    }
    
    console.log('❌ No AI Overview found on this page');
    return null;
}

function injectImportButton(aiOverview) {
    // Create import button
    importButton = document.createElement('button');
    importButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
        </svg>
        Import to Branestawm
    `;
    
    importButton.style.cssText = `
        background: #4285f4;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        margin: 12px 0;
        transition: background 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;
    
    importButton.addEventListener('mouseenter', () => {
        importButton.style.background = '#3367d6';
    });
    
    importButton.addEventListener('mouseleave', () => {
        importButton.style.background = '#4285f4';
    });
    
    importButton.addEventListener('click', handleImportClick);
    
    // Insert button after the AI Overview
    aiOverview.parentNode.insertBefore(importButton, aiOverview.nextSibling);
    
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
    
    // Find AI Overview again (in case page changed)
    const aiOverview = findAIOverview();
    if (!aiOverview) {
        showError('Could not find AI Overview content to import');
        return;
    }
    
    // Extract content
    const content = extractAIOverviewContent(aiOverview);
    const searchQuery = extractSearchQuery();
    
    // Send to Branestawm extension
    sendToExtension(content, searchQuery);
}

function extractAIOverviewContent(aiOverview) {
    // Clean up the content
    const cloned = aiOverview.cloneNode(true);
    
    // Remove unwanted elements
    const unwanted = cloned.querySelectorAll('script, style, .hidden, [style*="display: none"]');
    unwanted.forEach(el => el.remove());
    
    // Get text content and clean it up
    let content = cloned.textContent || cloned.innerText || '';
    
    // Clean up whitespace and formatting
    content = content
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
    
    // Add source attribution if available
    const sources = aiOverview.querySelectorAll('cite, [href], .source');
    if (sources.length > 0) {
        content += '\n\nSources: ';
        const sourceList = Array.from(sources)
            .map(source => source.textContent || source.href)
            .filter(Boolean)
            .slice(0, 3); // Limit to 3 sources
        content += sourceList.join(', ');
    }
    
    return content;
}

function extractSearchQuery() {
    // Try to get search query from URL or search input
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q') || document.querySelector('input[name="q"]')?.value || 'Google search';
    return query;
}

function sendToExtension(content, searchQuery) {
    const importData = {
        type: 'IMPORT_SEARCH_RESULTS',
        source: 'Google AI Overview',
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
        ${message}
    `;
    importButton.style.background = '#34a853';
}

function showError(message) {
    importButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
            <path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/>
        </svg>
        ${message}
    `;
    importButton.style.background = '#ea4335';
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
            importButton.style.background = '#4285f4';
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