// Branestawm - Folio Switcher
// Seamless folio switching with context carryover and LLM-initiated transitions

class FolioSwitcher {
    constructor() {
        if (FolioSwitcher.instance) {
            return FolioSwitcher.instance;
        }
        
        this.pendingSwitches = new Map();
        this.switchHistory = [];
        this.contextCarryover = new Map();
        
        this.initializeSwitchPatterns();
        this.setupEventListeners();
        
        FolioSwitcher.instance = this;
        console.log('FolioSwitcher initialized');
    }
    
    /**
     * Initialize patterns that trigger folio switch suggestions
     */
    initializeSwitchPatterns() {
        // Patterns that might indicate a need to switch context/folio
        this.switchTriggerPatterns = [
            // Direct switching requests
            {
                pattern: /(?:switch|move|change).*(?:folio|conversation|context|topic)/i,
                confidence: 0.9,
                type: 'direct_request'
            },
            {
                pattern: /(?:let's talk about|can we discuss|I want to focus on)/i,
                confidence: 0.7,
                type: 'topic_change'
            },
            
            // Work/project context switches
            {
                pattern: /(?:different project|another task|new work|other assignment)/i,
                confidence: 0.8,
                type: 'work_context'
            },
            {
                pattern: /(?:meeting about|project called|working on)/i,
                confidence: 0.6,
                type: 'project_mention'
            },
            
            // Personal context switches
            {
                pattern: /(?:personal matter|life stuff|non-work|outside work)/i,
                confidence: 0.7,
                type: 'personal_context'
            },
            
            // Learning/research context switches
            {
                pattern: /(?:learn about|research|study|understand)/i,
                confidence: 0.5,
                type: 'learning_context'
            },
            
            // Creative context switches
            {
                pattern: /(?:creative|brainstorm|ideas|writing|design)/i,
                confidence: 0.5,
                type: 'creative_context'
            }
        ];
        
        // LLM response patterns that suggest switching
        this.llmSwitchPatterns = [
            {
                pattern: /I (?:think|suggest|recommend) (?:we|you) should (?:switch|move|transition) to/i,
                confidence: 0.9,
                type: 'llm_suggestion'
            },
            {
                pattern: /This (?:might|would) be better (?:discussed|handled) in (?:a different|another)/i,
                confidence: 0.8,
                type: 'llm_context_suggestion'
            },
            {
                pattern: /(?:Would you like|Shall we) (?:switch|move|transition) to/i,
                confidence: 0.8,
                type: 'llm_offer'
            }
        ];
        
        // Folio matching patterns to suggest appropriate folios
        this.folioSuggestionPatterns = {
            work: ['work', 'project', 'meeting', 'professional', 'business', 'career'],
            personal: ['personal', 'life', 'family', 'friends', 'home', 'self'],
            learning: ['learn', 'study', 'research', 'course', 'education', 'knowledge'],
            creative: ['creative', 'art', 'design', 'writing', 'brainstorm', 'ideas'],
            technical: ['technical', 'coding', 'programming', 'development', 'software'],
            health: ['health', 'fitness', 'medical', 'wellness', 'exercise'],
            finance: ['finance', 'money', 'budget', 'investment', 'financial']
        };
    }
    
    /**
     * Setup event listeners for folio switching
     */
    setupEventListeners() {
        // Listen for message events to detect switch triggers
        document.addEventListener('message-sent', (event) => {
            this.analyzeMessageForSwitch(event.detail.message, 'user');
        });
        
        document.addEventListener('message-received', (event) => {
            this.analyzeMessageForSwitch(event.detail.message, 'assistant');
        });
        
        // Listen for folio changes to update context
        document.addEventListener('folio-changed', (event) => {
            this.handleFolioChange(event.detail);
        });
    }
    
    /**
     * Analyze message for potential folio switch triggers
     */
    analyzeMessageForSwitch(message, role) {
        if (!message || !message.content) return;
        
        const content = message.content;
        const patterns = role === 'user' ? this.switchTriggerPatterns : this.llmSwitchPatterns;
        
        for (const pattern of patterns) {
            if (pattern.pattern.test(content)) {
                this.handleSwitchTrigger({
                    message,
                    role,
                    pattern,
                    confidence: pattern.confidence,
                    type: pattern.type,
                    timestamp: Date.now()
                });
                break; // Only trigger on first match
            }
        }
    }
    
    /**
     * Handle a detected switch trigger
     */
    async handleSwitchTrigger(triggerInfo) {
        const { message, role, pattern, confidence, type } = triggerInfo;
        
        // Generate switch suggestions
        const suggestions = await this.generateSwitchSuggestions(message.content, type);
        
        if (suggestions.length > 0) {
            const switchId = this.generateSwitchId();
            
            this.pendingSwitches.set(switchId, {
                ...triggerInfo,
                suggestions,
                currentFolio: currentFolio,
                contextSnapshot: await this.createContextSnapshot()
            });
            
            // If LLM suggested the switch, show immediate options
            if (role === 'assistant' && confidence > 0.7) {
                this.showSwitchDialog(switchId, suggestions);
            }
            // For user messages, we might want to suggest in the next LLM response
            else if (role === 'user' && confidence > 0.8) {
                await this.addSwitchSuggestionToContext(switchId, suggestions);
            }
        }
    }
    
    /**
     * Generate folio switch suggestions based on content analysis
     */
    async generateSwitchSuggestions(content, triggerType) {
        const suggestions = [];
        const contentLower = content.toLowerCase();
        
        // Get available folios
        const folios = window.dataManager ? window.dataManager.getFolios() : {};
        const availableFolios = Object.entries(folios).filter(([id, folio]) => 
            id !== currentFolio && folio.title
        );
        
        if (availableFolios.length === 0) {
            return suggestions; // No other folios to switch to
        }
        
        // Score folios based on content relevance
        const scoredFolios = [];
        
        for (const [folioId, folio] of availableFolios) {
            let score = 0;
            const folioText = `${folio.title} ${folio.description || ''}`.toLowerCase();
            
            // Check for exact folio name mentions
            if (contentLower.includes(folio.title.toLowerCase())) {
                score += 50;
            }
            
            // Check folio suggestion patterns
            Object.entries(this.folioSuggestionPatterns).forEach(([category, keywords]) => {
                const keywordMatches = keywords.filter(keyword => 
                    contentLower.includes(keyword) || folioText.includes(keyword)
                ).length;
                score += keywordMatches * 5;
            });
            
            // Boost score for recent folios
            if (folio.lastUsed) {
                const daysSinceUsed = (Date.now() - new Date(folio.lastUsed).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceUsed < 7) {
                    score += Math.max(0, 10 - daysSinceUsed);
                }
            }
            
            // Boost score based on message count (more active folios)
            if (folio.messages && folio.messages.length > 0) {
                score += Math.min(5, folio.messages.length / 10);
            }
            
            if (score > 0) {
                scoredFolios.push({ folioId, folio, score });
            }
        }
        
        // Sort by score and take top suggestions
        scoredFolios.sort((a, b) => b.score - a.score);
        
        // Create suggestions with context carryover plans
        for (const { folioId, folio, score } of scoredFolios.slice(0, 3)) {
            const contextPlan = await this.planContextCarryover(currentFolio, folioId, content);
            
            suggestions.push({
                folioId,
                title: folio.title,
                description: folio.description || 'No description',
                relevanceScore: score,
                contextCarryover: contextPlan,
                reason: this.generateSuggestionReason(folio, triggerType, score)
            });
        }
        
        return suggestions;
    }
    
    /**
     * Plan context carryover between folios
     */
    async planContextCarryover(fromFolioId, toFolioId, triggerContent) {
        const plan = {
            includeRecentMessages: 0,
            includeSummary: false,
            bridgeMessage: null,
            contextExplanation: null
        };
        
        try {
            // Get recent messages from current folio
            const fromFolio = window.dataManager ? await window.dataManager.getFolio(fromFolioId) : null;
            if (fromFolio && fromFolio.messages && fromFolio.messages.length > 0) {
                const recentMessages = fromFolio.messages.slice(-5);
                
                // Include 2-3 recent messages if they're relevant to the switch
                plan.includeRecentMessages = Math.min(3, recentMessages.length);
                
                // Create a bridge message to explain the context switch
                plan.bridgeMessage = await this.createBridgeMessage(
                    fromFolio.title,
                    triggerContent,
                    recentMessages.slice(-2)
                );
                
                // Create context explanation for the new folio
                plan.contextExplanation = `Continuing our conversation from ${fromFolio.title}. ${plan.bridgeMessage}`;
            }
            
            // Include summary if available and conversation is long
            if (window.summarizationEngine && fromFolio && fromFolio.messages.length > 20) {
                plan.includeSummary = true;
            }
            
        } catch (error) {
            console.error('Error planning context carryover:', error);
        }
        
        return plan;
    }
    
    /**
     * Create a bridge message to explain the context switch
     */
    async createBridgeMessage(fromFolioTitle, triggerContent, recentMessages) {
        const recentContext = recentMessages.map(msg => 
            `${msg.role === 'user' ? 'You' : 'I'}: ${msg.content.substring(0, 100)}...`
        ).join('\n');
        
        return `We were discussing: "${recentContext}" 
        
You mentioned: "${triggerContent.substring(0, 150)}..."
        
I'm continuing our conversation here to better focus on this topic.`;
    }
    
    /**
     * Generate reason for suggesting a folio switch
     */
    generateSuggestionReason(folio, triggerType, score) {
        const reasons = {
            direct_request: `You asked to switch contexts`,
            topic_change: `This seems like a different topic that might fit better in "${folio.title}"`,
            work_context: `This appears to be work-related and "${folio.title}" might be more appropriate`,
            personal_context: `This seems personal and might be better discussed in "${folio.title}"`,
            learning_context: `This looks like a learning topic that could benefit from "${folio.title}"`,
            creative_context: `This creative discussion might work better in "${folio.title}"`,
            llm_suggestion: `I think "${folio.title}" would be better for this discussion`,
            llm_context_suggestion: `"${folio.title}" seems more suitable for this topic`
        };
        
        return reasons[triggerType] || `"${folio.title}" might be relevant for this discussion`;
    }
    
    /**
     * Show folio switch dialog to user
     */
    showSwitchDialog(switchId, suggestions) {
        // Create modal dialog
        const modal = document.createElement('div');
        modal.className = 'modal folio-switch-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'switchModalTitle');
        modal.setAttribute('aria-modal', 'true');
        
        modal.innerHTML = `
            <div class="modal-content small">
                <div class="modal-header">
                    <h3 id="switchModalTitle">🔄 Switch Conversation</h3>
                    <button class="close-btn" aria-label="Close switch dialog">×</button>
                </div>
                <div class="modal-body">
                    <p class="help-text">I think this conversation might work better in a different folio. Would you like to switch?</p>
                    
                    <div class="folio-suggestions">
                        ${suggestions.map(suggestion => `
                            <div class="folio-suggestion" data-folio-id="${suggestion.folioId}">
                                <div class="suggestion-header">
                                    <h4>${suggestion.title}</h4>
                                    <span class="relevance-score">${Math.round(suggestion.relevanceScore)}%</span>
                                </div>
                                <p class="suggestion-reason">${suggestion.reason}</p>
                                <p class="suggestion-description">${suggestion.description}</p>
                                ${suggestion.contextCarryover.includeRecentMessages > 0 ? 
                                    `<small class="context-note">Will carry over ${suggestion.contextCarryover.includeRecentMessages} recent messages</small>` : ''
                                }
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn secondary" id="cancelSwitchBtn">Stay Here</button>
                    <button class="btn" id="confirmSwitchBtn" disabled>Switch</button>
                </div>
            </div>
        `;
        
        // Add to DOM
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
        // Setup event listeners
        this.setupSwitchDialogEvents(modal, switchId, suggestions);
    }
    
    /**
     * Setup event listeners for switch dialog
     */
    setupSwitchDialogEvents(modal, switchId, suggestions) {
        const confirmBtn = modal.querySelector('#confirmSwitchBtn');
        const cancelBtn = modal.querySelector('#cancelSwitchBtn');
        const closeBtn = modal.querySelector('.close-btn');
        const suggestionElements = modal.querySelectorAll('.folio-suggestion');
        
        let selectedSuggestion = null;
        
        // Suggestion selection
        suggestionElements.forEach(element => {
            element.addEventListener('click', () => {
                suggestionElements.forEach(el => el.classList.remove('selected'));
                element.classList.add('selected');
                
                const folioId = element.dataset.folioId;
                selectedSuggestion = suggestions.find(s => s.folioId === folioId);
                confirmBtn.disabled = false;
            });
        });
        
        // Confirm switch
        confirmBtn.addEventListener('click', async () => {
            if (selectedSuggestion) {
                await this.executeSwitch(switchId, selectedSuggestion);
                modal.remove();
            }
        });
        
        // Cancel/close
        const closeDialog = () => {
            this.pendingSwitches.delete(switchId);
            modal.remove();
        };
        
        cancelBtn.addEventListener('click', closeDialog);
        closeBtn.addEventListener('click', closeDialog);
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeDialog();
            }
        });
        
        // Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }
    
    /**
     * Execute the folio switch with context carryover
     */
    async executeSwitch(switchId, selectedSuggestion) {
        const switchInfo = this.pendingSwitches.get(switchId);
        if (!switchInfo) return;
        
        try {
            const { folioId, contextCarryover } = selectedSuggestion;
            const fromFolioId = switchInfo.currentFolio;
            
            // Record the switch in history
            this.switchHistory.push({
                fromFolioId,
                toFolioId: folioId,
                timestamp: Date.now(),
                triggerType: switchInfo.type,
                contextCarried: !!contextCarryover.bridgeMessage
            });
            
            // Switch to the target folio
            await this.switchToFolio(folioId);
            
            // Add context carryover message if planned
            if (contextCarryover.bridgeMessage) {
                await this.addContextCarryoverMessage(folioId, contextCarryover, switchInfo);
            }
            
            // Clean up
            this.pendingSwitches.delete(switchId);
            
            // Show confirmation message
            this.showSwitchConfirmation(selectedSuggestion.title);
            
        } catch (error) {
            console.error('Error executing folio switch:', error);
            if (window.errorManager) {
                window.errorManager.handleError({
                    type: 'folio_switch_error',
                    message: error.message,
                    details: { switchId, selectedSuggestion }
                });
            }
        }
    }
    
    /**
     * Switch to a specific folio
     */
    async switchToFolio(folioId) {
        // This integrates with the existing folio switching mechanism
        if (window.switchFolio) {
            await window.switchFolio(folioId);
        } else {
            // Fallback method
            currentFolio = folioId;
            document.dispatchEvent(new CustomEvent('folio-changed', {
                detail: { folioId, source: 'folio_switcher' }
            }));
        }
    }
    
    /**
     * Add context carryover message to the new folio
     */
    async addContextCarryoverMessage(folioId, contextCarryover, switchInfo) {
        if (!contextCarryover.contextExplanation) return;
        
        // Add a system-style message explaining the context
        const contextMessage = {
            id: generateId(),
            role: 'system',
            content: `🔄 **Context Switch**\n\n${contextCarryover.contextExplanation}`,
            timestamp: new Date().toISOString(),
            metadata: {
                type: 'context_carryover',
                fromFolio: switchInfo.currentFolio,
                switchType: switchInfo.type
            }
        };
        
        if (window.addMessage) {
            await window.addMessage(folioId, 'system', contextMessage.content);
        }
    }
    
    /**
     * Show switch confirmation message
     */
    showSwitchConfirmation(folioTitle) {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.className = 'switch-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">🔄</span>
                <span class="notification-text">Switched to ${folioTitle}</span>
            </div>
        `;
        
        // Add styles if not already present
        if (!document.querySelector('#folio-switch-styles')) {
            const styles = document.createElement('style');
            styles.id = 'folio-switch-styles';
            styles.textContent = `
                .folio-switch-modal .folio-suggestion {
                    padding: var(--space-3);
                    border: 1px solid var(--border-primary);
                    border-radius: var(--radius-md);
                    margin-bottom: var(--space-2);
                    cursor: pointer;
                    transition: all var(--transition-fast);
                }
                
                .folio-switch-modal .folio-suggestion:hover {
                    border-color: var(--primary);
                    background: var(--surface-secondary);
                }
                
                .folio-switch-modal .folio-suggestion.selected {
                    border-color: var(--primary);
                    background: var(--primary-light);
                }
                
                .folio-switch-modal .suggestion-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--space-1);
                }
                
                .folio-switch-modal .suggestion-header h4 {
                    margin: 0;
                    color: var(--text-primary);
                }
                
                .folio-switch-modal .relevance-score {
                    background: var(--success);
                    color: white;
                    padding: var(--space-1) var(--space-2);
                    border-radius: var(--radius-full);
                    font-size: var(--text-xs);
                    font-weight: 600;
                }
                
                .folio-switch-modal .suggestion-reason {
                    color: var(--text-accent);
                    font-weight: 500;
                    margin: var(--space-1) 0;
                }
                
                .folio-switch-modal .suggestion-description {
                    color: var(--text-secondary);
                    font-size: var(--text-sm);
                    margin: 0;
                }
                
                .folio-switch-modal .context-note {
                    color: var(--text-tertiary);
                    font-style: italic;
                    margin-top: var(--space-1);
                    display: block;
                }
                
                .switch-notification {
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    background: var(--success);
                    color: white;
                    padding: var(--space-3) var(--space-4);
                    border-radius: var(--radius-md);
                    box-shadow: var(--shadow-lg);
                    z-index: 10000;
                    animation: slideIn 0.3s ease-out;
                }
                
                .switch-notification .notification-content {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                }
                
                .switch-notification .notification-icon {
                    font-size: 1.2em;
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
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    /**
     * Create context snapshot for potential carryover
     */
    async createContextSnapshot() {
        const snapshot = {
            folioId: currentFolio,
            timestamp: Date.now(),
            recentMessages: [],
            summary: null
        };
        
        try {
            const folio = window.dataManager ? await window.dataManager.getFolio(currentFolio) : null;
            if (folio && folio.messages) {
                snapshot.recentMessages = folio.messages.slice(-5);
            }
            
            // Get summary if available
            if (window.summarizationEngine) {
                const summaryContext = await window.summarizationEngine.getOptimalContext(currentFolio, '', 1000);
                if (summaryContext && summaryContext.summaries) {
                    snapshot.summary = summaryContext.summaries[0];
                }
            }
        } catch (error) {
            console.error('Error creating context snapshot:', error);
        }
        
        return snapshot;
    }
    
    /**
     * Handle folio change events
     */
    handleFolioChange(changeInfo) {
        // Clear any pending switches when folio changes
        this.pendingSwitches.clear();
        
        // Store context carryover if needed
        if (changeInfo.source !== 'folio_switcher') {
            // This was a manual switch, not one initiated by us
            this.contextCarryover.set(changeInfo.folioId, {
                timestamp: Date.now(),
                source: changeInfo.source
            });
        }
    }
    
    /**
     * Generate unique switch ID
     */
    generateSwitchId() {
        return `switch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Add switch suggestion to LLM context (for user-triggered switches)
     */
    async addSwitchSuggestionToContext(switchId, suggestions) {
        // This could be implemented to add folio switch suggestions to the next LLM response
        // For now, we'll store it for potential use
        console.log('Switch suggestion available for next LLM response:', { switchId, suggestions });
    }
    
    /**
     * Get switch statistics and history
     */
    getSwitchStatistics() {
        return {
            totalSwitches: this.switchHistory.length,
            recentSwitches: this.switchHistory.slice(-10),
            pendingSwitches: this.pendingSwitches.size,
            mostCommonTrigger: this.getMostCommonTrigger(),
            averageSwitchesPerDay: this.getAverageSwitchesPerDay()
        };
    }
    
    /**
     * Get most common switch trigger
     */
    getMostCommonTrigger() {
        const triggers = this.switchHistory.map(s => s.triggerType);
        const frequency = {};
        triggers.forEach(trigger => frequency[trigger] = (frequency[trigger] || 0) + 1);
        return Object.keys(frequency).reduce((a, b) => frequency[a] > frequency[b] ? a : b, null);
    }
    
    /**
     * Get average switches per day
     */
    getAverageSwitchesPerDay() {
        if (this.switchHistory.length === 0) return 0;
        
        const oldestSwitch = Math.min(...this.switchHistory.map(s => s.timestamp));
        const daysSinceOldest = (Date.now() - oldestSwitch) / (1000 * 60 * 60 * 24);
        
        return this.switchHistory.length / Math.max(1, daysSinceOldest);
    }
    
    /**
     * Cleanup and destroy folio switcher
     */
    cleanup() {
        // Clear all data structures
        this.pendingSwitches.clear();
        this.switchHistory.length = 0;
        this.contextCarryover.clear();
        
        // Remove event listeners
        document.removeEventListener('message-sent', this.analyzeMessageForSwitch);
        document.removeEventListener('message-received', this.analyzeMessageForSwitch);
        document.removeEventListener('folio-changed', this.handleFolioChange);
        
        console.log('FolioSwitcher cleaned up');
    }
}

// Global instance
window.folioSwitcher = new FolioSwitcher();