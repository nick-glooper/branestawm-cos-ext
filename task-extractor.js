// Branestawm - Task Extractor
// Pattern matching and task extraction logic

class TaskExtractor {
    constructor() {
        this.taskPatterns = [
            // Action-based patterns
            /I need to (.+?)(?:\.|$)/gi,
            /I should (.+?)(?:\.|$)/gi,
            /I have to (.+?)(?:\.|$)/gi,
            /I must (.+?)(?:\.|$)/gi,
            
            // Reminder patterns
            /[Rr]emember to (.+?)(?:\.|$)/gi,
            /[Dd]on't forget to (.+?)(?:\.|$)/gi,
            /[Mm]ake sure to (.+?)(?:\.|$)/gi,
            
            // Communication patterns
            /[Cc]all (.+?)(?:\.|$)/gi,
            /[Ee]mail (.+?)(?:\.|$)/gi,
            /[Tt]ext (.+?)(?:\.|$)/gi,
            /[Ff]ollow up (?:with|on) (.+?)(?:\.|$)/gi,
            /[Cc]ontact (.+?)(?:\.|$)/gi,
            
            // Planning patterns
            /[Pp]lan (?:to )?(.+?)(?:\.|$)/gi,
            /[Ss]chedule (.+?)(?:\.|$)/gi,
            /[Oo]rganize (.+?)(?:\.|$)/gi,
            
            // Deadline patterns with context
            /(.+?) by (.+?)(?:\.|$)/gi,
            /(.+?) before (.+?)(?:\.|$)/gi,
            /(.+?) due (.+?)(?:\.|$)/gi
        ];
    }
    
