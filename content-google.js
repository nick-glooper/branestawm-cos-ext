// Content script for Google Search pages
// Injects "Import to Branestawm" button to scrape AI Overview content

let importButton = null;
let isProcessing = false;
let cachedAIContent = null; // Cache the AI content element when found

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGoogleImport);
} else {
    initializeGoogleImport();
}

function initializeGoogleImport() {
    // Wait a bit for Google to load AI Overview
    console.log('🚀 initializeGoogleImport called, setting timeout...');
    setTimeout(() => {
        console.log('🚀 Initial timeout executing, calling findAndInjectImportButton...');
        findAndInjectImportButton();
    }, 2000);
    
    // Also watch for dynamic content changes
    const observer = new MutationObserver((mutations) => {
        console.log('🔍 MutationObserver triggered, mutations:', mutations.length);
        if (!importButton) {
            console.log('🔍 No import button, clearing cache and trying injection');
            cachedAIContent = null; // Clear cache when page changes
            findAndInjectImportButton();
        } else {
            console.log('🔍 Import button exists, skipping re-injection');
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function findAndInjectImportButton() {
    console.log('🔍 findAndInjectImportButton called');
    console.log('🔍 Current state - importButton exists:', !!importButton);
    console.log('🔍 Is Google search results page:', isGoogleSearchResultsPage());
    
    if (importButton || !isGoogleSearchResultsPage()) {
        console.log('🔍 Skipping injection - button exists or not search page');
        return;
    }
    
    // Look for Google AI Overview container
    console.log('🔍 Looking for AI Overview container...');
    
    // First, let's analyze the page structure to understand the DOM better
    analyzePage();
    
    const aiOverview = findAIOverview();
    if (aiOverview) {
        console.log('🔍 AI Overview found, injecting button...');
        injectImportButton(aiOverview);
    } else {
        console.log('❌ No AI Overview found, button not injected');
    }
}

function analyzePage() {
    console.log('📊 === GOOGLE PAGE ANALYSIS ===');
    console.log('📊 URL:', window.location.href);
    console.log('📊 Title:', document.title);
    
    // Look for main search container
    const searchContainer = document.querySelector('#search, #main, #center_col, #rcnt');
    console.log('📊 Main search container:', searchContainer?.tagName, searchContainer?.id, searchContainer?.className);
    
    // Look for all elements containing substantial text
    console.log('📊 Elements with substantial text (>200 chars):');
    const textElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent?.trim();
        return text && text.length > 200 && text.length < 2000 && !el.querySelector('script, style');
    });
    
    textElements.slice(0, 10).forEach((el, i) => {
        console.log(`📊 [${i}] ${el.tagName}.${el.className} (${el.id}) - ${el.textContent.substring(0, 100)}...`);
        console.log(`📊     Parent: ${el.parentElement?.tagName}.${el.parentElement?.className}`);
        console.log(`📊     Data attrs: ${Array.from(el.attributes).filter(a => a.name.startsWith('data-')).map(a => a.name).join(', ')}`);
    });
    
    // Look for AI-specific indicators
    console.log('📊 AI-specific elements:');
    const aiSelectors = [
        '[data-testid*="ai"]', '[data-testid*="overview"]',
        '[class*="ai"]', '[class*="overview"]', '[class*="generative"]',
        '[aria-label*="AI"]', '[aria-label*="overview"]'
    ];
    
    aiSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            console.log(`📊 Found ${elements.length} elements matching: ${selector}`);
            elements.forEach((el, i) => {
                if (i < 3) { // Only show first 3
                    console.log(`📊   [${i}] ${el.tagName}.${el.className} - ${el.textContent?.substring(0, 80)}...`);
                }
            });
        }
    });
    
    console.log('📊 === END ANALYSIS ===');
}

function isGoogleSearchResultsPage() {
    return window.location.hostname.includes('google.com') && 
           window.location.pathname.includes('/search') &&
           document.querySelector('#search') !== null;
}

