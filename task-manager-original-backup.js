// Branestawm - Task Manager
// Time-first task management system with automatic extraction and conscious deadline decisions

class TaskManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
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
        
        this.pendingTaskConfirmation = null;
        this.setupEventListeners();
        
        console.log('TaskManager initialized');
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
     * Detect related tasks based on content similarity
     */
    findRelatedTasks(taskText, category, limit = 3) {
        const state = this.dataManager.getState();
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
        const keywordMap = {
            meeting: ['meeting', 'call', 'zoom', 'discuss', 'sync', 'conference'],
            communication: ['email', 'send', 'contact', 'follow up', 'reply'],
            research: ['research', 'investigate', 'analyze', 'study', 'explore'],
            shopping: ['buy', 'purchase', 'order', 'shop', 'get'],
            appointment: ['appointment', 'schedule', 'book', 'doctor', 'dentist'],
            writing: ['write', 'draft', 'create', 'blog', 'article'],
            administrative: ['organize', 'file', 'sort', 'update', 'renew', 'form'],
            learning: ['learn', 'practice', 'study', 'course', 'skill']
        };
        
        return keywordMap[templateType] || [];
    }
    
    /**
     * Parse time estimate from text to minutes
     */
    parseTimeEstimate(timeString) {
        if (!timeString) return null;
        
        const text = timeString.toLowerCase();
        
        // Look for numeric values followed by time units
        const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)/);
        const minuteMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)/);
        
        let totalMinutes = 0;
        
        if (hourMatch) {
            totalMinutes += parseFloat(hourMatch[1]) * 60;
        }
        
        if (minuteMatch) {
            totalMinutes += parseFloat(minuteMatch[1]);
        }
        
        // Handle ranges (e.g., "1-3 hours", "30-90 minutes")
        const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h|minutes?|mins?|m)/);
        if (rangeMatch && totalMinutes === 0) {
            const min = parseFloat(rangeMatch[1]);
            const max = parseFloat(rangeMatch[2]);
            const avg = (min + max) / 2;
            
            if (text.includes('hour') || text.includes('hr')) {
                totalMinutes = avg * 60;
            } else {
                totalMinutes = avg;
            }
        }
        
        return totalMinutes > 0 ? Math.round(totalMinutes) : null;
    }
    
    /**
     * Start time tracking for a task
     */
    async startTaskTimer(taskId) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        
        if (!task) return false;
        
        // Initialize time tracking if not exists
        if (!task.timeTracking) {
            task.timeTracking = {
                estimatedMinutes: null,
                startedAt: null,
                completedAt: null,
                actualMinutes: null,
                accuracy: null
            };
        }
        
        task.timeTracking.startedAt = new Date().toISOString();
        task.status = 'in-progress';
        
        await this.dataManager.saveData();
        this.triggerTimelineUIUpdate();
        
        return true;
    }
    
    /**
     * Complete task and record actual time
     */
    async completeTaskWithTracking(taskId) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        
        if (!task) return false;
        
        const completedAt = new Date().toISOString();
        task.status = 'completed';
        task.completedAt = completedAt;
        
        // Calculate actual time if tracking was started
        if (task.timeTracking && task.timeTracking.startedAt) {
            const startTime = new Date(task.timeTracking.startedAt);
            const endTime = new Date(completedAt);
            const actualMinutes = Math.round((endTime - startTime) / (1000 * 60));
            
            task.timeTracking.completedAt = completedAt;
            task.timeTracking.actualMinutes = actualMinutes;
            
            // Calculate accuracy if we had an estimate
            if (task.timeTracking.estimatedMinutes) {
                const estimated = task.timeTracking.estimatedMinutes;
                task.timeTracking.accuracy = this.calculateTimeAccuracy(estimated, actualMinutes);
            }
            
            // Save this data for learning
            this.recordTimeEstimateData(task);
        }
        
        await this.dataManager.saveData();
        this.triggerTimelineUIUpdate();
        
        return true;
    }
    
    /**
     * Calculate accuracy of time estimate
     */
    calculateTimeAccuracy(estimated, actual) {
        if (!estimated || !actual) return null;
        
        // Perfect accuracy = 1.0, decreases as difference increases
        const ratio = Math.min(estimated, actual) / Math.max(estimated, actual);
        return Math.round(ratio * 100) / 100;
    }
    
    /**
     * Record time estimate data for learning
     */
    recordTimeEstimateData(task) {
        if (!task.timeTracking || !task.templateApplied) return;
        
        const state = this.dataManager.getState();
        
        // Initialize learning data structure if not exists
        if (!state.taskLearning) {
            state.taskLearning = {
                timeEstimates: {
                    byCategory: {},
                    byTemplate: {},
                    overallStats: {
                        totalTasks: 0,
                        averageAccuracy: 0,
                        lastUpdated: new Date().toISOString()
                    }
                }
            };
        }
        
        const learning = state.taskLearning.timeEstimates;
        const category = task.category || 'general';
        const templateType = task.templateApplied.type;
        
        // Record by category
        if (!learning.byCategory[category]) {
            learning.byCategory[category] = {
                estimates: [],
                averageAccuracy: 0,
                averageRatio: 1.0,
                sampleSize: 0
            };
        }
        
        // Record by template type
        if (!learning.byTemplate[templateType]) {
            learning.byTemplate[templateType] = {
                estimates: [],
                averageAccuracy: 0,
                averageRatio: 1.0,
                sampleSize: 0
            };
        }
        
        const estimateRecord = {
            estimated: task.timeTracking.estimatedMinutes,
            actual: task.timeTracking.actualMinutes,
            accuracy: task.timeTracking.accuracy,
            ratio: task.timeTracking.actualMinutes / task.timeTracking.estimatedMinutes,
            taskTitle: task.title,
            completedAt: task.timeTracking.completedAt
        };
        
        // Add to category data
        learning.byCategory[category].estimates.push(estimateRecord);
        this.updateLearningStats(learning.byCategory[category]);
        
        // Add to template data
        learning.byTemplate[templateType].estimates.push(estimateRecord);
        this.updateLearningStats(learning.byTemplate[templateType]);
        
        // Update overall stats
        learning.overallStats.totalTasks++;
        this.updateOverallLearningStats(learning.overallStats, learning.byCategory);
        
        console.log('Time estimate data recorded for learning:', estimateRecord);
    }
    
    /**
     * Update learning statistics
     */
    updateLearningStats(learningData) {
        const estimates = learningData.estimates;
        learningData.sampleSize = estimates.length;
        
        if (estimates.length === 0) return;
        
        // Calculate averages
        const totalAccuracy = estimates.reduce((sum, e) => sum + (e.accuracy || 0), 0);
        const totalRatio = estimates.reduce((sum, e) => sum + (e.ratio || 1), 0);
        
        learningData.averageAccuracy = Math.round((totalAccuracy / estimates.length) * 100) / 100;
        learningData.averageRatio = Math.round((totalRatio / estimates.length) * 100) / 100;
        
        // Keep only last 20 estimates per category/template
        if (estimates.length > 20) {
            learningData.estimates = estimates.slice(-20);
        }
    }
    
    /**
     * Update overall learning statistics
     */
    updateOverallLearningStats(overallStats, categoryData) {
        let totalAccuracy = 0;
        let totalSamples = 0;
        
        for (const category of Object.values(categoryData)) {
            totalAccuracy += (category.averageAccuracy || 0) * category.sampleSize;
            totalSamples += category.sampleSize;
        }
        
        overallStats.averageAccuracy = totalSamples > 0 ? 
            Math.round((totalAccuracy / totalSamples) * 100) / 100 : 0;
        overallStats.lastUpdated = new Date().toISOString();
    }
    
    /**
     * Get improved time estimate based on learning data
     */
    getImprovedTimeEstimate(category, templateType, originalEstimate) {
        const state = this.dataManager.getState();
        const learning = state.taskLearning?.timeEstimates;
        
        if (!learning || !originalEstimate) return originalEstimate;
        
        let adjustmentRatio = 1.0;
        let confidence = 0;
        
        // Check template-specific data first (more specific)
        if (learning.byTemplate[templateType] && learning.byTemplate[templateType].sampleSize >= 3) {
            adjustmentRatio = learning.byTemplate[templateType].averageRatio;
            confidence = Math.min(learning.byTemplate[templateType].sampleSize / 10, 1.0);
        } 
        // Fall back to category data
        else if (learning.byCategory[category] && learning.byCategory[category].sampleSize >= 5) {
            adjustmentRatio = learning.byCategory[category].averageRatio;
            confidence = Math.min(learning.byCategory[category].sampleSize / 15, 0.8);
        }
        
        if (confidence < 0.3) return originalEstimate; // Not enough data
        
        const parsedOriginal = this.parseTimeEstimate(originalEstimate);
        if (!parsedOriginal) return originalEstimate;
        
        const adjustedMinutes = Math.round(parsedOriginal * adjustmentRatio);
        const adjustedHours = adjustedMinutes >= 60 ? Math.round(adjustedMinutes / 60 * 10) / 10 : null;
        
        let improvedEstimate;
        if (adjustedHours && adjustedHours >= 1) {
            improvedEstimate = adjustedHours === Math.floor(adjustedHours) ? 
                `${adjustedHours} hour${adjustedHours > 1 ? 's' : ''}` :
                `${adjustedHours} hours`;
        } else {
            improvedEstimate = `${adjustedMinutes} minutes`;
        }
        
        return {
            original: originalEstimate,
            improved: improvedEstimate,
            confidence: Math.round(confidence * 100),
            adjustmentRatio: Math.round(adjustmentRatio * 100) / 100,
            basedOn: `${templateType ? 'template' : 'category'} data`
        };
    }
    
    /**
     * Extract date information from context
     */
    extractDateFromContext(context) {
        if (!context) return null;
        
        const datePatterns = [
            /today/gi,
            /tomorrow/gi,
            /this week/gi,
            /next week/gi,
            /by friday/gi,
            /end of (?:the )?week/gi,
            /\d{1,2}\/\d{1,2}\/?\d{0,4}/g, // MM/DD or MM/DD/YY
            /\d{1,2}-\d{1,2}-?\d{0,4}/g,   // MM-DD or MM-DD-YY
        ];
        
        for (const pattern of datePatterns) {
            const match = context.match(pattern);
            if (match) {
                return {
                    raw: match[0],
                    parsed: this.parseRelativeDate(match[0])
                };
            }
        }
        
        return null;
    }
    
    /**
     * Parse relative date expressions
     */
    parseRelativeDate(dateString) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (dateString.toLowerCase()) {
            case 'today':
                return today;
            case 'tomorrow':
                return new Date(today.getTime() + 24 * 60 * 60 * 1000);
            case 'this week':
                // End of current week (Friday)
                const daysUntilFriday = (5 - today.getDay() + 7) % 7;
                return new Date(today.getTime() + daysUntilFriday * 24 * 60 * 60 * 1000);
            case 'next week':
                // Next Monday
                const daysUntilNextMonday = (8 - today.getDay()) % 7 || 7;
                return new Date(today.getTime() + daysUntilNextMonday * 24 * 60 * 60 * 1000);
            default:
                // Try to parse as date
                const parsed = new Date(dateString);
                return isNaN(parsed.getTime()) ? null : parsed;
        }
    }
    
    /**
     * Show task confirmation dialog
     */
    showTaskConfirmation(tasks, messageId, folioId) {
        if (tasks.length === 0) return;
        
        // Detect templates for each task
        const tasksWithTemplates = tasks.map(task => ({
            ...task,
            templates: this.detectTaskTemplates(task.text, task.context),
            category: this.categorizeTask(task.text, task.context)
        }));
        
        this.pendingTaskConfirmation = {
            tasks: tasksWithTemplates,
            messageId,
            folioId,
            timestamp: Date.now()
        };
        
        // Create and show confirmation UI
        this.createTaskConfirmationUI(tasksWithTemplates);
    }
    
    /**
     * Create task confirmation UI
     */
    createTaskConfirmationUI(tasks) {
        // Remove any existing confirmation dialog
        this.removeTaskConfirmationUI();
        
        const dialog = document.createElement('div');
        dialog.className = 'task-confirmation-dialog';
        dialog.innerHTML = `
            <div class="task-confirmation-overlay">
                <div class="task-confirmation-content">
                    <div class="task-confirmation-header">
                        <h3>📋 Task Detected</h3>
                        <button class="close-btn" aria-label="Close">&times;</button>
                    </div>
                    <div class="task-confirmation-body">
                        <p>I noticed you mentioned ${tasks.length > 1 ? 'these tasks' : 'a task'}:</p>
                        <div class="detected-tasks">
                            ${tasks.map((task, index) => {
                                const categoryInfo = this.getCategoryInfo(task.category || 'general');
                                const hasTemplates = task.templates && task.templates.length > 0;
                                
                                return `
                                    <div class="detected-task" data-task-index="${index}">
                                        <div class="task-main">
                                            <div class="task-header">
                                                <div class="task-category-small" style="color: ${categoryInfo.color};">
                                                    ${categoryInfo.icon} ${categoryInfo.name}
                                                </div>
                                                <div class="task-confidence">
                                                    ${Math.round(task.confidence * 100)}% confident
                                                </div>
                                            </div>
                                            <div class="task-text">"${task.text}"</div>
                                            ${task.extractedDate ? `<div class="task-suggested-date">Suggested: ${task.extractedDate.raw}</div>` : ''}
                                        </div>
                                        
                                        ${hasTemplates ? `
                                            <div class="task-templates">
                                                <div class="templates-header">
                                                    <span class="templates-icon">💡</span>
                                                    <span class="templates-label">Smart Templates</span>
                                                </div>
                                                <div class="template-suggestions">
                                                    ${task.templates.map((template, templateIndex) => `
                                                        <div class="template-suggestion" data-template-index="${templateIndex}">
                                                            <div class="template-main">
                                                                <div class="template-header">
                                                                    <span class="template-icon">${template.icon}</span>
                                                                    <span class="template-name">${template.name}</span>
                                                                </div>
                                                                <div class="template-description">${template.description}</div>
                                                                <div class="template-time">${template.estimatedTime}</div>
                                                            </div>
                                                            <button class="template-use-btn" data-task-index="${index}" data-template-index="${templateIndex}">
                                                                Use Template
                                                            </button>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <div class="task-confirmation-actions">
                            <button class="btn secondary" id="ignoreTaskBtn">Not a task</button>
                            <button class="btn primary" id="confirmTaskBtn">Yes, add ${tasks.length > 1 ? 'these tasks' : 'this task'}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add styles
        this.injectTaskConfirmationStyles();
        
        // Add to page
        document.body.appendChild(dialog);
        
        // Setup event listeners
        this.setupTaskConfirmationListeners(dialog);
    }
    
    /**
     * Setup task confirmation event listeners
     */
    setupTaskConfirmationListeners(dialog) {
        const closeBtn = dialog.querySelector('.close-btn');
        const ignoreBtn = dialog.querySelector('#ignoreTaskBtn');
        const confirmBtn = dialog.querySelector('#confirmTaskBtn');
        const overlay = dialog.querySelector('.task-confirmation-overlay');
        
        // Close dialog handlers
        const closeDialog = () => {
            this.removeTaskConfirmationUI();
            this.pendingTaskConfirmation = null;
        };
        
        closeBtn?.addEventListener('click', closeDialog);
        ignoreBtn?.addEventListener('click', closeDialog);
        
        // Click outside to close
        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) closeDialog();
        });
        
        // Template use buttons
        dialog.querySelectorAll('.template-use-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskIndex = parseInt(e.target.dataset.taskIndex);
                const templateIndex = parseInt(e.target.dataset.templateIndex);
                this.applyTemplateToTask(taskIndex, templateIndex);
            });
        });
        
        // Confirm tasks
        confirmBtn?.addEventListener('click', () => {
            this.proceedWithTaskCreation();
            closeDialog();
        });
        
        // ESC key to close
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }
    
    /**
     * Proceed with task creation after confirmation
     */
    proceedWithTaskCreation() {
        if (!this.pendingTaskConfirmation) return;
        
        const { tasks, messageId, folioId } = this.pendingTaskConfirmation;
        
        // For each confirmed task, show deadline selection dialog
        this.showDeadlineSelectionDialog(tasks, messageId, folioId);
    }
    
    /**
     * Show deadline selection dialog for confirmed tasks
     */
    showDeadlineSelectionDialog(tasks, messageId, folioId) {
        const dialog = document.createElement('div');
        dialog.className = 'deadline-selection-dialog';
        
        dialog.innerHTML = `
            <div class="deadline-selection-overlay">
                <div class="deadline-selection-content">
                    <div class="deadline-selection-header">
                        <h3>⏰ Set Deadlines</h3>
                        <p>When do these tasks need to be completed?</p>
                    </div>
                    <div class="deadline-selection-body">
                        ${tasks.map((task, index) => `
                            <div class="task-deadline-item" data-task-index="${index}">
                                <div class="task-text">"${task.text}"</div>
                                <div class="deadline-options">
                                    <button class="deadline-btn" data-deadline="today" data-color="red">
                                        🔴 Today
                                    </button>
                                    <button class="deadline-btn" data-deadline="tomorrow" data-color="orange">
                                        🟠 Tomorrow
                                    </button>
                                    <button class="deadline-btn" data-deadline="this-week" data-color="yellow">
                                        🟡 This Week
                                    </button>
                                    <button class="deadline-btn" data-deadline="next-week" data-color="blue">
                                        🔵 Next Week
                                    </button>
                                    <button class="deadline-btn" data-deadline="custom" data-color="purple">
                                        🟣 Specific Date
                                    </button>
                                    <button class="deadline-btn no-deadline" data-deadline="none" data-color="gray">
                                        ⚪ No Specific Deadline
                                    </button>
                                </div>
                                <input type="date" class="custom-date-input" style="display: none;" />
                                <div class="no-deadline-confirmation" style="display: none;">
                                    <p class="warning">⚠️ Are you sure this doesn't need a deadline? This will go to your 'Someday/Maybe' list.</p>
                                    <div class="confirmation-buttons">
                                        <button class="btn secondary small confirm-no-deadline">Yes, no deadline</button>
                                        <button class="btn primary small cancel-no-deadline">Let me set a deadline</button>
                                    </div>
                                </div>
                                <div class="selected-deadline"></div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="deadline-selection-actions">
                        <button class="btn secondary" id="cancelDeadlineBtn">Cancel</button>
                        <button class="btn primary" id="createTasksBtn" disabled>Create Tasks</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add styles
        this.injectDeadlineSelectionStyles();
        
        // Add to page
        document.body.appendChild(dialog);
        
        // Setup deadline selection logic
        this.setupDeadlineSelectionListeners(dialog, tasks, messageId, folioId);
    }
    
    /**
     * Setup deadline selection event listeners
     */
    setupDeadlineSelectionListeners(dialog, tasks, messageId, folioId) {
        const cancelBtn = dialog.querySelector('#cancelDeadlineBtn');
        const createBtn = dialog.querySelector('#createTasksBtn');
        const overlay = dialog.querySelector('.deadline-selection-overlay');
        const taskSelections = new Map(); // Track selections per task
        
        // Close dialog
        const closeDialog = () => {
            document.body.removeChild(dialog);
        };
        
        cancelBtn?.addEventListener('click', closeDialog);
        
        // Click outside to close
        overlay?.addEventListener('click', (e) => {
            if (e.target === overlay) closeDialog();
        });
        
        // Handle deadline button clicks
        dialog.addEventListener('click', (e) => {
            if (e.target.classList.contains('deadline-btn')) {
                const taskItem = e.target.closest('.task-deadline-item');
                const taskIndex = parseInt(taskItem.dataset.taskIndex);
                const deadline = e.target.dataset.deadline;
                const customDateInput = taskItem.querySelector('.custom-date-input');
                const noDeadlineConfirmation = taskItem.querySelector('.no-deadline-confirmation');
                const selectedDeadlineDiv = taskItem.querySelector('.selected-deadline');
                
                // Clear previous selections
                taskItem.querySelectorAll('.deadline-btn').forEach(btn => btn.classList.remove('selected'));
                customDateInput.style.display = 'none';
                noDeadlineConfirmation.style.display = 'none';
                
                if (deadline === 'custom') {
                    // Show date picker
                    customDateInput.style.display = 'block';
                    customDateInput.focus();
                    e.target.classList.add('selected');
                } else if (deadline === 'none') {
                    // Show no-deadline confirmation
                    noDeadlineConfirmation.style.display = 'block';
                    e.target.classList.add('selected');
                } else {
                    // Direct deadline selection
                    e.target.classList.add('selected');
                    const deadlineDate = this.parseRelativeDate(deadline);
                    taskSelections.set(taskIndex, {
                        deadline: deadline,
                        date: deadlineDate,
                        text: e.target.textContent.trim()
                    });
                    
                    selectedDeadlineDiv.innerHTML = `<span class="selected-text">Due: ${e.target.textContent.trim()}</span>`;
                    this.checkAllTasksHaveDeadlines(taskSelections, tasks.length, createBtn);
                }
            }
        });
        
        // Handle custom date input
        dialog.addEventListener('change', (e) => {
            if (e.target.classList.contains('custom-date-input')) {
                const taskItem = e.target.closest('.task-deadline-item');
                const taskIndex = parseInt(taskItem.dataset.taskIndex);
                const selectedDate = new Date(e.target.value);
                const selectedDeadlineDiv = taskItem.querySelector('.selected-deadline');
                
                taskSelections.set(taskIndex, {
                    deadline: 'custom',
                    date: selectedDate,
                    text: selectedDate.toLocaleDateString()
                });
                
                selectedDeadlineDiv.innerHTML = `<span class="selected-text">Due: ${selectedDate.toLocaleDateString()}</span>`;
                this.checkAllTasksHaveDeadlines(taskSelections, tasks.length, createBtn);
            }
        });
        
        // Handle no-deadline confirmation
        dialog.addEventListener('click', (e) => {
            if (e.target.classList.contains('confirm-no-deadline')) {
                const taskItem = e.target.closest('.task-deadline-item');
                const taskIndex = parseInt(taskItem.dataset.taskIndex);
                const selectedDeadlineDiv = taskItem.querySelector('.selected-deadline');
                
                taskSelections.set(taskIndex, {
                    deadline: 'none',
                    date: null,
                    text: 'No specific deadline'
                });
                
                selectedDeadlineDiv.innerHTML = `<span class="selected-text">Someday/Maybe</span>`;
                this.checkAllTasksHaveDeadlines(taskSelections, tasks.length, createBtn);
            } else if (e.target.classList.contains('cancel-no-deadline')) {
                const taskItem = e.target.closest('.task-deadline-item');
                const noDeadlineConfirmation = taskItem.querySelector('.no-deadline-confirmation');
                taskItem.querySelectorAll('.deadline-btn').forEach(btn => btn.classList.remove('selected'));
                noDeadlineConfirmation.style.display = 'none';
            }
        });
        
        // Create tasks button
        createBtn?.addEventListener('click', () => {
            this.createTasksFromSelections(tasks, taskSelections, messageId, folioId);
            closeDialog();
        });
    }
    
    /**
     * Check if all tasks have deadline selections
     */
    checkAllTasksHaveDeadlines(selections, totalTasks, createBtn) {
        const allSelected = selections.size === totalTasks;
        createBtn.disabled = !allSelected;
        
        if (allSelected) {
            createBtn.textContent = `Create ${totalTasks} Task${totalTasks > 1 ? 's' : ''}`;
        } else {
            createBtn.textContent = `Select deadlines for all tasks (${selections.size}/${totalTasks})`;
        }
    }
    
    /**
     * Create tasks from user selections
     */
    async createTasksFromSelections(tasks, selections, messageId, folioId) {
        const createdTasks = [];
        
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const selection = selections.get(i);
            
            if (!selection) continue;
            
            const taskId = this.generateTaskId();
            
            // Smart categorization based on content
            const contentCategory = this.categorizeTask(task.text, task.context);
            const timeCategory = this.categorizeTaskByDate(selection.date);
            
            // Find related tasks
            const relatedTasks = this.findRelatedTasks(task.text, contentCategory);
            
            const newTask = {
                id: taskId,
                title: task.text,
                description: '', // Can be filled later through planning
                dueDate: selection.date,
                timeCategory: timeCategory,
                category: contentCategory,
                priority: this.calculatePriorityFromDate(selection.date),
                sourceConversation: messageId,
                folio: folioId,
                persona: this.dataManager.getState().currentPersona || 'core',
                status: 'pending',
                created: new Date().toISOString(),
                lastReviewed: new Date().toISOString(),
                originalContext: task.context,
                confidence: task.confidence,
                extractedFrom: task.originalMatch,
                relatedTasks: relatedTasks.map(rt => ({
                    id: rt.task.id,
                    title: rt.task.title,
                    reason: rt.reason,
                    similarity: rt.similarity
                })),
                categoryInfo: this.getCategoryInfo(contentCategory)
            };
            
            createdTasks.push(newTask);
        }
        
        // Save tasks to data store
        await this.saveTasks(createdTasks);
        
        // Show success notification
        this.showTaskCreationSuccess(createdTasks);
        
        // Trigger timeline update
        this.updateTimeline();
        
        console.log('Tasks created:', createdTasks);
    }
    
    /**
     * Categorize task by due date
     */
    categorizeTaskByDate(date) {
        if (!date) return 'someday';
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        if (date < today) return 'overdue';
        if (date.toDateString() === today.toDateString()) return 'today';
        if (date.toDateString() === tomorrow.toDateString()) return 'tomorrow';
        if (date <= nextWeek) return 'this-week';
        
        return 'future';
    }
    
    /**
     * Calculate priority from due date
     */
    calculatePriorityFromDate(date) {
        if (!date) return 1; // Lowest priority for no deadline
        
        const now = new Date();
        const timeDiff = date.getTime() - now.getTime();
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
        
        if (daysDiff < 0) return 10; // Overdue - highest priority
        if (daysDiff < 1) return 9;  // Due today
        if (daysDiff < 2) return 7;  // Due tomorrow
        if (daysDiff < 7) return 5;  // Due this week
        
        return 3; // Future tasks
    }
    
    /**
     * Generate unique task ID
     */
    generateTaskId() {
        return 'task-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Save tasks to data store
     */
    async saveTasks(tasks) {
        const state = this.dataManager.getState();
        
        // Initialize tasks structure if it doesn't exist
        if (!state.tasks) {
            state.tasks = {
                items: new Map(),
                timeline: {
                    overdue: new Set(),
                    today: new Set(),
                    tomorrow: new Set(),
                    thisWeek: new Set(),
                    future: new Set(),
                    someday: new Set()
                }
            };
        }
        
        // Add tasks to store
        for (const task of tasks) {
            state.tasks.items.set(task.id, task);
            state.tasks.timeline[task.timeCategory].add(task.id);
        }
        
        // Save to persistent storage
        await this.dataManager.saveData();
    }
    
    /**
     * Update timeline categorization
     */
    updateTimeline() {
        const state = this.dataManager.getState();
        if (!state.tasks) return;
        
        // Clear existing timeline
        for (const category in state.tasks.timeline) {
            state.tasks.timeline[category].clear();
        }
        
        // Recategorize all tasks
        for (const [taskId, task] of state.tasks.items) {
            const category = this.categorizeTaskByDate(task.dueDate);
            task.category = category;
            task.priority = this.calculatePriorityFromDate(task.dueDate);
            state.tasks.timeline[category].add(taskId);
        }
        
        // Trigger UI update if timeline is visible
        this.triggerTimelineUIUpdate();
    }
    
    /**
     * Show task creation success notification
     */
    showTaskCreationSuccess(tasks) {
        const notification = document.createElement('div');
        notification.className = 'task-success-notification';
        notification.innerHTML = `
            <div class="task-success-content">
                <span class="success-icon">✅</span>
                <span class="success-text">
                    ${tasks.length > 1 ? `Created ${tasks.length} tasks` : 'Task created successfully'}
                </span>
                <button class="view-timeline-btn">View Timeline</button>
            </div>
        `;
        
        // Add styles
        this.injectSuccessNotificationStyles();
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // View timeline button
        notification.querySelector('.view-timeline-btn')?.addEventListener('click', () => {
            this.showTimelineView();
            notification.parentNode.removeChild(notification);
        });
    }
    
    /**
     * Apply template to task
     */
    applyTemplateToTask(taskIndex, templateIndex) {
        if (!this.pendingTaskConfirmation) return;
        
        const task = this.pendingTaskConfirmation.tasks[taskIndex];
        const template = task.templates[templateIndex];
        
        if (!task || !template) return;
        
        // Apply template information to the task
        task.templateApplied = {
            type: template.type,
            name: template.name,
            subtasks: template.subtasks,
            estimatedTime: template.estimatedTime
        };
        
        // Add time tracking for learning
        task.timeTracking = {
            estimatedMinutes: this.parseTimeEstimate(template.estimatedTime),
            startedAt: null,
            completedAt: null,
            actualMinutes: null,
            accuracy: null
        };
        
        // Show template application feedback
        this.showTemplateAppliedFeedback(task, template);
        
        // Update the UI to show the template has been applied
        this.updateTaskConfirmationUI(taskIndex, template);
    }
    
    /**
     * Show template applied feedback
     */
    showTemplateAppliedFeedback(task, template) {
        // Create a temporary feedback element
        const feedback = document.createElement('div');
        feedback.className = 'template-applied-feedback';
        feedback.innerHTML = `
            <div class="feedback-content">
                ${template.icon} Applied "${template.name}" template to "${task.text}"
            </div>
        `;
        
        // Add styles for the feedback
        this.injectTemplateStyles();
        
        // Add to the task confirmation dialog
        const dialog = document.querySelector('.task-confirmation-dialog');
        if (dialog) {
            dialog.appendChild(feedback);
            
            // Remove after 3 seconds
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.remove();
                }
            }, 3000);
        }
    }
    
    /**
     * Update task confirmation UI when template is applied
     */
    updateTaskConfirmationUI(taskIndex, template) {
        const taskDiv = document.querySelector(`[data-task-index="${taskIndex}"]`);
        if (!taskDiv) return;
        
        // Find and update the template button
        const templateBtn = taskDiv.querySelector(`[data-template-index]`);
        if (templateBtn) {
            templateBtn.textContent = '✓ Applied';
            templateBtn.disabled = true;
            templateBtn.classList.add('template-applied');
        }
        
        // Add visual indication that template was applied
        taskDiv.classList.add('template-applied-task');
        
        // Show subtasks preview
        const templatesDiv = taskDiv.querySelector('.task-templates');
        if (templatesDiv) {
            const subtasksPreview = document.createElement('div');
            subtasksPreview.className = 'subtasks-preview';
            subtasksPreview.innerHTML = `
                <div class="subtasks-header">📝 This will create ${template.subtasks.length} subtasks:</div>
                <ul class="subtasks-list">
                    ${template.subtasks.slice(0, 3).map(subtask => `<li>${subtask}</li>`).join('')}
                    ${template.subtasks.length > 3 ? `<li class="more-subtasks">...and ${template.subtasks.length - 3} more</li>` : ''}
                </ul>
            `;
            templatesDiv.appendChild(subtasksPreview);
        }
    }
    
    /**
     * Remove task confirmation UI
     */
    removeTaskConfirmationUI() {
        const existing = document.querySelector('.task-confirmation-dialog');
        if (existing) {
            existing.parentNode.removeChild(existing);
        }
    }
    
    /**
     * Trigger timeline UI update
     */
    triggerTimelineUIUpdate() {
        // Dispatch custom event for UI components to listen to
        window.dispatchEvent(new CustomEvent('branestawm:tasksUpdated', {
            detail: { timestamp: Date.now() }
        }));
    }
    
    /**
     * Show timeline view
     */
    showTimelineView() {
        console.log('Timeline view requested');
        
        // Inject timeline styles
        this.injectTimelineStyles();
        
        // Remove any existing timeline view
        const existingTimeline = document.querySelector('.branestawm-timeline-overlay');
        if (existingTimeline) {
            existingTimeline.remove();
        }
        
        // Create timeline overlay
        const overlay = document.createElement('div');
        overlay.className = 'branestawm-timeline-overlay';
        overlay.innerHTML = this.generateTimelineHTML();
        
        // Add to page
        document.body.appendChild(overlay);
        
        // Setup event listeners
        this.setupTimelineEventListeners(overlay);
        
        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('branestawm:showTimeline'));
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for new messages to extract tasks
        window.addEventListener('branestawm:messageAdded', (event) => {
            const { message, folioId } = event.detail;
            this.processMessageForTasks(message, folioId);
        });
        
        // Listen for timeline update requests
        window.addEventListener('branestawm:updateTimeline', () => {
            this.updateTimeline();
        });
        
        // Listen for conversation context changes for proactive suggestions
        window.addEventListener('branestawm:conversationContext', (event) => {
            this.analyzeConversationContext(event.detail);
        });
    }
    
    /**
     * Analyze conversation context for proactive task suggestions
     */
    analyzeConversationContext(contextData) {
        const { messages, folioId, currentPersona } = contextData;
        
        if (!messages || messages.length === 0) return;
        
        // Get recent messages for context analysis
        const recentMessages = messages.slice(-5); // Last 5 messages
        const combinedText = recentMessages
            .map(msg => msg.content || '')
            .join(' ')
            .toLowerCase();
        
        // Find relevant tasks based on context
        const relevantTasks = this.findTasksRelatedToContext(combinedText, folioId, currentPersona);
        
        // Check for proactive reminder opportunities
        this.checkForProactiveReminders(relevantTasks, combinedText, folioId);
        
        // Look for missed task extraction opportunities
        this.checkForMissedTasks(recentMessages, folioId);
        
        // Check for deadline adjustment suggestions
        this.checkForDeadlineAdjustments(combinedText, relevantTasks);
    }
    
    /**
     * Find tasks related to conversation context
     */
    findTasksRelatedToContext(contextText, folioId, currentPersona) {
        const state = this.dataManager.getState();
        if (!state.tasks?.items) return [];
        
        const relevantTasks = [];
        const contextKeywords = this.extractKeywords(contextText);
        
        for (const [taskId, task] of state.tasks.items) {
            if (task.status === 'completed') continue;
            
            let relevanceScore = 0;
            const taskKeywords = this.extractKeywords(task.title + ' ' + (task.description || ''));
            
            // Check keyword similarity
            const similarity = this.calculateSimilarity(contextKeywords, taskKeywords);
            relevanceScore += similarity * 100;
            
            // Boost score for same folio
            if (task.folio === folioId) {
                relevanceScore += 20;
            }
            
            // Boost score for same persona
            if (task.persona === currentPersona) {
                relevanceScore += 15;
            }
            
            // Boost score for same category if context suggests category
            const contextCategory = this.categorizeTask(contextText);
            if (task.category === contextCategory) {
                relevanceScore += 10;
            }
            
            // Check for due date proximity (urgent tasks get higher relevance)
            if (task.dueDate) {
                const daysUntilDue = this.getDaysUntilDue(new Date(task.dueDate));
                if (daysUntilDue <= 1) relevanceScore += 30;
                else if (daysUntilDue <= 3) relevanceScore += 15;
                else if (daysUntilDue <= 7) relevanceScore += 5;
            }
            
            if (relevanceScore >= 30) { // Threshold for relevance
                relevantTasks.push({
                    task,
                    relevanceScore,
                    reasons: this.getRelevanceReasons(similarity, task, contextCategory, folioId, currentPersona)
                });
            }
        }
        
        return relevantTasks
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 3); // Top 3 most relevant
    }
    
    /**
     * Get reasons for task relevance
     */
    getRelevanceReasons(similarity, task, contextCategory, folioId, currentPersona) {
        const reasons = [];
        
        if (similarity > 0.3) reasons.push('Similar content');
        if (task.folio === folioId) reasons.push('Same conversation');
        if (task.persona === currentPersona) reasons.push('Same persona');
        if (task.category === contextCategory) reasons.push('Related category');
        
        const daysUntilDue = task.dueDate ? this.getDaysUntilDue(new Date(task.dueDate)) : null;
        if (daysUntilDue !== null) {
            if (daysUntilDue <= 0) reasons.push('Overdue');
            else if (daysUntilDue <= 1) reasons.push('Due soon');
            else if (daysUntilDue <= 7) reasons.push('Due this week');
        }
        
        return reasons;
    }
    
    /**
     * Get days until due date
     */
    getDaysUntilDue(dueDate) {
        const now = new Date();
        const diffTime = dueDate.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    /**
     * Check for proactive reminder opportunities
     */
    checkForProactiveReminders(relevantTasks, contextText, folioId) {
        if (relevantTasks.length === 0) return;
        
        // Only show proactive reminders if context strongly suggests task relevance
        const highRelevanceTasks = relevantTasks.filter(rt => rt.relevanceScore >= 50);
        
        if (highRelevanceTasks.length > 0) {
            // Throttle notifications - don't show more than once per 10 minutes per task
            const now = Date.now();
            const throttleTime = 10 * 60 * 1000; // 10 minutes
            
            for (const relevantTask of highRelevanceTasks) {
                const task = relevantTask.task;
                const lastReminder = task.lastProactiveReminder || 0;
                
                if (now - lastReminder > throttleTime) {
                    task.lastProactiveReminder = now;
                    this.showProactiveTaskReminder(relevantTask, folioId);
                    break; // Only show one reminder at a time
                }
            }
        }
    }
    
    /**
     * Show proactive task reminder
     */
    showProactiveTaskReminder(relevantTask, folioId) {
        const { task, relevanceScore, reasons } = relevantTask;
        
        const reminder = document.createElement('div');
        reminder.className = 'proactive-task-reminder';
        reminder.innerHTML = `
            <div class="reminder-content">
                <div class="reminder-header">
                    <span class="reminder-icon">💡</span>
                    <span class="reminder-title">Related Task</span>
                    <button class="reminder-close" title="Dismiss">×</button>
                </div>
                
                <div class="reminder-body">
                    <div class="task-info">
                        <h4>${this.escapeHTML(task.title || task.text)}</h4>
                        ${task.dueDate ? `<div class="task-due">Due: ${this.formatDueDate(new Date(task.dueDate))}</div>` : ''}
                        <div class="relevance-reasons">
                            ${reasons.slice(0, 2).map(reason => `<span class="reason-tag">${reason}</span>`).join('')}
                        </div>
                    </div>
                    
                    <div class="reminder-actions">
                        <button class="reminder-action view-task">View</button>
                        <button class="reminder-action start-task">Start</button>
                        <button class="reminder-action dismiss">Later</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add styles
        this.injectProactiveReminderStyles();
        
        // Position in top-right corner
        document.body.appendChild(reminder);
        
        // Event listeners
        reminder.querySelector('.reminder-close')?.addEventListener('click', () => {
            reminder.remove();
        });
        
        reminder.querySelector('.view-task')?.addEventListener('click', () => {
            this.showTimelineView();
            reminder.remove();
        });
        
        reminder.querySelector('.start-task')?.addEventListener('click', () => {
            this.startTaskTimer(task.id);
            this.showTimelineView();
            reminder.remove();
        });
        
        reminder.querySelector('.dismiss')?.addEventListener('click', () => {
            reminder.remove();
        });
        
        // Auto-dismiss after 15 seconds
        setTimeout(() => {
            if (reminder.parentNode) {
                reminder.remove();
            }
        }, 15000);
    }
    
    /**
     * Check for missed task extraction opportunities
     */
    checkForMissedTasks(recentMessages, folioId) {
        // Look for patterns that might indicate tasks were missed
        const userMessages = recentMessages.filter(msg => msg.role === 'user');
        
        if (userMessages.length === 0) return;
        
        const lastUserMessage = userMessages[userMessages.length - 1];
        const potentialTasks = this.extractPotentialTasks(lastUserMessage.content);
        
        // Only suggest if confidence is moderate but not high (high confidence tasks should have been extracted)
        const missedTasks = potentialTasks.filter(task => 
            task.confidence > 0.4 && task.confidence < 0.7
        );
        
        if (missedTasks.length > 0) {
            // Show subtle suggestion for missed tasks
            this.showMissedTaskSuggestion(missedTasks, folioId);
        }
    }
    
    /**
     * Show missed task suggestion
     */
    showMissedTaskSuggestion(missedTasks, folioId) {
        const suggestion = document.createElement('div');
        suggestion.className = 'missed-task-suggestion';
        suggestion.innerHTML = `
            <div class="suggestion-content">
                <div class="suggestion-header">
                    <span class="suggestion-icon">🤔</span>
                    <span class="suggestion-text">Did you mean to create a task?</span>
                    <button class="suggestion-close" title="Dismiss">×</button>
                </div>
                
                <div class="suggestion-body">
                    <div class="potential-task">
                        "${this.escapeHTML(missedTasks[0].text)}"
                    </div>
                    <div class="suggestion-actions">
                        <button class="suggestion-action create-task">Yes, create task</button>
                        <button class="suggestion-action ignore">No, ignore</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add styles
        this.injectProactiveReminderStyles();
        
        document.body.appendChild(suggestion);
        
        // Event listeners
        suggestion.querySelector('.suggestion-close')?.addEventListener('click', () => {
            suggestion.remove();
        });
        
        suggestion.querySelector('.create-task')?.addEventListener('click', () => {
            // Create task confirmation dialog
            this.showTaskConfirmation(missedTasks, 'manual', folioId);
            suggestion.remove();
        });
        
        suggestion.querySelector('.ignore')?.addEventListener('click', () => {
            suggestion.remove();
        });
        
        // Auto-dismiss after 20 seconds
        setTimeout(() => {
            if (suggestion.parentNode) {
                suggestion.remove();
            }
        }, 20000);
    }
    
    /**
     * Check for deadline adjustment suggestions
     */
    checkForDeadlineAdjustments(contextText, relevantTasks) {
        // Look for time-related context clues that might suggest deadline changes
        const timeIndicators = [
            /postpone|delay|push back|move to|reschedule/gi,
            /urgent|asap|immediately|rush|priority/gi,
            /can't make it|won't finish|need more time/gi,
            /ahead of schedule|early|ready now/gi
        ];
        
        let adjustmentType = null;
        
        for (const indicator of timeIndicators) {
            if (indicator.test(contextText)) {
                if (indicator.source.includes('postpone|delay|push back')) {
                    adjustmentType = 'postpone';
                } else if (indicator.source.includes('urgent|asap|immediately')) {
                    adjustmentType = 'urgent';
                } else if (indicator.source.includes('can\'t make it|won\'t finish')) {
                    adjustmentType = 'extend';
                } else if (indicator.source.includes('ahead of schedule|early')) {
                    adjustmentType = 'advance';
                }
                break;
            }
        }
        
        if (adjustmentType && relevantTasks.length > 0) {
            // Show deadline adjustment suggestion
            this.showDeadlineAdjustmentSuggestion(relevantTasks[0].task, adjustmentType);
        }
    }
    
    /**
     * Show deadline adjustment suggestion
     */
    showDeadlineAdjustmentSuggestion(task, adjustmentType) {
        if (!task.dueDate) return;
        
        let suggestionText = '';
        let newDate = new Date(task.dueDate);
        
        switch (adjustmentType) {
            case 'postpone':
                newDate.setDate(newDate.getDate() + 3);
                suggestionText = `Move "${task.title}" deadline to ${newDate.toLocaleDateString()}?`;
                break;
            case 'urgent':
                newDate = new Date();
                newDate.setDate(newDate.getDate() + 1);
                suggestionText = `Make "${task.title}" due tomorrow (urgent)?`;
                break;
            case 'extend':
                newDate.setDate(newDate.getDate() + 7);
                suggestionText = `Extend "${task.title}" deadline by a week?`;
                break;
            case 'advance':
                newDate = new Date();
                suggestionText = `Mark "${task.title}" as due today (ready early)?`;
                break;
            default:
                return;
        }
        
        const adjustment = document.createElement('div');
        adjustment.className = 'deadline-adjustment-suggestion';
        adjustment.innerHTML = `
            <div class="adjustment-content">
                <div class="adjustment-header">
                    <span class="adjustment-icon">📅</span>
                    <span class="adjustment-title">Deadline Adjustment</span>
                    <button class="adjustment-close" title="Dismiss">×</button>
                </div>
                
                <div class="adjustment-body">
                    <div class="adjustment-question">${suggestionText}</div>
                    <div class="adjustment-actions">
                        <button class="adjustment-action accept">Yes, adjust</button>
                        <button class="adjustment-action decline">No, keep current</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add styles
        this.injectProactiveReminderStyles();
        
        document.body.appendChild(adjustment);
        
        // Event listeners
        adjustment.querySelector('.adjustment-close')?.addEventListener('click', () => {
            adjustment.remove();
        });
        
        adjustment.querySelector('.accept')?.addEventListener('click', async () => {
            // Update task deadline
            task.dueDate = newDate.toISOString();
            task.timeCategory = this.categorizeTaskByDate(newDate);
            
            await this.dataManager.saveData();
            this.triggerTimelineUIUpdate();
            
            adjustment.remove();
        });
        
        adjustment.querySelector('.decline')?.addEventListener('click', () => {
            adjustment.remove();
        });
        
        // Auto-dismiss after 25 seconds
        setTimeout(() => {
            if (adjustment.parentNode) {
                adjustment.remove();
            }
        }, 25000);
    }
    
    /**
     * Process message for task extraction
     */
    processMessageForTasks(message, folioId) {
        if (message.role !== 'user') return; // Only process user messages
        
        const tasks = this.extractPotentialTasks(message.content);
        if (tasks.length > 0) {
            // Small delay to ensure message is rendered
            setTimeout(() => {
                this.showTaskConfirmation(tasks, message.id, folioId);
            }, 500);
        }
    }
    
    /**
     * Get all tasks
     */
    getAllTasks() {
        const state = this.dataManager.getState();
        if (!state.tasks) return [];
        
        return Array.from(state.tasks.items.values());
    }
    
    /**
     * Get tasks by category
     */
    getTasksByCategory(category) {
        const state = this.dataManager.getState();
        if (!state.tasks || !state.tasks.timeline[category]) return [];
        
        const taskIds = Array.from(state.tasks.timeline[category]);
        return taskIds.map(id => state.tasks.items.get(id)).filter(Boolean);
    }
    
    /**
     * Update task status
     */
    async updateTaskStatus(taskId, status) {
        const state = this.dataManager.getState();
        if (!state.tasks || !state.tasks.items.has(taskId)) return false;
        
        const task = state.tasks.items.get(taskId);
        task.status = status;
        task.lastReviewed = new Date();
        
        await this.dataManager.saveData();
        this.triggerTimelineUIUpdate();
        
        return true;
    }
    
    /**
     * Delete task
     */
    async deleteTask(taskId) {
        const state = this.dataManager.getState();
        if (!state.tasks || !state.tasks.items.has(taskId)) return false;
        
        const task = state.tasks.items.get(taskId);
        
        // Remove from items
        state.tasks.items.delete(taskId);
        
        // Remove from timeline
        state.tasks.timeline[task.category].delete(taskId);
        
        await this.dataManager.saveData();
        this.triggerTimelineUIUpdate();
        
        return true;
    }
    
    /**
     * Generate timeline HTML
     */
    generateTimelineHTML() {
        const state = this.dataManager.getState();
        
        const categories = [
            { key: 'overdue', title: 'Overdue', icon: '⚠️', urgent: true },
            { key: 'today', title: 'Today', icon: '📅', urgent: true },
            { key: 'tomorrow', title: 'Tomorrow', icon: '➡️', urgent: false },
            { key: 'thisWeek', title: 'This Week', icon: '📆', urgent: false },
            { key: 'future', title: 'Future', icon: '🔮', urgent: false },
            { key: 'someday', title: 'Someday', icon: '💭', urgent: false }
        ];
        
        let timelineHTML = `
            <div class="branestawm-timeline-container">
                <div class="timeline-header">
                    <h2>📋 Task Timeline</h2>
                    <p class="timeline-subtitle">Time-first task management</p>
                    <button class="timeline-close-btn" title="Close Timeline">✕</button>
                </div>
                <div class="timeline-content">
        `;
        
        for (const category of categories) {
            const tasks = this.getTasksByCategory(category.key);
            const urgentClass = category.urgent ? 'urgent-category' : '';
            
            timelineHTML += `
                <div class="timeline-category ${urgentClass}" data-category="${category.key}">
                    <div class="category-header">
                        <span class="category-icon">${category.icon}</span>
                        <h3 class="category-title">${category.title}</h3>
                        <span class="task-count">${tasks.length}</span>
                    </div>
                    <div class="category-tasks">
            `;
            
            if (tasks.length === 0) {
                timelineHTML += `
                    <div class="empty-category">
                        <span class="empty-message">No tasks scheduled</span>
                    </div>
                `;
            } else {
                // Sort tasks by priority within category
                tasks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
                
                for (const task of tasks) {
                    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                    const dueDateText = dueDate ? this.formatDueDate(dueDate) : 'No deadline';
                    const priorityClass = this.getPriorityClass(task.priority);
                    
                    // Get category info for display
                    const categoryInfo = task.categoryInfo || this.getCategoryInfo(task.category || 'general');
                    const hasRelatedTasks = task.relatedTasks && task.relatedTasks.length > 0;
                    
                    // Build related tasks display
                    let relatedTasksHTML = '';
                    if (hasRelatedTasks) {
                        const relatedCount = task.relatedTasks.length;
                        const topRelated = task.relatedTasks[0];
                        relatedTasksHTML = `
                            <div class="task-related" title="Related to: ${task.relatedTasks.map(rt => rt.title).join(', ')}">
                                🔗 ${relatedCount} related ${relatedCount === 1 ? 'task' : 'tasks'}
                            </div>
                        `;
                    }
                    
                    timelineHTML += `
                        <div class="timeline-task ${priorityClass}" data-task-id="${task.id}" data-category="${task.category || 'general'}">
                            <div class="task-main">
                                <div class="task-header">
                                    <div class="task-category-badge" style="background-color: ${categoryInfo.color}20; border-left: 3px solid ${categoryInfo.color};">
                                        <span class="category-icon">${categoryInfo.icon}</span>
                                        <span class="category-name">${categoryInfo.name}</span>
                                    </div>
                                    ${relatedTasksHTML}
                                </div>
                                <div class="task-content">
                                    <h4 class="task-title">${this.escapeHTML(task.title || task.text)}</h4>
                                    <p class="task-description">${this.escapeHTML(task.description || '')}</p>
                                </div>
                                <div class="task-meta">
                                    <span class="task-due-date">${dueDateText}</span>
                                    <span class="task-priority">Priority: ${task.priority || 0}</span>
                                    ${task.confidence ? `<span class="task-confidence">Confidence: ${Math.round(task.confidence * 100)}%</span>` : ''}
                                </div>
                            </div>
                            <div class="task-actions">
                                ${task.status === 'in-progress' && task.timeTracking?.startedAt ? 
                                    '<button class="task-timer-btn active" title="Timer Running">⏱️ Running</button>' :
                                    '<button class="task-timer-btn" title="Start Timer">⏱️ Start</button>'
                                }
                                <button class="task-complete-btn" title="Mark Complete">✓</button>
                                <button class="task-plan-btn" title="Plan This Task">📋</button>
                                ${hasRelatedTasks ? '<button class="task-related-btn" title="View Related Tasks">🔗</button>' : ''}
                                <button class="task-edit-btn" title="Edit Task">✎</button>
                                <button class="task-delete-btn" title="Delete Task">🗑</button>
                            </div>
                        </div>
                    `;
                }
            }
            
            timelineHTML += `
                    </div>
                </div>
            `;
        }
        
        timelineHTML += `
                </div>
                <div class="timeline-footer">
                    <div class="timeline-stats">
                        Total: ${this.getTotalTaskCount()} tasks
                    </div>
                    <button class="add-task-btn">+ Add New Task</button>
                </div>
            </div>
        `;
        
        return timelineHTML;
    }
    
    /**
     * Setup timeline event listeners
     */
    setupTimelineEventListeners(overlay) {
        // Close button
        overlay.querySelector('.timeline-close-btn')?.addEventListener('click', () => {
            overlay.remove();
        });
        
        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
        
        // Task action buttons
        overlay.querySelectorAll('.task-timer-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.closest('.timeline-task').dataset.taskId;
                if (btn.classList.contains('active')) {
                    // Timer is running, show elapsed time or pause option
                    this.showTimerDialog(taskId);
                } else {
                    // Start timer
                    this.startTaskTimer(taskId);
                    this.refreshTimelineView(overlay);
                }
            });
        });
        
        overlay.querySelectorAll('.task-complete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.closest('.timeline-task').dataset.taskId;
                this.completeTaskWithTracking(taskId);
                this.refreshTimelineView(overlay);
            });
        });
        
        overlay.querySelectorAll('.task-plan-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.closest('.timeline-task').dataset.taskId;
                overlay.remove();
                this.showTaskPlanningDialog(taskId);
            });
        });
        
        overlay.querySelectorAll('.task-related-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.closest('.timeline-task').dataset.taskId;
                this.showRelatedTasksDialog(taskId);
            });
        });
        
        overlay.querySelectorAll('.task-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.closest('.timeline-task').dataset.taskId;
                if (confirm('Delete this task?')) {
                    this.deleteTask(taskId);
                    this.refreshTimelineView(overlay);
                }
            });
        });
        
        // Add new task button
        overlay.querySelector('.add-task-btn')?.addEventListener('click', () => {
            overlay.remove();
            this.showManualTaskCreation();
        });
        
        // Keyboard navigation
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
            }
        });
    }
    
    /**
     * Refresh timeline view
     */
    refreshTimelineView(overlay) {
        const content = overlay.querySelector('.timeline-content');
        if (content) {
            content.innerHTML = this.generateTimelineHTML().match(/<div class="timeline-content">([\s\S]*?)<\/div>\s*<div class="timeline-footer">/)[1];
            this.setupTimelineEventListeners(overlay);
        }
    }
    
    /**
     * Helper methods for timeline
     */
    getPriorityClass(priority) {
        if (priority >= 80) return 'priority-critical';
        if (priority >= 60) return 'priority-high';
        if (priority >= 40) return 'priority-medium';
        if (priority >= 20) return 'priority-low';
        return 'priority-minimal';
    }
    
    getTotalTaskCount() {
        const state = this.dataManager.getState();
        return state.tasks ? state.tasks.items.size : 0;
    }
    
    formatDueDate(date) {
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            return `${Math.abs(diffDays)} days overdue`;
        } else if (diffDays === 0) {
            return 'Due today';
        } else if (diffDays === 1) {
            return 'Due tomorrow';
        } else if (diffDays < 7) {
            return `Due in ${diffDays} days`;
        } else {
            return date.toLocaleDateString();
        }
    }
    
    escapeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Show timer dialog for active task
     */
    showTimerDialog(taskId) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        
        if (!task || !task.timeTracking?.startedAt) return;
        
        const startTime = new Date(task.timeTracking.startedAt);
        const elapsedMinutes = Math.round((new Date() - startTime) / (1000 * 60));
        const elapsedHours = Math.floor(elapsedMinutes / 60);
        const remainingMinutes = elapsedMinutes % 60;
        
        let elapsedText;
        if (elapsedHours > 0) {
            elapsedText = `${elapsedHours}h ${remainingMinutes}m`;
        } else {
            elapsedText = `${elapsedMinutes}m`;
        }
        
        const dialog = document.createElement('div');
        dialog.className = 'timer-dialog-overlay';
        dialog.innerHTML = `
            <div class="timer-dialog-container">
                <div class="timer-header">
                    <h3>⏱️ Timer: ${this.escapeHTML(task.title || task.text)}</h3>
                    <button class="timer-close-btn" title="Close">✕</button>
                </div>
                
                <div class="timer-content">
                    <div class="timer-display">
                        <div class="elapsed-time">${elapsedText}</div>
                        <div class="timer-status">Running since ${startTime.toLocaleTimeString()}</div>
                    </div>
                    
                    ${task.timeTracking.estimatedMinutes ? `
                        <div class="estimate-comparison">
                            <div class="estimate-info">
                                <span class="estimate-label">Estimated:</span>
                                <span class="estimate-value">${task.timeTracking.estimatedMinutes}m</span>
                            </div>
                            <div class="progress-indicator">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${Math.min((elapsedMinutes / task.timeTracking.estimatedMinutes) * 100, 100)}%"></div>
                                </div>
                                <span class="progress-text">
                                    ${Math.round((elapsedMinutes / task.timeTracking.estimatedMinutes) * 100)}% of estimate
                                </span>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="timer-actions">
                        <button class="timer-complete-btn">✓ Complete Task</button>
                        <button class="timer-pause-btn">⏸️ Pause Timer</button>
                    </div>
                </div>
            </div>
        `;
        
        // Inject timer styles
        this.injectTimerStyles();
        
        document.body.appendChild(dialog);
        this.setupTimerDialogListeners(dialog, taskId);
    }
    
    /**
     * Setup timer dialog listeners
     */
    setupTimerDialogListeners(dialog, taskId) {
        // Close button
        dialog.querySelector('.timer-close-btn')?.addEventListener('click', () => {
            dialog.remove();
        });
        
        // Click outside to close
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
        
        // Complete task button
        dialog.querySelector('.timer-complete-btn')?.addEventListener('click', () => {
            this.completeTaskWithTracking(taskId);
            dialog.remove();
            
            // Show completion notification with time summary
            this.showTaskCompletionSummary(taskId);
        });
        
        // Pause timer button (for future implementation)
        dialog.querySelector('.timer-pause-btn')?.addEventListener('click', () => {
            // TODO: Implement pause/resume functionality
            console.log('Pause timer functionality - to be implemented');
            dialog.remove();
        });
        
        // Keyboard navigation
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dialog.remove();
            }
        });
    }
    
    /**
     * Show task completion summary with time learning data
     */
    showTaskCompletionSummary(taskId) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        
        if (!task || !task.timeTracking) return;
        
        const actualTime = task.timeTracking.actualMinutes;
        const estimatedTime = task.timeTracking.estimatedMinutes;
        const accuracy = task.timeTracking.accuracy;
        
        let timeComparisonText = '';
        let accuracyClass = '';
        
        if (estimatedTime && actualTime) {
            const difference = actualTime - estimatedTime;
            
            if (Math.abs(difference) <= 5) {
                timeComparisonText = '🎯 Right on target!';
                accuracyClass = 'excellent';
            } else if (difference > 0) {
                timeComparisonText = `⏰ Took ${difference}m longer than expected`;
                accuracyClass = difference > estimatedTime * 0.5 ? 'poor' : 'fair';
            } else {
                timeComparisonText = `⚡ Finished ${Math.abs(difference)}m faster than expected`;
                accuracyClass = 'good';
            }
        }
        
        const notification = document.createElement('div');
        notification.className = 'task-completion-summary';
        notification.innerHTML = `
            <div class="completion-content">
                <h3>✅ Task Complete!</h3>
                <p><strong>${this.escapeHTML(task.title || task.text)}</strong></p>
                
                ${timeComparisonText ? `
                    <div class="time-summary ${accuracyClass}">
                        <div class="time-comparison">${timeComparisonText}</div>
                        ${estimatedTime ? `
                            <div class="time-details">
                                Estimated: ${estimatedTime}m | Actual: ${actualTime}m | Accuracy: ${Math.round(accuracy * 100)}%
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                
                <div class="learning-note">
                    📊 This data helps improve future time estimates
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 6 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 6000);
    }
    
    /**
     * Show related tasks dialog
     */
    showRelatedTasksDialog(taskId) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        
        if (!task || !task.relatedTasks || task.relatedTasks.length === 0) {
            console.error('Task not found or has no related tasks:', taskId);
            return;
        }
        
        const dialog = document.createElement('div');
        dialog.className = 'related-tasks-overlay';
        dialog.innerHTML = `
            <div class="related-tasks-container">
                <div class="related-header">
                    <h2>🔗 Related Tasks</h2>
                    <button class="related-close-btn" title="Close">✕</button>
                </div>
                
                <div class="related-content">
                    <div class="current-task-info">
                        <h3>Current Task</h3>
                        <div class="task-summary">
                            <span class="task-category">${task.categoryInfo?.icon || '📝'} ${task.categoryInfo?.name || 'General'}</span>
                            <h4>${this.escapeHTML(task.title || task.text)}</h4>
                        </div>
                    </div>
                    
                    <div class="related-tasks-list">
                        <h3>Related Tasks (${task.relatedTasks.length})</h3>
                        ${task.relatedTasks.map(relatedTask => {
                            const fullTask = state.tasks?.items.get(relatedTask.id);
                            const categoryInfo = fullTask?.categoryInfo || this.getCategoryInfo('general');
                            const status = fullTask?.status || 'unknown';
                            const statusIcon = status === 'completed' ? '✅' : status === 'in-progress' ? '🔄' : '⏳';
                            
                            return `
                                <div class="related-task-item" data-task-id="${relatedTask.id}">
                                    <div class="related-task-main">
                                        <div class="related-task-header">
                                            <span class="task-status">${statusIcon}</span>
                                            <span class="task-category-small">${categoryInfo.icon} ${categoryInfo.name}</span>
                                            <span class="similarity-score">${Math.round(relatedTask.similarity * 100)}% similar</span>
                                        </div>
                                        <h4 class="related-task-title">${this.escapeHTML(relatedTask.title)}</h4>
                                        <p class="related-reason">${relatedTask.reason}</p>
                                    </div>
                                    <div class="related-task-actions">
                                        <button class="view-task-btn" data-task-id="${relatedTask.id}">View</button>
                                        ${status !== 'completed' ? `<button class="plan-together-btn" data-task-id="${relatedTask.id}">Plan Together</button>` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    
                    <div class="related-suggestions">
                        <h3>💡 Smart Suggestions</h3>
                        <div class="suggestion-list">
                            <div class="suggestion-item">
                                <span class="suggestion-icon">📋</span>
                                <span class="suggestion-text">Consider grouping these tasks into a project</span>
                                <button class="suggestion-action-btn">Create Project</button>
                            </div>
                            <div class="suggestion-item">
                                <span class="suggestion-icon">⏰</span>
                                <span class="suggestion-text">Schedule related tasks in sequence</span>
                                <button class="suggestion-action-btn">Auto-Schedule</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="related-footer">
                    <button class="back-timeline-btn">Back to Timeline</button>
                </div>
            </div>
        `;
        
        // Inject styles for related tasks dialog
        this.injectRelatedTasksStyles();
        
        document.body.appendChild(dialog);
        this.setupRelatedTasksEventListeners(dialog);
    }
    
    /**
     * Setup related tasks dialog event listeners
     */
    setupRelatedTasksEventListeners(dialog) {
        // Close button
        dialog.querySelector('.related-close-btn')?.addEventListener('click', () => {
            dialog.remove();
        });
        
        // Click outside to close
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
        
        // View task buttons
        dialog.querySelectorAll('.view-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.dataset.taskId;
                dialog.remove();
                // Show task details or timeline focused on this task
                this.showTimelineView();
                // TODO: Scroll to and highlight the specific task
            });
        });
        
        // Plan together buttons
        dialog.querySelectorAll('.plan-together-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.dataset.taskId;
                dialog.remove();
                this.showGroupPlanningDialog([dialog.querySelector('.current-task-info').dataset.taskId, taskId]);
            });
        });
        
        // Suggestion action buttons
        dialog.querySelectorAll('.suggestion-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const suggestion = e.target.closest('.suggestion-item');
                const suggestionText = suggestion.querySelector('.suggestion-text').textContent;
                
                if (suggestionText.includes('project')) {
                    this.showCreateProjectDialog();
                } else if (suggestionText.includes('schedule')) {
                    this.showAutoScheduleDialog();
                }
            });
        });
        
        // Back to timeline
        dialog.querySelector('.back-timeline-btn')?.addEventListener('click', () => {
            dialog.remove();
            this.showTimelineView();
        });
        
        // Keyboard navigation
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dialog.remove();
            }
        });
    }
    
    /**
     * Generate planning template based on task template
     */
    generatePlanningTemplate(task) {
        const template = task.templateApplied;
        if (!template) return '';
        
        return `
            <div class="planning-template">
                <h3>📋 ${template.name} Template</h3>
                <div class="template-subtasks">
                    <div class="subtasks-header">
                        <span class="subtasks-title">Suggested Steps:</span>
                        <button class="generate-subtasks-btn" data-task-id="${task.id}">
                            Create as Subtasks
                        </button>
                    </div>
                    <ul class="planning-subtasks-list">
                        ${template.subtasks.map((subtask, index) => `
                            <li class="planning-subtask" data-subtask-index="${index}">
                                <input type="checkbox" class="subtask-checkbox" id="subtask-${index}">
                                <label for="subtask-${index}" class="subtask-text">${subtask}</label>
                            </li>
                        `).join('')}
                    </ul>
                </div>
                
                <div class="template-insights">
                    <h4>💡 Template Insights</h4>
                    <div class="insight-item">
                        <span class="insight-label">Estimated Time:</span>
                        <span class="insight-value">${template.estimatedTime}</span>
                    </div>
                    ${task.timeTracking ? this.generateTimeInsight(task.timeTracking, template) : ''}
                </div>
            </div>
        `;
    }
    
    /**
     * Generate time insight based on learning data
     */
    generateTimeInsight(timeTracking, template) {
        const state = this.dataManager.getState();
        const learning = state.taskLearning?.timeEstimates;
        
        if (!learning) return '';
        
        // Get improved estimate
        const improved = this.getImprovedTimeEstimate(
            template.category || 'general',
            template.type,
            template.estimatedTime
        );
        
        if (typeof improved === 'object' && improved.confidence >= 50) {
            return `
                <div class="insight-item time-improvement">
                    <span class="insight-label">Improved Estimate:</span>
                    <span class="insight-value">${improved.improved}</span>
                    <span class="confidence-badge">${improved.confidence}% confident</span>
                </div>
            `;
        }
        
        return '';
    }
    
    /**
     * Show task planning dialog
     */
    showTaskPlanningDialog(taskId) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        
        if (!task) {
            console.error('Task not found:', taskId);
            return;
        }
        
        this.injectPlanningStyles();
        
        const dialog = document.createElement('div');
        dialog.className = 'task-planning-overlay';
        dialog.innerHTML = `
            <div class="task-planning-container">
                <div class="planning-header">
                    <h2>🧠 Plan: ${this.escapeHTML(task.title)}</h2>
                    <button class="planning-close-btn" title="Close Planning">✕</button>
                </div>
                
                <div class="planning-content">
                    <div class="task-overview">
                        <h3>Task Overview</h3>
                        <p><strong>Title:</strong> ${this.escapeHTML(task.title)}</p>
                        <p><strong>Description:</strong> ${this.escapeHTML(task.description || 'No description')}</p>
                        <p><strong>Due Date:</strong> ${task.dueDate ? this.formatDueDate(new Date(task.dueDate)) : 'No deadline'}</p>
                        <p><strong>Priority:</strong> ${task.priority || 0}</p>
                    </div>
                    
                    ${task.templateApplied ? this.generatePlanningTemplate(task) : ''}
                    
                    <div class="planning-questions">
                        <h3>Planning Questions</h3>
                        <div class="planning-conversation" data-task-id="${taskId}">
                            <div class="question-card active" data-question="1">
                                <h4>🎯 What is the main outcome you want to achieve?</h4>
                                <textarea placeholder="Describe the specific result or deliverable you're aiming for..."></textarea>
                                <div class="question-actions">
                                    <button class="skip-btn">Skip</button>
                                    <button class="next-btn">Next</button>
                                </div>
                            </div>
                            
                            <div class="question-card" data-question="2">
                                <h4>⚡ What smaller steps could this break down into?</h4>
                                <textarea placeholder="Think of 2-4 concrete actions you could take..."></textarea>
                                <div class="question-actions">
                                    <button class="prev-btn">Previous</button>
                                    <button class="skip-btn">Skip</button>
                                    <button class="next-btn">Next</button>
                                </div>
                            </div>
                            
                            <div class="question-card" data-question="3">
                                <h4>🧱 What needs to be done first?</h4>
                                <textarea placeholder="What dependencies or prerequisites should you handle before starting..."></textarea>
                                <div class="question-actions">
                                    <button class="prev-btn">Previous</button>
                                    <button class="skip-btn">Skip</button>
                                    <button class="next-btn">Next</button>
                                </div>
                            </div>
                            
                            <div class="question-card" data-question="4">
                                <h4>⏰ How much time do you think this will realistically take?</h4>
                                <textarea placeholder="Consider each step and add buffer time for unexpected issues..."></textarea>
                                <div class="question-actions">
                                    <button class="prev-btn">Previous</button>
                                    <button class="skip-btn">Skip</button>
                                    <button class="next-btn">Next</button>
                                </div>
                            </div>
                            
                            <div class="question-card" data-question="5">
                                <h4>🚧 What might block you or go wrong?</h4>
                                <textarea placeholder="Think about potential obstacles and how you might handle them..."></textarea>
                                <div class="question-actions">
                                    <button class="prev-btn">Previous</button>
                                    <button class="skip-btn">Skip</button>
                                    <button class="next-btn">Next</button>
                                </div>
                            </div>
                            
                            <div class="question-card" data-question="6">
                                <h4>✨ What would make this easier or more enjoyable?</h4>
                                <textarea placeholder="Consider tools, environment, timing, or support that would help..."></textarea>
                                <div class="question-actions">
                                    <button class="prev-btn">Previous</button>
                                    <button class="finish-btn">Finish Planning</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="planning-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 16.67%"></div>
                    </div>
                    <span class="progress-text">Question 1 of 6</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        this.setupPlanningEventListeners(dialog);
    }
    
    /**
     * Setup planning dialog event listeners
     */
    setupPlanningEventListeners(dialog) {
        const taskId = dialog.querySelector('.planning-conversation').dataset.taskId;
        let currentQuestion = 1;
        const totalQuestions = 6;
        const responses = {};
        
        // Close button
        dialog.querySelector('.planning-close-btn')?.addEventListener('click', () => {
            dialog.remove();
        });
        
        // Generate subtasks button
        dialog.querySelector('.generate-subtasks-btn')?.addEventListener('click', (e) => {
            const taskId = e.target.dataset.taskId;
            this.generateSubtasksFromTemplate(taskId, dialog);
        });
        
        // Click outside to close
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
        
        // Navigation functions
        const showQuestion = (questionNum) => {
            // Hide all questions
            dialog.querySelectorAll('.question-card').forEach(card => {
                card.classList.remove('active');
            });
            
            // Show current question
            const currentCard = dialog.querySelector(`[data-question="${questionNum}"]`);
            if (currentCard) {
                currentCard.classList.add('active');
                currentCard.querySelector('textarea')?.focus();
            }
            
            // Update progress
            const progressFill = dialog.querySelector('.progress-fill');
            const progressText = dialog.querySelector('.progress-text');
            const progress = (questionNum / totalQuestions) * 100;
            
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `Question ${questionNum} of ${totalQuestions}`;
            
            currentQuestion = questionNum;
        };
        
        const saveResponse = (questionNum) => {
            const card = dialog.querySelector(`[data-question="${questionNum}"]`);
            const textarea = card?.querySelector('textarea');
            if (textarea) {
                responses[questionNum] = textarea.value.trim();
            }
        };
        
        // Button event listeners
        dialog.addEventListener('click', (e) => {
            if (e.target.classList.contains('next-btn')) {
                saveResponse(currentQuestion);
                if (currentQuestion < totalQuestions) {
                    showQuestion(currentQuestion + 1);
                }
            } else if (e.target.classList.contains('prev-btn')) {
                saveResponse(currentQuestion);
                if (currentQuestion > 1) {
                    showQuestion(currentQuestion - 1);
                }
            } else if (e.target.classList.contains('skip-btn')) {
                if (currentQuestion < totalQuestions) {
                    showQuestion(currentQuestion + 1);
                }
            } else if (e.target.classList.contains('finish-btn')) {
                saveResponse(currentQuestion);
                this.completePlanningSession(taskId, responses);
                dialog.remove();
            }
        });
        
        // Keyboard navigation
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dialog.remove();
            } else if (e.ctrlKey || e.metaKey) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const nextBtn = dialog.querySelector('.question-card.active .next-btn');
                    const finishBtn = dialog.querySelector('.question-card.active .finish-btn');
                    if (finishBtn) {
                        finishBtn.click();
                    } else if (nextBtn) {
                        nextBtn.click();
                    }
                }
            }
        });
        
        // Auto-save responses as user types
        dialog.addEventListener('input', (e) => {
            if (e.target.tagName === 'TEXTAREA') {
                const questionCard = e.target.closest('.question-card');
                const questionNum = parseInt(questionCard?.dataset.question);
                if (questionNum) {
                    responses[questionNum] = e.target.value.trim();
                }
            }
        });
        
        // Focus first textarea
        dialog.querySelector('.question-card.active textarea')?.focus();
    }
    
    /**
     * Complete planning session and update task
     */
    completePlanningSession(taskId, responses) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        
        if (!task) return;
        
        // Create planning notes from responses
        const planningNotes = this.generatePlanningNotes(responses);
        
        // Update task with planning information
        task.planning = {
            responses: responses,
            notes: planningNotes,
            plannedAt: new Date().toISOString()
        };
        
        // Save updated task
        state.tasks.items.set(taskId, task);
        this.dataManager.saveData();
        
        // Show planning completion notification
        this.showPlanningCompleteNotification(task, planningNotes);
        
        console.log('Planning session completed for task:', taskId);
    }
    
    /**
     * Generate planning notes from responses
     */
    generatePlanningNotes(responses) {
        const notes = {
            outcome: responses[1] || '',
            steps: responses[2] || '',
            prerequisites: responses[3] || '',
            timeEstimate: responses[4] || '',
            obstacles: responses[5] || '',
            improvements: responses[6] || ''
        };
        
        // Generate summary
        let summary = "📋 **Planning Summary**\n\n";
        
        if (notes.outcome) {
            summary += `🎯 **Desired Outcome:** ${notes.outcome}\n\n`;
        }
        
        if (notes.steps) {
            summary += `⚡ **Key Steps:**\n${notes.steps}\n\n`;
        }
        
        if (notes.prerequisites) {
            summary += `🧱 **Prerequisites:**\n${notes.prerequisites}\n\n`;
        }
        
        if (notes.timeEstimate) {
            summary += `⏰ **Time Estimate:**\n${notes.timeEstimate}\n\n`;
        }
        
        if (notes.obstacles) {
            summary += `🚧 **Potential Obstacles:**\n${notes.obstacles}\n\n`;
        }
        
        if (notes.improvements) {
            summary += `✨ **Success Factors:**\n${notes.improvements}\n\n`;
        }
        
        return {
            individual: notes,
            summary: summary
        };
    }
    
    /**
     * Show planning completion notification
     */
    showPlanningCompleteNotification(task, planningNotes) {
        const notification = document.createElement('div');
        notification.className = 'planning-complete-notification';
        notification.innerHTML = `
            <div class="planning-complete-content">
                <h3>🎉 Planning Complete!</h3>
                <p>Your planning session for "<strong>${this.escapeHTML(task.title)}</strong>" is saved.</p>
                <div class="planning-actions">
                    <button class="view-plan-btn">View Plan</button>
                    <button class="start-work-btn">Start Working</button>
                    <button class="timeline-btn">Back to Timeline</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Event listeners
        notification.querySelector('.view-plan-btn')?.addEventListener('click', () => {
            this.showPlanSummary(task, planningNotes);
            notification.remove();
        });
        
        notification.querySelector('.start-work-btn')?.addEventListener('click', () => {
            // Mark task as in progress and show timeline
            task.status = 'in-progress';
            task.startedAt = new Date().toISOString();
            this.dataManager.saveData();
            this.showTimelineView();
            notification.remove();
        });
        
        notification.querySelector('.timeline-btn')?.addEventListener('click', () => {
            this.showTimelineView();
            notification.remove();
        });
        
        // Auto-remove after 8 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 8000);
    }
    
    /**
     * Show plan summary
     */
    showPlanSummary(task, planningNotes) {
        const dialog = document.createElement('div');
        dialog.className = 'plan-summary-overlay';
        dialog.innerHTML = `
            <div class="plan-summary-container">
                <div class="summary-header">
                    <h2>📋 Plan: ${this.escapeHTML(task.title)}</h2>
                    <button class="summary-close-btn" title="Close">✕</button>
                </div>
                <div class="summary-content">
                    <div class="plan-text">
                        ${this.markdownToHTML(planningNotes.summary)}
                    </div>
                    <div class="summary-actions">
                        <button class="edit-plan-btn">Edit Plan</button>
                        <button class="start-work-btn">Start Working</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Event listeners
        dialog.querySelector('.summary-close-btn')?.addEventListener('click', () => dialog.remove());
        dialog.querySelector('.edit-plan-btn')?.addEventListener('click', () => {
            dialog.remove();
            this.showTaskPlanningDialog(task.id);
        });
        dialog.querySelector('.start-work-btn')?.addEventListener('click', () => {
            task.status = 'in-progress';
            task.startedAt = new Date().toISOString();
            this.dataManager.saveData();
            this.showTimelineView();
            dialog.remove();
        });
        
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.remove();
        });
        
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') dialog.remove();
        });
    }
    
    /**
     * Generate subtasks from template
     */
    async generateSubtasksFromTemplate(taskId, dialog) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        
        if (!task || !task.templateApplied) return;
        
        const template = task.templateApplied;
        const selectedSubtasks = [];
        
        // Get selected subtasks from checkboxes
        const checkboxes = dialog.querySelectorAll('.subtask-checkbox:checked');
        checkboxes.forEach((checkbox, index) => {
            const subtaskIndex = parseInt(checkbox.closest('.planning-subtask').dataset.subtaskIndex);
            const subtaskText = template.subtasks[subtaskIndex];
            if (subtaskText) {
                selectedSubtasks.push({
                    text: subtaskText,
                    index: subtaskIndex
                });
            }
        });
        
        if (selectedSubtasks.length === 0) {
            // If none selected, use all
            template.subtasks.forEach((subtaskText, index) => {
                selectedSubtasks.push({
                    text: subtaskText,
                    index: index
                });
            });
        }
        
        // Create subtasks
        const createdSubtasks = [];
        
        for (let i = 0; i < selectedSubtasks.length; i++) {
            const subtask = selectedSubtasks[i];
            const subtaskId = this.generateTaskId();
            
            // Calculate due date for subtask (spread over time before main task)
            let subtaskDueDate = null;
            if (task.dueDate) {
                const mainDueDate = new Date(task.dueDate);
                const daysBeforeDue = Math.max(1, Math.floor((selectedSubtasks.length - i) * 0.8));
                subtaskDueDate = new Date(mainDueDate);
                subtaskDueDate.setDate(subtaskDueDate.getDate() - daysBeforeDue);
            }
            
            const newSubtask = {
                id: subtaskId,
                title: subtask.text,
                description: `Subtask ${i + 1} of ${selectedSubtasks.length} for: ${task.title}`,
                dueDate: subtaskDueDate ? subtaskDueDate.toISOString() : null,
                timeCategory: subtaskDueDate ? this.categorizeTaskByDate(subtaskDueDate) : 'someday',
                category: task.category,
                priority: Math.max(10, (task.priority || 20) - 10), // Lower priority than main task
                sourceConversation: task.sourceConversation,
                folio: task.folio,
                persona: task.persona,
                status: 'pending',
                created: new Date().toISOString(),
                lastReviewed: new Date().toISOString(),
                parentTask: taskId,
                subtaskOrder: i,
                categoryInfo: task.categoryInfo,
                extractedFrom: 'subtask_generation'
            };
            
            createdSubtasks.push(newSubtask);
        }
        
        // Add subtasks to parent task
        if (!task.subtasks) {
            task.subtasks = [];
        }
        task.subtasks = createdSubtasks.map(st => st.id);
        
        // Save all subtasks
        await this.saveTasks(createdSubtasks);
        
        // Update parent task
        state.tasks.items.set(taskId, task);
        await this.dataManager.saveData();
        
        // Update UI to show success
        this.showSubtaskCreationSuccess(createdSubtasks.length, task.title);
        
        // Update the planning dialog to show the created subtasks
        this.updatePlanningDialogWithSubtasks(dialog, createdSubtasks);
    }
    
    /**
     * Show subtask creation success notification
     */
    showSubtaskCreationSuccess(count, parentTitle) {
        const notification = document.createElement('div');
        notification.className = 'subtask-creation-success';
        notification.innerHTML = `
            <div class="success-content">
                <h3>✅ Subtasks Created!</h3>
                <p>Created ${count} subtask${count > 1 ? 's' : ''} for "${parentTitle}"</p>
                <button class="view-timeline-btn">View in Timeline</button>
            </div>
        `;
        
        // Add styles
        this.injectPlanningStyles();
        
        document.body.appendChild(notification);
        
        // Event listeners
        notification.querySelector('.view-timeline-btn')?.addEventListener('click', () => {
            this.showTimelineView();
            notification.remove();
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
    
    /**
     * Cross-folio task synchronization
     */
    async syncTaskAcrossFolios(taskId, targetFolioIds = []) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        
        if (!task || !targetFolioIds.length) return false;
        
        const syncedTasks = [];
        
        for (const folioId of targetFolioIds) {
            if (!state.folios[folioId]) continue;
            
            // Create synchronized task copy
            const syncedTask = {
                ...task,
                id: this.generateTaskId(),
                originalTaskId: taskId,
                sourcefolio: task.folioId,
                folioId: folioId,
                syncStatus: 'synced',
                lastSyncAt: new Date().toISOString(),
                syncedAt: new Date().toISOString()
            };
            
            // Update sync relationships
            if (!task.syncedTo) task.syncedTo = [];
            task.syncedTo.push(syncedTask.id);
            
            state.tasks.items.set(syncedTask.id, syncedTask);
            syncedTasks.push(syncedTask);
        }
        
        await this.dataManager.saveData();
        this.triggerTimelineUIUpdate();
        
        return syncedTasks;
    }
    
    /**
     * Get all tasks across folios
     */
    getAllTasksAcrossFolios(filterOptions = {}) {
        const state = this.dataManager.getState();
        const allTasks = [];
        
        if (!state.tasks?.items) return allTasks;
        
        for (const [taskId, task] of state.tasks.items) {
            // Apply filters
            if (filterOptions.folioIds && !filterOptions.folioIds.includes(task.folioId)) continue;
            if (filterOptions.category && task.category !== filterOptions.category) continue;
            if (filterOptions.status && task.status !== filterOptions.status) continue;
            if (filterOptions.assignedTo && task.assignedTo !== filterOptions.assignedTo) continue;
            
            // Apply search query
            if (filterOptions.searchQuery) {
                const query = filterOptions.searchQuery.toLowerCase();
                const searchableText = `${task.title} ${task.description || ''}`.toLowerCase();
                if (!searchableText.includes(query)) continue;
            }
            
            allTasks.push(task);
        }
        
        return allTasks.sort((a, b) => {
            // Priority: overdue > today > tomorrow > future
            const priorityOrder = ['overdue', 'today', 'tomorrow', 'thisWeek', 'future', 'someday'];
            const aPriority = priorityOrder.indexOf(a.timeCategory || 'future');
            const bPriority = priorityOrder.indexOf(b.timeCategory || 'future');
            
            if (aPriority !== bPriority) return aPriority - bPriority;
            
            // Secondary sort by creation date
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    }
    
    /**
     * Show unified task view across all folios
     */
    showUnifiedTaskView() {
        const existingView = document.querySelector('#unified-task-view');
        if (existingView) {
            existingView.remove();
        }
        
        const overlay = document.createElement('div');
        overlay.id = 'unified-task-view';
        overlay.className = 'unified-view-overlay';
        
        overlay.innerHTML = `
            <div class="unified-view-dialog">
                <div class="unified-view-header">
                    <h2>All Tasks Across Folios</h2>
                    <button class="close-unified-view" onclick="document.getElementById('unified-task-view').remove()">×</button>
                </div>
                
                <div class="unified-view-filters">
                    <div class="filter-row">
                        <input type="text" id="unified-search" placeholder="Search tasks..." class="search-input">
                        <select id="folio-filter" class="filter-select">
                            <option value="">All Folios</option>
                        </select>
                        <select id="category-filter" class="filter-select">
                            <option value="">All Categories</option>
                            <option value="work">Work</option>
                            <option value="personal">Personal</option>
                            <option value="creative">Creative</option>
                            <option value="administrative">Admin</option>
                        </select>
                        <select id="status-filter" class="filter-select">
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                </div>
                
                <div class="unified-tasks-container" id="unified-tasks-list">
                    <!-- Tasks will be populated here -->
                </div>
            </div>
        `;
        
        this.injectUnifiedViewStyles();
        document.body.appendChild(overlay);
        
        this.populateUnifiedTaskView();
        this.setupUnifiedViewFilters();
    }
    
    /**
     * Populate the unified task view
     */
    populateUnifiedTaskView() {
        const state = this.dataManager.getState();
        const container = document.getElementById('unified-tasks-list');
        const folioFilter = document.getElementById('folio-filter');
        
        // Populate folio filter options
        for (const [folioId, folio] of Object.entries(state.folios)) {
            const option = document.createElement('option');
            option.value = folioId;
            option.textContent = folio.title;
            folioFilter.appendChild(option);
        }
        
        this.updateUnifiedTaskDisplay();
    }
    
    /**
     * Update the unified task display based on filters
     */
    updateUnifiedTaskDisplay() {
        const container = document.getElementById('unified-tasks-list');
        if (!container) return;
        
        const filters = {
            searchQuery: document.getElementById('unified-search')?.value || '',
            folioIds: document.getElementById('folio-filter')?.value ? [document.getElementById('folio-filter').value] : null,
            category: document.getElementById('category-filter')?.value || null,
            status: document.getElementById('status-filter')?.value || null
        };
        
        const tasks = this.getAllTasksAcrossFolios(filters);
        const state = this.dataManager.getState();
        
        if (tasks.length === 0) {
            container.innerHTML = '<div class="no-tasks-message">No tasks match the current filters</div>';
            return;
        }
        
        const tasksByFolio = {};
        tasks.forEach(task => {
            if (!tasksByFolio[task.folioId]) {
                tasksByFolio[task.folioId] = [];
            }
            tasksByFolio[task.folioId].push(task);
        });
        
        let html = '';
        
        for (const [folioId, folioTasks] of Object.entries(tasksByFolio)) {
            const folio = state.folios[folioId];
            if (!folio) continue;
            
            html += `
                <div class="folio-task-section">
                    <div class="folio-header">
                        <span class="folio-name">${folio.title}</span>
                        <span class="task-count">${folioTasks.length} task${folioTasks.length > 1 ? 's' : ''}</span>
                    </div>
                    <div class="folio-tasks">
                        ${folioTasks.map(task => this.renderUnifiedTaskItem(task)).join('')}
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
    }
    
    /**
     * Render a task item in the unified view
     */
    renderUnifiedTaskItem(task) {
        const categoryInfo = this.getCategoryInfo(task.category || 'general');
        const isOverdue = task.timeCategory === 'overdue';
        const hasDeadline = task.scheduledFor || task.deadline;
        
        return `
            <div class="unified-task-item ${task.status}" data-task-id="${task.id}">
                <div class="task-main-content">
                    <div class="task-header-row">
                        <div class="task-category" style="color: ${categoryInfo.color};">
                            ${categoryInfo.icon} ${categoryInfo.name}
                        </div>
                        <div class="task-status ${task.status}">${task.status}</div>
                    </div>
                    
                    <div class="task-title" onclick="window.taskManager.navigateToTask('${task.id}')">
                        ${task.title}
                    </div>
                    
                    ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                    
                    <div class="task-metadata">
                        ${hasDeadline ? `
                            <span class="task-deadline ${isOverdue ? 'overdue' : ''}">
                                📅 ${task.scheduledFor || task.deadline}
                            </span>
                        ` : ''}
                        
                        ${task.timeTracking?.estimatedMinutes ? `
                            <span class="task-estimate">
                                ⏱️ ~${Math.round(task.timeTracking.estimatedMinutes / 60 * 10) / 10}h
                            </span>
                        ` : ''}
                        
                        ${task.dependencies?.length ? `
                            <span class="task-dependencies">
                                🔗 ${task.dependencies.length} dependencies
                            </span>
                        ` : ''}
                    </div>
                </div>
                
                <div class="task-actions">
                    <button onclick="window.taskManager.showTaskActionMenu('${task.id}')" class="task-action-btn">
                        ⋮
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Setup unified view filters
     */
    setupUnifiedViewFilters() {
        const searchInput = document.getElementById('unified-search');
        const folioFilter = document.getElementById('folio-filter');
        const categoryFilter = document.getElementById('category-filter');
        const statusFilter = document.getElementById('status-filter');
        
        const updateDisplay = () => this.updateUnifiedTaskDisplay();
        
        searchInput?.addEventListener('input', updateDisplay);
        folioFilter?.addEventListener('change', updateDisplay);
        categoryFilter?.addEventListener('change', updateDisplay);
        statusFilter?.addEventListener('change', updateDisplay);
    }
    
    /**
     * Route task to best folio based on context
     */
    suggestBestFolioForTask(taskText, context = '') {
        const state = this.dataManager.getState();
        const suggestions = [];
        
        // Analyze task content
        const taskCategory = this.categorizeTask(taskText, context);
        const taskKeywords = this.extractKeywords(taskText + ' ' + context);
        
        // Score each folio based on relevance
        for (const [folioId, folio] of Object.entries(state.folios)) {
            if (folioId === 'general') continue; // Skip general folio for routing
            
            let score = 0;
            let reasons = [];
            
            // Check folio title and description
            const folioKeywords = this.extractKeywords(
                `${folio.title} ${folio.description || ''} ${folio.guidelines || ''}`
            );
            
            const keywordOverlap = this.calculateSimilarity(taskKeywords, folioKeywords);
            if (keywordOverlap > 0.2) {
                score += keywordOverlap * 50;
                reasons.push(`Keyword match (${Math.round(keywordOverlap * 100)}%)`);
            }
            
            // Check existing tasks in folio for category patterns
            const folioTasks = [...(state.tasks?.items || new Map()).values()]
                .filter(task => task.folioId === folioId);
            
            const categoryMatch = folioTasks.some(task => task.category === taskCategory);
            if (categoryMatch) {
                score += 30;
                reasons.push(`Similar tasks exist (${taskCategory})`);
            }
            
            // Check persona assignment match
            if (folio.assignedPersona) {
                const persona = state.settings?.personas[folio.assignedPersona];
                if (persona) {
                    const personaKeywords = this.extractKeywords(
                        `${persona.roleContext} ${persona.identity}`
                    );
                    const personaOverlap = this.calculateSimilarity(taskKeywords, personaKeywords);
                    if (personaOverlap > 0.15) {
                        score += personaOverlap * 25;
                        reasons.push(`Persona expertise match`);
                    }
                }
            }
            
            // Check recent activity in folio
            const recentActivity = folio.lastUsed && 
                (Date.now() - new Date(folio.lastUsed)) < (7 * 24 * 60 * 60 * 1000); // 7 days
            if (recentActivity) {
                score += 10;
                reasons.push('Recently active folio');
            }
            
            if (score > 20) {
                suggestions.push({
                    folioId,
                    folio,
                    score: Math.round(score),
                    reasons,
                    confidence: Math.min(score / 100, 1.0)
                });
            }
        }
        
        return suggestions
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
    }
    
    /**
     * Create task dependency relationship
     */
    async createTaskDependency(taskId, dependsOnTaskId, dependencyType = 'blocks') {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        const dependsOnTask = state.tasks?.items.get(dependsOnTaskId);
        
        if (!task || !dependsOnTask) return false;
        
        // Initialize dependencies
        if (!task.dependencies) task.dependencies = [];
        if (!dependsOnTask.dependents) dependsOnTask.dependents = [];
        
        // Create dependency relationship
        const dependency = {
            taskId: dependsOnTaskId,
            type: dependencyType,
            createdAt: new Date().toISOString(),
            folioId: dependsOnTask.folioId
        };
        
        const dependent = {
            taskId: taskId,
            type: dependencyType,
            createdAt: new Date().toISOString(),
            folioId: task.folioId
        };
        
        // Avoid duplicates
        const existingDep = task.dependencies.find(dep => dep.taskId === dependsOnTaskId);
        if (!existingDep) {
            task.dependencies.push(dependency);
            dependsOnTask.dependents.push(dependent);
        }
        
        await this.dataManager.saveData();
        
        // Check if task is now unblocked
        if (dependsOnTask.status === 'completed') {
            this.checkTaskUnblocked(taskId);
        }
        
        return true;
    }
    
    /**
     * Check if task is unblocked and notify
     */
    async checkTaskUnblocked(taskId) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        
        if (!task || !task.dependencies) return;
        
        const blockingDeps = task.dependencies.filter(dep => 
            dep.type === 'blocks' || dep.type === 'requires'
        );
        
        const allResolved = blockingDeps.every(dep => {
            const dependencyTask = state.tasks.items.get(dep.taskId);
            return dependencyTask && dependencyTask.status === 'completed';
        });
        
        if (allResolved && task.status !== 'completed') {
            // Task is now unblocked - send notification
            this.showTaskUnblockedNotification(task);
        }
    }
    
    /**
     * Show task unblocked notification
     */
    showTaskUnblockedNotification(task) {
        const notification = document.createElement('div');
        notification.className = 'task-notification task-unblocked-notification';
        notification.innerHTML = `
            <div class="notification-header">
                <span class="notification-icon">🔓</span>
                <span class="notification-title">Task Unblocked!</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="notification-body">
                <div class="task-title">${task.title}</div>
                <div class="task-message">All dependencies completed - ready to work on!</div>
                <div class="notification-actions">
                    <button onclick="window.taskManager.navigateToTask('${task.id}')" class="btn-primary">View Task</button>
                    <button onclick="window.taskManager.startTaskTimer('${task.id}')" class="btn-secondary">Start Working</button>
                </div>
            </div>
        `;
        
        this.injectNotificationStyles();
        document.body.appendChild(notification);
        
        // Auto-remove after 8 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 8000);
    }
    
    /**
     * Get folio-specific task templates
     */
    getFolioTaskTemplates(folioId) {
        const state = this.dataManager.getState();
        const folio = state.folios[folioId];
        
        if (!folio) return [];
        
        // Initialize folio templates if not exist
        if (!state.folioTaskTemplates) {
            state.folioTaskTemplates = {};
        }
        
        if (!state.folioTaskTemplates[folioId]) {
            state.folioTaskTemplates[folioId] = this.generateDefaultFolioTemplates(folio);
        }
        
        return state.folioTaskTemplates[folioId];
    }
    
    /**
     * Generate default templates based on folio context
     */
    generateDefaultFolioTemplates(folio) {
        const templates = [];
        const folioText = `${folio.title} ${folio.description || ''} ${folio.guidelines || ''}`.toLowerCase();
        
        // Analyze folio context to suggest relevant templates
        if (/project|development|coding|software/g.test(folioText)) {
            templates.push({
                type: 'project-task',
                name: 'Development Task',
                icon: '⚡',
                description: 'Software development task',
                subtasks: [
                    'Plan implementation approach',
                    'Write code and tests',
                    'Review and refactor',
                    'Test thoroughly',
                    'Document changes'
                ],
                estimatedTime: '2-4 hours',
                category: 'work'
            });
        }
        
        if (/research|analysis|study/g.test(folioText)) {
            templates.push({
                type: 'research-deep',
                name: 'Deep Research',
                icon: '🔬',
                description: 'Comprehensive research task',
                subtasks: [
                    'Define research scope and questions',
                    'Identify authoritative sources',
                    'Conduct systematic review',
                    'Analyze and synthesize findings',
                    'Create summary report'
                ],
                estimatedTime: '3-6 hours',
                category: 'work'
            });
        }
        
        if (/client|customer|business/g.test(folioText)) {
            templates.push({
                type: 'client-interaction',
                name: 'Client Task',
                icon: '🤝',
                description: 'Client-related task',
                subtasks: [
                    'Prepare client materials',
                    'Schedule appropriate time',
                    'Conduct interaction/meeting',
                    'Follow up on action items',
                    'Update client records'
                ],
                estimatedTime: '1-2 hours',
                category: 'work'
            });
        }
        
        // Always include generic templates
        templates.push({
            type: 'quick-task',
            name: 'Quick Task',
            icon: '⚡',
            description: 'Simple task for this folio',
            subtasks: [
                'Complete the main action',
                'Verify results',
                'Update status'
            ],
            estimatedTime: '15-30 minutes',
            category: 'general'
        });
        
        return templates;
    }
    
    /**
     * Migrate task to different folio
     */
    async migrateTaskToFolio(taskId, targetFolioId, options = {}) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        const targetFolio = state.folios[targetFolioId];
        
        if (!task || !targetFolio) return false;
        
        // Create migration record
        const migration = {
            taskId: taskId,
            fromFolio: task.folioId,
            toFolio: targetFolioId,
            migratedAt: new Date().toISOString(),
            reason: options.reason || 'Manual migration',
            preserveOriginal: options.preserveOriginal || false
        };
        
        if (options.preserveOriginal) {
            // Create copy in target folio
            const migratedTask = {
                ...task,
                id: this.generateTaskId(),
                folioId: targetFolioId,
                originalTaskId: taskId,
                migratedFrom: task.folioId,
                createdAt: new Date().toISOString(),
                status: 'pending'
            };
            
            state.tasks.items.set(migratedTask.id, migratedTask);
            
            // Mark original as migrated
            task.migratedTo = migratedTask.id;
            task.migrationRecord = migration;
        } else {
            // Move task to target folio
            task.folioId = targetFolioId;
            task.migrationRecord = migration;
        }
        
        await this.dataManager.saveData();
        this.triggerTimelineUIUpdate();
        
        return true;
    }
    
    /**
     * Duplicate task with options
     */
    async duplicateTask(taskId, options = {}) {
        const state = this.dataManager.getState();
        const originalTask = state.tasks?.items.get(taskId);
        
        if (!originalTask) return null;
        
        const duplicatedTask = {
            ...originalTask,
            id: this.generateTaskId(),
            title: options.newTitle || `${originalTask.title} (Copy)`,
            description: options.newDescription || originalTask.description,
            folioId: options.targetFolioId || originalTask.folioId,
            status: 'pending',
            createdAt: new Date().toISOString(),
            duplicatedFrom: taskId,
            
            // Reset tracking data
            timeTracking: null,
            completedAt: null,
            startedAt: null
        };
        
        // Handle subtasks if they exist
        if (originalTask.subtasks && options.includeSubtasks !== false) {
            duplicatedTask.subtasks = originalTask.subtasks.map(subtask => ({
                ...subtask,
                id: this.generateTaskId(),
                status: 'pending',
                createdAt: new Date().toISOString(),
                parentTaskId: duplicatedTask.id
            }));
        }
        
        state.tasks.items.set(duplicatedTask.id, duplicatedTask);
        await this.dataManager.saveData();
        this.triggerTimelineUIUpdate();
        
        return duplicatedTask;
    }
    
    /**
     * Navigate to task in its folio
     */
    navigateToTask(taskId) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        
        if (!task) return false;
        
        // Switch to task's folio if different from current
        if (state.currentFolio !== task.folioId) {
            // Emit event for folio switching
            window.dispatchEvent(new CustomEvent('switchFolio', {
                detail: { folioId: task.folioId, focusTaskId: taskId }
            }));
        }
        
        // Highlight task in timeline
        setTimeout(() => {
            const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
            if (taskElement) {
                taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                taskElement.classList.add('task-highlighted');
                setTimeout(() => taskElement.classList.remove('task-highlighted'), 3000);
            }
        }, 500);
        
        return true;
    }
    
    /**
     * Show task action menu for cross-folio operations
     */
    showTaskActionMenu(taskId) {
        const existingMenu = document.querySelector('.task-action-menu');
        if (existingMenu) existingMenu.remove();
        
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        if (!task) return;
        
        const menu = document.createElement('div');
        menu.className = 'task-action-menu';
        
        const availableFolios = Object.entries(state.folios)
            .filter(([folioId]) => folioId !== task.folioId)
            .map(([folioId, folio]) => `<option value="${folioId}">${folio.title}</option>`)
            .join('');
        
        menu.innerHTML = `
            <div class="action-menu-content">
                <div class="menu-header">
                    <span class="menu-title">Task Actions</span>
                    <button class="close-menu" onclick="this.closest('.task-action-menu').remove()">×</button>
                </div>
                
                <div class="menu-actions">
                    <button onclick="window.taskManager.navigateToTask('${taskId}')" class="menu-action">
                        👁️ View in Folio
                    </button>
                    
                    <button onclick="window.taskManager.startTaskTimer('${taskId}')" class="menu-action">
                        ⏱️ Start Timer
                    </button>
                    
                    <button onclick="window.taskManager.showDuplicateDialog('${taskId}')" class="menu-action">
                        📋 Duplicate Task
                    </button>
                    
                    <div class="menu-action-group">
                        <label>Migrate to Folio:</label>
                        <select id="migrate-folio-${taskId}" class="folio-select">
                            <option value="">Choose folio...</option>
                            ${availableFolios}
                        </select>
                        <button onclick="window.taskManager.performMigration('${taskId}')" class="menu-action-btn">
                            Migrate
                        </button>
                    </div>
                    
                    <div class="menu-action-group">
                        <label>Sync to Folio:</label>
                        <select id="sync-folio-${taskId}" class="folio-select">
                            <option value="">Choose folio...</option>
                            ${availableFolios}
                        </select>
                        <button onclick="window.taskManager.performSync('${taskId}')" class="menu-action-btn">
                            Sync
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.injectTaskMenuStyles();
        document.body.appendChild(menu);
        
        // Position menu near click point or center if not available
        menu.style.position = 'fixed';
        menu.style.top = '50%';
        menu.style.left = '50%';
        menu.style.transform = 'translate(-50%, -50%)';
        menu.style.zIndex = '10000';
    }
    
    /**
     * Perform task migration from action menu
     */
    async performMigration(taskId) {
        const targetFolioId = document.getElementById(`migrate-folio-${taskId}`)?.value;
        if (!targetFolioId) return;
        
        const success = await this.migrateTaskToFolio(taskId, targetFolioId, {
            reason: 'User-initiated migration from unified view'
        });
        
        if (success) {
            this.showSuccessNotification('Task migrated successfully');
            this.updateUnifiedTaskDisplay();
        }
        
        document.querySelector('.task-action-menu')?.remove();
    }
    
    /**
     * Perform task sync from action menu
     */
    async performSync(taskId) {
        const targetFolioId = document.getElementById(`sync-folio-${taskId}`)?.value;
        if (!targetFolioId) return;
        
        const syncedTasks = await this.syncTaskAcrossFolios(taskId, [targetFolioId]);
        
        if (syncedTasks && syncedTasks.length > 0) {
            this.showSuccessNotification('Task synced successfully');
            this.updateUnifiedTaskDisplay();
        }
        
        document.querySelector('.task-action-menu')?.remove();
    }
    
    /**
     * Show duplicate task dialog
     */
    showDuplicateDialog(taskId) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        if (!task) return;
        
        const dialog = document.createElement('div');
        dialog.className = 'duplicate-task-dialog';
        
        const availableFolios = Object.entries(state.folios)
            .map(([folioId, folio]) => `<option value="${folioId}" ${folioId === task.folioId ? 'selected' : ''}>${folio.title}</option>`)
            .join('');
        
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>Duplicate Task</h3>
                    <button onclick="this.closest('.duplicate-task-dialog').remove()">×</button>
                </div>
                
                <div class="dialog-body">
                    <label>New Title:</label>
                    <input type="text" id="duplicate-title" value="${task.title} (Copy)" class="text-input">
                    
                    <label>Target Folio:</label>
                    <select id="duplicate-folio" class="folio-select">
                        ${availableFolios}
                    </select>
                    
                    <label>
                        <input type="checkbox" id="include-subtasks" checked>
                        Include subtasks
                    </label>
                </div>
                
                <div class="dialog-actions">
                    <button onclick="window.taskManager.performDuplication('${taskId}')" class="btn-primary">
                        Duplicate
                    </button>
                    <button onclick="this.closest('.duplicate-task-dialog').remove()" class="btn-secondary">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        document.querySelector('.task-action-menu')?.remove();
    }
    
    /**
     * Perform task duplication
     */
    async performDuplication(taskId) {
        const newTitle = document.getElementById('duplicate-title')?.value;
        const targetFolioId = document.getElementById('duplicate-folio')?.value;
        const includeSubtasks = document.getElementById('include-subtasks')?.checked;
        
        if (!newTitle || !targetFolioId) return;
        
        const duplicatedTask = await this.duplicateTask(taskId, {
            newTitle,
            targetFolioId,
            includeSubtasks
        });
        
        if (duplicatedTask) {
            this.showSuccessNotification('Task duplicated successfully');
            this.updateUnifiedTaskDisplay();
        }
        
        document.querySelector('.duplicate-task-dialog')?.remove();
    }
    
    /**
     * Show success notification
     */
    showSuccessNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'success-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="success-icon">✅</span>
                <span class="success-message">${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }
    
    /**
     * Update planning dialog to show created subtasks
     */
    updatePlanningDialogWithSubtasks(dialog, createdSubtasks) {
        const templateDiv = dialog.querySelector('.planning-template');
        if (!templateDiv) return;
        
        // Replace the subtasks section with success message
        const subtasksDiv = templateDiv.querySelector('.template-subtasks');
        if (subtasksDiv) {
            subtasksDiv.innerHTML = `
                <div class="subtasks-created">
                    <div class="creation-success">
                        ✅ ${createdSubtasks.length} subtasks created successfully!
                    </div>
                    <div class="created-subtasks-list">
                        ${createdSubtasks.map((subtask, index) => `
                            <div class="created-subtask">
                                <span class="subtask-number">${index + 1}.</span>
                                <span class="subtask-title">${subtask.title}</span>
                                ${subtask.dueDate ? `<span class="subtask-due">${this.formatDueDate(new Date(subtask.dueDate))}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }
    
    /**
     * Show quick planning mode (streamlined 3 questions)
     */
    showQuickPlanningDialog(taskId) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        
        if (!task) {
            console.error('Task not found:', taskId);
            return;
        }
        
        this.injectPlanningStyles();
        
        const dialog = document.createElement('div');
        dialog.className = 'task-planning-overlay quick-mode';
        dialog.innerHTML = `
            <div class="task-planning-container">
                <div class="planning-header">
                    <h2>⚡ Quick Plan: ${this.escapeHTML(task.title)}</h2>
                    <button class="planning-close-btn" title="Close Planning">✕</button>
                </div>
                
                <div class="planning-content">
                    <div class="quick-planning-questions">
                        <div class="question-card active" data-question="1">
                            <h4>🎯 What's the main goal?</h4>
                            <textarea placeholder="One sentence - what do you want to accomplish?"></textarea>
                            <div class="question-actions">
                                <button class="skip-btn">Skip</button>
                                <button class="next-btn">Next</button>
                            </div>
                        </div>
                        
                        <div class="question-card" data-question="2">
                            <h4>📝 What are the key steps?</h4>
                            <textarea placeholder="List 2-3 main things you need to do..."></textarea>
                            <div class="question-actions">
                                <button class="prev-btn">Previous</button>
                                <button class="skip-btn">Skip</button>
                                <button class="next-btn">Next</button>
                            </div>
                        </div>
                        
                        <div class="question-card" data-question="3">
                            <h4>⚠️ What might go wrong?</h4>
                            <textarea placeholder="Quick note about potential obstacles..."></textarea>
                            <div class="question-actions">
                                <button class="prev-btn">Previous</button>
                                <button class="finish-btn">Finish</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="planning-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 33.33%"></div>
                    </div>
                    <span class="progress-text">Quick Plan - Question 1 of 3</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        this.setupQuickPlanningEventListeners(dialog);
    }
    
    /**
     * Setup quick planning event listeners
     */
    setupQuickPlanningEventListeners(dialog) {
        const taskId = dialog.querySelector('.task-planning-container').dataset.taskId;
        let currentQuestion = 1;
        const totalQuestions = 3;
        const responses = {};
        
        // Navigation functions (simplified version)
        const showQuestion = (questionNum) => {
            dialog.querySelectorAll('.question-card').forEach(card => {
                card.classList.remove('active');
            });
            
            const currentCard = dialog.querySelector(`[data-question="${questionNum}"]`);
            if (currentCard) {
                currentCard.classList.add('active');
                currentCard.querySelector('textarea')?.focus();
            }
            
            const progressFill = dialog.querySelector('.progress-fill');
            const progressText = dialog.querySelector('.progress-text');
            const progress = (questionNum / totalQuestions) * 100;
            
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `Quick Plan - Question ${questionNum} of ${totalQuestions}`;
            
            currentQuestion = questionNum;
        };
        
        const saveResponse = (questionNum) => {
            const card = dialog.querySelector(`[data-question="${questionNum}"]`);
            const textarea = card?.querySelector('textarea');
            if (textarea) {
                responses[questionNum] = textarea.value.trim();
            }
        };
        
        // Event handlers
        dialog.querySelector('.planning-close-btn')?.addEventListener('click', () => {
            dialog.remove();
        });
        
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) dialog.remove();
            
            if (e.target.classList.contains('next-btn')) {
                saveResponse(currentQuestion);
                if (currentQuestion < totalQuestions) {
                    showQuestion(currentQuestion + 1);
                }
            } else if (e.target.classList.contains('prev-btn')) {
                saveResponse(currentQuestion);
                if (currentQuestion > 1) {
                    showQuestion(currentQuestion - 1);
                }
            } else if (e.target.classList.contains('skip-btn')) {
                if (currentQuestion < totalQuestions) {
                    showQuestion(currentQuestion + 1);
                }
            } else if (e.target.classList.contains('finish-btn')) {
                saveResponse(currentQuestion);
                this.completeQuickPlanning(taskId, responses);
                dialog.remove();
            }
        });
        
        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dialog.remove();
            }
        });
    }
    
    /**
     * Complete quick planning session
     */
    completeQuickPlanning(taskId, responses) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        
        if (!task) return;
        
        // Save quick planning notes
        task.quickPlanning = {
            goal: responses[1] || '',
            steps: responses[2] || '',
            obstacles: responses[3] || '',
            plannedAt: new Date().toISOString()
        };
        
        // Update task
        state.tasks.items.set(taskId, task);
        this.dataManager.saveData();
        
        // Show completion notification
        const notification = document.createElement('div');
        notification.className = 'quick-planning-complete';
        notification.innerHTML = `
            <div class="completion-content">
                <h3>⚡ Quick Plan Complete!</h3>
                <p>Planning notes saved for "${this.escapeHTML(task.title)}"</p>
                <div class="completion-actions">
                    <button class="start-work-btn">Start Working</button>
                    <button class="full-plan-btn">Full Planning</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        notification.querySelector('.start-work-btn')?.addEventListener('click', () => {
            this.startTaskTimer(taskId);
            this.showTimelineView();
            notification.remove();
        });
        
        notification.querySelector('.full-plan-btn')?.addEventListener('click', () => {
            this.showTaskPlanningDialog(taskId);
            notification.remove();
        });
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 6000);
    }
    
    /**
     * Simple markdown to HTML converter
     */
    markdownToHTML(markdown) {
        return markdown
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }
    
    /**
     * Show manual task creation dialog
     */
    showManualTaskCreation() {
        const dialog = document.createElement('div');
        dialog.className = 'task-creation-dialog';
        dialog.innerHTML = `
            <div class="task-creation-content">
                <h3>Create New Task</h3>
                <form class="task-creation-form">
                    <input type="text" name="title" placeholder="Task title..." required>
                    <textarea name="description" placeholder="Task description (optional)"></textarea>
                    <div class="deadline-section">
                        <label>Deadline:</label>
                        <input type="date" name="dueDate">
                        <label><input type="checkbox" name="noDeadline"> No deadline (someday)</label>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="cancel-btn">Cancel</button>
                        <button type="submit" class="create-btn">Create Task</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Focus title input
        dialog.querySelector('input[name="title"]').focus();
        
        // Event listeners
        dialog.querySelector('.cancel-btn').addEventListener('click', () => dialog.remove());
        dialog.querySelector('.task-creation-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const taskData = {
                title: formData.get('title'),
                description: formData.get('description'),
                dueDate: formData.get('noDeadline') ? null : formData.get('dueDate'),
                extractedFrom: 'manual',
                confidence: 1.0
            };
            
            if (taskData.title.trim()) {
                this.createTask(taskData);
                dialog.remove();
                this.showTimelineView();
            }
        });
    }

    // Style injection methods
    injectTaskConfirmationStyles() {
        if (document.getElementById('task-confirmation-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'task-confirmation-styles';
        styles.textContent = `
            .task-confirmation-dialog {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .task-confirmation-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            
            .task-confirmation-content {
                background: white;
                border-radius: 12px;
                max-width: 500px;
                width: 100%;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
                max-height: 80vh;
                overflow-y: auto;
            }
            
            .task-confirmation-header {
                padding: 24px 24px 16px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .task-confirmation-header h3 {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #111827;
            }
            
            .close-btn {
                background: none;
                border: none;
                font-size: 24px;
                color: #6b7280;
                cursor: pointer;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
            }
            
            .close-btn:hover {
                background: #f3f4f6;
            }
            
            .task-confirmation-body {
                padding: 24px;
            }
            
            .task-confirmation-body p {
                margin: 0 0 16px;
                color: #374151;
            }
            
            .detected-tasks {
                margin-bottom: 24px;
            }
            
            .detected-task {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
            }
            
            .detected-task:last-child {
                margin-bottom: 0;
            }
            
            .task-text {
                font-weight: 500;
                color: #1e293b;
                margin-bottom: 4px;
            }
            
            .task-suggested-date {
                font-size: 14px;
                color: #64748b;
            }
            
            .task-confirmation-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }
            
            .btn {
                padding: 10px 20px;
                border-radius: 8px;
                font-weight: 500;
                font-size: 14px;
                cursor: pointer;
                border: none;
                transition: all 0.2s;
            }
            
            .btn.primary {
                background: #3b82f6;
                color: white;
            }
            
            .btn.primary:hover {
                background: #2563eb;
            }
            
            .btn.secondary {
                background: #f3f4f6;
                color: #374151;
                border: 1px solid #d1d5db;
            }
            
            .btn.secondary:hover {
                background: #e5e7eb;
            }
            
            /* Template suggestion styles */
            .detected-task {
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
            }
            
            .detected-task.template-applied-task {
                border-color: #10b981;
                background: #f0fdf4;
            }
            
            .task-main {
                margin-bottom: 12px;
            }
            
            .task-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                font-size: 0.8rem;
            }
            
            .task-category-small {
                font-weight: 600;
            }
            
            .task-confidence {
                color: #6b7280;
                font-size: 0.75rem;
            }
            
            .task-templates {
                border-top: 1px solid #e5e7eb;
                padding-top: 12px;
                margin-top: 8px;
            }
            
            .templates-header {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 8px;
                font-size: 0.9rem;
                font-weight: 600;
                color: #374151;
            }
            
            .templates-icon {
                font-size: 1rem;
            }
            
            .template-suggestion {
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 8px;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 12px;
            }
            
            .template-main {
                flex: 1;
                min-width: 0;
            }
            
            .template-header {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 4px;
            }
            
            .template-icon {
                font-size: 1.1rem;
            }
            
            .template-name {
                font-weight: 600;
                color: #374151;
                font-size: 0.9rem;
            }
            
            .template-description {
                color: #6b7280;
                font-size: 0.8rem;
                margin-bottom: 2px;
            }
            
            .template-time {
                color: #9ca3af;
                font-size: 0.75rem;
                font-style: italic;
            }
            
            .template-use-btn {
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 6px 12px;
                font-size: 0.8rem;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
                flex-shrink: 0;
            }
            
            .template-use-btn:hover {
                background: #2563eb;
            }
            
            .template-use-btn.template-applied {
                background: #10b981;
                cursor: default;
            }
            
            .template-use-btn:disabled {
                opacity: 0.8;
                cursor: default;
            }
            
            .subtasks-preview {
                margin-top: 8px;
                padding: 8px;
                background: #f0fdf4;
                border-radius: 4px;
                border-left: 3px solid #10b981;
            }
            
            .subtasks-header {
                font-size: 0.8rem;
                font-weight: 600;
                color: #065f46;
                margin-bottom: 6px;
            }
            
            .subtasks-list {
                margin: 0;
                padding-left: 16px;
                color: #047857;
                font-size: 0.75rem;
            }
            
            .subtasks-list li {
                margin-bottom: 2px;
            }
            
            .more-subtasks {
                color: #6b7280;
                font-style: italic;
            }
            
            .template-applied-feedback {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10001;
                background: #10b981;
                color: white;
                padding: 12px 16px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                animation: slideInRight 0.3s ease-out;
            }
            
            .feedback-content {
                font-size: 0.9rem;
                font-weight: 600;
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    injectDeadlineSelectionStyles() {
        if (document.getElementById('deadline-selection-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'deadline-selection-styles';
        styles.textContent = `
            .deadline-selection-dialog {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .deadline-selection-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            
            .deadline-selection-content {
                background: white;
                border-radius: 12px;
                max-width: 600px;
                width: 100%;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
                max-height: 85vh;
                overflow-y: auto;
            }
            
            .deadline-selection-header {
                padding: 24px 24px 16px;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .deadline-selection-header h3 {
                margin: 0 0 8px;
                font-size: 18px;
                font-weight: 600;
                color: #111827;
            }
            
            .deadline-selection-header p {
                margin: 0;
                color: #6b7280;
                font-size: 14px;
            }
            
            .deadline-selection-body {
                padding: 24px;
            }
            
            .task-deadline-item {
                background: #fafafa;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 20px;
            }
            
            .task-deadline-item:last-child {
                margin-bottom: 0;
            }
            
            .task-deadline-item .task-text {
                font-weight: 500;
                color: #1e293b;
                margin-bottom: 16px;
                font-size: 15px;
            }
            
            .deadline-options {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 8px;
                margin-bottom: 12px;
            }
            
            .deadline-btn {
                background: white;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                padding: 12px 8px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                text-align: center;
            }
            
            .deadline-btn:hover {
                border-color: #3b82f6;
                background: #eff6ff;
            }
            
            .deadline-btn.selected {
                border-color: #3b82f6;
                background: #3b82f6;
                color: white;
            }
            
            .deadline-btn.no-deadline {
                grid-column: 1 / -1;
            }
            
            .custom-date-input {
                width: 100%;
                padding: 10px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                margin-bottom: 12px;
            }
            
            .no-deadline-confirmation {
                background: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
            }
            
            .no-deadline-confirmation .warning {
                margin: 0 0 12px;
                color: #92400e;
                font-size: 14px;
            }
            
            .confirmation-buttons {
                display: flex;
                gap: 8px;
            }
            
            .btn.small {
                padding: 6px 12px;
                font-size: 12px;
            }
            
            .selected-deadline {
                min-height: 24px;
            }
            
            .selected-text {
                display: inline-block;
                background: #dcfce7;
                color: #166534;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
            }
            
            .deadline-selection-actions {
                padding: 0 24px 24px;
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    injectSuccessNotificationStyles() {
        if (document.getElementById('success-notification-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'success-notification-styles';
        styles.textContent = `
            .task-success-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .task-success-content {
                background: #059669;
                color: white;
                padding: 16px 20px;
                border-radius: 10px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 300px;
            }
            
            .success-icon {
                font-size: 18px;
            }
            
            .success-text {
                flex: 1;
                font-weight: 500;
                font-size: 14px;
            }
            
            .view-timeline-btn {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .view-timeline-btn:hover {
                background: rgba(255, 255, 255, 0.3);
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    injectTimelineStyles() {
        if (document.getElementById('timeline-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'timeline-styles';
        styles.textContent = `
            .branestawm-timeline-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 9999;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .branestawm-timeline-container {
                background: #1e293b;
                border-radius: 12px;
                width: 90vw;
                max-width: 1000px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                color: #e2e8f0;
            }
            
            .timeline-header {
                padding: 20px 24px 16px;
                border-bottom: 1px solid #334155;
                display: flex;
                align-items: center;
                justify-content: space-between;
                position: relative;
            }
            
            .timeline-header h2 {
                margin: 0;
                font-size: 1.5rem;
                font-weight: 600;
                color: #f1f5f9;
            }
            
            .timeline-subtitle {
                position: absolute;
                left: 24px;
                bottom: -8px;
                margin: 0;
                font-size: 0.875rem;
                color: #94a3b8;
                font-style: italic;
            }
            
            .timeline-close-btn {
                background: #475569;
                border: none;
                border-radius: 6px;
                color: #cbd5e1;
                font-size: 16px;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .timeline-close-btn:hover {
                background: #64748b;
            }
            
            .timeline-content {
                flex: 1;
                overflow-y: auto;
                padding: 16px 24px;
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 16px;
                align-content: start;
            }
            
            .timeline-category {
                background: #334155;
                border-radius: 8px;
                padding: 16px;
                min-height: 120px;
                display: flex;
                flex-direction: column;
            }
            
            .timeline-category.urgent-category {
                background: linear-gradient(145deg, #7f1d1d, #991b1b);
                border: 1px solid #dc2626;
            }
            
            .category-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid #475569;
            }
            
            .category-icon {
                font-size: 1.25rem;
            }
            
            .category-title {
                margin: 0;
                font-size: 1rem;
                font-weight: 600;
                flex: 1;
            }
            
            .task-count {
                background: #64748b;
                color: #f8fafc;
                font-size: 0.75rem;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 12px;
                min-width: 20px;
                text-align: center;
            }
            
            .urgent-category .task-count {
                background: #fca5a5;
                color: #7f1d1d;
            }
            
            .category-tasks {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .empty-category {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                color: #64748b;
                font-style: italic;
            }
            
            .timeline-task {
                background: #475569;
                border-radius: 6px;
                padding: 12px;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 12px;
                transition: background-color 0.2s;
            }
            
            .timeline-task:hover {
                background: #64748b;
            }
            
            .timeline-task.priority-critical {
                background: linear-gradient(135deg, #dc2626, #ef4444);
                color: white;
            }
            
            .timeline-task.priority-high {
                background: linear-gradient(135deg, #ea580c, #f97316);
                color: white;
            }
            
            .timeline-task.priority-medium {
                background: linear-gradient(135deg, #d97706, #f59e0b);
                color: white;
            }
            
            .timeline-task.priority-low {
                background: linear-gradient(135deg, #059669, #10b981);
                color: white;
            }
            
            .task-main {
                flex: 1;
                min-width: 0;
            }
            
            .task-content h4 {
                margin: 0 0 4px 0;
                font-size: 0.875rem;
                font-weight: 600;
                line-height: 1.2;
            }
            
            .task-content p {
                margin: 0;
                font-size: 0.75rem;
                opacity: 0.8;
                line-height: 1.3;
            }
            
            .task-meta {
                display: flex;
                flex-direction: column;
                gap: 2px;
                margin-top: 6px;
            }
            
            .task-due-date,
            .task-priority {
                font-size: 0.65rem;
                opacity: 0.7;
            }
            
            .task-actions {
                display: flex;
                gap: 4px;
                flex-shrink: 0;
            }
            
            .task-actions button {
                background: rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 4px;
                color: inherit;
                font-size: 12px;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .task-actions button:hover {
                background: rgba(0, 0, 0, 0.4);
            }
            
            .task-complete-btn:hover {
                background: #059669;
            }
            
            .task-delete-btn:hover {
                background: #dc2626;
            }
            
            /* New smart categorization styles */
            .task-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                gap: 8px;
            }
            
            .task-category-badge {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 0.7rem;
                font-weight: 600;
                flex-shrink: 0;
            }
            
            .category-icon {
                font-size: 0.8rem;
            }
            
            .category-name {
                font-size: 0.65rem;
                opacity: 0.9;
            }
            
            .task-related {
                display: flex;
                align-items: center;
                gap: 2px;
                font-size: 0.6rem;
                color: #8b5cf6;
                background: rgba(139, 92, 246, 0.1);
                padding: 2px 6px;
                border-radius: 10px;
                border: 1px solid rgba(139, 92, 246, 0.3);
            }
            
            .task-confidence {
                font-size: 0.6rem;
                opacity: 0.6;
                color: #10b981;
            }
            
            .task-timer-btn {
                background: rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 4px;
                color: inherit;
                font-size: 10px;
                padding: 2px 6px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .task-timer-btn:hover {
                background: rgba(0, 0, 0, 0.4);
            }
            
            .task-timer-btn.active {
                background: #f59e0b;
                color: white;
                border-color: #d97706;
            }
            
            .task-timer-btn.active:hover {
                background: #d97706;
            }
            
            .timeline-footer {
                padding: 16px 24px;
                border-top: 1px solid #334155;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .timeline-stats {
                font-size: 0.875rem;
                color: #94a3b8;
            }
            
            .add-task-btn {
                background: #059669;
                border: none;
                border-radius: 6px;
                color: white;
                font-size: 0.875rem;
                font-weight: 600;
                padding: 8px 16px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .add-task-btn:hover {
                background: #047857;
            }
            
            .task-creation-dialog {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 10000;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .task-creation-content {
                background: #1e293b;
                border-radius: 12px;
                padding: 24px;
                width: 90vw;
                max-width: 500px;
                color: #e2e8f0;
            }
            
            .task-creation-content h3 {
                margin: 0 0 20px 0;
                font-size: 1.25rem;
                font-weight: 600;
            }
            
            .task-creation-form {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            
            .task-creation-form input,
            .task-creation-form textarea {
                background: #334155;
                border: 1px solid #475569;
                border-radius: 6px;
                color: #e2e8f0;
                padding: 12px;
                font-size: 0.875rem;
                font-family: inherit;
            }
            
            .task-creation-form input:focus,
            .task-creation-form textarea:focus {
                outline: none;
                border-color: #059669;
                box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.2);
            }
            
            .task-creation-form textarea {
                min-height: 60px;
                resize: vertical;
            }
            
            .deadline-section {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .deadline-section label {
                font-size: 0.875rem;
                color: #cbd5e1;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .deadline-section input[type="checkbox"] {
                width: auto;
                padding: 0;
                margin: 0;
            }
            
            .form-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
                margin-top: 8px;
            }
            
            .form-actions button {
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
                font-family: inherit;
            }
            
            .cancel-btn {
                background: #475569;
                border: 1px solid #64748b;
                color: #cbd5e1;
            }
            
            .cancel-btn:hover {
                background: #64748b;
            }
            
            .create-btn {
                background: #059669;
                border: 1px solid #047857;
                color: white;
            }
            
            .create-btn:hover {
                background: #047857;
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    injectPlanningStyles() {
        if (document.getElementById('planning-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'planning-styles';
        styles.textContent = `
            .task-planning-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 9999;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .task-planning-container {
                background: #1e293b;
                border-radius: 12px;
                width: 90vw;
                max-width: 700px;
                max-height: 85vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
                color: #e2e8f0;
            }
            
            .planning-header {
                padding: 20px 24px 16px;
                border-bottom: 1px solid #334155;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .planning-header h2 {
                margin: 0;
                font-size: 1.5rem;
                font-weight: 600;
                color: #f1f5f9;
            }
            
            .planning-close-btn {
                background: #475569;
                border: none;
                border-radius: 6px;
                color: #cbd5e1;
                font-size: 16px;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .planning-close-btn:hover {
                background: #64748b;
            }
            
            .planning-content {
                flex: 1;
                overflow-y: auto;
                padding: 20px 24px;
                display: flex;
                flex-direction: column;
                gap: 24px;
            }
            
            .task-overview {
                background: #334155;
                border-radius: 8px;
                padding: 16px;
            }
            
            .task-overview h3 {
                margin: 0 0 12px 0;
                font-size: 1.1rem;
                color: #f1f5f9;
            }
            
            .task-overview p {
                margin: 6px 0;
                font-size: 0.875rem;
                line-height: 1.4;
            }
            
            .planning-questions h3 {
                margin: 0 0 16px 0;
                font-size: 1.1rem;
                color: #f1f5f9;
            }
            
            .planning-conversation {
                position: relative;
            }
            
            .question-card {
                display: none;
                background: #334155;
                border-radius: 8px;
                padding: 20px;
                animation: fadeIn 0.3s ease-in-out;
            }
            
            .question-card.active {
                display: block;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .question-card h4 {
                margin: 0 0 12px 0;
                font-size: 1rem;
                color: #f1f5f9;
                font-weight: 600;
            }
            
            .question-card textarea {
                width: 100%;
                background: #475569;
                border: 1px solid #64748b;
                border-radius: 6px;
                color: #e2e8f0;
                padding: 12px;
                font-size: 0.875rem;
                font-family: inherit;
                min-height: 100px;
                resize: vertical;
                margin-bottom: 16px;
            }
            
            .question-card textarea:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
            }
            
            .question-card textarea::placeholder {
                color: #94a3b8;
            }
            
            .question-actions {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }
            
            .question-actions button {
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
                font-family: inherit;
                border: none;
            }
            
            .prev-btn {
                background: #64748b;
                color: #e2e8f0;
            }
            
            .prev-btn:hover {
                background: #475569;
            }
            
            .skip-btn {
                background: #6b7280;
                color: #e2e8f0;
            }
            
            .skip-btn:hover {
                background: #4b5563;
            }
            
            .next-btn,
            .finish-btn {
                background: #3b82f6;
                color: white;
            }
            
            .next-btn:hover,
            .finish-btn:hover {
                background: #2563eb;
            }
            
            .planning-progress {
                padding: 16px 24px;
                border-top: 1px solid #334155;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .progress-bar {
                flex: 1;
                background: #475569;
                border-radius: 8px;
                height: 8px;
                overflow: hidden;
            }
            
            .progress-fill {
                background: #3b82f6;
                height: 100%;
                border-radius: 8px;
                transition: width 0.3s ease;
            }
            
            .progress-text {
                font-size: 0.75rem;
                color: #94a3b8;
                font-weight: 600;
                min-width: 80px;
                text-align: right;
            }
            
            .planning-complete-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 10000;
                font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .planning-complete-content {
                background: #059669;
                color: white;
                padding: 20px 24px;
                border-radius: 10px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
                max-width: 350px;
            }
            
            .planning-complete-content h3 {
                margin: 0 0 8px 0;
                font-size: 1.1rem;
                font-weight: 600;
            }
            
            .planning-complete-content p {
                margin: 0 0 16px 0;
                font-size: 0.875rem;
                line-height: 1.4;
            }
            
            .planning-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            
            .planning-actions button {
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
                font-family: inherit;
                border: none;
            }
            
            .view-plan-btn {
                background: rgba(255, 255, 255, 0.2);
                color: white;
            }
            
            .view-plan-btn:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .start-work-btn {
                background: #047857;
                color: white;
            }
            
            .start-work-btn:hover {
                background: #065f46;
            }
            
            .timeline-btn {
                background: rgba(255, 255, 255, 0.1);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
            }
            
            .timeline-btn:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .plan-summary-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 9999;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .plan-summary-container {
                background: #1e293b;
                border-radius: 12px;
                width: 90vw;
                max-width: 600px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
                color: #e2e8f0;
            }
            
            .summary-header {
                padding: 20px 24px 16px;
                border-bottom: 1px solid #334155;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .summary-header h2 {
                margin: 0;
                font-size: 1.5rem;
                font-weight: 600;
                color: #f1f5f9;
            }
            
            .summary-close-btn {
                background: #475569;
                border: none;
                border-radius: 6px;
                color: #cbd5e1;
                font-size: 16px;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .summary-close-btn:hover {
                background: #64748b;
            }
            
            .summary-content {
                flex: 1;
                overflow-y: auto;
                padding: 20px 24px;
            }
            
            .plan-text {
                background: #334155;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 20px;
                line-height: 1.6;
            }
            
            .plan-text h3,
            .plan-text h4 {
                color: #f1f5f9;
                margin-top: 16px;
                margin-bottom: 8px;
            }
            
            .plan-text p {
                margin: 8px 0;
            }
            
            .summary-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }
            
            .summary-actions button {
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
                font-family: inherit;
                border: none;
            }
            
            .edit-plan-btn {
                background: #64748b;
                color: #e2e8f0;
            }
            
            .edit-plan-btn:hover {
                background: #475569;
            }
            
            .summary-actions .start-work-btn {
                background: #059669;
                color: white;
            }
            
            .summary-actions .start-work-btn:hover {
                background: #047857;
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    injectRelatedTasksStyles() {
        if (document.getElementById('related-tasks-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'related-tasks-styles';
        styles.textContent = `
            .related-tasks-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 9999;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .related-tasks-container {
                background: #1e293b;
                border-radius: 12px;
                width: 90vw;
                max-width: 600px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
                color: #e2e8f0;
            }
            
            .related-header {
                padding: 20px 24px 16px;
                border-bottom: 1px solid #334155;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .related-header h2 {
                margin: 0;
                font-size: 1.5rem;
                font-weight: 600;
                color: #f1f5f9;
            }
            
            .related-close-btn {
                background: #475569;
                border: none;
                border-radius: 6px;
                color: #cbd5e1;
                font-size: 16px;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .related-close-btn:hover {
                background: #64748b;
            }
            
            .related-content {
                flex: 1;
                overflow-y: auto;
                padding: 20px 24px;
            }
            
            .current-task-info {
                background: #334155;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 20px;
            }
            
            .current-task-info h3 {
                margin: 0 0 12px 0;
                font-size: 1.1rem;
                color: #f1f5f9;
            }
            
            .task-summary {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .task-category {
                font-size: 0.8rem;
                color: #94a3b8;
            }
            
            .task-summary h4 {
                margin: 0;
                font-size: 1rem;
                color: #f1f5f9;
            }
            
            .related-tasks-list h3 {
                margin: 0 0 16px 0;
                font-size: 1.1rem;
                color: #f1f5f9;
            }
            
            .related-task-item {
                background: #475569;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 12px;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 12px;
            }
            
            .related-task-main {
                flex: 1;
                min-width: 0;
            }
            
            .related-task-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 6px;
            }
            
            .task-status {
                font-size: 0.9rem;
            }
            
            .task-category-small {
                font-size: 0.7rem;
                color: #94a3b8;
            }
            
            .similarity-score {
                font-size: 0.65rem;
                background: rgba(59, 130, 246, 0.2);
                color: #60a5fa;
                padding: 2px 6px;
                border-radius: 4px;
                margin-left: auto;
            }
            
            .related-task-title {
                margin: 0 0 4px 0;
                font-size: 0.9rem;
                color: #f1f5f9;
                line-height: 1.3;
            }
            
            .related-reason {
                margin: 0;
                font-size: 0.75rem;
                color: #94a3b8;
                font-style: italic;
            }
            
            .related-task-actions {
                display: flex;
                gap: 6px;
                flex-shrink: 0;
            }
            
            .related-task-actions button {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.7rem;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
                font-family: inherit;
                border: none;
            }
            
            .view-task-btn {
                background: #64748b;
                color: #e2e8f0;
            }
            
            .view-task-btn:hover {
                background: #475569;
            }
            
            .plan-together-btn {
                background: #3b82f6;
                color: white;
            }
            
            .plan-together-btn:hover {
                background: #2563eb;
            }
            
            .related-suggestions {
                margin-top: 24px;
            }
            
            .related-suggestions h3 {
                margin: 0 0 16px 0;
                font-size: 1.1rem;
                color: #f1f5f9;
            }
            
            .suggestion-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .suggestion-item {
                background: #334155;
                border-radius: 8px;
                padding: 12px;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .suggestion-icon {
                font-size: 1.2rem;
                flex-shrink: 0;
            }
            
            .suggestion-text {
                flex: 1;
                font-size: 0.875rem;
                color: #cbd5e1;
            }
            
            .suggestion-action-btn {
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 600;
                background: #059669;
                color: white;
                border: none;
                cursor: pointer;
                transition: background-color 0.2s;
                font-family: inherit;
            }
            
            .suggestion-action-btn:hover {
                background: #047857;
            }
            
            .related-footer {
                padding: 16px 24px;
                border-top: 1px solid #334155;
                display: flex;
                justify-content: center;
            }
            
            .back-timeline-btn {
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 0.875rem;
                font-weight: 600;
                background: #64748b;
                color: #e2e8f0;
                border: none;
                cursor: pointer;
                transition: background-color 0.2s;
                font-family: inherit;
            }
            
            .back-timeline-btn:hover {
                background: #475569;
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    injectTimerStyles() {
        if (document.getElementById('timer-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'timer-styles';
        styles.textContent = `
            .timer-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                z-index: 10000;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .timer-dialog-container {
                background: #1e293b;
                border-radius: 12px;
                width: 90vw;
                max-width: 400px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
                color: #e2e8f0;
            }
            
            .timer-header {
                padding: 20px 24px 16px;
                border-bottom: 1px solid #334155;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .timer-header h3 {
                margin: 0;
                font-size: 1.2rem;
                font-weight: 600;
                color: #f1f5f9;
            }
            
            .timer-close-btn {
                background: #475569;
                border: none;
                border-radius: 6px;
                color: #cbd5e1;
                font-size: 16px;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .timer-close-btn:hover {
                background: #64748b;
            }
            
            .timer-content {
                padding: 24px;
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            
            .timer-display {
                text-align: center;
                padding: 20px;
                background: #334155;
                border-radius: 8px;
            }
            
            .elapsed-time {
                font-size: 2.5rem;
                font-weight: 700;
                color: #f59e0b;
                margin-bottom: 8px;
            }
            
            .timer-status {
                font-size: 0.9rem;
                color: #94a3b8;
            }
            
            .estimate-comparison {
                background: #334155;
                border-radius: 8px;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            
            .estimate-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.9rem;
            }
            
            .estimate-label {
                color: #94a3b8;
            }
            
            .estimate-value {
                color: #f1f5f9;
                font-weight: 600;
            }
            
            .progress-indicator {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            
            .progress-bar {
                background: #475569;
                border-radius: 4px;
                height: 8px;
                overflow: hidden;
            }
            
            .progress-fill {
                background: linear-gradient(90deg, #10b981, #f59e0b, #ef4444);
                height: 100%;
                border-radius: 4px;
                transition: width 0.3s ease;
            }
            
            .progress-text {
                font-size: 0.8rem;
                color: #cbd5e1;
                text-align: center;
            }
            
            .timer-actions {
                display: flex;
                gap: 12px;
            }
            
            .timer-actions button {
                flex: 1;
                padding: 12px;
                border-radius: 6px;
                font-size: 0.9rem;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
                font-family: inherit;
                border: none;
            }
            
            .timer-complete-btn {
                background: #059669;
                color: white;
            }
            
            .timer-complete-btn:hover {
                background: #047857;
            }
            
            .timer-pause-btn {
                background: #64748b;
                color: #e2e8f0;
            }
            
            .timer-pause-btn:hover {
                background: #475569;
            }
            
            .task-completion-summary {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 10001;
                background: #1e293b;
                color: #e2e8f0;
                padding: 20px 24px;
                border-radius: 10px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                max-width: 400px;
                animation: slideInUp 0.3s ease-out;
                font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .completion-content h3 {
                margin: 0 0 8px 0;
                font-size: 1.1rem;
                font-weight: 600;
                color: #10b981;
            }
            
            .completion-content p {
                margin: 0 0 12px 0;
                font-size: 0.9rem;
                line-height: 1.4;
            }
            
            .time-summary {
                background: #334155;
                border-radius: 6px;
                padding: 12px;
                margin: 12px 0;
            }
            
            .time-summary.excellent {
                background: linear-gradient(135deg, #065f46, #059669);
                border-left: 4px solid #10b981;
            }
            
            .time-summary.good {
                background: linear-gradient(135deg, #1e40af, #3b82f6);
                border-left: 4px solid #60a5fa;
            }
            
            .time-summary.fair {
                background: linear-gradient(135deg, #d97706, #f59e0b);
                border-left: 4px solid #fbbf24;
            }
            
            .time-summary.poor {
                background: linear-gradient(135deg, #dc2626, #ef4444);
                border-left: 4px solid #f87171;
            }
            
            .time-comparison {
                font-size: 0.9rem;
                font-weight: 600;
                margin-bottom: 4px;
            }
            
            .time-details {
                font-size: 0.75rem;
                opacity: 0.9;
            }
            
            .learning-note {
                font-size: 0.8rem;
                color: #94a3b8;
                font-style: italic;
                border-top: 1px solid #475569;
                padding-top: 8px;
                margin-top: 8px;
            }
            
            @keyframes slideInUp {
                from {
                    transform: translateY(100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    injectProactiveReminderStyles() {
        if (document.getElementById('proactive-reminder-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'proactive-reminder-styles';
        styles.textContent = `
            .proactive-task-reminder,
            .missed-task-suggestion,
            .deadline-adjustment-suggestion {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                background: #1e293b;
                color: #e2e8f0;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                max-width: 350px;
                animation: slideInRight 0.3s ease-out;
                font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .reminder-content,
            .suggestion-content,
            .adjustment-content {
                padding: 16px;
            }
            
            .reminder-header,
            .suggestion-header,
            .adjustment-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid #334155;
            }
            
            .reminder-icon,
            .suggestion-icon,
            .adjustment-icon {
                font-size: 1.2rem;
            }
            
            .reminder-title,
            .suggestion-text,
            .adjustment-title {
                flex: 1;
                font-weight: 600;
                font-size: 0.9rem;
            }
            
            .reminder-close,
            .suggestion-close,
            .adjustment-close {
                background: none;
                border: none;
                color: #94a3b8;
                font-size: 1.2rem;
                cursor: pointer;
                padding: 2px;
                border-radius: 2px;
                transition: background-color 0.2s;
            }
            
            .reminder-close:hover,
            .suggestion-close:hover,
            .adjustment-close:hover {
                background: #374151;
                color: #e2e8f0;
            }
            
            .task-info h4 {
                margin: 0 0 6px 0;
                font-size: 0.95rem;
                font-weight: 600;
                color: #f1f5f9;
                line-height: 1.3;
            }
            
            .task-due {
                font-size: 0.8rem;
                color: #f59e0b;
                margin-bottom: 8px;
            }
            
            .relevance-reasons {
                display: flex;
                gap: 4px;
                flex-wrap: wrap;
                margin-bottom: 12px;
            }
            
            .reason-tag {
                background: #374151;
                color: #cbd5e1;
                font-size: 0.7rem;
                padding: 2px 6px;
                border-radius: 10px;
                font-weight: 500;
            }
            
            .reminder-actions,
            .suggestion-actions,
            .adjustment-actions {
                display: flex;
                gap: 6px;
            }
            
            .reminder-action,
            .suggestion-action,
            .adjustment-action {
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 0.8rem;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
                font-family: inherit;
                border: none;
            }
            
            .reminder-action.view-task,
            .suggestion-action.create-task,
            .adjustment-action.accept {
                background: #3b82f6;
                color: white;
            }
            
            .reminder-action.view-task:hover,
            .suggestion-action.create-task:hover,
            .adjustment-action.accept:hover {
                background: #2563eb;
            }
            
            .reminder-action.start-task {
                background: #059669;
                color: white;
            }
            
            .reminder-action.start-task:hover {
                background: #047857;
            }
            
            .reminder-action.dismiss,
            .suggestion-action.ignore,
            .adjustment-action.decline {
                background: #6b7280;
                color: #e2e8f0;
            }
            
            .reminder-action.dismiss:hover,
            .suggestion-action.ignore:hover,
            .adjustment-action.decline:hover {
                background: #4b5563;
            }
            
            .potential-task {
                background: #334155;
                padding: 8px 12px;
                border-radius: 4px;
                font-style: italic;
                color: #cbd5e1;
                margin-bottom: 12px;
                font-size: 0.85rem;
                border-left: 3px solid #60a5fa;
            }
            
            .adjustment-question {
                color: #f1f5f9;
                font-size: 0.9rem;
                margin-bottom: 12px;
                line-height: 1.4;
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            /* Stack multiple notifications */
            .proactive-task-reminder:nth-of-type(2),
            .missed-task-suggestion:nth-of-type(2),
            .deadline-adjustment-suggestion:nth-of-type(2) {
                top: 110px;
            }
            
            .proactive-task-reminder:nth-of-type(3),
            .missed-task-suggestion:nth-of-type(3),
            .deadline-adjustment-suggestion:nth-of-type(3) {
                top: 200px;
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    /**
     * Inject styles for unified task view
     */
    injectUnifiedViewStyles() {
        const styleId = 'unified-view-styles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .unified-view-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .unified-view-dialog {
                background: white;
                border-radius: 12px;
                width: 90vw;
                max-width: 1200px;
                height: 80vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
                overflow: hidden;
            }

            .unified-view-header {
                padding: 24px 32px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: #f9fafb;
            }

            .unified-view-header h2 {
                margin: 0;
                color: #1f2937;
                font-size: 24px;
                font-weight: 600;
            }

            .close-unified-view {
                background: none;
                border: none;
                font-size: 24px;
                color: #6b7280;
                cursor: pointer;
                padding: 4px;
                border-radius: 6px;
                transition: all 0.2s;
            }

            .close-unified-view:hover {
                background: #e5e7eb;
                color: #374151;
            }

            .unified-view-filters {
                padding: 16px 32px;
                border-bottom: 1px solid #e5e7eb;
                background: white;
            }

            .filter-row {
                display: flex;
                gap: 16px;
                align-items: center;
            }

            .search-input,
            .filter-select {
                padding: 8px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s;
            }

            .search-input {
                flex: 1;
                min-width: 200px;
            }

            .search-input:focus,
            .filter-select:focus {
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }

            .filter-select {
                min-width: 120px;
            }

            .unified-tasks-container {
                flex: 1;
                overflow-y: auto;
                padding: 24px 32px;
                background: #f9fafb;
            }

            .folio-task-section {
                margin-bottom: 32px;
            }

            .folio-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
                padding: 12px 0;
                border-bottom: 2px solid #e5e7eb;
            }

            .folio-name {
                font-size: 18px;
                font-weight: 600;
                color: #1f2937;
            }

            .task-count {
                color: #6b7280;
                font-size: 14px;
                background: #e5e7eb;
                padding: 4px 12px;
                border-radius: 12px;
            }

            .folio-tasks {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .unified-task-item {
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 16px;
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                transition: all 0.2s;
                cursor: pointer;
            }

            .unified-task-item:hover {
                border-color: #3b82f6;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
            }

            .unified-task-item.completed {
                opacity: 0.7;
                background: #f3f4f6;
            }

            .unified-task-item.in-progress {
                border-left: 4px solid #3b82f6;
            }

            .task-main-content {
                flex: 1;
            }

            .task-header-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 8px;
            }

            .task-category {
                font-size: 12px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .task-status {
                font-size: 11px;
                text-transform: uppercase;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 10px;
                background: #e5e7eb;
                color: #6b7280;
            }

            .task-status.pending {
                background: #fef3c7;
                color: #d97706;
            }

            .task-status.in-progress {
                background: #dbeafe;
                color: #2563eb;
            }

            .task-status.completed {
                background: #d1fae5;
                color: #065f46;
            }

            .task-title {
                font-size: 16px;
                font-weight: 500;
                color: #1f2937;
                margin-bottom: 8px;
                cursor: pointer;
            }

            .task-title:hover {
                color: #3b82f6;
            }

            .task-description {
                color: #6b7280;
                font-size: 14px;
                margin-bottom: 12px;
                line-height: 1.4;
            }

            .task-metadata {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                font-size: 12px;
            }

            .task-deadline,
            .task-estimate,
            .task-dependencies {
                display: flex;
                align-items: center;
                gap: 4px;
                color: #6b7280;
            }

            .task-deadline.overdue {
                color: #dc2626;
                font-weight: 600;
            }

            .task-actions {
                flex-shrink: 0;
                margin-left: 16px;
            }

            .task-action-btn {
                background: none;
                border: none;
                color: #6b7280;
                font-size: 18px;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s;
            }

            .task-action-btn:hover {
                background: #f3f4f6;
                color: #374151;
            }

            .no-tasks-message {
                text-align: center;
                color: #6b7280;
                font-size: 16px;
                padding: 48px;
                background: white;
                border-radius: 8px;
                border: 1px dashed #d1d5db;
            }

            .task-highlighted {
                animation: highlight 2s ease-in-out;
                border-color: #3b82f6 !important;
                box-shadow: 0 0 20px rgba(59, 130, 246, 0.3) !important;
            }

            @keyframes highlight {
                0% { transform: scale(1); }
                50% { transform: scale(1.02); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Inject styles for task action menu
     */
    injectTaskMenuStyles() {
        const styleId = 'task-menu-styles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .task-action-menu {
                position: fixed;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                z-index: 10001;
                min-width: 280px;
                overflow: hidden;
            }

            .action-menu-content {
                padding: 0;
            }

            .menu-header {
                background: #f9fafb;
                padding: 12px 16px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .menu-title {
                font-weight: 600;
                color: #1f2937;
                font-size: 14px;
            }

            .close-menu {
                background: none;
                border: none;
                color: #6b7280;
                font-size: 18px;
                cursor: pointer;
                padding: 2px;
                border-radius: 4px;
            }

            .close-menu:hover {
                background: #e5e7eb;
            }

            .menu-actions {
                padding: 8px 0;
            }

            .menu-action {
                width: 100%;
                background: none;
                border: none;
                padding: 12px 16px;
                text-align: left;
                cursor: pointer;
                font-size: 14px;
                color: #374151;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: background-color 0.2s;
            }

            .menu-action:hover {
                background: #f3f4f6;
            }

            .menu-action-group {
                padding: 12px 16px;
                border-top: 1px solid #f3f4f6;
            }

            .menu-action-group label {
                display: block;
                font-size: 12px;
                color: #6b7280;
                margin-bottom: 6px;
                font-weight: 500;
            }

            .folio-select {
                width: 100%;
                padding: 6px 8px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 13px;
                margin-bottom: 8px;
            }

            .menu-action-btn {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                font-size: 13px;
                cursor: pointer;
                transition: background-color 0.2s;
            }

            .menu-action-btn:hover {
                background: #2563eb;
            }

            .duplicate-task-dialog {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10002;
            }

            .dialog-content {
                background: white;
                border-radius: 8px;
                width: 400px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
                overflow: hidden;
            }

            .dialog-header {
                background: #f9fafb;
                padding: 16px 20px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .dialog-header h3 {
                margin: 0;
                font-size: 16px;
                color: #1f2937;
            }

            .dialog-header button {
                background: none;
                border: none;
                font-size: 18px;
                color: #6b7280;
                cursor: pointer;
            }

            .dialog-body {
                padding: 20px;
            }

            .dialog-body label {
                display: block;
                margin-bottom: 6px;
                font-size: 14px;
                color: #374151;
                font-weight: 500;
            }

            .text-input {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                margin-bottom: 16px;
                font-size: 14px;
            }

            .text-input:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }

            .dialog-actions {
                padding: 16px 20px;
                background: #f9fafb;
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }

            .btn-primary {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
                transition: background-color 0.2s;
            }

            .btn-primary:hover {
                background: #2563eb;
            }

            .btn-secondary {
                background: #f3f4f6;
                color: #374151;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
                transition: background-color 0.2s;
            }

            .btn-secondary:hover {
                background: #e5e7eb;
            }

            .success-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                z-index: 10003;
                animation: slideIn 0.3s ease-out;
            }

            .notification-content {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .success-icon {
                font-size: 16px;
            }

            .success-message {
                font-size: 14px;
                font-weight: 500;
            }

            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    /**
     * Advanced Analytics Dashboard
     */
    showAnalyticsDashboard() {
        const existingDashboard = document.querySelector('#analytics-dashboard');
        if (existingDashboard) {
            existingDashboard.remove();
        }
        
        const overlay = document.createElement('div');
        overlay.id = 'analytics-dashboard';
        overlay.className = 'analytics-overlay';
        
        overlay.innerHTML = `
            <div class="analytics-dialog">
                <div class="analytics-header">
                    <h2>📊 Task Analytics & Insights</h2>
                    <button class="close-analytics" onclick="document.getElementById('analytics-dashboard').remove()">×</button>
                </div>
                
                <div class="analytics-nav">
                    <button class="nav-tab active" data-tab="overview">Overview</button>
                    <button class="nav-tab" data-tab="productivity">Productivity</button>
                    <button class="nav-tab" data-tab="patterns">Patterns</button>
                    <button class="nav-tab" data-tab="predictions">Predictions</button>
                    <button class="nav-tab" data-tab="recommendations">Insights</button>
                </div>
                
                <div class="analytics-content">
                    <div class="tab-content active" id="overview-tab">
                        <!-- Overview content will be populated -->
                    </div>
                    
                    <div class="tab-content" id="productivity-tab">
                        <!-- Productivity content will be populated -->
                    </div>
                    
                    <div class="tab-content" id="patterns-tab">
                        <!-- Patterns content will be populated -->
                    </div>
                    
                    <div class="tab-content" id="predictions-tab">
                        <!-- Predictions content will be populated -->
                    </div>
                    
                    <div class="tab-content" id="recommendations-tab">
                        <!-- Recommendations content will be populated -->
                    </div>
                </div>
            </div>
        `;
        
        this.injectAnalyticsStyles();
        document.body.appendChild(overlay);
        
        this.setupAnalyticsTabs();
        this.populateAnalyticsDashboard();
    }
    
    /**
     * Setup analytics dashboard tabs
     */
    setupAnalyticsTabs() {
        const tabs = document.querySelectorAll('.nav-tab');
        const contents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs and contents
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                tab.classList.add('active');
                const tabId = tab.dataset.tab + '-tab';
                document.getElementById(tabId)?.classList.add('active');
                
                // Load content for the selected tab
                this.loadAnalyticsTab(tab.dataset.tab);
            });
        });
    }
    
    /**
     * Populate analytics dashboard with data
     */
    populateAnalyticsDashboard() {
        this.loadAnalyticsTab('overview');
    }
    
    /**
     * Load specific analytics tab content
     */
    loadAnalyticsTab(tabName) {
        const container = document.getElementById(`${tabName}-tab`);
        if (!container) return;
        
        switch (tabName) {
            case 'overview':
                this.renderOverviewTab(container);
                break;
            case 'productivity':
                this.renderProductivityTab(container);
                break;
            case 'patterns':
                this.renderPatternsTab(container);
                break;
            case 'predictions':
                this.renderPredictionsTab(container);
                break;
            case 'recommendations':
                this.renderRecommendationsTab(container);
                break;
        }
    }
    
    /**
     * Calculate comprehensive task analytics
     */
    calculateTaskAnalytics() {
        const state = this.dataManager.getState();
        const tasks = [...(state.tasks?.items?.values() || [])];
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        // Basic metrics
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const pendingTasks = tasks.filter(t => t.status === 'pending').length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        // Time-based analytics
        const recentTasks = tasks.filter(t => new Date(t.createdAt) > weekAgo);
        const lastWeekTasks = tasks.filter(t => {
            const created = new Date(t.createdAt);
            return created > new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000) && created <= weekAgo;
        });
        
        const recentCompletionRate = recentTasks.length > 0 ? 
            (recentTasks.filter(t => t.status === 'completed').length / recentTasks.length) * 100 : 0;
        const lastWeekCompletionRate = lastWeekTasks.length > 0 ? 
            (lastWeekTasks.filter(t => t.status === 'completed').length / lastWeekTasks.length) * 100 : 0;
        
        const completionTrend = Math.round(recentCompletionRate - lastWeekCompletionRate);
        
        // Time accuracy
        const tasksWithTracking = tasks.filter(t => t.timeTracking?.actualMinutes && t.timeTracking?.estimatedMinutes);
        const timeAccuracy = tasksWithTracking.length > 0 ? 
            Math.round(tasksWithTracking.reduce((sum, t) => sum + (t.timeTracking.accuracy || 0), 0) / tasksWithTracking.length * 100) : 0;
        
        // Average completion time
        const avgMinutes = tasksWithTracking.length > 0 ?
            tasksWithTracking.reduce((sum, t) => sum + t.timeTracking.actualMinutes, 0) / tasksWithTracking.length : 0;
        const avgCompletionTime = avgMinutes >= 60 ? 
            `${Math.round(avgMinutes / 60 * 10) / 10}h` : 
            `${Math.round(avgMinutes)}m`;
        
        // Focus score calculation
        const focusScore = this.calculateFocusScore(tasks);
        const focusDescription = this.getFocusDescription(focusScore);
        
        // Historical data
        const completionHistory = this.generateCompletionHistory(tasks, 30);
        const categoryBreakdown = this.calculateCategoryBreakdown(tasks);
        
        return {
            totalTasks,
            completedTasks,
            pendingTasks,
            completionRate,
            completionTrend,
            avgCompletionTime,
            timeAccuracy,
            focusScore,
            focusDescription,
            completionHistory,
            categoryBreakdown
        };
    }
    
    /**
     * Calculate focus score based on task patterns
     */
    calculateFocusScore(tasks) {
        let score = 5; // Base score
        
        const completedTasks = tasks.filter(t => t.status === 'completed');
        if (completedTasks.length === 0) return score;
        
        // Factor 1: Completion consistency
        const completionRate = completedTasks.length / tasks.length;
        score += (completionRate - 0.5) * 4;
        
        // Factor 2: Time estimation accuracy
        const tasksWithTracking = completedTasks.filter(t => t.timeTracking?.accuracy);
        if (tasksWithTracking.length > 0) {
            const avgAccuracy = tasksWithTracking.reduce((sum, t) => sum + t.timeTracking.accuracy, 0) / tasksWithTracking.length;
            score += (avgAccuracy - 0.5) * 2;
        }
        
        return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
    }
    
    /**
     * Get focus score description
     */
    getFocusDescription(score) {
        if (score >= 8) return 'Excellent focus';
        if (score >= 6) return 'Good focus';
        if (score >= 4) return 'Moderate focus';
        if (score >= 2) return 'Needs improvement';
        return 'Focus challenges';
    }
    
    /**
     * Generate completion history for charting
     */
    generateCompletionHistory(tasks, days = 30) {
        const history = [];
        const now = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dayString = date.toISOString().split('T')[0];
            const dayTasks = tasks.filter(t => {
                if (!t.completedAt) return false;
                return t.completedAt.startsWith(dayString);
            });
            
            history.push({
                date: dayString,
                completed: dayTasks.length,
                label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            });
        }
        
        return history;
    }
    
    /**
     * Calculate category breakdown
     */
    calculateCategoryBreakdown(tasks) {
        const breakdown = {
            work: 0,
            personal: 0,
            creative: 0,
            administrative: 0,
            general: 0
        };
        
        tasks.forEach(task => {
            const category = task.category || 'general';
            if (breakdown.hasOwnProperty(category)) {
                breakdown[category]++;
            } else {
                breakdown.general++;
            }
        });
        
        return breakdown;
    }
    
    /**
     * Render overview tab with key metrics
     */
    renderOverviewTab(container) {
        const analytics = this.calculateTaskAnalytics();
        
        container.innerHTML = `
            <div class="analytics-grid">
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-icon">📋</span>
                        <h3>Total Tasks</h3>
                    </div>
                    <div class="metric-value">${analytics.totalTasks}</div>
                    <div class="metric-detail">
                        <span class="completed">${analytics.completedTasks} completed</span>
                        <span class="pending">${analytics.pendingTasks} pending</span>
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-icon">✅</span>
                        <h3>Completion Rate</h3>
                    </div>
                    <div class="metric-value">${analytics.completionRate}%</div>
                    <div class="metric-detail">
                        <span class="trend ${analytics.completionTrend > 0 ? 'positive' : 'negative'}">
                            ${analytics.completionTrend > 0 ? '↗' : '↘'} ${Math.abs(analytics.completionTrend)}% vs last week
                        </span>
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-icon">⏱️</span>
                        <h3>Avg. Completion Time</h3>
                    </div>
                    <div class="metric-value">${analytics.avgCompletionTime}</div>
                    <div class="metric-detail">
                        <span class="accuracy">Time accuracy: ${analytics.timeAccuracy}%</span>
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-icon">🎯</span>
                        <h3>Focus Score</h3>
                    </div>
                    <div class="metric-value">${analytics.focusScore}/10</div>
                    <div class="metric-detail">
                        <span class="focus-desc">${analytics.focusDescription}</span>
                    </div>
                </div>
            </div>
            
            <div class="analytics-charts">
                <div class="chart-section">
                    <h4>Task Completion Over Time</h4>
                    <div class="completion-chart" id="completion-chart">
                        ${this.renderCompletionChart(analytics.completionHistory)}
                    </div>
                </div>
                
                <div class="chart-section">
                    <h4>Tasks by Category</h4>
                    <div class="category-chart" id="category-chart">
                        ${this.renderCategoryChart(analytics.categoryBreakdown)}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Render completion chart
     */
    renderCompletionChart(history) {
        const maxCompleted = Math.max(...history.map(h => h.completed), 1);
        const barWidth = Math.max(100 / history.length - 1, 2);
        
        return `
            <div class="chart-container">
                <div class="chart-bars">
                    ${history.map(day => `
                        <div class="chart-bar" style="height: ${(day.completed / maxCompleted) * 100}%; width: ${barWidth}%;" 
                             title="${day.label}: ${day.completed} tasks">
                        </div>
                    `).join('')}
                </div>
                <div class="chart-labels">
                    ${history.filter((_, i) => i % Math.ceil(history.length / 7) === 0).map(day => `
                        <span class="chart-label">${day.label}</span>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * Render category chart
     */
    renderCategoryChart(breakdown) {
        const total = Object.values(breakdown).reduce((sum, count) => sum + count, 0);
        if (total === 0) return '<div class="no-data">No data available</div>';
        
        const colors = {
            work: '#3b82f6',
            personal: '#10b981',
            creative: '#8b5cf6',
            administrative: '#f59e0b',
            general: '#64748b'
        };
        
        const icons = {
            work: '💼',
            personal: '🏠',
            creative: '🎨',
            administrative: '📋',
            general: '📝'
        };
        
        return `
            <div class="category-breakdown">
                ${Object.entries(breakdown).filter(([_, count]) => count > 0).map(([category, count]) => {
                    const percentage = Math.round((count / total) * 100);
                    return `
                        <div class="category-item">
                            <div class="category-info">
                                <span class="category-icon">${icons[category]}</span>
                                <span class="category-name">${category.charAt(0).toUpperCase() + category.slice(1)}</span>
                                <span class="category-count">${count}</span>
                            </div>
                            <div class="category-bar">
                                <div class="category-fill" style="width: ${percentage}%; background-color: ${colors[category]};"></div>
                            </div>
                            <span class="category-percentage">${percentage}%</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    /**
     * Render predictions tab with ML-based forecasting
     */
    renderPredictionsTab(container) {
        const predictions = this.generateTaskPredictions();
        
        container.innerHTML = `
            <div class="predictions-analysis">
                <div class="prediction-cards">
                    <div class="prediction-card">
                        <h4>📈 Completion Forecast</h4>
                        <div class="forecast-chart">
                            ${this.renderForecastChart(predictions.completionForecast)}
                        </div>
                        <div class="forecast-summary">
                            <p>Expected completion rate next week: <strong>${predictions.expectedCompletionRate}%</strong></p>
                            <p class="confidence">Confidence: ${predictions.forecastConfidence}%</p>
                        </div>
                    </div>
                    
                    <div class="prediction-card">
                        <h4>⏰ Time Prediction Model</h4>
                        <div class="time-predictions">
                            ${predictions.timePredictions.map(pred => `
                                <div class="time-pred-item">
                                    <span class="pred-category">${pred.category}</span>
                                    <span class="pred-time">${pred.predictedTime}</span>
                                    <span class="pred-confidence">${pred.confidence}% accurate</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="model-info">
                            <p>Model trained on ${predictions.trainingDataSize} completed tasks</p>
                            <p>Last updated: ${predictions.lastModelUpdate}</p>
                        </div>
                    </div>
                    
                    <div class="prediction-card">
                        <h4>🔮 Risk Assessment</h4>
                        <div class="risk-factors">
                            ${predictions.riskFactors.map(risk => `
                                <div class="risk-item ${risk.level}">
                                    <div class="risk-header">
                                        <span class="risk-icon">${risk.icon}</span>
                                        <span class="risk-title">${risk.title}</span>
                                        <span class="risk-level">${risk.level}</span>
                                    </div>
                                    <p class="risk-description">${risk.description}</p>
                                    <p class="risk-mitigation">💡 ${risk.mitigation}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="prediction-card">
                        <h4>🎯 Workload Optimization</h4>
                        <div class="optimization-suggestions">
                            ${predictions.optimizations.map(opt => `
                                <div class="optimization-item">
                                    <div class="opt-header">
                                        <span class="opt-impact">${opt.impact}</span>
                                        <span class="opt-effort">${opt.effort} effort</span>
                                    </div>
                                    <h5>${opt.title}</h5>
                                    <p>${opt.description}</p>
                                    <div class="opt-benefits">
                                        ${opt.benefits.map(benefit => `<span class="benefit-tag">${benefit}</span>`).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate task predictions using ML-inspired algorithms
     */
    generateTaskPredictions() {
        const state = this.dataManager.getState();
        const tasks = [...(state.tasks?.items?.values() || [])];
        const completedTasks = tasks.filter(t => t.status === 'completed' && t.completedAt);
        
        // Completion forecast
        const completionForecast = this.predictCompletionTrend(completedTasks);
        const expectedCompletionRate = Math.round(completionForecast.expectedRate * 100);
        const forecastConfidence = Math.round(completionForecast.confidence * 100);
        
        // Time predictions by category
        const timePredictions = this.generateTimePredictions(completedTasks);
        
        // Risk assessment
        const riskFactors = this.assessTaskRisks(tasks);
        
        // Workload optimizations
        const optimizations = this.generateOptimizations(tasks);
        
        return {
            completionForecast: completionForecast.data,
            expectedCompletionRate,
            forecastConfidence,
            timePredictions,
            trainingDataSize: completedTasks.length,
            lastModelUpdate: new Date().toLocaleDateString(),
            riskFactors,
            optimizations
        };
    }
    
    /**
     * Predict completion trend using moving averages
     */
    predictCompletionTrend(completedTasks) {
        if (completedTasks.length < 7) {
            return {
                data: [],
                expectedRate: 0.5,
                confidence: 0.3
            };
        }
        
        // Group by day for the last 30 days
        const dailyCompletions = {};
        const today = new Date();
        
        for (let i = 0; i < 30; i++) {
            const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
            const dayString = date.toISOString().split('T')[0];
            dailyCompletions[dayString] = 0;
        }
        
        completedTasks.forEach(task => {
            const dayString = task.completedAt.split('T')[0];
            if (dailyCompletions.hasOwnProperty(dayString)) {
                dailyCompletions[dayString]++;
            }
        });
        
        const dailyValues = Object.values(dailyCompletions);
        const movingAverage = this.calculateMovingAverage(dailyValues, 7);
        
        // Simple linear regression for trend
        const trend = this.calculateTrend(movingAverage);
        const expectedRate = Math.max(0, Math.min(1, movingAverage[movingAverage.length - 1] / 10));
        const confidence = Math.min(0.9, completedTasks.length / 50);
        
        // Generate forecast data
        const forecastData = movingAverage.slice(-14).map((value, index) => ({
            day: index + 1,
            completed: value,
            predicted: value + (trend * (index + 1))
        }));
        
        return {
            data: forecastData,
            expectedRate,
            confidence
        };
    }
    
    /**
     * Calculate moving average
     */
    calculateMovingAverage(data, window) {
        const result = [];
        for (let i = window - 1; i < data.length; i++) {
            const slice = data.slice(i - window + 1, i + 1);
            const avg = slice.reduce((sum, val) => sum + val, 0) / window;
            result.push(avg);
        }
        return result;
    }
    
    /**
     * Calculate trend using simple linear regression
     */
    calculateTrend(data) {
        if (data.length < 2) return 0;
        
        const n = data.length;
        const sumX = (n * (n - 1)) / 2; // Sum of indices
        const sumY = data.reduce((sum, val) => sum + val, 0);
        const sumXY = data.reduce((sum, val, index) => sum + (index * val), 0);
        const sumX2 = data.reduce((sum, _, index) => sum + (index * index), 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope;
    }
    
    /**
     * Generate time predictions by category
     */
    generateTimePredictions(completedTasks) {
        const categories = ['work', 'personal', 'creative', 'administrative', 'general'];
        
        return categories.map(category => {
            const categoryTasks = completedTasks.filter(t => 
                (t.category || 'general') === category && 
                t.timeTracking?.actualMinutes
            );
            
            if (categoryTasks.length === 0) return null;
            
            const times = categoryTasks.map(t => t.timeTracking.actualMinutes);
            const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
            const confidence = Math.min(95, categoryTasks.length * 5);
            
            const predictedTime = avgTime >= 60 ? 
                `${Math.round(avgTime / 60 * 10) / 10}h` : 
                `${Math.round(avgTime)}m`;
            
            return {
                category: category.charAt(0).toUpperCase() + category.slice(1),
                predictedTime,
                confidence
            };
        }).filter(Boolean);
    }
    
    /**
     * Assess task-related risks
     */
    assessTaskRisks(tasks) {
        const risks = [];
        const now = new Date();
        
        // Overdue task risk
        const overdueTasks = tasks.filter(t => {
            if (t.status === 'completed' || !t.scheduledFor) return false;
            return new Date(t.scheduledFor) < now;
        });
        
        if (overdueTasks.length > 0) {
            risks.push({
                icon: '⚠️',
                title: 'Overdue Tasks',
                level: overdueTasks.length > 5 ? 'high' : 'medium',
                description: `${overdueTasks.length} tasks are overdue and may impact other commitments`,
                mitigation: 'Prioritize overdue tasks or reschedule based on current capacity'
            });
        }
        
        // Time estimation risk
        const tasksWithTracking = tasks.filter(t => t.timeTracking?.accuracy);
        if (tasksWithTracking.length > 5) {
            const avgAccuracy = tasksWithTracking.reduce((sum, t) => sum + t.timeTracking.accuracy, 0) / tasksWithTracking.length;
            if (avgAccuracy < 0.6) {
                risks.push({
                    icon: '⏱️',
                    title: 'Time Estimation Issues',
                    level: 'medium',
                    description: `Time estimates are ${Math.round(avgAccuracy * 100)}% accurate, indicating planning challenges`,
                    mitigation: 'Break down large tasks into smaller, more predictable chunks'
                });
            }
        }
        
        // Workload concentration risk
        const categoryDistribution = this.calculateCategoryBreakdown(tasks.filter(t => t.status === 'pending'));
        const maxCategory = Math.max(...Object.values(categoryDistribution));
        const totalPending = Object.values(categoryDistribution).reduce((sum, count) => sum + count, 0);
        
        if (totalPending > 0 && maxCategory / totalPending > 0.7) {
            risks.push({
                icon: '📊',
                title: 'Workload Concentration',
                level: 'low',
                description: 'Most tasks are concentrated in one category, limiting flexibility',
                mitigation: 'Consider diversifying task types to maintain engagement'
            });
        }
        
        // Default risk if none found
        if (risks.length === 0) {
            risks.push({
                icon: '✅',
                title: 'Low Risk Profile',
                level: 'low',
                description: 'Task management is on track with no significant risks identified',
                mitigation: 'Continue current practices and monitor for changes'
            });
        }
        
        return risks;
    }
    
    /**
     * Generate optimization suggestions
     */
    generateOptimizations(tasks) {
        const optimizations = [];
        const completedTasks = tasks.filter(t => t.status === 'completed');
        
        // Time batching optimization
        const categoryTasks = {};
        tasks.forEach(task => {
            const category = task.category || 'general';
            if (!categoryTasks[category]) categoryTasks[category] = [];
            categoryTasks[category].push(task);
        });
        
        const multiCategoryDay = Object.keys(categoryTasks).length > 3;
        if (multiCategoryDay) {
            optimizations.push({
                impact: 'High',
                effort: 'Low',
                title: 'Time Batching',
                description: 'Group similar tasks together to reduce context switching and improve focus',
                benefits: ['+25% efficiency', 'Better focus', 'Less mental fatigue']
            });
        }
        
        // Template optimization
        const recurringPatterns = this.findRecurringPatterns(tasks);
        if (recurringPatterns.length > 0) {
            optimizations.push({
                impact: 'Medium',
                effort: 'Medium',
                title: 'Task Templates',
                description: 'Create templates for recurring tasks to speed up planning and ensure consistency',
                benefits: ['-30% planning time', 'Better consistency', 'Fewer missed steps']
            });
        }
        
        // Default optimization
        if (optimizations.length === 0) {
            optimizations.push({
                impact: 'Medium',
                effort: 'Low',
                title: 'Regular Reviews',
                description: 'Schedule weekly task reviews to identify patterns and improvement opportunities',
                benefits: ['Better planning', 'Increased awareness', 'Continuous improvement']
            });
        }
        
        return optimizations;
    }
    
    /**
     * Find recurring patterns in tasks
     */
    findRecurringPatterns(tasks) {
        const titleWords = {};
        tasks.forEach(task => {
            const words = task.title.toLowerCase().split(' ').filter(word => word.length > 3);
            words.forEach(word => {
                titleWords[word] = (titleWords[word] || 0) + 1;
            });
        });
        
        return Object.entries(titleWords)
            .filter(([word, count]) => count >= 3)
            .map(([word, count]) => ({ word, count }));
    }
    
    /**
     * Render recommendations tab
     */
    renderRecommendationsTab(container) {
        const recommendations = this.generatePersonalizedRecommendations();
        
        container.innerHTML = `
            <div class="recommendations-content">
                <div class="recommendations-header">
                    <h3>🎯 Personalized Insights</h3>
                    <p>AI-powered recommendations based on your task patterns</p>
                </div>
                
                <div class="recommendation-sections">
                    <div class="rec-section">
                        <h4>📈 Productivity Boosters</h4>
                        <div class="rec-cards">
                            ${recommendations.productivity.map(rec => `
                                <div class="rec-card ${rec.priority}">
                                    <div class="rec-header">
                                        <span class="rec-icon">${rec.icon}</span>
                                        <h5>${rec.title}</h5>
                                        <span class="rec-impact">${rec.impact}</span>
                                    </div>
                                    <p class="rec-description">${rec.description}</p>
                                    <div class="rec-actions">
                                        <button class="rec-action-btn" onclick="window.taskManager.implementRecommendation('${rec.id}')">
                                            Implement
                                        </button>
                                        <span class="rec-effort">${rec.effort}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="rec-section">
                        <h4>🧠 Focus Improvements</h4>
                        <div class="rec-cards">
                            ${recommendations.focus.map(rec => `
                                <div class="rec-card ${rec.priority}">
                                    <div class="rec-header">
                                        <span class="rec-icon">${rec.icon}</span>
                                        <h5>${rec.title}</h5>
                                        <span class="rec-impact">${rec.impact}</span>
                                    </div>
                                    <p class="rec-description">${rec.description}</p>
                                    <div class="rec-actions">
                                        <button class="rec-action-btn" onclick="window.taskManager.implementRecommendation('${rec.id}')">
                                            Try It
                                        </button>
                                        <span class="rec-effort">${rec.effort}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="rec-section">
                        <h4>⚡ Quick Wins</h4>
                        <div class="quick-wins">
                            ${recommendations.quickWins.map(win => `
                                <div class="quick-win-item">
                                    <span class="win-icon">${win.icon}</span>
                                    <span class="win-text">${win.text}</span>
                                    <button class="win-btn" onclick="window.taskManager.implementRecommendation('${win.id}')">
                                        Do It
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate personalized recommendations
     */
    generatePersonalizedRecommendations() {
        const state = this.dataManager.getState();
        const tasks = [...(state.tasks?.items?.values() || [])];
        const analytics = this.calculateTaskAnalytics();
        
        const productivity = [];
        const focus = [];
        const quickWins = [];
        
        // Productivity recommendations
        if (analytics.timeAccuracy < 70) {
            productivity.push({
                id: 'improve-time-estimation',
                icon: '⏱️',
                title: 'Improve Time Estimation',
                priority: 'high',
                impact: '+15% accuracy',
                effort: '5 min/task',
                description: 'Break down large tasks into smaller chunks for more accurate time estimates'
            });
        }
        
        if (analytics.completionRate < 60) {
            productivity.push({
                id: 'reduce-task-overload',
                icon: '📉',
                title: 'Reduce Task Overload',
                priority: 'high',
                impact: '+20% completion',
                effort: '10 min/week',
                description: 'Focus on fewer tasks at once to improve completion rates and reduce stress'
            });
        }
        
        // Focus recommendations
        if (analytics.focusScore < 6) {
            focus.push({
                id: 'implement-time-blocking',
                icon: '🕒',
                title: 'Time Blocking',
                priority: 'medium',
                impact: '+2 focus points',
                effort: '15 min setup',
                description: 'Dedicate specific time blocks to task categories to reduce context switching'
            });
        }
        
        const categories = Object.keys(analytics.categoryBreakdown).filter(cat => analytics.categoryBreakdown[cat] > 0);
        if (categories.length > 4) {
            focus.push({
                id: 'category-consolidation',
                icon: '🎯',
                title: 'Consolidate Categories',
                priority: 'low',
                impact: '+1 focus point',
                effort: '5 min',
                description: 'Reduce the number of active task categories to maintain better focus'
            });
        }
        
        // Quick wins
        quickWins.push({
            id: 'set-daily-goal',
            icon: '🎯',
            text: 'Set a daily completion goal based on your average',
            action: 'Set Goal'
        });
        
        if (tasks.filter(t => !t.category).length > 0) {
            quickWins.push({
                id: 'categorize-uncategorized',
                icon: '📊',
                text: 'Categorize your uncategorized tasks',
                action: 'Categorize'
            });
        }
        
        quickWins.push({
            id: 'review-overdue',
            icon: '⚠️',
            text: 'Review and reschedule overdue tasks',
            action: 'Review'
        });
        
        return {
            productivity,
            focus,
            quickWins
        };
    }
    
    /**
     * Implement a specific recommendation
     */
    implementRecommendation(recommendationId) {
        // This would implement specific recommendation actions
        console.log('Implementing recommendation:', recommendationId);
        this.showSuccessNotification('Recommendation implemented successfully!');
    }
    
    /**
     * Inject analytics dashboard styles
     */
    injectAnalyticsStyles() {
        const styleId = 'analytics-styles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .analytics-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .analytics-dialog {
                background: white;
                border-radius: 12px;
                width: 95vw;
                max-width: 1400px;
                height: 90vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
                overflow: hidden;
            }

            .analytics-header {
                padding: 20px 32px;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            .analytics-header h2 {
                margin: 0;
                font-size: 24px;
                font-weight: 600;
            }

            .close-analytics {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                padding: 8px 12px;
                border-radius: 8px;
                transition: background-color 0.2s;
            }

            .close-analytics:hover {
                background: rgba(255, 255, 255, 0.3);
            }

            .analytics-nav {
                display: flex;
                background: #f8fafc;
                border-bottom: 1px solid #e5e7eb;
                padding: 0 32px;
            }

            .nav-tab {
                background: none;
                border: none;
                padding: 16px 24px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                color: #64748b;
                border-bottom: 3px solid transparent;
                transition: all 0.2s;
            }

            .nav-tab:hover {
                color: #3b82f6;
                background: rgba(59, 130, 246, 0.05);
            }

            .nav-tab.active {
                color: #3b82f6;
                border-bottom-color: #3b82f6;
                background: rgba(59, 130, 246, 0.05);
            }

            .analytics-content {
                flex: 1;
                overflow-y: auto;
                padding: 32px;
                background: #f8fafc;
            }

            .tab-content {
                display: none;
            }

            .tab-content.active {
                display: block;
            }

            .analytics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 24px;
                margin-bottom: 32px;
            }

            .metric-card {
                background: white;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
                border: 1px solid #e5e7eb;
            }

            .metric-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
            }

            .metric-icon {
                font-size: 24px;
            }

            .metric-header h3 {
                margin: 0;
                font-size: 16px;
                color: #374151;
            }

            .metric-value {
                font-size: 32px;
                font-weight: bold;
                color: #1f2937;
                margin-bottom: 8px;
            }

            .metric-detail {
                display: flex;
                flex-direction: column;
                gap: 4px;
                font-size: 14px;
                color: #6b7280;
            }

            .trend.positive {
                color: #10b981;
            }

            .trend.negative {
                color: #ef4444;
            }

            .analytics-charts {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 32px;
            }

            .chart-section {
                background: white;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
                border: 1px solid #e5e7eb;
            }

            .chart-section h4 {
                margin: 0 0 20px 0;
                color: #374151;
            }

            .chart-container {
                height: 200px;
                display: flex;
                flex-direction: column;
            }

            .chart-bars {
                flex: 1;
                display: flex;
                align-items: end;
                gap: 2px;
                padding: 10px 0;
            }

            .chart-bar {
                background: linear-gradient(to top, #3b82f6, #60a5fa);
                border-radius: 2px 2px 0 0;
                min-height: 4px;
                transition: all 0.2s;
            }

            .chart-bar:hover {
                background: linear-gradient(to top, #2563eb, #3b82f6);
            }

            .chart-labels {
                display: flex;
                justify-content: space-between;
                padding-top: 10px;
                font-size: 12px;
                color: #6b7280;
            }

            .category-breakdown {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .category-item {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .category-info {
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 120px;
            }

            .category-bar {
                flex: 1;
                height: 8px;
                background: #f3f4f6;
                border-radius: 4px;
                overflow: hidden;
            }

            .category-fill {
                height: 100%;
                border-radius: 4px;
                transition: width 0.3s ease;
            }

            .category-percentage {
                min-width: 40px;
                text-align: right;
                font-weight: 500;
                color: #374151;
            }
        `;
        document.head.appendChild(styles);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskManager;
} else {
    window.TaskManager = TaskManager;
}