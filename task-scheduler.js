// Branestawm - Task Scheduler
// Date/time handling, scheduling, and time tracking functionality

class TaskScheduler {
    constructor(dataManager) {
        this.dataManager = dataManager;
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
                const accuracy = Math.max(0, 1 - Math.abs(actualMinutes - estimated) / estimated);
                task.timeTracking.accuracy = Math.round(accuracy * 100) / 100;
            }
            
            // Record learning data for future estimates
            this.recordTimeEstimateData(task);
        }
        
        await this.dataManager.saveData();
        this.triggerTimelineUIUpdate();
        
        return true;
    }
    
    /**
     * Record time estimate data for machine learning
     */
    recordTimeEstimateData(task) {
        if (!task.timeTracking?.estimatedMinutes || !task.timeTracking?.actualMinutes) {
            return;
        }
        
        const state = this.dataManager.getState();
        
        // Initialize learning data structure
        if (!state.taskLearning) {
            state.taskLearning = {
                timeEstimates: {
                    byCategory: {},
                    byTemplate: {},
                    overallStats: {
                        totalTasks: 0,
                        averageAccuracy: 0,
                        lastUpdated: null
                    }
                }
            };
        }
        
        const learning = state.taskLearning.timeEstimates;
        const category = task.category || 'general';
        const templateType = task.templateApplied?.type || 'general';
        
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
        
        // Apply gradual adjustment based on confidence
        const finalRatio = 1.0 + (adjustmentRatio - 1.0) * confidence;
        const adjustedEstimate = Math.round(originalEstimate * finalRatio);
        
        return {
            original: originalEstimate,
            adjusted: adjustedEstimate,
            confidence: confidence,
            learningSource: confidence > 0 ? (learning.byTemplate[templateType] ? 'template' : 'category') : 'none'
        };
    }
    
    /**
     * Format time duration for display
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
    
    /**
     * Parse date from various formats
     */
    parseDate(dateString) {
        if (!dateString) return null;
        
        const text = dateString.toLowerCase().trim();
        const now = new Date();
        
        // Handle relative dates
        if (text === 'today') {
            return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        
        if (text === 'tomorrow') {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
        }
        
        // Handle weekdays
        const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayIndex = weekdays.findIndex(day => text.includes(day));
        if (dayIndex !== -1) {
            const targetDate = new Date(now);
            const currentDay = targetDate.getDay();
            const daysUntilTarget = (dayIndex - currentDay + 7) % 7;
            if (daysUntilTarget === 0 && text !== weekdays[currentDay]) {
                targetDate.setDate(targetDate.getDate() + 7); // Next week
            } else {
                targetDate.setDate(targetDate.getDate() + daysUntilTarget);
            }
            return new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        }
        
        // Try to parse as regular date
        const parsedDate = new Date(dateString);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
        
        return null;
    }
    
    /**
     * Trigger timeline UI update (placeholder for UI integration)
     */
    triggerTimelineUIUpdate() {
        // This would be implemented to refresh the UI timeline
        if (window.taskTimeline && typeof window.taskTimeline.refresh === 'function') {
            window.taskTimeline.refresh();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskScheduler;
} else {
    window.TaskScheduler = TaskScheduler;
}