function findAIOverview() {
    console.log('🎯 === SIMPLIFIED AI OVERVIEW DETECTION ===');
    
    // Instead of guessing, let's systematically check what's actually on the page
    // Look for the most likely AI content containers based on common patterns
    
    const candidates = [
        // AI Mode conversation responses (higher priority)
        { selector: '[data-testid*="conversation"]', name: 'AI Mode conversation elements' },
        { selector: '[data-testid*="response"]', name: 'AI Mode response elements' },
        { selector: '[data-testid*="turn"]', name: 'AI Mode conversation turn' },
        { selector: '[role="main"] div[data-testid]', name: 'Main area data-testid elements' },
        { selector: '[class*="conversation"]', name: 'AI Mode conversation container' },
        { selector: 'div[data-node-key]', name: 'AI Mode data-node-key elements' },
        
        // Traditional AI Overview patterns  
        { selector: '[data-snc="ih6Jnb_4Hk7"]', name: 'AI Overview main container' },
        { selector: '.X5LH0c', name: 'AI generated answer' },
        { selector: '.IZ6rdc', name: 'Search generative experience' },
        { selector: '[data-testid*="ai"]', name: 'AI testid elements' },
        { selector: '[aria-label*="AI"]', name: 'AI aria-label elements' },
        
        // Weather and location-specific content patterns (for user's query)
        { selector: 'div:has-weather', name: 'Elements with weather content', manual: true },
        { selector: 'div:has-location', name: 'Elements with location content (GU51 2TH)', manual: true },
        { selector: 'div:has-forecast', name: 'Elements with forecast content', manual: true },
        { selector: 'div:has-text("As of")', name: 'Elements with AI intro phrases', manual: true },
        { selector: 'div:has-text("Based on")', name: 'Elements with AI intro phrases', manual: true },
        { selector: 'div:has-text("According to")', name: 'Elements with AI intro phrases', manual: true },
        { selector: 'div:has-text("The weather")', name: 'Weather response indicators', manual: true },
    ];
    
    for (const candidate of candidates) {
        if (candidate.manual) {
            // For text-based searches, we need to manually search
            let elements = [];
            
            if (candidate.selector === 'div:has-weather') {
                // Look for weather-specific content
                elements = Array.from(document.querySelectorAll('div')).filter(el => {
                    const text = el.textContent?.trim();
                    return text && text.length > 100 && text.length < 2000 && (
                        text.includes('°C') || text.includes('°F') ||
                        text.includes('temperature') || text.includes('Temperature') ||
                        text.includes('weather') || text.includes('Weather') ||
                        text.includes('forecast') || text.includes('Forecast') ||
                        text.match(/\d+°[CF]/) || // Temperature patterns
                        text.includes('humidity') || text.includes('wind') ||
                        text.includes('rain') || text.includes('sunny') || text.includes('cloudy')
                    );
                });
            } else if (candidate.selector === 'div:has-location') {
                // Look for location-specific content (user's GU51 2TH query)
                elements = Array.from(document.querySelectorAll('div')).filter(el => {
                    const text = el.textContent?.trim();
                    return text && text.length > 100 && text.length < 2000 && (
                        text.includes('GU51 2TH') || text.includes('GU51') ||
                        text.includes('Fleet') || text.includes('Hampshire') ||
                        text.includes('England') || text.includes('UK') ||
                        text.match(/\b[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}\b/) // UK postcode pattern
                    );
                });
            } else if (candidate.selector === 'div:has-forecast') {
                // Look for forecast-specific content
                elements = Array.from(document.querySelectorAll('div')).filter(el => {
                    const text = el.textContent?.trim();
                    return text && text.length > 100 && text.length < 2000 && (
                        text.includes('forecast') || text.includes('Forecast') ||
                        text.includes('today') || text.includes('tomorrow') ||
                        text.includes('week') || text.includes('outlook') ||
                        text.includes('expect') || text.includes('will be') ||
                        text.match(/\d+%.*chance/) || // "70% chance of rain"
                        text.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/) ||
                        text.includes('high') || text.includes('low')
                    );
                });
            } else if (candidate.selector.includes('"The weather"')) {
                // Look for weather response indicators
                elements = Array.from(document.querySelectorAll('div')).filter(el => {
                    const text = el.textContent?.trim();
                    return text && text.length > 100 && text.length < 2000 && (
                        text.includes('The weather') || text.includes('the weather') ||
                        text.includes('Current weather') || text.includes('current weather') ||
                        text.includes('Today\'s weather') || text.includes('today\'s weather')
                    );
                });
            } else {
                // Original AI intro phrase search
                elements = Array.from(document.querySelectorAll('div')).filter(el => {
                    const text = el.textContent?.trim();
                    return text && (
                        text.includes('As of ') || 
                        text.includes('Based on ') || 
                        text.includes('According to ')
                    ) && text.length > 100 && text.length < 2000;
                });
            }
            
            if (elements.length > 0) {
                const element = elements[0];
                console.log(`🎯 Found via ${candidate.name}:`, element.tagName, element.className);
                console.log(`🎯 Text preview:`, element.textContent.substring(0, 200));
                cachedAIContent = element;
                return element;
            }
        } else {
            const element = document.querySelector(candidate.selector);
            if (element && element.textContent?.trim().length > 100) {
                console.log(`🎯 Found via ${candidate.name}:`, element.tagName, element.className);
                console.log(`🎯 Text preview:`, element.textContent.substring(0, 200));
                cachedAIContent = element;
                return element;
            }
        }
    }
    console.log('🎯 No AI Overview found with specific targeting');
    return null;
}

