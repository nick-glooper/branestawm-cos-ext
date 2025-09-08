// Branestawm - Task Renderer
// UI rendering and DOM manipulation for tasks

class TaskRenderer {
    constructor() {
        this.pendingConfirmation = null;
    }
    
    /**
     * Create task confirmation UI
     */
    createTaskConfirmationUI(tasks, extractor) {
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
                                const categoryInfo = extractor.getCategoryInfo(task.category || 'general');
                                const hasTemplates = task.templates && task.templates.length > 0;
                                
                                return `
                                    <div class="detected-task" data-task-index="${index}">
                                        <div class="task-main">
                                            <div class="task-header">
                                                <div class="task-category-small" style="color: ${SecurityUtils.sanitizeColor(categoryInfo.color)};">
                                                    ${SecurityUtils.escapeHtml(categoryInfo.icon)} ${SecurityUtils.escapeHtml(categoryInfo.name)}
                                                </div>
                                                <div class="task-confidence">
                                                    ${Math.round(task.confidence * 100)}% confident
                                                </div>
                                            </div>
                                            <div class="task-text">"${SecurityUtils.escapeHtml(task.text)}"</div>
                                            ${task.extractedDate ? `<div class="task-suggested-date">Suggested: ${SecurityUtils.escapeHtml(task.extractedDate.raw)}</div>` : ''}
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
                                                                    <span class="template-icon">${SecurityUtils.escapeHtml(template.icon)}</span>
                                                                    <span class="template-name">${SecurityUtils.escapeHtml(template.name)}</span>
                                                                </div>
                                                                <div class="template-description">${SecurityUtils.escapeHtml(template.description)}</div>
                                                                <div class="template-time">${SecurityUtils.escapeHtml(template.estimatedTime)}</div>
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
        
        return dialog;
    }
    
    /**
     * Setup task confirmation event listeners
     */
    setupTaskConfirmationListeners(dialog, onConfirm, onIgnore, onTemplateUse) {
        const closeBtn = dialog.querySelector('.close-btn');
        const ignoreBtn = dialog.querySelector('#ignoreTaskBtn');
        const confirmBtn = dialog.querySelector('#confirmTaskBtn');
        const overlay = dialog.querySelector('.task-confirmation-overlay');
        
        // Close dialog handlers
        const closeDialog = () => {
            this.removeTaskConfirmationUI();
            this.pendingConfirmation = null;
            if (onIgnore) onIgnore();
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
                if (onTemplateUse) onTemplateUse(taskIndex, templateIndex);
            });
        });
        
        // Confirm tasks
        confirmBtn?.addEventListener('click', () => {
            if (onConfirm) onConfirm();
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
     * Remove task confirmation UI
     */
    removeTaskConfirmationUI() {
        const existing = document.querySelector('.task-confirmation-dialog');
        if (existing) {
            existing.remove();
        }
    }
    
    /**
     * Inject task confirmation styles
     */
    injectTaskConfirmationStyles() {
        const styleId = 'task-confirmation-styles';
        if (document.getElementById(styleId)) return;
        
        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .task-confirmation-dialog {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .task-confirmation-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }

            .task-confirmation-content {
                background: white;
                border-radius: 16px;
                max-width: 600px;
                width: 100%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            }

            .task-confirmation-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 24px 24px 0 24px;
            }

            .task-confirmation-header h3 {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                color: #1f2937;
            }

            .close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #6b7280;
                padding: 4px;
                border-radius: 4px;
                transition: all 0.2s;
            }

            .close-btn:hover {
                background: #f3f4f6;
                color: #374151;
            }

            .task-confirmation-body {
                padding: 20px 24px 24px 24px;
            }

            .task-confirmation-body > p {
                margin: 0 0 16px 0;
                color: #4b5563;
                font-size: 16px;
            }

            .detected-task {
                background: #f9fafb;
                border: 1px solid #e5e7eb;
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 12px;
            }

            .task-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 8px;
            }

            .task-category-small {
                font-size: 14px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .task-confidence {
                font-size: 12px;
                color: #6b7280;
                background: #e5e7eb;
                padding: 2px 8px;
                border-radius: 12px;
            }

            .task-text {
                font-size: 16px;
                color: #1f2937;
                font-weight: 500;
                margin-bottom: 8px;
            }

            .task-suggested-date {
                font-size: 14px;
                color: #059669;
                background: #d1fae5;
                padding: 4px 8px;
                border-radius: 6px;
                display: inline-block;
            }

            .task-templates {
                margin-top: 16px;
                border-top: 1px solid #e5e7eb;
                padding-top: 16px;
            }

            .templates-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
            }

            .templates-label {
                font-size: 14px;
                font-weight: 600;
                color: #374151;
            }

            .template-suggestion {
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .template-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 4px;
            }

            .template-name {
                font-weight: 600;
                color: #1f2937;
            }

            .template-description {
                font-size: 14px;
                color: #6b7280;
                margin-bottom: 4px;
            }

            .template-time {
                font-size: 12px;
                color: #7c3aed;
                background: #ede9fe;
                padding: 2px 6px;
                border-radius: 4px;
            }

            .template-use-btn {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                font-weight: 500;
                transition: background 0.2s;
            }

            .template-use-btn:hover {
                background: #2563eb;
            }

            .task-confirmation-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
                margin-top: 24px;
                padding-top: 16px;
                border-top: 1px solid #e5e7eb;
            }

            .task-confirmation-actions .btn {
                padding: 10px 20px;
                border-radius: 8px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                border: 1px solid transparent;
            }

            .task-confirmation-actions .btn.secondary {
                background: #f3f4f6;
                color: #374151;
                border-color: #d1d5db;
            }

            .task-confirmation-actions .btn.secondary:hover {
                background: #e5e7eb;
            }

            .task-confirmation-actions .btn.primary {
                background: #3b82f6;
                color: white;
            }

            .task-confirmation-actions .btn.primary:hover {
                background: #2563eb;
            }

            /* Task highlight animation */
            .task-highlighted {
                animation: task-highlight 3s ease-in-out;
                background: linear-gradient(90deg, #fef3c7, #fbbf24, #fef3c7);
                background-size: 200% 200%;
                border: 2px solid #f59e0b;
                border-radius: 8px;
                transition: all 0.3s ease;
            }

            @keyframes task-highlight {
                0% {
                    background-position: 0% 50%;
                    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
                }
                25% {
                    background-position: 100% 50%;
                    box-shadow: 0 0 0 10px rgba(245, 158, 11, 0.3);
                }
                50% {
                    background-position: 0% 50%;
                    box-shadow: 0 0 0 15px rgba(245, 158, 11, 0.2);
                }
                75% {
                    background-position: 100% 50%;
                    box-shadow: 0 0 0 10px rgba(245, 158, 11, 0.1);
                }
                100% {
                    background-position: 0% 50%;
                    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
                }
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    /**
     * Render task list in timeline
     */
    renderTaskTimeline(tasks, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const tasksByStatus = {
            pending: tasks.filter(t => t.status === 'pending'),
            'in-progress': tasks.filter(t => t.status === 'in-progress'),
            completed: tasks.filter(t => t.status === 'completed')
        };
        
        container.innerHTML = `
            <div class="task-timeline">
                ${Object.entries(tasksByStatus).map(([status, statusTasks]) => `
                    <div class="task-status-group" data-status="${status}">
                        <h3 class="status-header">${this.formatStatusHeader(status)} (${statusTasks.length})</h3>
                        <div class="task-list">
                            ${statusTasks.map(task => this.renderTaskItem(task)).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    /**
     * Render individual task item
     */
    renderTaskItem(task) {
        const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '';
        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
        
        return `
            <div class="task-item" data-task-id="${SecurityUtils.escapeHtml(task.id)}">
                <div class="task-content">
                    <div class="task-title">${SecurityUtils.escapeHtml(task.title)}</div>
                    ${task.description ? `<div class="task-description">${SecurityUtils.escapeHtml(task.description)}</div>` : ''}
                    <div class="task-meta">
                        <span class="task-category">${SecurityUtils.escapeHtml(task.category)}</span>
                        ${dueDate ? `<span class="task-due-date ${isOverdue ? 'overdue' : ''}">${dueDate}</span>` : ''}
                        ${task.timeTracking?.estimatedMinutes ? `<span class="task-estimate">${this.formatDuration(task.timeTracking.estimatedMinutes)}</span>` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    ${task.status === 'pending' ? `<button class="btn-start" data-task-id="${SecurityUtils.escapeHtml(task.id)}">Start</button>` : ''}
                    ${task.status === 'in-progress' ? `<button class="btn-complete" data-task-id="${SecurityUtils.escapeHtml(task.id)}">Complete</button>` : ''}
                    <button class="btn-delete" data-task-id="${SecurityUtils.escapeHtml(task.id)}">Delete</button>
                </div>
            </div>
        `;
    }
    
    /**
     * Format status header
     */
    formatStatusHeader(status) {
        const statusMap = {
            'pending': '📋 Pending',
            'in-progress': '⚡ In Progress', 
            'completed': '✅ Completed'
        };
        return statusMap[status] || status;
    }
    
    /**
     * Scroll to and highlight a specific task
     */
    scrollToAndHighlightTask(taskId) {
        const taskElement = document.querySelector(`[data-task-id="${taskId}"]`);
        
        if (taskElement) {
            // Scroll the task into view
            taskElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
            
            // Add highlight effect
            taskElement.classList.add('task-highlighted');
            
            // Remove highlight after a few seconds
            setTimeout(() => {
                taskElement.classList.remove('task-highlighted');
            }, 3000);
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Format duration for display
     */
    formatDuration(minutes) {
        if (!minutes || minutes <= 0) return '';
        
        if (minutes < 60) {
            return `${minutes}m`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            if (remainingMinutes === 0) {
                return `${hours}h`;
            } else {
                return `${hours}h ${remainingMinutes}m`;
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskRenderer;
} else {
    window.TaskRenderer = TaskRenderer;
}