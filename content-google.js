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
    console.log('🎯 === IMPROVED AI OVERVIEW DETECTION ===');
    
    // Enhanced detection strategy with better Google AI Mode support
    const candidates = [
        // Google AI Mode specific selectors (highest priority) - visible elements only
        { selector: '[data-testid*="conversation"][data-testid*="thread"]:not([style*="display: none"])', name: 'AI Mode conversation thread' },
        { selector: '[data-testid*="assistant-response"]:not([style*="display: none"])', name: 'AI Mode assistant response' },
        { selector: '[data-testid*="conversation-turn"]:not([style*="display: none"])', name: 'AI Mode conversation turn' },
        { selector: '[data-testid*="search-generative"]:not([style*="display: none"])', name: 'Search generative AI content' },
        { selector: '[data-ved][role="region"] > div:not([style*="display: none"])', name: 'Google AI content region' },
        
        // Traditional Google AI Overview patterns (visible only)
        { selector: '[data-snc="ih6Jnb_4Hk7"]:not([style*="display: none"])', name: 'AI Overview main container' },
        { selector: '.X5LH0c:not([style*="display: none"])', name: 'AI generated answer' },
        { selector: '.IZ6rdc:not([style*="display: none"])', name: 'Search generative experience' },
        { selector: '[data-testid*="ai"]:not([role="dialog"]):not([style*="display: none"])', name: 'AI testid elements' },
        { selector: '[aria-label*="AI"]:not([role="dialog"]):not([style*="display: none"])', name: 'AI aria-label elements' },
        
        // Focus on visible elements in main content area
        { selector: '#main div:not(.OkHxFe):not([style*="display: none"])', name: 'Main content divs (excluding share dialog)' },
        { selector: '#center_col div:not(.OkHxFe):not([style*="display: none"])', name: 'Center column content' },
        { selector: '[role="main"] div:not(.OkHxFe):not([style*="display: none"])', name: 'Main role content' },
        
        // Enhanced content detection with improved filtering
        { selector: 'div:ai-conversation', name: 'AI conversation content', manual: true },
        { selector: 'div:substantial-content', name: 'Substantial content fallback', manual: true },
    ];
    
    for (const candidate of candidates) {
        if (candidate.manual) {
            // Generic content detection - find substantial content not in UI dialogs
            let elements = [];
            
            if (candidate.selector === 'div:ai-conversation') {
                // Look specifically for AI conversation patterns
                elements = Array.from(document.querySelectorAll('div')).filter(el => {
                    const text = el.textContent?.trim();
                    
                    // Must have substantial content
                    if (!text || text.length < 200 || text.length > 5000) return false;
                    
                    // CRITICAL: Exclude hidden elements first
                    const isHidden = el.style.display === 'none' ||
                                    el.style.visibility === 'hidden' ||
                                    el.hasAttribute('hidden') ||
                                    getComputedStyle(el).display === 'none' ||
                                    getComputedStyle(el).visibility === 'hidden';
                    
                    if (isHidden) return false;
                    
                    // Exclude UI dialogs and navigation (including share management)
                    const isUIDialog = el.closest('[role="dialog"]') ||
                                      el.closest('.wklPJe') ||
                                      el.closest('.OkHxFe') ||  // Share management dialog
                                      el.closest('[data-xid*="share"]') ||  // Share dialogs
                                      el.closest('[data-type="hovc"]') ||
                                      el.closest('[data-type="vsh"]') ||
                                      el.closest('nav, header, footer');
                    
                    if (isUIDialog) return false;
                    
                    // Look for AI conversation indicators
                    const hasAIIndicators = text.toLowerCase().includes('according to') ||
                                           text.toLowerCase().includes('based on') ||
                                           text.toLowerCase().includes('as of') ||
                                           text.match(/\b(however|therefore|additionally|furthermore)\b/i) ||
                                           (text.includes('?') && text.includes('.') && text.split('.').length > 2);
                    
                    // Must be in main content area
                    const inMainContent = el.closest('#search, #main, #center_col, [role="main"]');
                    
                    return hasAIIndicators && inMainContent;
                });
                
                // Sort by content quality score
                elements.sort((a, b) => {
                    const scoreA = calculateContentQuality(a.textContent);
                    const scoreB = calculateContentQuality(b.textContent);
                    return scoreB - scoreA;
                });
            } else if (candidate.selector === 'div:substantial-content') {
                // Enhanced fallback with better filtering
                elements = Array.from(document.querySelectorAll('div')).filter(el => {
                    const text = el.textContent?.trim();
                    
                    // CRITICAL: Exclude hidden elements first
                    const isHidden = el.style.display === 'none' ||
                                    el.style.visibility === 'hidden' ||
                                    el.hasAttribute('hidden') ||
                                    getComputedStyle(el).display === 'none' ||
                                    getComputedStyle(el).visibility === 'hidden';
                    
                    if (isHidden) return false;
                    
                    // Exclude known UI dialog containers (including share management)
                    const isUIDialog = el.closest('[role="dialog"]') ||
                                      el.closest('.wklPJe') ||
                                      el.closest('.OkHxFe') ||  // Share management dialog
                                      el.closest('[data-xid*="share"]') ||  // Share dialogs
                                      el.closest('[data-type="hovc"]') ||
                                      el.closest('[data-type="vsh"]') ||
                                      el.closest('[jsaction*="vshDecision"]');
                    
                    if (isUIDialog) return false;
                    
                    // Look for substantial, meaningful content
                    const hasSubstantialContent = text && text.length > 150 && text.length < 3000;
                    
                    // Exclude elements that are clearly UI/navigation
                    const isNavigation = el.closest('nav, header, footer, [role="navigation"], [role="banner"]');
                    
                    // Must be in main search content area
                    const inSearchArea = el.closest('#search, #main, #center_col, [role="main"]');
                    
                    return hasSubstantialContent && !isUIDialog && !isNavigation && inSearchArea;
                });
                
                // Sort by content quality and length
                elements.sort((a, b) => {
                    const qualityA = calculateContentQuality(a.textContent);
                    const qualityB = calculateContentQuality(b.textContent);
                    return qualityB - qualityA;
                });
            }
            
            if (elements.length > 0) {
                const element = elements[0];
                console.log(`🎯 Found via ${candidate.name}:`, element.tagName, element.className);
                console.log(`🎯 Element visible:`, !element.style.display || element.style.display !== 'none');
                console.log(`🎯 Content quality score:`, calculateContentQuality(element.textContent));
                console.log(`🎯 Text preview:`, element.textContent.substring(0, 200));
                cachedAIContent = element;
                return element;
            }
        } else {
            const element = document.querySelector(candidate.selector);
            if (element && element.textContent?.trim().length > 100) {
                // Check if element is visible and not a UI dialog
                const isVisible = element.style.display !== 'none' && 
                                 !element.hasAttribute('hidden') &&
                                 getComputedStyle(element).display !== 'none';
                                 
                const qualityScore = calculateContentQuality(element.textContent);
                
                if (isVisible && qualityScore > 10) {
                    console.log(`🎯 Found via ${candidate.name}:`, element.tagName, element.className);
                    console.log(`🎯 Element visible:`, isVisible);
                    console.log(`🎯 Content quality score:`, qualityScore);
                    console.log(`🎯 Text preview:`, element.textContent.substring(0, 200));
                    cachedAIContent = element;
                    return element;
                } else {
                    console.log(`⚠️ Skipping ${candidate.name}: visible=${isVisible}, quality=${qualityScore}`);
                }
            }
        }
    }
    console.log('🎯 No AI Overview found with specific targeting');
    
    // Last resort: enable debug mode to help identify the correct element
    if (window.location.href.includes('debug=1')) {
        console.log('🔍 DEBUG MODE: Analyzing page structure...');
        debugPageStructure();
    }
    
    console.log('⚠️ No suitable AI content found. This might be a page without AI responses.');
    return null;
}