function injectImportButton(aiOverview) {
    console.log('🔧 injectImportButton called with element:', aiOverview?.tagName, aiOverview?.className);
    
    // Create import button
    importButton = document.createElement('button');
    console.log('🔧 Created button element:', importButton);
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
    console.log('🔧 Button in DOM:', document.body.contains(importButton));
    console.log('🔧 Button element:', document.querySelector('#branestawm-import-btn-google'));
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
    
    // Use cached content if available, otherwise search again
    let aiOverview = cachedAIContent;
    if (!aiOverview || !document.contains(aiOverview)) {
        console.log('🔍 Cached content not available or removed, searching again...');
        aiOverview = findAIOverview();
        if (!aiOverview) {
            console.error('❌ No content found for Google import');
            showError('Could not find content to import');
            return;
        }
    } else {
        console.log('✅ Using cached AI Overview content');
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
    
    // Remove unwanted UI elements including CSS-heavy containers
    const unwantedSelectors = [
        'script', 'style', 'noscript',
        '.hidden', '[style*="display: none"]', '[style*="visibility: hidden"]',
        'button', 'input', 'select', 'textarea', 
        '.gb_f', '.gb_g', '.gb_h', // Google toolbar
        'nav', 'header', 'footer',
        '[role="button"]', '[role="navigation"]',
        '.FeRdKc', // Google ads
        '.commercial', '.ads',
        '[data-ved]', // Google tracking elements - these contain CSS
        '.g-blk', // Some Google blocks
        '.s6JM6d', // Google UI elements
        '.N6Sb2c', // Google dialogs
        '.VfPpkd', // Material Design components
        '.shared-links', // Shared links dialog
        '[aria-label*="Delete"]', '[aria-label*="Cancel"]', // Dialog buttons
        '[data-attrid*="action"]', // Action buttons
        '[class*="SPo9yc"]', '[class*="uqGSn"]', // CSS class containers
        '[class*="KrKx0b"]', '[class*="tA3WHf"]', // More CSS containers
        'div[class][style]', // Divs with both class and style attributes (likely CSS containers)
    ];
    
    unwantedSelectors.forEach(selector => {
        const elements = cloned.querySelectorAll(selector);
        elements.forEach(el => el.remove());
    });
    
    // Get text content and clean it up
    let content = cloned.textContent || cloned.innerText || '';
    
    // Filter out CSS-like content and styling information
    content = content.replace(/\.[A-Z][a-zA-Z0-9]+[,{][^}]*}/g, ''); // CSS rules
    content = content.replace(/width:\s*\d+%/g, ''); // CSS width properties
    content = content.replace(/height:\s*\d+[px|%]/g, ''); // CSS height properties
    content = content.replace(/margin[^;]*;/g, ''); // CSS margin properties
    content = content.replace(/padding[^;]*;/g, ''); // CSS padding properties
    content = content.replace(/background[^;]*;/g, ''); // CSS background properties
    content = content.replace(/transform[^;]*;/g, ''); // CSS transform properties
    content = content.replace(/position:\s*(absolute|fixed|relative)/g, ''); // CSS position
    content = content.replace(/display:\s*(flex|grid|inline-block)/g, ''); // CSS display
    content = content.replace(/@media[^{]*{[^}]*}/g, ''); // CSS media queries
    content = content.replace(/calc\([^)]+\)/g, ''); // CSS calc functions
    
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
    
    // Check if content looks like CSS or styling information
    const cssIndicators = content.match(/\.(SPo9yc|uqGSn|KrKx0b|tA3WHf|WVV5ke|PLq9Je)/g);
    const cssPropertyCount = (content.match(/(width|height|margin|padding|position|display|background|transform):/g) || []).length;
    
    // If content is too short, looks like UI text, or contains CSS, try to find actual content
    if (content.length < 100 || 
        cssIndicators?.length > 5 || 
        cssPropertyCount > 10 ||
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
    console.log('🔄 resetButton called');
    setTimeout(() => {
        console.log('🔄 resetButton timeout executing, button exists:', !!importButton);
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