// Branestawm - Task Templates
// Template generation and suggestions for task breakdowns

class TaskTemplates {
    constructor() {
        this.keywordMap = {
            meeting: ['meeting', 'call', 'zoom', 'discuss', 'sync', 'conference'],
            communication: ['email', 'send', 'contact', 'follow up', 'reply'],
            research: ['research', 'investigate', 'analyze', 'study', 'explore'],
            shopping: ['buy', 'purchase', 'order', 'shop', 'get', 'grocery'],
            appointment: ['appointment', 'schedule', 'book', 'doctor', 'dentist'],
            writing: ['write', 'draft', 'create', 'blog', 'article', 'document'],
            administrative: ['organize', 'file', 'sort', 'clean', 'update', 'form'],
            learning: ['learn', 'practice', 'study', 'course', 'skill', 'tutorial']
        };
    }
    
    /**
     * Detect task templates based on content patterns
     */
    detectTaskTemplates(taskText, context = '') {
        const combinedText = `${taskText} ${context}`.toLowerCase();
        const templates = [];
        
        // Meeting templates
        if (/\b(meeting|call|zoom|teams|conference|discuss|sync|standup|kickoff|review meeting)\b/g.test(combinedText)) {
            templates.push({
                type: 'meeting',
                name: 'Meeting Preparation',
                icon: '👥',
                description: 'Prepare for a meeting or call',
                subtasks: [
                    'Review agenda or talking points',
                    'Prepare materials or documents',
                    'Set up meeting room or video call',
                    'Send calendar invite with details',
                    'Follow up with action items afterward'
                ],
                estimatedTime: '30-45 minutes prep + meeting time',
                category: 'work'
            });
        }
        
        // Email/Communication templates
        if (/\b(email|send|contact|reach out|follow up|reply|respond)\b/g.test(combinedText)) {
            templates.push({
                type: 'communication',
                name: 'Communication Task',
                icon: '📧',
                description: 'Send email or contact someone',
                subtasks: [
                    'Draft the message',
                    'Review and edit for clarity',
                    'Add any necessary attachments',
                    'Send the communication',
                    'Set reminder for follow-up if needed'
                ],
                estimatedTime: '10-20 minutes',
                category: 'work'
            });
        }
        
        // Project/Research templates
        if (/\b(research|investigate|analyze|study|explore|learn|find out|look into)\b/g.test(combinedText)) {
            templates.push({
                type: 'research',
                name: 'Research Project',
                icon: '🔍',
                description: 'Research or investigate a topic',
                subtasks: [
                    'Define research questions or goals',
                    'Identify reliable sources',
                    'Gather and review information',
                    'Take notes and organize findings',
                    'Summarize conclusions or next steps'
                ],
                estimatedTime: '1-3 hours depending on scope',
                category: 'work'
            });
        }
        
        // Purchase/Shopping templates
        if (/\b(buy|purchase|order|shop|get|pick up|grocery|store)\b/g.test(combinedText)) {
            templates.push({
                type: 'shopping',
                name: 'Purchase Task',
                icon: '🛒',
                description: 'Buy or obtain something',
                subtasks: [
                    'Research options and prices',
                    'Check reviews or recommendations',
                    'Compare vendors or stores',
                    'Make the purchase',
                    'Confirm delivery or pickup'
                ],
                estimatedTime: '20-60 minutes',
                category: 'personal'
            });
        }
        
        // Appointment templates
        if (/\b(appointment|schedule|book|doctor|dentist|haircut|service)\b/g.test(combinedText)) {
            templates.push({
                type: 'appointment',
                name: 'Appointment Booking',
                icon: '📅',
                description: 'Schedule an appointment',
                subtasks: [
                    'Check your calendar for availability',
                    'Contact the provider to schedule',
                    'Add appointment to calendar',
                    'Set reminder before appointment',
                    'Prepare any needed documents'
                ],
                estimatedTime: '10-15 minutes to schedule',
                category: 'personal'
            });
        }
        
        // Writing/Creative templates
        if (/\b(write|draft|create|design|blog|article|document|proposal)\b/g.test(combinedText)) {
            templates.push({
                type: 'writing',
                name: 'Writing Project',
                icon: '✍️',
                description: 'Create written content',
                subtasks: [
                    'Outline key points or structure',
                    'Write first draft',
                    'Review and edit content',
                    'Check formatting and style',
                    'Share or publish as needed'
                ],
                estimatedTime: '1-4 hours depending on length',
                category: 'creative'
            });
        }
        
        // Administrative templates
        if (/\b(organize|file|sort|clean|update|renew|register|apply|form|paperwork)\b/g.test(combinedText)) {
            templates.push({
                type: 'administrative',
                name: 'Administrative Task',
                icon: '📋',
                description: 'Handle paperwork or organization',
                subtasks: [
                    'Gather required documents',
                    'Fill out necessary forms',
                    'Review for accuracy',
                    'Submit or file appropriately',
                    'Keep copies for records'
                ],
                estimatedTime: '30-90 minutes',
                category: 'administrative'
            });
        }
        
        // Learning/Skill Development templates
        if (/\b(learn|practice|study|course|tutorial|skill|train|improve)\b/g.test(combinedText)) {
            templates.push({
                type: 'learning',
                name: 'Learning Session',
                icon: '📚',
                description: 'Learn or practice a skill',
                subtasks: [
                    'Set specific learning goals',
                    'Find quality resources or materials',
                    'Dedicate focused time to practice',
                    'Take notes on key concepts',
                    'Apply what you learned practically'
                ],
                estimatedTime: '30 minutes - 2 hours per session',
                category: 'personal'
            });
        }
        
        // Return top 2 most relevant templates
        return templates
            .sort((a, b) => this.calculateTemplateRelevance(b, combinedText) - this.calculateTemplateRelevance(a, combinedText))
            .slice(0, 2);
    }
    
