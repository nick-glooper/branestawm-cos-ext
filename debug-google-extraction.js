// Debug script to help identify the correct Google AI Mode selectors
// Run this in browser console on Google AI Mode pages to find the right elements

console.log('🔍 GOOGLE AI MODE EXTRACTION DEBUGGER');
console.log('====================================');

function debugGoogleAIMode() {
    console.log('📍 Current URL:', window.location.href);
    console.log('📍 Page Title:', document.title);
    
    // Check if we're in AI Mode
    const isAIMode = window.location.href.includes('udm=') || 
                     document.querySelector('[data-testid*="ai"]') ||
                     document.querySelector('[aria-label*="AI"]') ||
                     document.title.includes('AI');
    
    console.log('🤖 AI Mode detected:', isAIMode);
    
    // Find all elements with substantial content
    console.log('\n📊 ELEMENTS WITH SUBSTANTIAL CONTENT:');
    const substantialElements = Array.from(document.querySelectorAll('*'))
        .filter(el => {
            const text = el.textContent?.trim();
            return text && text.length > 200 && text.length < 5000 && 
                   !el.querySelector('script, style') &&
                   !el.closest('script, style, head');
        })
        .sort((a, b) => b.textContent.trim().length - a.textContent.trim().length);
    
    substantialElements.slice(0, 10).forEach((el, i) => {
        console.log(`\n[${i + 1}] Element:`, {
            tag: el.tagName,
            id: el.id,
            classes: el.className,
            textLength: el.textContent.trim().length,
            textPreview: el.textContent.trim().substring(0, 150) + '...',
            dataAttributes: Array.from(el.attributes)
                .filter(a => a.name.startsWith('data-'))
                .map(a => `${a.name}="${a.value}"`)
                .join(' '),
            ariaLabel: el.getAttribute('aria-label'),
            role: el.getAttribute('role'),
            parentInfo: {
                tag: el.parentElement?.tagName,
                classes: el.parentElement?.className,
                id: el.parentElement?.id
            }
        });
    });
    
    // Look for AI-specific patterns
    console.log('\n🤖 AI-SPECIFIC ELEMENTS:');
    const aiPatterns = [
        '[data-testid*="conversation"]',
        '[data-testid*="response"]', 
        '[data-testid*="turn"]',
        '[data-testid*="ai"]',
        '[class*="conversation"]',
        '[class*="response"]',
        '[class*="ai"]',
        '[aria-label*="AI"]',
        '[aria-label*="response"]',
        'div[data-node-key]',
        '[role="main"] > div',
        '[id*="search"] > div'
    ];
    
    aiPatterns.forEach(pattern => {
        const elements = document.querySelectorAll(pattern);
        if (elements.length > 0) {
            console.log(`\n📍 Pattern "${pattern}" found ${elements.length} elements:`);
            Array.from(elements).slice(0, 3).forEach((el, i) => {
                console.log(`  [${i}]`, {
                    tag: el.tagName,
                    classes: el.className.substring(0, 100),
                    textLength: el.textContent?.trim().length,
                    textPreview: el.textContent?.trim().substring(0, 100) + '...'
                });
            });
        }
    });
    
    // Find the main content area
    console.log('\n📋 MAIN CONTENT CONTAINERS:');
    const mainContainers = [
        '#search',
        '#main', 
        '#center_col',
        '#rcnt',
        '[role="main"]',
        '.g',
        '.tF2Cxc'
    ];
    
    mainContainers.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) {
            console.log(`📍 ${selector}:`, {
                tag: el.tagName,
                classes: el.className,
                childCount: el.children.length,
                textLength: el.textContent?.trim().length
            });
        }
    });
    
    // Find conversation-like structures
    console.log('\n💬 CONVERSATION STRUCTURES:');
    const conversationElements = Array.from(document.querySelectorAll('div'))
        .filter(el => {
            const text = el.textContent?.trim();
            const hasConversationLength = text && text.length > 300;
            const hasQuestionAnswer = text && (
                text.includes('?') && text.includes('.') ||
                text.toLowerCase().includes('according to') ||
                text.toLowerCase().includes('based on') ||
                text.toLowerCase().includes('as of')
            );
            return hasConversationLength && hasQuestionAnswer;
        });
    
    conversationElements.slice(0, 5).forEach((el, i) => {
        console.log(`\n[${i + 1}] Conversation candidate:`, {
            tag: el.tagName,
            classes: el.className.substring(0, 100),
            textLength: el.textContent.trim().length,
            textPreview: el.textContent.trim().substring(0, 200) + '...',
            hasDataTestId: !!el.getAttribute('data-testid'),
            hasAriaLabel: !!el.getAttribute('aria-label'),
            xpath: getXPath(el)
        });
    });
    
    return {
        substantialElements: substantialElements.slice(0, 5),
        conversationElements: conversationElements.slice(0, 3)
    };
}

// Helper function to get XPath
function getXPath(element) {
    if (element.id) return `//*[@id="${element.id}"]`;
    if (element === document.body) return '/html/body';
    
    let ix = 0;
    const siblings = element.parentNode?.childNodes || [];
    for (let sibling of siblings) {
        if (sibling === element) {
            return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
        }
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            ix++;
        }
    }
}

// Run the debugger
const results = debugGoogleAIMode();

console.log('\n🎯 RECOMMENDATIONS:');
console.log('1. Test these elements in order of preference');
console.log('2. Look for consistent patterns across different AI Mode pages');
console.log('3. Check if elements persist after page interactions');
console.log('4. Verify extracted content quality');

console.log('\n📋 DEBUG COMPLETE - Results available in `results` variable');