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
        
        this.pendingTaskConfirmation = {
            tasks,
            messageId,
            folioId,
            timestamp: Date.now()
        };
        
        // Create and show confirmation UI
        this.createTaskConfirmationUI(tasks);
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
                            ${tasks.map((task, index) => `
                                <div class="detected-task" data-task-index="${index}">
                                    <div class="task-text">"${task.text}"</div>
                                    ${task.extractedDate ? `<div class="task-suggested-date">Suggested: ${task.extractedDate.raw}</div>` : ''}
                                </div>
                            `).join('')}
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
            const newTask = {
                id: taskId,
                text: task.text,
                dueDate: selection.date,
                category: this.categorizeTaskByDate(selection.date),
                priority: this.calculatePriorityFromDate(selection.date),
                sourceConversation: messageId,
                folio: folioId,
                persona: this.dataManager.getState().currentPersona || 'core',
                status: 'pending',
                created: new Date(),
                lastReviewed: new Date(),
                originalContext: task.context
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
            state.tasks.timeline[task.category].add(task.id);
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
                    
                    timelineHTML += `
                        <div class="timeline-task ${priorityClass}" data-task-id="${task.id}">
                            <div class="task-main">
                                <div class="task-content">
                                    <h4 class="task-title">${this.escapeHTML(task.title)}</h4>
                                    <p class="task-description">${this.escapeHTML(task.description || '')}</p>
                                </div>
                                <div class="task-meta">
                                    <span class="task-due-date">${dueDateText}</span>
                                    <span class="task-priority">Priority: ${task.priority || 0}</span>
                                </div>
                            </div>
                            <div class="task-actions">
                                <button class="task-complete-btn" title="Mark Complete">✓</button>
                                <button class="task-plan-btn" title="Plan This Task">📋</button>
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
        overlay.querySelectorAll('.task-complete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const taskId = e.target.closest('.timeline-task').dataset.taskId;
                this.completeTask(taskId);
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskManager;
} else {
    window.TaskManager = TaskManager;
}