// Branestawm - Security Utilities
// HTML escaping and sanitization functions

class SecurityUtils {
    /**
     * Escape HTML to prevent XSS attacks
     */
    static escapeHtml(text) {
        if (typeof text !== 'string') {
            return String(text || '');
        }
        
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };
        
        return text.replace(/[&<>"'/]/g, (char) => escapeMap[char]);
    }
    
    /**
     * Sanitize CSS values to prevent injection
     */
    static sanitizeCssValue(value) {
        if (typeof value !== 'string') {
            return '';
        }
        
        // Remove potentially dangerous characters
        return value.replace(/[<>"'`(){}[\]\\]/g, '');
    }
    
    /**
     * Validate and sanitize color values
     */
    static sanitizeColor(color) {
        if (typeof color !== 'string') {
            return '#64748b'; // Default safe color
        }
        
        // Allow hex colors, rgb(), and safe CSS color names
        const safeColorPattern = /^(#[0-9A-Fa-f]{3,6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|[a-zA-Z]+)$/;
        
        if (safeColorPattern.test(color)) {
            return color;
        }
        
        return '#64748b'; // Default safe color
    }
    
    /**
     * Create safe HTML element with text content
     */
    static createSafeElement(tagName, textContent = '', attributes = {}) {
        const element = document.createElement(tagName);
        
        if (textContent) {
            element.textContent = textContent; // Safe - uses textContent instead of innerHTML
        }
        
        // Safely set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (typeof key === 'string' && typeof value === 'string') {
                // Whitelist safe attributes
                const safeAttributes = ['class', 'id', 'data-task-index', 'data-template-index', 'aria-label', 'role', 'style'];
                if (safeAttributes.includes(key)) {
                    if (key === 'style') {
                        // Extra validation for style attribute
                        element.setAttribute(key, this.sanitizeCssValue(value));
                    } else {
                        element.setAttribute(key, value);
                    }
                }
            }
        });
        
        return element;
    }
    
    /**
     * Safely set style properties on an element
     */
    static setSafeStyle(element, property, value) {
        if (!(element instanceof Element)) {
            return;
        }
        
        // Whitelist safe style properties
        const safeProperties = ['color', 'background-color', 'display', 'visibility', 'opacity'];
        
        if (safeProperties.includes(property)) {
            if (property === 'color' || property === 'background-color') {
                element.style[property] = this.sanitizeColor(value);
            } else {
                element.style[property] = this.sanitizeCssValue(value);
            }
        }
    }
    
    /**
     * Validate that a string contains only safe characters for use in data attributes
     */
    static validateDataAttribute(value) {
        if (typeof value !== 'string') {
            return false;
        }
        
        // Allow only alphanumeric, hyphens, underscores
        return /^[a-zA-Z0-9_-]+$/.test(value);
    }
    
    /**
     * Sanitize user input for safe display
     */
    static sanitizeUserInput(input) {
        if (typeof input !== 'string') {
            return String(input || '');
        }
        
        // Remove HTML tags and escape special characters
        return this.escapeHtml(input.replace(/<[^>]*>/g, ''));
    }
    
    /**
     * Check if a URL is safe for use in links
     */
    static isSafeUrl(url) {
        if (typeof url !== 'string') {
            return false;
        }
        
        try {
            const parsed = new URL(url);
            // Allow only safe protocols
            const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
            return safeProtocols.includes(parsed.protocol);
        } catch (error) {
            return false;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityUtils;
} else {
    window.SecurityUtils = SecurityUtils;
}