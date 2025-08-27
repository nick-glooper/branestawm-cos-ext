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
    // Prioritize main content containers and exclude sidebar elements
    const selectors = [
        // AI Overview specific - prioritize main content containers
        '[data-snc="ih6Jnb_4Hk7"] .yp', // AI Overview main content
        '.yp:not([data-ved])', // AI Overview text without tracking attributes
        '[data-testid="ai-overview"] .yp', // Direct AI Overview content
        '.X5LH0c .yp', // AI-generated answer content
        '.IZ6rdc .yp', // Search generative experience content
        '.ujudUb .yp', // Another SGE content selector
        
        // Broader AI Overview containers (but exclude sidebars and thumbnails)
        '[data-snc="ih6Jnb_4Hk7"]', // Common AI Overview selector
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
            console.log('🔍 Element tag:', element.tagName);
            console.log('🔍 Element classes:', element.className);
            console.log('🔍 Element ID:', element.id);
            console.log('🔍 Element data attributes:', Array.from(element.attributes).filter(attr => attr.name.startsWith('data-')).map(attr => `${attr.name}="${attr.value}"`));
            console.log('🔍 Element parent:', element.parentElement?.tagName, element.parentElement?.className);
            console.log('🔍 First 300 chars of text:', element.textContent.trim().substring(0, 300));
            console.log('🔍 Element HTML structure:', element.outerHTML.substring(0, 500));
            return element;
        }
    }
    
    // Try a more targeted search for AI Overview content first
    console.log('🔍 Trying more targeted AI Overview search...');
    
    // Method 1: Look for elements that contain the typical AI Overview response patterns
    const possibleAIElements = document.querySelectorAll('div, section, article');
    for (const element of possibleAIElements) {
        const text = element.textContent.trim();
        if (text.length > 200 && 
            // AI Overview content typically has structured information
            (text.includes('Current conditions') || 
             text.includes('As of ') || 
             text.includes('°C') ||
             text.includes('Temperature:') ||
             text.includes('according to') ||
             text.includes('Based on') ||
             text.includes('Forecast') ||
             text.match(/\d+°[CF]:/)) &&
            // Exclude search result snippets and UI elements
            !element.closest('.MFrAxb, .g, .related-question-pair, .commercial') &&
            !text.includes('Weather2Travel.com') &&
            !text.includes('Met Office') &&
            !text.includes('Show all') &&
            !text.includes('AI responses may include mistakes') &&
            !text.includes('Meet AI Mode') &&
            !text.includes('Ask detailed questions') &&
            !text.includes('Dismiss') &&
            !text.includes('Upload image') &&
            !text.includes('Microphone') &&
            !text.includes('Send') &&
            !text.includes('Google activity') &&
            !text.includes('Sources:')) {
            
            console.log('🔍 Found potential AI Overview by content pattern:', element.tagName, element.className);
            console.log('🔍 Content preview:', text.substring(0, 300));
            return element;
        }
    }
    
    // Method 2: Traditional container-based search
    const aiContainers = document.querySelectorAll('[data-snc*="ih6Jnb"], .X5LH0c, .IZ6rdc, .ujudUb, [data-testid*="ai"], .ai-overview, .generative-ai');
    for (const container of aiContainers) {
        const textContent = container.textContent.trim();
        if (textContent.length > 100 && !textContent.includes('google.') && !textContent.includes('xsrf')) {
            console.log('🔍 Found targeted AI container:', container.tagName, container.className, textContent.substring(0, 200));
            return container;
        }
    }
    
    // Enhanced fallback: look for the most substantial content block
    console.log('🔍 Falling back to general content search...');
    const allElements = document.querySelectorAll('div, p, section, article');
    let bestMatch = null;
    let bestScore = 0;
    
    for (const element of allElements) {
        const text = element.textContent.trim();
        if (text.length < 200) continue;
        
        // Skip navigation, ads, dialogs, footer scripts, and other non-content
        if (element.closest('.gb_f, .FeRdKc, .commercial, nav, header, footer, .N6Sb2c, .VfPpkd, .shared-links, [role="dialog"], [role="alertdialog"], .modal, .popup')) continue;
        if (element.querySelector('nav, button, input, select, textarea')) continue;
        if (element.id === 'lfootercc' || element.closest('#lfootercc')) continue; // Skip Google footer scripts
        if (element.querySelector('script') && element.textContent.includes('google.')) continue; // Skip Google script containers
        
        // Skip Google sharing dialog specifically
        if (element.closest('[data-ved]') && text.toLowerCase().includes('public link')) continue;
        
        // Skip thumbnail/sidebar/reference containers - but be more selective
        if (element.closest('.related-question-pair, .d4rhi, .dG2XIf, .cUnke, .mnr-c, .kno-ec')) continue;
        // Skip search result snippets that look like external sites
        if (element.closest('.MFrAxb, .g') && (text.includes('.com') || text.includes('Met Office') || text.includes('Weather2Travel'))) continue;
        // Only skip [data-ved] elements if they clearly contain date patterns (not all [data-ved] elements)
        if (element.closest('[data-ved]') && text.length < 500 && (text.match(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/) || text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/) || text.match(/\d+\s+(hour|day|week|month|year)s?\s+ago/))) continue;
        
        // Debug: log elements that pass initial filters
        console.log('🔍 Candidate element:', {
            tag: element.tagName,
            classes: element.className,
            id: element.id,
            textLength: text.length,
            textPreview: text.substring(0, 100) + '...'
        });
        
        // Skip elements that contain UI text
        if (text.toLowerCase().includes('delete all') || 
            text.toLowerCase().includes('shared public') ||
            text.toLowerCase().includes('learn more') ||
            text.toLowerCase().includes('cancel') ||
            text.toLowerCase().includes('public link shares') ||
            text.toLowerCase().includes('personal information') ||
            text.toLowerCase().includes('third parties') ||
            text.toLowerCase().includes('their policies apply') ||
            text.toLowerCase().includes('meet ai mode') ||
            text.toLowerCase().includes('ask detailed questions') ||
            text.toLowerCase().includes('dismiss') ||
            text.toLowerCase().includes('upload image') ||
            text.toLowerCase().includes('microphone') ||
            text.toLowerCase().includes('send') ||
            text.toLowerCase().includes('google activity') ||
            text.toLowerCase().includes('sources:')) continue;
        
        let score = 0;
        score += text.length > 400 ? 2 : 1;
        score += text.includes('.') ? 1 : 0; // Has sentences
        score += element.closest('#search, .g, .kp-blk') ? 2 : 0; // In search results area
        score += text.toLowerCase().includes('according to') ? 1 : 0;
        score += element.querySelector('cite, a[href]') ? 1 : 0; // Has sources
        
        // Boost score for elements that look like AI Overview main content
        score += element.closest('[data-snc="ih6Jnb_4Hk7"], .X5LH0c, .IZ6rdc, .ujudUb') ? 5 : 0; // Higher boost for AI containers
        score += element.classList.contains('yp') ? 3 : 0; // Higher boost for AI content
        score += element.closest('[data-testid="ai-overview"]') ? 4 : 0; // Boost for direct AI overview
        
        // Boost for content that looks like AI Overview responses
        score += text.includes('Current conditions') ? 3 : 0;
        score += text.includes('As of ') || text.includes('Based on') ? 2 : 0;
        score += text.includes('Temperature:') || text.match(/\d+°[CF]:/) ? 2 : 0;
        score += text.includes('Forecast') && text.length > 500 ? 2 : 0; // Long forecast content
        score += !text.includes('.com') && !text.includes('Show all') ? 1 : 0; // Not external links
        
        // Penalize search result snippets and UI elements
        score -= element.closest('.MFrAxb, .g') ? 3 : 0; // Strong penalty for search snippets
        score -= text.includes('Weather2Travel.com') || text.includes('Met Office') ? 2 : 0;
        score -= text.includes('Meet AI Mode') || text.includes('Ask detailed questions') ? 5 : 0; // Heavy penalty for UI elements
        score -= text.includes('Upload image') || text.includes('Microphone') || text.includes('Send') ? 3 : 0;
        score -= text.length < 300 && text.match(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/) ? 1 : 0; // Only penalize short text with dates
        score -= text.length < 300 && text.match(/\d+\s+(hour|day|week|month|year)s?\s+ago/) ? 1 : 0; // Only penalize short text with relative dates
        
        if (score > bestScore) {
            bestScore = score;
            bestMatch = element;
        }
    }
    
    if (bestMatch && bestScore >= 2) { // Lower threshold since we have better filtering
        console.log('🔍 Found best content match with score:', bestScore);
        console.log('🔍 Fallback element tag:', bestMatch.tagName);
        console.log('🔍 Fallback element classes:', bestMatch.className);
        console.log('🔍 Fallback element ID:', bestMatch.id);
        console.log('🔍 Fallback element data attributes:', Array.from(bestMatch.attributes).filter(attr => attr.name.startsWith('data-')).map(attr => `${attr.name}="${attr.value}"`));
        console.log('🔍 Fallback element parent:', bestMatch.parentElement?.tagName, bestMatch.parentElement?.className);
        console.log('🔍 Fallback first 300 chars of text:', bestMatch.textContent.trim().substring(0, 300));
        console.log('🔍 Fallback element HTML structure:', bestMatch.outerHTML.substring(0, 500));
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
    
    console.log('🔄 Google import button clicked');
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
        console.error('❌ No content found for Google import');
        showError('Could not find content to import');
        return;
    }
    
    console.log('📄 Found content element:', aiOverview);
    console.log('📄 Element HTML preview:', aiOverview.outerHTML.substring(0, 300) + '...');
    
    // Extract content
    const content = extractAIOverviewContent(aiOverview);
    const searchQuery = extractSearchQuery();
    
    console.log('📝 Extracted content length:', content.length);
    console.log('🔍 Extracted query:', searchQuery);
    console.log('📄 Content preview:', content.substring(0, 200) + '...');
    
    if (!content || content.trim().length < 50) {
        console.error('❌ Content too short or empty after extraction:', content);
        showError('No substantial content found to import');
        resetButton();
        return;
    }
    
    // Send to Branestawm extension
    sendToExtension(content, searchQuery);
}

