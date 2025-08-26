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
    // Try multiple selectors for Google AI Overview and other useful content
    const selectors = [
        // AI Overview specific
        '[data-snc="ih6Jnb_4Hk7"]', // Common AI Overview selector
        '.yp', // Another AI Overview selector
        '[data-testid="ai-overview"]', // Direct AI Overview
        '.X5LH0c', // AI-generated answer
        '.IZ6rdc', // Search generative experience
        '.ujudUb', // Another SGE selector
        
        // Featured snippets and knowledge panels
        '.LGOjhe', // Featured snippet
        '.hgKElc', // Featured snippet text
        '[data-attrid="wa:/description"]', // Knowledge panel descriptions
        '.kno-rdesc', // Knowledge panel content
        '.kp-blk', // Knowledge panel block
        '.xpdopen', // Expanded knowledge panel
        
        // General search results with substantial content
        '.g .VwiC3b', // Search result snippets
        '.s .st', // Search result descriptions
        '.rc .s', // Result container descriptions
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim().length > 100) {
            console.log('🔍 Found content with selector:', selector);
            return element;
        }
    }
    
    // Enhanced fallback: look for the most substantial content block
    const allElements = document.querySelectorAll('div, p, section, article');
    let bestMatch = null;
    let bestScore = 0;
    
    for (const element of allElements) {
        const text = element.textContent.trim();
        if (text.length < 200) continue;
        
        // Skip navigation, ads, and other non-content
        if (element.closest('.gb_f, .FeRdKc, .commercial, nav, header, footer')) continue;
        if (element.querySelector('nav, button[role="button"], input')) continue;
        
        let score = 0;
        score += text.length > 400 ? 2 : 1;
        score += text.includes('.') ? 1 : 0; // Has sentences
        score += element.closest('#search, .g, .kp-blk') ? 2 : 0; // In search results area
        score += text.toLowerCase().includes('according to') ? 1 : 0;
        score += element.querySelector('cite, a[href]') ? 1 : 0; // Has sources
        
        if (score > bestScore) {
            bestScore = score;
            bestMatch = element;
        }
    }
    
    if (bestMatch && bestScore >= 3) {
        console.log('🔍 Found best content match with score:', bestScore, bestMatch);
        return bestMatch;
    }
    
    console.log('❌ No suitable content found on this page');
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
    
    importButton.id = 'branestawm-import-btn-google';
    importButton.className = 'branestawm-import-button-google';
    importButton.setAttribute('data-branestawm', 'import-button-google');
    
    importButton.style.cssText = `
        position: fixed !important;
        top: 100px !important;
        right: 20px !important;
        background: #4285f4 !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 12px 20px !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        transition: all 0.2s ease !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif !important;
        box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3) !important;
        z-index: 999999 !important;
        opacity: 0.95 !important;
        visibility: visible !important;
        pointer-events: auto !important;
        width: auto !important;
        min-width: 220px !important;
        max-width: 280px !important;
        transform: translateZ(0) !important;
        will-change: transform !important;
    `;
    
    importButton.addEventListener('mouseenter', () => {
        importButton.style.background = '#3367d6 !important';
        importButton.style.opacity = '1 !important';
        importButton.style.transform = 'translateZ(0) scale(1.02) !important';
    });
    
    importButton.addEventListener('mouseleave', () => {
        importButton.style.background = '#4285f4 !important';
        importButton.style.opacity = '0.95 !important';
        importButton.style.transform = 'translateZ(0) scale(1) !important';
    });
    
    importButton.addEventListener('click', handleImportClick);
    
    // Append directly to body so it can't be removed by page updates
    document.body.appendChild(importButton);
    
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