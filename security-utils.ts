// Branestawm - Security Utilities (TypeScript)
// HTML escaping and sanitization functions with type safety

import { SafeHtmlString } from './types/branestawm';

class SecurityUtils {
    /**
     * Escape HTML to prevent XSS attacks
     */
    static escapeHtml(text: string | number | boolean | null | undefined): string {
        if (typeof text !== 'string') {
            return String(text || '');
        }
        
        const escapeMap: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };
        
        return text.replace(/[&<>"'/]/g, (char: string): string => escapeMap[char] || char);
    }
    
    /**
     * Sanitize CSS values to prevent injection
     */
    static sanitizeCssValue(value: string | number | null | undefined): string {
        if (typeof value !== 'string') {
            return '';
        }
        
        // Remove potentially dangerous characters
        return value.replace(/[<>"'`(){}[\]\\]/g, '');
    }
    
    /**
     * Validate and sanitize color values
     */
    static sanitizeColor(color: string | null | undefined): string {
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
    static createSafeElement(
        tagName: string, 
        textContent: string = '', 
        attributes: Record<string, string> = {}
    ): HTMLElement {
        const element = document.createElement(tagName);
        
        if (textContent) {
            element.textContent = textContent; // Safe - uses textContent instead of innerHTML
        }
        
        // Safely set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (typeof key === 'string' && typeof value === 'string') {
                // Whitelist safe attributes
                const safeAttributes = [
                    'class', 'id', 'data-task-index', 'data-template-index', 
                    'aria-label', 'role', 'style'
                ];
                
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
    static setSafeStyle(
        element: Element, 
        property: string, 
        value: string | number
    ): void {
        if (!(element instanceof Element)) {
            return;
        }
        
        // Whitelist safe style properties
        const safeProperties = ['color', 'background-color', 'display', 'visibility', 'opacity'];
        
        if (safeProperties.includes(property)) {
            const htmlElement = element as HTMLElement;
            
            if (property === 'color' || property === 'background-color') {
                htmlElement.style.setProperty(property, this.sanitizeColor(String(value)));
            } else {
                htmlElement.style.setProperty(property, this.sanitizeCssValue(String(value)));
            }
        }
    }
    
    /**
     * Validate that a string contains only safe characters for use in data attributes
     */
    static validateDataAttribute(value: string | null | undefined): boolean {
        if (typeof value !== 'string') {
            return false;
        }
        
        // Allow only alphanumeric, hyphens, underscores
        return /^[a-zA-Z0-9_-]+$/.test(value);
    }
    
    /**
     * Sanitize user input for safe display
     */
    static sanitizeUserInput(input: string | number | boolean | null | undefined): string {
        if (typeof input !== 'string') {
            return String(input || '');
        }
        
        // Remove HTML tags and escape special characters
        return this.escapeHtml(input.replace(/<[^>]*>/g, ''));
    }
    
    /**
     * Check if a URL is safe for use in links
     */
    static isSafeUrl(url: string | null | undefined): boolean {
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
    
    /**
     * Create a safe HTML string marker (for template literals)
     */
    static safeHtml(strings: TemplateStringsArray, ...values: any[]): SafeHtmlString {
        let result = '';
        
        for (let i = 0; i < strings.length; i++) {
            result += strings[i];
            if (i < values.length) {
                result += this.escapeHtml(values[i]);
            }
        }
        
        return result as SafeHtmlString;
    }
    
    /**
     * Validate and sanitize JSON data
     */
    static sanitizeJsonData(data: any, maxDepth: number = 10): any {
        if (maxDepth <= 0) {
            return '[Max depth exceeded]';
        }
        
        if (data === null || data === undefined) {
            return data;
        }
        
        if (typeof data === 'string') {
            return this.sanitizeUserInput(data);
        }
        
        if (typeof data === 'number' || typeof data === 'boolean') {
            return data;
        }
        
        if (Array.isArray(data)) {
            return data.map(item => this.sanitizeJsonData(item, maxDepth - 1));
        }
        
        if (typeof data === 'object') {
            const sanitized: Record<string, any> = {};
            
            Object.entries(data).forEach(([key, value]) => {
                const sanitizedKey = this.sanitizeUserInput(key);
                sanitized[sanitizedKey] = this.sanitizeJsonData(value, maxDepth - 1);
            });
            
            return sanitized;
        }
        
        return String(data);
    }
}

// Export for use in other modules
export default SecurityUtils;

// Also maintain global compatibility
if (typeof window !== 'undefined') {
    window.SecurityUtils = SecurityUtils;
}