// Helper function to calculate content quality score
function calculateContentQuality(text) {
    if (!text) return 0;
    
    let score = 0;
    
    // Length score (optimal range 300-1500 chars)
    const length = text.length;
    if (length >= 300 && length <= 1500) {
        score += 50;
    } else if (length >= 150 && length < 300) {
        score += 30;
    } else if (length > 1500 && length < 3000) {
        score += 20;
    }
    
    // AI conversation indicators
    const aiPhrases = [
        /according to/i, /based on/i, /as of/i, /research shows/i,
        /studies suggest/i, /experts say/i, /however/i, /therefore/i,
        /additionally/i, /furthermore/i, /meanwhile/i
    ];
    
    aiPhrases.forEach(phrase => {
        if (phrase.test(text)) score += 10;
    });
    
    // Question-answer pattern
    if (text.includes('?') && text.includes('.')) {
        const sentences = text.split('.').length;
        if (sentences >= 3) score += 15;
    }
    
    // Strong negative scoring for UI/dialog text
    const strongUIPatterns = [
        /shared public links/i, /you don't have any shared links/i,
        /delete all links/i, /something went wrong/i, /loading\.\.\.?/i,
        /learn more/i, /dismiss/i, /cancel/i, /delete all/i,
        /upload image/i, /microphone/i, /send/i
    ];
    
    strongUIPatterns.forEach(pattern => {
        if (pattern.test(text)) score -= 50;  // Heavy penalty for UI text
    });
    
    // Additional penalty for typical error/loading messages
    if (text.toLowerCase().includes('loading') || 
        text.toLowerCase().includes('something went wrong') ||
        text.toLowerCase().includes('shared links')) {
        score -= 100;  // Severe penalty
    }
    
    return score;
}

