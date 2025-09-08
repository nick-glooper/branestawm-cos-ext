// Branestawm Type Definitions
// Core type definitions for the extension

declare global {
    interface Window {
        TaskManager: typeof TaskManager;
        taskManager: TaskManager;
        logger: Logger;
        SecurityUtils: typeof SecurityUtils;
        performanceTracker: PerformanceTracker;
        perf: {
            start: (op: string) => string | null;
            end: (id: string | null, meta?: any) => any;
            time: (op: string, fn: Function, ...args: any[]) => Promise<any>;
            summary: () => any;
            clear: () => void;
            export: () => any;
        };
    }
}

// Task Management Types
export interface Task {
    id: string;
    title: string;
    description?: string;
    category: TaskCategory;
    status: TaskStatus;
    priority: TaskPriority;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    dueDate?: string;
    folioId?: string;
    messageId?: string;
    templateApplied?: TaskTemplate;
    timeTracking: TimeTracking;
    subtasks: SubTask[];
    context?: string;
}

export interface SubTask {
    id: string;
    text: string;
    completed: boolean;
    createdAt: string;
}

export interface TimeTracking {
    estimatedMinutes?: number;
    startedAt?: string;
    completedAt?: string;
    actualMinutes?: number;
    accuracy?: number;
    pausedAt?: string;
    totalPausedTime: number;
    isPaused: boolean;
}

export interface TaskTemplate {
    type: string;
    name: string;
    icon: string;
    description: string;
    subtasks: string[];
    estimatedTime: string;
    category: TaskCategory;
}

export interface PotentialTask {
    text: string;
    originalMatch: string;
    confidence: number;
    extractedDate?: ExtractedDate;
    context: string;
    category?: TaskCategory;
    templates?: TaskTemplate[];
}

export interface ExtractedDate {
    raw: string;
    confidence: number;
}

export type TaskCategory = 'work' | 'personal' | 'creative' | 'administrative' | 'general';
export type TaskStatus = 'pending' | 'in-progress' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface CategoryInfo {
    icon: string;
    name: string;
    color: string;
}

// Folio Management Types
export interface Folio {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    settings: FolioSettings;
    tasks: string[];
    conversations: string[];
    artifacts: string[];
}

export interface FolioSettings {
    theme: string;
    aiProvider: string;
    defaultCategory: TaskCategory;
    autoTaskExtraction: boolean;
}

// Data Management Types
export interface DataManagerState {
    currentFolio: string;
    folios: Record<string, Folio>;
    tasks: {
        items: Map<string, Task>;
        nextId: number;
    };
    settings: ExtensionSettings;
    taskLearning?: TaskLearningData;
}

export interface TaskLearningData {
    timeEstimates: {
        byCategory: Record<string, LearningStats>;
        byTemplate: Record<string, LearningStats>;
        overallStats: {
            totalTasks: number;
            averageAccuracy: number;
            lastUpdated?: string;
        };
    };
}

export interface LearningStats {
    estimates: EstimateRecord[];
    averageAccuracy: number;
    averageRatio: number;
    sampleSize: number;
}

export interface EstimateRecord {
    estimated: number;
    actual: number;
    accuracy: number;
    ratio: number;
    taskTitle: string;
    completedAt: string;
}

// Extension Settings Types
export interface ExtensionSettings {
    authMethod?: string;
    googleToken?: string;
    apiEndpoint: string;
    apiKey: string;
    model: string;
    systemPrompt: string;
    showTooltips: boolean;
    syncKey: string;
    syncId: string;
    jsonbinApiKey: string;
    usePrivateBins: boolean;
    autoSync: boolean;
}

// Logging Types
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LoggerConfig {
    logLevel: number;
    logLevelName: string;
    isProduction: boolean;
    enablePerformanceLogs: boolean;
    availableLevels: string[];
}

// Performance Types
export interface PerformanceMetric {
    operation: string;
    duration: number;
    memoryDelta: number;
    timestamp: string;
    metadata: Record<string, any>;
}

export interface PerformanceSummary {
    operations: Record<string, OperationStats>;
    totalMetrics: number;
    memoryBaseline: number;
    currentMemory: number;
    trackingEnabled: boolean;
}

export interface OperationStats {
    count: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    avgMemoryDelta: number;
    errorRate: number;
    trend?: 'faster' | 'slower';
    trendPercent?: number;
}

// Security Types
export type SafeHtmlString = string & { __htmlEscaped: true };

// Test Types
export interface TestContext {
    test: (description: string, testFn: () => void | Promise<void>) => void;
    expect: (actual: any) => Expectation;
}

export interface Expectation {
    toBe: (expected: any) => void;
    toEqual: (expected: any) => void;
    toBeTruthy: () => void;
    toBeFalsy: () => void;
    toContain: (expected: any) => void;
    toThrow: () => void;
}

// Build System Types
export interface BuildConfig {
    sourceDir: string;
    buildDir: string;
    distDir: string;
    jsFiles: string[];
    cssFiles: string[];
    htmlFiles: string[];
    staticFiles: string[];
}

export interface BuildStats {
    sourceSize: number;
    buildSize: number;
    reduction: number;
    buildDir: string;
    distDir: string;
}

// Event Types
export interface TaskEvent {
    type: 'created' | 'updated' | 'completed' | 'deleted' | 'started' | 'paused' | 'resumed';
    taskId: string;
    task?: Task;
    timestamp: string;
    metadata?: Record<string, any>;
}

export interface PerformanceEvent {
    type: 'thresholdExceeded' | 'memoryLeak' | 'slowOperation';
    operation: string;
    duration?: number;
    threshold?: number;
    metadata?: Record<string, any>;
}

// Chrome Extension Types
export interface ChromeMessage {
    type: string;
    payload?: any;
    tabId?: number;
    timestamp: string;
}

export interface ChromeStorageData {
    settings?: ExtensionSettings;
    projects?: Record<string, any>;
    conversations?: Record<string, any>;
    artifacts?: Record<string, any>;
    currentProject?: string;
}

// Export all types as module
export {};