function extractAIOverviewContent(aiOverview) {
    // Clean up the content
    const cloned = aiOverview.cloneNode(true);
    
    // Remove unwanted UI elements
    const unwantedSelectors = [
        'script', 'style', 'noscript',
        '.hidden', '[style*="display: none"]', '[style*="visibility: hidden"]',
        'button', 'input', 'select', 'textarea', 
        '.gb_f', '.gb_g', '.gb_h', // Google toolbar
        'nav', 'header', 'footer',
        '[role="button"]', '[role="navigation"]',
        '.FeRdKc', // Google ads
        '.commercial', '.ads',
        '[data-ved]', // Google tracking elements
        '.g-blk', // Some Google blocks
        '.s6JM6d', // Google UI elements
        '.N6Sb2c', // Google dialogs
        '.VfPpkd', // Material Design components
        '.shared-links', // Shared links dialog
        '[aria-label*="Delete"]', '[aria-label*="Cancel"]', // Dialog buttons
        '[data-attrid*="action"]' // Action buttons
    ];
    
    unwantedSelectors.forEach(selector => {
        const elements = cloned.querySelectorAll(selector);
        elements.forEach(el => el.remove());
    });
    
    // Get text content and clean it up
    let content = cloned.textContent || cloned.innerText || '';
    
    // Filter out common Google UI text patterns
    const uiPatterns = [
        /Shared public links/gi,
        /Delete all links/gi,
        /Your public links are automatically deleted/gi,
        /Learn more/gi,
        /Delete all public links\?/gi,
        /If you delete all of your shared links/gi,
        /Delete all.*Cancel/gi,
        /\d+ months?\./gi,
        /This public link shares a thread/gi,
        /including any personal information you added/gi,
        /You can delete a public link at any time/gi,
        /but not copies made by others/gi,
        /If you share with third parties/gi,
        /their policies apply/gi,
        /public link/gi,
        /shares a thread/gi,
        /Meet AI Mode/gi,
        /Ask detailed questions for better responses/gi,
        /Ask detailed questions/gi,
        /Dismiss/gi,
        /Upload image/gi,
        /Microphone/gi,
        /Send/gi,
        /Google activity/gi,
        /Sources:/gi
    ];
    
    uiPatterns.forEach(pattern => {
        content = content.replace(pattern, '');
    });
    
    // Clean up whitespace and formatting
    content = content
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .replace(/^\s*Sources?:?\s*/gi, '') // Remove standalone "Sources:" at start
        .trim();
    
    // If content is too short or looks like UI text, try to find actual content
    if (content.length < 100 || 
        content.toLowerCase().includes('delete') || 
        content.toLowerCase().includes('cancel') ||
        content.toLowerCase().includes('public link') ||
        content.toLowerCase().includes('personal information') ||
        content.toLowerCase().includes('third parties') ||
        content.toLowerCase().includes('meet ai mode') ||
        content.toLowerCase().includes('upload image') ||
        content.toLowerCase().includes('microphone') ||
        content.toLowerCase().includes('google activity')) {
        console.log('⚠️ Content appears to be UI elements, searching for better content...');
        
        // Try to find actual AI response content within the element
        const contentElements = aiOverview.querySelectorAll('p, div, span');
        const candidates = [];
        
        for (const element of contentElements) {
            const text = element.textContent.trim();
            if (text.length > 50 && 
                !text.toLowerCase().includes('delete') &&
                !text.toLowerCase().includes('cancel') &&
                !text.toLowerCase().includes('shared') &&
                !text.toLowerCase().includes('learn more') &&
                !text.toLowerCase().includes('public link') &&
                !text.toLowerCase().includes('personal information') &&
                !text.toLowerCase().includes('third parties') &&
                !text.toLowerCase().includes('policies apply') &&
                !text.toLowerCase().includes('meet ai mode') &&
                !text.toLowerCase().includes('upload image') &&
                !text.toLowerCase().includes('microphone') &&
                !text.toLowerCase().includes('google activity') &&
                !text.toLowerCase().includes('dismiss') &&
                !text.toLowerCase().includes('send')) {
                candidates.push(text);
            }
        }
        
        if (candidates.length > 0) {
            content = candidates.join('\n\n');
            console.log('✅ Found better content candidates');
        }
    }
    
    // Add source attribution if available (but filter out UI sources)
    const sources = aiOverview.querySelectorAll('cite, a[href]:not([href*="support.google"]):not([href*="policies.google"])');
    if (sources.length > 0) {
        const sourceList = Array.from(sources)
            .map(source => {
                const text = source.textContent.trim();
                const href = source.href;
                if (text && !text.toLowerCase().includes('learn more') && !text.toLowerCase().includes('delete')) {
                    return text;
                } else if (href && !href.includes('google.com')) {
                    return href;
                }
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