// Debug function to help identify correct elements
function debugPageStructure() {
    console.log('🔍 === DEBUG PAGE STRUCTURE ===');
    
    const substantialElements = Array.from(document.querySelectorAll('div'))
        .filter(el => {
            const text = el.textContent?.trim();
            return text && text.length > 200 && text.length < 5000;
        })
        .sort((a, b) => calculateContentQuality(b.textContent) - calculateContentQuality(a.textContent));
    
    console.log('🔍 Top 5 content candidates:');
    substantialElements.slice(0, 5).forEach((el, i) => {
        console.log(`[${i + 1}]`, {
            element: el,
            tag: el.tagName,
            classes: el.className.substring(0, 100),
            textLength: el.textContent.trim().length,
            qualityScore: calculateContentQuality(el.textContent),
            preview: el.textContent.trim().substring(0, 150) + '...'
        });
    });
    
    console.log('🔍 === END DEBUG ===');
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
    
    // Remove unwanted UI elements including CSS-heavy containers and dialogs
    const unwantedSelectors = [
        'script', 'style', 'noscript',
        '.hidden', '[style*="display: none"]', '[style*="visibility: hidden"]',
        'button', 'input', 'select', 'textarea', 
        '.gb_f', '.gb_g', '.gb_h', // Google toolbar
        'nav', 'header', 'footer',
        '[role="button"]', '[role="navigation"]', '[role="dialog"]', // Dialog elements
        '.FeRdKc', // Google ads
        '.commercial', '.ads',
        '[data-ved]', // Google tracking elements - these contain CSS
        '.g-blk', // Some Google blocks
        '.s6JM6d', // Google UI elements
        '.N6Sb2c', // Google dialogs
        '.VfPpkd', // Material Design components
        '.wklPJe', '.xyZFie', // Visual Search History dialog classes
        '.shared-links', // Shared links dialog
        '[data-type="hovc"]', '[data-type="vsh"]', // Visual search dialog attributes
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
    
    // Remove common UI button text and navigation elements
    const genericUIPatterns = [
        /Learn more/gi,
        /Dismiss/gi,
        /Upload image/gi,
        /Microphone/gi,
        /Send/gi,
        /Cancel/gi,
        /Delete/gi,
        /Sources?:/gi
    ];
    
    genericUIPatterns.forEach(pattern => {
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
    
    // If content is too short or contains excessive CSS, try to find actual content
    if (content.length < 50 || 
        cssIndicators?.length > 10 || 
        cssPropertyCount > 20) {
        console.log('⚠️ Content appears to be UI/CSS elements, searching for better content...');
        
        // Try to find actual AI response content within the element
        const contentElements = aiOverview.querySelectorAll('p, div, span');
        const candidates = [];
        
        for (const element of contentElements) {
            const text = element.textContent.trim();
            // Simple filtering - just avoid very short text and obvious UI button text
            if (text.length > 30 && 
                !text.toLowerCase().includes('delete') &&
                !text.toLowerCase().includes('cancel') &&
                !text.toLowerCase().includes('learn more') &&
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