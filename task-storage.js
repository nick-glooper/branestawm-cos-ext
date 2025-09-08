// Branestawm - Task Storage
// Data persistence and task management operations

class TaskStorage {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }
    
    /**
     * Create a new task
     */
    async createTask(taskData) {
        const state = this.dataManager.getState();
        
        // Initialize tasks structure if needed
        if (!state.tasks) {
            state.tasks = {
                items: new Map(),
                nextId: 1
            };
        }
        
        const taskId = `task_${state.tasks.nextId++}`;
        const task = {
            id: taskId,
            title: taskData.text || taskData.title,
            description: taskData.description || '',
            category: taskData.category || 'general',
            status: 'pending',
            priority: taskData.priority || 'medium',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            dueDate: taskData.dueDate || null,
            folioId: taskData.folioId || null,
            messageId: taskData.messageId || null,
            templateApplied: taskData.templateApplied || null,
            timeTracking: {
                estimatedMinutes: taskData.estimatedMinutes || null,
                startedAt: null,
                completedAt: null,
                actualMinutes: null,
                accuracy: null
            },
            subtasks: taskData.subtasks || [],
            context: taskData.context || ''
        };
        
        state.tasks.items.set(taskId, task);
        await this.dataManager.saveData();
        
        return task;
    }
    
    /**
     * Update an existing task
     */
    async updateTask(taskId, updates) {
        const state = this.dataManager.getState();
        const task = state.tasks?.items.get(taskId);
        
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        
        // Apply updates
        Object.assign(task, updates);
        task.updatedAt = new Date().toISOString();
        
        await this.dataManager.saveData();
        return task;
    }
    
    /**
     * Delete a task
     */
    async deleteTask(taskId) {
        const state = this.dataManager.getState();
        const deleted = state.tasks?.items.delete(taskId);
        
        if (deleted) {
            await this.dataManager.saveData();
        }
        
        return deleted;
    }
    
    /**
     * Get a task by ID
     */
    getTask(taskId) {
        const state = this.dataManager.getState();
        return state.tasks?.items.get(taskId) || null;
    }
    
    /**
     * Get all tasks
     */
    getAllTasks() {
        const state = this.dataManager.getState();
        return Array.from(state.tasks?.items.values() || []);
    }
    
    /**
     * Get tasks filtered by criteria
     */
    getTasksBy(filters = {}) {
        const allTasks = this.getAllTasks();
        
        return allTasks.filter(task => {
            if (filters.status && task.status !== filters.status) return false;
            if (filters.category && task.category !== filters.category) return false;
            if (filters.folioId && task.folioId !== filters.folioId) return false;
            if (filters.priority && task.priority !== filters.priority) return false;
            if (filters.dueDate) {
                const taskDueDate = task.dueDate ? new Date(task.dueDate) : null;
                const filterDate = new Date(filters.dueDate);
                if (!taskDueDate || taskDueDate.toDateString() !== filterDate.toDateString()) {
                    return false;
                }
            }
            return true;
        });
    }
    
    /**
     * Get tasks for current folio
     */
    getCurrentFolioTasks() {
        const currentFolio = this.dataManager.getState('currentFolio');
        return this.getTasksBy({ folioId: currentFolio });
    }
    
    /**
     * Get overdue tasks
     */
    getOverdueTasks() {
        const now = new Date();
        const allTasks = this.getAllTasks();
        
        return allTasks.filter(task => {
            if (task.status === 'completed') return false;
            if (!task.dueDate) return false;
            
            const dueDate = new Date(task.dueDate);
            return dueDate < now;
        });
    }
    
    /**
     * Get tasks due today
     */
    getTodayTasks() {
        const today = new Date();
        const todayStr = today.toDateString();
        
        return this.getAllTasks().filter(task => {
            if (!task.dueDate) return false;
            const taskDate = new Date(task.dueDate);
            return taskDate.toDateString() === todayStr;
        });
    }
    
    /**
     * Get task statistics
     */
    getTaskStatistics() {
        const allTasks = this.getAllTasks();
        
        const stats = {
            total: allTasks.length,
            pending: 0,
            inProgress: 0,
            completed: 0,
            overdue: 0,
            byCategory: {},
            byPriority: {}
        };
        
        const now = new Date();
        
        allTasks.forEach(task => {
            // Status counts
            if (task.status === 'pending') stats.pending++;
            else if (task.status === 'in-progress') stats.inProgress++;
            else if (task.status === 'completed') stats.completed++;
            
            // Overdue count
            if (task.dueDate && task.status !== 'completed') {
                const dueDate = new Date(task.dueDate);
                if (dueDate < now) stats.overdue++;
            }
            
            // Category counts
            const category = task.category || 'general';
            stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
            
            // Priority counts
            const priority = task.priority || 'medium';
            stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
        });
        
        return stats;
    }
    
    /**
     * Mark task as completed
     */
    async completeTask(taskId) {
        return await this.updateTask(taskId, {
            status: 'completed',
            completedAt: new Date().toISOString()
        });
    }
    
    /**
     * Create multiple tasks from extraction
     */
    async createTasksFromExtraction(tasks, messageId, folioId) {
        const createdTasks = [];
        
        for (const taskData of tasks) {
            const task = await this.createTask({
                ...taskData,
                messageId,
                folioId
            });
            createdTasks.push(task);
        }
        
        return createdTasks;
    }
    
    /**
     * Apply template to task (update with template data)
     */
    async applyTemplateToTask(taskId, template) {
        const task = this.getTask(taskId);
        if (!task) return null;
        
        const updates = {
            templateApplied: template,
            subtasks: template.subtasks || [],
            category: template.category || task.category,
            timeTracking: {
                ...task.timeTracking,
                estimatedMinutes: this.parseEstimatedTime(template.estimatedTime)
            }
        };
        
        return await this.updateTask(taskId, updates);
    }
    
    /**
     * Parse estimated time from template string
     */
    parseEstimatedTime(timeString) {
        if (!timeString) return null;
        
        const text = timeString.toLowerCase();
        const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)/);
        const minuteMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)/);
        
        let totalMinutes = 0;
        
        if (hourMatch) {
            totalMinutes += parseFloat(hourMatch[1]) * 60;
        }
        
        if (minuteMatch) {
            totalMinutes += parseFloat(minuteMatch[1]);
        }
        
        return totalMinutes > 0 ? Math.round(totalMinutes) : null;
    }
    
    /**
     * Clean up old completed tasks (older than 30 days)
     */
    async cleanupOldTasks(daysOld = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        const allTasks = this.getAllTasks();
        let deletedCount = 0;
        
        for (const task of allTasks) {
            if (task.status === 'completed' && task.completedAt) {
                const completedDate = new Date(task.completedAt);
                if (completedDate < cutoffDate) {
                    await this.deleteTask(task.id);
                    deletedCount++;
                }
            }
        }
        
        return deletedCount;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskStorage;
} else {
    window.TaskStorage = TaskStorage;
}