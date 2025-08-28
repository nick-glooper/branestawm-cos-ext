# Google AI Mode Extraction - Testing & Debugging Guide

## Problem Summary
The Branestawm import button appears on Google AI Mode pages but fails to extract the correct AI-generated content. This guide provides systematic testing steps to identify and fix the extraction issues.

## Key Issues Identified

1. **Generic Detection Logic**: Current fallback selector searches ALL divs, often picking up random page content
2. **Missing AI Mode Selectors**: Google AI Mode uses different DOM patterns than traditional AI Overview
3. **Over-Aggressive Filtering**: Content extraction removes too much legitimate AI content
4. **Insufficient Debugging**: Hard to identify which element was actually selected

## Testing Strategy

### Phase 1: Debug Current Extraction (5 minutes)

1. **Enable Debug Mode**
   - Go to a Google AI Mode search page (any search with `&udm=`)
   - Add `&debug=1` to the URL and refresh
   - Open browser console (F12) 
   - Look for debug output showing page analysis

2. **Run Debug Script**
   ```javascript
   // Paste debug-google-extraction.js content into browser console
   // This will show top content candidates with quality scores
   ```

3. **Check Current Extraction**
   - Click the "Import to Branestawm" button
   - Check console for extraction details
   - Note which element was selected and its content quality

### Phase 2: Identify Correct Selectors (10 minutes)

**Manual Testing on Live Google AI Mode Pages:**

1. **Test on Different Query Types**
   - Weather query: "weather in London"
   - Factual query: "who won the 2024 election"  
   - How-to query: "how to bake bread"
   - Current events: "latest news about AI"

2. **Inspect AI Response Elements**
   For each query type:
   - Right-click on the AI-generated response text
   - Select "Inspect Element"
   - Note the element structure:
     - Tag name and classes
     - Data attributes (data-testid, data-ved, etc.)
     - Parent container structure
     - Text content length and quality

3. **Document Patterns**
   Look for consistent patterns across different queries:
   - Common class names or data attributes
   - Container structure (main > section > div pattern)
   - Text length ranges (typically 200-2000 characters)
   - Presence of AI conversation indicators

### Phase 3: Test Improved Selectors (15 minutes)

**Update the candidates array in findAIOverview() with findings:**

```javascript
const candidates = [
    // Add your discovered selectors here, in order of preference
    { selector: '[your-discovered-selector]', name: 'Description' },
    // Example based on common patterns:
    { selector: '[data-testid*="conversation-thread"]', name: 'AI conversation thread' },
    { selector: '[data-ved][role="region"] div[class*="response"]', name: 'AI response region' },
    { selector: '#main div[data-testid]:has-text("according to")', name: 'AI content with indicators' },
];
```

**Testing Steps:**
1. Modify content-google.js with new selectors
2. Reload extension (chrome://extensions → reload)
3. Test on various Google AI Mode pages
4. Check console output for successful detection
5. Verify extracted content quality

### Phase 4: Validate Content Quality (10 minutes)

**Content Quality Checklist:**
- [ ] Contains actual AI-generated response (not UI elements)
- [ ] Length appropriate (200-2000 characters typically)
- [ ] Includes conversational elements ("according to", "based on", etc.)
- [ ] No CSS styling information or class names
- [ ] No UI button text ("Learn more", "Dismiss", etc.)
- [ ] Preserves important information and context

## Common Google AI Mode Patterns to Look For

Based on analysis, these patterns are commonly used:

### High-Priority Selectors
```css
[data-testid*="conversation"]
[data-testid*="response"]  
[data-testid*="ai-response"]
[data-ved][role="region"] > div
div[data-node-key]
.response-container (varies)
```

### Structural Patterns
- AI responses often in `#main` or `#center_col` containers
- Wrapped in divs with data-testid attributes
- May have role="region" or role="text" attributes
- Often 2-3 levels deep from main search container

### Content Indicators
- Text contains phrases like "According to", "Based on", "As of"
- Multiple sentences with periods and proper punctuation
- May include numbered lists or bullet points
- Length typically 300-1500 characters for good responses

## Debugging Commands

**Browser Console Commands:**
```javascript
// Find all substantial text elements
document.querySelectorAll('div').forEach(el => {
    const text = el.textContent?.trim();
    if (text && text.length > 200 && text.length < 2000) {
        console.log({
            element: el,
            text: text.substring(0, 100) + '...',
            classes: el.className,
            dataAttrs: [...el.attributes].filter(a => a.name.startsWith('data-'))
        });
    }
});

// Test a specific selector
const testElement = document.querySelector('[your-selector]');
if (testElement) {
    console.log('Found element:', testElement);
    console.log('Text content:', testElement.textContent?.trim());
    console.log('Element structure:', {
        tag: testElement.tagName,
        classes: testElement.className,
        id: testElement.id,
        dataAttrs: [...testElement.attributes].filter(a => a.name.startsWith('data-'))
    });
}
```

## Expected Outcomes

**Success Indicators:**
1. Console shows "Found via [specific selector]" message
2. Extracted content contains actual AI response text
3. Content length is reasonable (100+ characters)
4. No CSS styling or UI elements in extracted text
5. Content includes conversational elements and information

**Failure Indicators:**
1. "No AI Overview found" message
2. Extracted content is very short or contains UI text
3. Content includes CSS class names or styling
4. Button text or navigation elements in extracted content

## Next Steps After Testing

1. **Document Working Selectors**: Record which selectors work for different query types
2. **Update Selector Priority**: Place working selectors at top of candidates array  
3. **Improve Fallback Logic**: Enhance substantial-content detection for edge cases
4. **Test Cross-Browser**: Verify selectors work in Chrome/Edge/Firefox
5. **Monitor Changes**: Google may update their DOM structure periodically

## Emergency Fallback Strategy

If specific selectors fail, implement these fallbacks:

1. **Smart Content Detection**: Look for divs containing AI conversation patterns
2. **Quality Scoring**: Use the content quality function to rank candidates
3. **User Feedback**: Add UI to let users select the correct element manually
4. **Multiple Attempts**: Try extraction from multiple candidate elements

This systematic approach should help identify the correct selectors and fix the extraction issues.