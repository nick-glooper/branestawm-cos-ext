// Branestawm - Task Manager (Refactored)
// Coordinating class that integrates all task management modules

class TaskManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        
        // Initialize component modules
        this.extractor = new TaskExtractor();
        this.templates = new TaskTemplates();
        this.storage = new TaskStorage(dataManager);
        this.scheduler = new TaskScheduler(dataManager);
        this.renderer = new TaskRenderer();
        
        this.pendingTaskConfirmation = null;
        this.setupEventListeners();
        
        logger.info('TaskManager initialized with modular architecture');
    }
    
    /**
     * Main entry point for processing chat messages
     */
    async processMessage(messageContent, messageId, folioId) {
        // Extract potential tasks from message
        const potentialTasks = this.extractor.extractPotentialTasks(messageContent);
        
        if (potentialTasks.length > 0) {
            await this.showTaskConfirmation(potentialTasks, messageId, folioId);
        }
    }
    
    /**
     * Show task confirmation dialog
     */
    async showTaskConfirmation(tasks, messageId, folioId) {
        // Enhance tasks with templates and category info
        const tasksWithTemplates = tasks.map(task => ({
            ...task,
            templates: this.templates.detectTaskTemplates(task.text, task.context),
            category: this.extractor.categorizeTask(task.text, task.context)
        }));
        
        this.pendingTaskConfirmation = {
            tasks: tasksWithTemplates,
            messageId,
            folioId,
            timestamp: Date.now()
        };
        
        // Create and show confirmation UI
        const dialog = this.renderer.createTaskConfirmationUI(tasksWithTemplates, this.extractor);
        
        // Setup event listeners
        this.renderer.setupTaskConfirmationListeners(
            dialog,
            () => this.proceedWithTaskCreation(),
            () => this.cancelTaskCreation(),
            (taskIndex, templateIndex) => this.applyTemplateToTask(taskIndex, templateIndex)
        );
    }
    
    /**
     * Apply template to a task in the confirmation dialog
     */
    applyTemplateToTask(taskIndex, templateIndex) {
        if (!this.pendingTaskConfirmation) return;
        
        const task = this.pendingTaskConfirmation.tasks[taskIndex];
        const template = task.templates[templateIndex];
        
        if (task && template) {
            // Update task with template data
            task.templateApplied = template;
            task.estimatedMinutes = this.scheduler.parseTimeEstimate(template.estimatedTime);
            task.category = template.category || task.category;
            task.subtasks = template.subtasks || [];
            
            // Update UI to show template was applied
            const taskElement = document.querySelector(`[data-task-index="${taskIndex}"]`);
            if (taskElement) {
                const templateBtn = taskElement.querySelector(`[data-template-index="${templateIndex}"]`);
                if (templateBtn) {
                    templateBtn.textContent = '✓ Applied';
                    templateBtn.style.background = '#10b981';
                }
            }
        }
    }
    
    /**
     * Proceed with creating tasks from confirmation
     */
    async proceedWithTaskCreation() {
        if (!this.pendingTaskConfirmation) return;
        
        const { tasks, messageId, folioId } = this.pendingTaskConfirmation;
        const createdTasks = [];
        
        try {
            for (const taskData of tasks) {
                // Create task with all the enriched data
                const task = await this.storage.createTask({
                    text: taskData.text,
                    category: taskData.category,
                    templateApplied: taskData.templateApplied,
                    estimatedMinutes: taskData.estimatedMinutes,
                    subtasks: taskData.subtasks || [],
                    context: taskData.context,
                    messageId,
                    folioId,
                    dueDate: taskData.extractedDate ? this.scheduler.parseDate(taskData.extractedDate.raw) : null
                });
                
                createdTasks.push(task);
            }
            
            // Trigger UI updates
            this.triggerTaskListUpdate();
            
            logger.info(`Created ${createdTasks.length} tasks from message extraction`);
            
        } catch (error) {
            logger.error('Error creating tasks:', error);
        }
        
        this.pendingTaskConfirmation = null;
    }
    
    /**
     * Cancel task creation
     */
    cancelTaskCreation() {
        this.pendingTaskConfirmation = null;
    }
    
    /**
     * Start a task timer
     */
    async startTask(taskId) {
        return await this.scheduler.startTaskTimer(taskId);
    }
    
    /**
     * Complete a task
     */
    async completeTask(taskId) {
        return await this.scheduler.completeTaskWithTracking(taskId);
    }
    
    /**
     * Get all tasks
     */
    getAllTasks() {
        return this.storage.getAllTasks();
    }
    
    /**
     * Get tasks by filter
     */
    getTasksBy(filters) {
        return this.storage.getTasksBy(filters);
    }
    
    /**
     * Get task statistics
     */
    getTaskStatistics() {
        return this.storage.getTaskStatistics();
    }
    
    /**
     * Delete a task
     */
    async deleteTask(taskId) {
        return await this.storage.deleteTask(taskId);
    }
    
    /**
     * Update a task
     */
    async updateTask(taskId, updates) {
        return await this.storage.updateTask(taskId, updates);
    }
    
    /**
     * Render task timeline in specified container
     */
    renderTaskTimeline(containerId) {
        const tasks = this.storage.getAllTasks();
        this.renderer.renderTaskTimeline(tasks, containerId);
    }
    
    /**
     * Setup event listeners for task management
     */
    setupEventListeners() {
        // Listen for task action buttons (delegated event handling)
        document.addEventListener('click', (e) => {
            if (e.target.matches('.btn-start')) {
                const taskId = e.target.dataset.taskId;
                this.startTask(taskId);
            } else if (e.target.matches('.btn-complete')) {
                const taskId = e.target.dataset.taskId;
                this.completeTask(taskId);
            } else if (e.target.matches('.btn-delete')) {
                const taskId = e.target.dataset.taskId;
                this.deleteTask(taskId);
            }
        });
        
        // Listen for custom events
        document.addEventListener('taskListNeedsUpdate', () => {
            this.triggerTaskListUpdate();
        });
    }
    
    /**
     * Trigger task list UI update
     */
    triggerTaskListUpdate() {
        // Refresh any visible task lists
        const taskContainers = document.querySelectorAll('[data-task-container]');
        taskContainers.forEach(container => {
            this.renderTaskTimeline(container.id);
        });
        
        // Dispatch custom event for other components
        document.dispatchEvent(new CustomEvent('tasksUpdated', {
            detail: { tasks: this.getAllTasks() }
        }));
    }
    
    /**
     * Get time estimate with learning improvements
     */
    getImprovedTimeEstimate(category, templateType, originalEstimate) {
        return this.scheduler.getImprovedTimeEstimate(category, templateType, originalEstimate);
    }
    
    /**
     * Clean up old completed tasks
     */
    async cleanupOldTasks(daysOld = 30) {
        return await this.storage.cleanupOldTasks(daysOld);
    }
    
    /**
     * Export tasks data
     */
    exportTasks() {
        const tasks = this.getAllTasks();
        const statistics = this.getTaskStatistics();
        
        return {
            tasks,
            statistics,
            exportedAt: new Date().toISOString(),
            version: '2.0'
        };
    }
    
    /**
     * Get overdue tasks
     */
    getOverdueTasks() {
        return this.storage.getOverdueTasks();
    }
    
    /**
     * Get today's tasks
     */
    getTodayTasks() {
        return this.storage.getTodayTasks();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskManager;
} else {
    window.TaskManager = TaskManager;
}