    /**
     * Extract potential tasks from message content
     */
    extractPotentialTasks(messageContent) {
        const potentialTasks = [];
        const processedTexts = new Set(); // Avoid duplicates
        
        for (const pattern of this.taskPatterns) {
            let match;
            pattern.lastIndex = 0; // Reset regex state
            
            while ((match = pattern.exec(messageContent)) !== null) {
                const taskText = match[1]?.trim();
                
                if (taskText && taskText.length > 3 && taskText.length < 200) {
                    // Clean up the task text
                    const cleanedText = this.cleanTaskText(taskText);
                    
                    if (!processedTexts.has(cleanedText.toLowerCase())) {
                        processedTexts.add(cleanedText.toLowerCase());
                        
                        potentialTasks.push({
                            text: cleanedText,
                            originalMatch: match[0],
                            confidence: this.calculateTaskConfidence(cleanedText),
                            extractedDate: this.extractDateFromContext(match[2] || messageContent),
                            context: messageContent.substring(Math.max(0, match.index - 50), match.index + match[0].length + 50)
                        });
                    }
                }
            }
        }
        
        // Sort by confidence and return top candidates
        return potentialTasks
            .filter(task => task.confidence > 0.3)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3); // Max 3 tasks per message to avoid overwhelming
    }
    
    /**
     * Clean and normalize task text
     */
    cleanTaskText(text) {
        return text
            .replace(/^(to\s+|that\s+)/i, '') // Remove leading "to" or "that"
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim()
            .replace(/^[a-z]/, (char) => char.toUpperCase()); // Capitalize first letter
    }
    
    /**
     * Calculate confidence score for task extraction
     */
    calculateTaskConfidence(text) {
        let confidence = 0.5; // Base confidence
        
        // Boost confidence for action words
        const actionWords = ['call', 'email', 'send', 'complete', 'finish', 'submit', 'review', 'prepare', 'organize', 'schedule', 'book', 'cancel', 'update', 'create', 'write'];
        const hasActionWord = actionWords.some(word => text.toLowerCase().includes(word));
        if (hasActionWord) confidence += 0.3;
        
        // Boost for specific names/entities
        const hasCapitalizedWord = /\b[A-Z][a-z]+/.test(text);
        if (hasCapitalizedWord) confidence += 0.2;
        
        // Reduce confidence for vague statements
        const vagueWords = ['something', 'things', 'stuff', 'maybe', 'probably', 'might'];
        const hasVagueWord = vagueWords.some(word => text.toLowerCase().includes(word));
        if (hasVagueWord) confidence -= 0.2;
        
        // Reduce confidence for very short or very long tasks
        if (text.length < 10) confidence -= 0.2;
        if (text.length > 100) confidence -= 0.1;
        
        return Math.max(0, Math.min(1, confidence));
    }
    
    /**
     * Automatically categorize task based on content
     */
    categorizeTask(taskText, context = '') {
        const combinedText = `${taskText} ${context}`.toLowerCase();
        
        // Work category patterns
        const workPatterns = [
            /\b(meeting|call|email|report|presentation|deadline|project|client|boss|manager|team|office|work|business|proposal|budget|invoice|contract|spreadsheet|document|review|approve)\b/g,
            /\b(monday|tuesday|wednesday|thursday|friday|9am|10am|11am|1pm|2pm|3pm|4pm|5pm|conference|zoom|teams|slack)\b/g
        ];
        
        // Personal category patterns  
        const personalPatterns = [
            /\b(doctor|dentist|appointment|family|friend|home|house|car|insurance|bank|grocery|shopping|vacation|holiday|birthday|anniversary|personal|health|medical|gym|exercise)\b/g,
            /\b(mom|dad|sister|brother|spouse|wife|husband|kid|child|parent|relative|weekend|saturday|sunday)\b/g
        ];
        
        // Creative category patterns
        const creativePatterns = [
            /\b(write|writing|blog|article|story|book|creative|design|art|music|photo|video|painting|drawing|craft|hobby|learn|study|course|practice|skill|guitar|piano)\b/g,
            /\b(portfolio|website|brand|logo|content|social media|instagram|youtube|podcast|newsletter|journal)\b/g
        ];
        
        // Administrative category patterns
        const adminPatterns = [
            /\b(file|filing|organize|clean|declutter|sort|archive|backup|update|renew|register|application|form|tax|taxes|bill|payment|subscription|account|password|setup|install)\b/g,
            /\b(paperwork|documentation|license|permit|registration|certificate|insurance|legal|finance|financial|administrative|admin|maintenance)\b/g
        ];
        
        // Count matches for each category
        const scores = {
            work: this.countPatternMatches(combinedText, workPatterns),
            personal: this.countPatternMatches(combinedText, personalPatterns), 
            creative: this.countPatternMatches(combinedText, creativePatterns),
            administrative: this.countPatternMatches(combinedText, adminPatterns)
        };
        
        // Find category with highest score
        const maxScore = Math.max(...Object.values(scores));
        if (maxScore === 0) return 'general';
        
        const topCategory = Object.keys(scores).find(key => scores[key] === maxScore);
        
        // Additional context-based refinements
        if (topCategory === 'work' && /\b(weekend|evening|after work|personal time)\b/g.test(combinedText)) {
            return scores.personal > 0 ? 'personal' : 'general';
        }
        
        return topCategory || 'general';
    }
    
    /**
     * Count pattern matches in text
     */
    countPatternMatches(text, patterns) {
        let totalMatches = 0;
        for (const pattern of patterns) {
            const matches = text.match(pattern);
            totalMatches += matches ? matches.length : 0;
        }
        return totalMatches;
    }
    
    /**
     * Get category display information
     */
    getCategoryInfo(category) {
        const categoryMap = {
            work: { icon: '💼', name: 'Work', color: '#3b82f6' },
            personal: { icon: '🏠', name: 'Personal', color: '#10b981' },
            creative: { icon: '🎨', name: 'Creative', color: '#8b5cf6' },
            administrative: { icon: '📋', name: 'Admin', color: '#f59e0b' },
            general: { icon: '📝', name: 'General', color: '#64748b' }
        };
        
        return categoryMap[category] || categoryMap.general;
    }
    
    /**
     * Extract date from context - simplified version
     */
    extractDateFromContext(dateContext) {
        if (!dateContext) return null;
        
        const datePatterns = [
            /\b(today|tomorrow|tonight)\b/i,
            /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
            /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/,
            /\b(\d{1,2}-\d{1,2}(?:-\d{2,4})?)\b/,
            /\b(\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december))\b/i
        ];
        
        for (const pattern of datePatterns) {
            const match = dateContext.match(pattern);
            if (match) {
                return {
                    raw: match[1],
                    confidence: 0.7
                };
            }
        }
        
        return null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskExtractor;
} else {
    window.TaskExtractor = TaskExtractor;
}