    /**
     * Calculate template relevance score
     */
    calculateTemplateRelevance(template, text) {
        let score = 0;
        const templateKeywords = this.getTemplateKeywords(template.type);
        
        for (const keyword of templateKeywords) {
            if (text.includes(keyword)) {
                score += 1;
            }
        }
        
        return score;
    }
    
    /**
     * Get keywords associated with template types
     */
    getTemplateKeywords(templateType) {
        return this.keywordMap[templateType] || [];
    }
    
    /**
     * Find related tasks based on content similarity
     */
    findRelatedTasks(taskText, category, dataManager, limit = 3) {
        const state = dataManager.getState();
        if (!state.tasks?.items) return [];
        
        const relatedTasks = [];
        const taskWords = this.extractKeywords(taskText);
        
        for (const [taskId, existingTask] of state.tasks.items) {
            if (existingTask.status === 'completed') continue;
            
            const existingWords = this.extractKeywords(existingTask.title + ' ' + (existingTask.description || ''));
            const similarity = this.calculateSimilarity(taskWords, existingWords);
            
            // Also check category match
            const categoryMatch = existingTask.category === category;
            
            if (similarity > 0.3 || categoryMatch) {
                relatedTasks.push({
                    task: existingTask,
                    similarity: similarity + (categoryMatch ? 0.2 : 0),
                    reason: similarity > 0.5 ? 'Similar content' : 
                           categoryMatch ? 'Same category' : 'Related keywords'
                });
            }
        }
        
        return relatedTasks
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }
    
    /**
     * Extract keywords from text for similarity comparison
     */
    extractKeywords(text) {
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'within', 'without', 'against', 'upon', 'beneath', 'beside', 'beyond', 'except', 'since', 'until', 'unless', 'although', 'because', 'however', 'therefore', 'thus', 'moreover', 'furthermore', 'nevertheless', 'nonetheless', 'meanwhile', 'otherwise', 'instead', 'accordingly', 'consequently', 'subsequently', 'previously', 'currently', 'recently', 'immediately', 'eventually', 'finally', 'initially', 'basically', 'generally', 'specifically', 'particularly', 'especially', 'mainly', 'primarily', 'essentially', 'actually', 'really', 'quite', 'very', 'too', 'so', 'such', 'even', 'just', 'only', 'also', 'still', 'yet', 'already', 'again', 'once', 'twice', 'always', 'never', 'often', 'sometimes', 'usually', 'frequently', 'rarely', 'occasionally', 'constantly', 'continuously', 'regularly', 'normally', 'typically', 'commonly', 'generally', 'specifically', 'particularly']);
        
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !commonWords.has(word));
    }
    
    /**
     * Calculate similarity between two sets of keywords
     */
    calculateSimilarity(words1, words2) {
        if (!words1.length || !words2.length) return 0;
        
        const set1 = new Set(words1);
        const set2 = new Set(words2);
        
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        return intersection.size / union.size;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskTemplates;
} else {
    window.TaskTemplates = TaskTemplates;
}