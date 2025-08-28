// Branestawm - Your AI Chief of Staff
// Main application logic for full-page tab interface

// ========== GLOBAL STATE ==========

let currentProject = 'default';
let currentConversation = null;
let conversations = {};
let projects = {
    'default': {
        id: 'default',
        name: 'Default Project',
        description: 'Default project for general conversations',
        conversations: [],
        artifacts: []
    }
};
let artifacts = {};
let settings = {
    authMethod: null, // 'google' or 'apikey'
    googleToken: null,
    apiEndpoint: 'https://api.cerebras.ai/v1/chat/completions',
    apiKey: '',
    model: 'llama3.1-8b',
    systemPrompt: 'You are Branestawm, an indispensable AI Chief of Staff designed to provide cognitive support for neurodivergent users. Always break down complex tasks into clear, manageable steps. Provide patient, structured guidance. Use numbered lists and clear headings to organize information. Focus on being helpful, supportive, and understanding of executive function challenges.',
    showTooltips: true,
    webSearchEnabled: true,
    syncKey: '',
    syncId: '',
    jsonbinApiKey: '',
    usePrivateBins: false,
    autoSync: false,
    // Glooper Design System settings
    colorScheme: 'professional', // 'professional', 'warm', 'cool'
    themeMode: 'dark', // 'light', 'dark', 'auto'
    fontSize: 'standard', // 'compact', 'standard', 'large', 'xl'
    reducedMotion: false,
    highContrast: false
};

let isProcessing = false;
let keepAlivePort = null;
let recentProjects = [];
let recentConversations = [];
let deleteTarget = null;

// ========== SETUP AND INITIALIZATION ==========

function showSetupModal() {
    document.getElementById('setupModal').classList.add('show');
}

function openSettings() {
    chrome.runtime.openOptionsPage();
}

// ========== ARTIFACT MANAGEMENT ==========

function editArtifact(artifactId) {
    const artifact = artifacts[artifactId];
    if (!artifact) return;
    
    // Populate the artifact modal with existing data
    document.getElementById('artifactTitle').value = artifact.title;
    document.getElementById('artifactText').value = artifact.content;
    document.getElementById('artifactModalTitle').textContent = 'Edit Note';
    
    // Store the artifact ID for saving
    document.getElementById('artifactModal').dataset.artifactId = artifactId;
    
    showModal('artifactModal');
}

function saveArtifact() {
    const title = document.getElementById('artifactTitle').value.trim();
    const content = document.getElementById('artifactText').value.trim();
    
    if (!title) {
        showMessage('Note title is required', 'error');
        return;
    }
    
    const artifactModal = document.getElementById('artifactModal');
    const existingId = artifactModal.dataset.artifactId;
    
    if (existingId) {
        // Edit existing artifact
        artifacts[existingId].title = title;
        artifacts[existingId].content = content;
        artifacts[existingId].updatedAt = new Date().toISOString();
        showMessage('Note updated successfully!', 'success');
    } else {
        // Create new artifact
        const artifactId = generateId();
        const artifact = {
            id: artifactId,
            title: title,
            content: content,
            projectId: currentProject,
            createdAt: new Date().toISOString()
        };
        
        artifacts[artifactId] = artifact;
        projects[currentProject].artifacts.push(artifactId);
        showMessage('Note created successfully!', 'success');
    }
    
    // Clear form and modal data
    document.getElementById('artifactTitle').value = '';
    document.getElementById('artifactText').value = '';
    delete artifactModal.dataset.artifactId;
    
    closeModal('artifactModal');
    updateUI();
    saveData();
}

// ========== SEARCH IMPORT MONITORING ==========

let importCheckInterval = null;

function startImportMonitoring() {
    if (importCheckInterval) return;
    
    // Check for imported search results every 2 seconds
    importCheckInterval = setInterval(checkForImportedResults, 2000);
    console.log('📥 Started monitoring for search result imports');
}

function stopImportMonitoring() {
    if (importCheckInterval) {
        clearInterval(importCheckInterval);
        importCheckInterval = null;
        console.log('📥 Stopped monitoring for search result imports');
    }
}

async function checkForImportedResults() {
    try {
        // Get all storage keys that start with 'searchImport_'
        const storage = await chrome.storage.local.get();
        const importKeys = Object.keys(storage).filter(key => key.startsWith('searchImport_'));
        
        for (const key of importKeys) {
            const importData = storage[key];
            if (importData && !importData.processed) {
                await processSearchImport(importData, key);
            }
        }
    } catch (error) {
        console.error('Error checking for imported results:', error);
    }
}

async function processSearchImport(importData, storageKey) {
    try {
        // Ensure we have a current conversation
        if (!currentConversation) {
            newConversation();
        }
        
        // Create a formatted message from the search data
        let searchMessage = `Search Results from ${importData.source}:\n\n`;
        
        if (importData.query) {
            searchMessage += `**Query:** ${importData.query}\n\n`;
        }
        
        if (importData.results) {
            importData.results.forEach((result, index) => {
                searchMessage += `**${index + 1}. ${result.title || 'Result'}**\n`;
                if (result.url) {
                    searchMessage += `Source: ${result.url}\n`;
                }
                if (result.content) {
                    searchMessage += `${result.content}\n`;
                }
                searchMessage += '\n';
            });
        }
        
        // Add the search results as a system message
        addMessage(currentConversation, 'system', searchMessage);
        
        // Mark as processed and remove from storage
        await chrome.storage.local.remove(storageKey);
        
        showMessage(`Search results imported from ${importData.source}!`, 'success');
        
    } catch (error) {
        console.error('Error processing search import:', error);
    }
}

// ========== WEB SEARCH INTEGRATION ==========

function showWebSearchModal() {
    showModal('webSearchModal');
}

function setupWebSearchEventListeners() {
    document.getElementById('googleSearchBtn').addEventListener('click', handleGoogleSearch);
    document.getElementById('perplexitySearchBtn').addEventListener('click', handlePerplexitySearch);
    document.getElementById('cancelWebSearchBtn').addEventListener('click', () => closeModal('webSearchModal'));
}

function handleGoogleSearch() {
    chrome.tabs.create({ 
        url: 'https://google.com',
        active: true
    });
    closeModal('webSearchModal');
    showMessage('Google AI search opened. The "Import to Branestawm" button will appear after you search with AI Overview enabled.', 'info');
}

function handlePerplexitySearch() {
    chrome.tabs.create({ 
        url: 'https://perplexity.ai',
        active: true
    });
    closeModal('webSearchModal');
    showMessage('Perplexity opened. Look for the "Import to Branestawm" button after searching.', 'info');
}

// ========== WIDGETS AND UI UPDATES ==========

function updateUI() {
    updateCurrentProjectDisplay();
    updateRecentProjectsWidget();
    updateRecentConversationsWidget();
    updateArtifactsList();
}

function updateArtifactsList() {
    const artifactsList = document.getElementById('artifactsList');
    artifactsList.innerHTML = '';
    
    const currentProjectArtifacts = projects[currentProject]?.artifacts || [];
    
    if (currentProjectArtifacts.length === 0) {
        artifactsList.innerHTML = '<div class="empty-artifacts">No notes yet</div>';
        return;
    }
    
    // Sort artifacts by creation date (newest first)
    const sortedArtifacts = currentProjectArtifacts
        .map(id => artifacts[id])
        .filter(artifact => artifact)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    
    sortedArtifacts.forEach(artifact => {
        const artifactItem = document.createElement('div');
        artifactItem.className = 'artifact-item';
        artifactItem.innerHTML = `
            <div class="artifact-header">
                <div class="artifact-title">${artifact.title}</div>
                <div class="artifact-actions">
                    <button class="action-btn edit-btn" aria-label="Edit note" onclick="editArtifact('${artifact.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="artifact-preview">${artifact.content.substring(0, 100)}${artifact.content.length > 100 ? '...' : ''}</div>
            <div class="artifact-meta">Created ${new Date(artifact.createdAt || Date.now()).toLocaleDateString()}</div>
        `;
        
        artifactsList.appendChild(artifactItem);
    });
}

function updateRecentProjectsWidget() {
    const widget = document.getElementById('recentProjectsWidget');
    const itemsList = widget.querySelector('.recent-items');
    
    itemsList.innerHTML = '';
    
    if (!recentProjects || recentProjects.length === 0) {
        itemsList.innerHTML = '<div class="empty-recent">No recent projects</div>';
        return;
    }
    
    recentProjects.slice(0, 5).forEach(projectId => {
        const project = projects[projectId];
        if (!project) return;
        
        const item = document.createElement('div');
        item.className = 'recent-item';
        item.setAttribute('aria-label', `Switch to project: ${project.name}`);
        
        const description = project.description || 'No description available';
        const hasInstructions = project.customInstructions && project.customInstructions.trim().length > 0;
        
        item.innerHTML = `
            <div class="item-header">
                <div class="item-title">
                    ${project.name}
                    ${hasInstructions ? '<span class="custom-instructions-badge">📋</span>' : ''}
                </div>
                <div class="item-actions">
                    <button class="action-btn edit-btn" aria-label="Edit project" onclick="editProject('${projectId}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="item-description">${description}</div>
        `;
        
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.action-btn')) {
                switchProject(projectId);
            }
        });
        
        itemsList.appendChild(item);
    });
}

function updateRecentConversationsWidget() {
    const widget = document.getElementById('recentConversationsWidget');
    const itemsList = widget.querySelector('.recent-items');
    
    itemsList.innerHTML = '';
    
    if (!recentConversations || recentConversations.length === 0) {
        itemsList.innerHTML = '<div class="empty-recent">No recent conversations</div>';
        return;
    }
    
    recentConversations.slice(0, 5).forEach(conversationId => {
        const conversation = conversations[conversationId];
        if (!conversation) return;
        
        const item = document.createElement('div');
        item.className = 'recent-item';
        if (conversation.id === currentConversation) {
            item.classList.add('active');
        }
        
        const preview = generateConversationPreview(conversation);
        const lastUpdated = new Date(conversation.updatedAt || conversation.createdAt).toLocaleDateString();
        
        item.innerHTML = `
            <div class="item-header">
                <div class="item-title">${conversation.title}</div>
                <div class="item-actions">
                    <button class="action-btn edit-btn" aria-label="Edit conversation" onclick="editConversation('${conversationId}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="item-description">${preview}</div>
            <div class="item-meta">Updated ${lastUpdated}</div>
        `;
        
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.action-btn')) {
                switchToConversation(conversationId);
            }
        });
        
        itemsList.appendChild(item);
    });
}

// ========== DELETE CONFIRMATION ==========

function confirmDelete() {
    if (!deleteTarget) return;
    
    if (deleteTarget.type === 'project') {
        const project = projects[deleteTarget.id];
        if (project) {
            // Delete all conversations in this project
            if (project.conversations) {
                project.conversations.forEach(convId => {
                    delete conversations[convId];
                });
            }
            
            // Delete all artifacts in this project
            if (project.artifacts) {
                project.artifacts.forEach(artifactId => {
                    delete artifacts[artifactId];
                });
            }
            
            // Remove from recent projects
            recentProjects = recentProjects.filter(id => id !== deleteTarget.id);
            
            // Delete the project
            delete projects[deleteTarget.id];
            
            // Switch to default project if we deleted the current one
            if (currentProject === deleteTarget.id) {
                currentProject = 'default';
                currentConversation = null;
            }
            
            showMessage(`Project "${project.name}" deleted successfully`, 'success');
        }
    } else if (deleteTarget.type === 'conversation') {
        const conversation = conversations[deleteTarget.id];
        if (conversation) {
            // Remove from project's conversations list
            const project = projects[conversation.projectId];
            if (project && project.conversations) {
                project.conversations = project.conversations.filter(id => id !== deleteTarget.id);
            }
            
            // Remove from recent conversations
            recentConversations = recentConversations.filter(id => id !== deleteTarget.id);
            
            // Clear current conversation if it's the one being deleted
            if (currentConversation === deleteTarget.id) {
                currentConversation = null;
                document.getElementById('chatMessages').innerHTML = '';
            }
            
            // Delete the conversation
            delete conversations[deleteTarget.id];
            
            showMessage(`Conversation "${conversation.title}" deleted successfully`, 'success');
        }
    }
    
    deleteTarget = null;
    closeModal('deleteConfirmationModal');
    updateUI();
    saveData();
}

// ========== EVENT LISTENERS SETUP ==========

function setupEventListeners() {
    // Core chat functionality
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    document.getElementById('messageInput').addEventListener('input', autoResizeTextarea);
    
    // Navigation
    document.getElementById('newChatBtn').addEventListener('click', newConversation);
    document.getElementById('selectProjectBtn').addEventListener('click', showProjectSelectionModal);
    document.getElementById('selectConversationBtn').addEventListener('click', showConversationSelectionModal);
    
    // Modals and settings
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('setupBtn').addEventListener('click', authenticateWithGoogle);
    document.getElementById('advancedSetupBtn').addEventListener('click', openSettings);
    document.getElementById('exportBtn').addEventListener('click', () => showModal('exportModal'));
    document.getElementById('cancelExportBtn').addEventListener('click', () => closeModal('exportModal'));
    document.getElementById('exportConversationBtn').addEventListener('click', () => {
        if (!currentConversation) {
            showMessage('No conversation selected to export', 'error');
            return;
        }
        exportConversationAsMarkdown(currentConversation);
        closeModal('exportModal');
    });
    document.getElementById('exportAllBtn').addEventListener('click', () => {
        exportAllDataAsMarkdown();
        closeModal('exportModal');
    });
    document.getElementById('syncBtn').addEventListener('click', () => showModal('syncModal'));
    document.getElementById('newProjectBtn').addEventListener('click', () => showModal('projectModal'));
    document.getElementById('webSearchBtn').addEventListener('click', showWebSearchModal);
    document.getElementById('newArtifactBtn').addEventListener('click', () => showModal('artifactModal'));
    
    // Modal form handlers
    document.getElementById('saveEditConversationBtn').addEventListener('click', saveConversationChanges);
    document.getElementById('cancelEditConversationBtn').addEventListener('click', () => closeModal('editConversationModal'));
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => closeModal('deleteConfirmationModal'));
    
    document.getElementById('createProjectBtn').addEventListener('click', createProject);
    document.getElementById('cancelProjectBtn').addEventListener('click', () => closeModal('projectModal'));
    document.getElementById('saveArtifactBtn').addEventListener('click', saveArtifact);
    document.getElementById('cancelArtifactBtn').addEventListener('click', () => closeModal('artifactModal'));
    
    // Web search setup
    setupWebSearchEventListeners();
    
    // Global modal close handlers
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
        
        const closeBtn = modal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                closeModal(this.id);
            });
        }
    });
}

// ========== PENDING QUERY CHECK ==========

async function checkPendingQuery() {
    try {
        const result = await chrome.storage.local.get(['pendingQuery']);
        if (result.pendingQuery) {
            // Clear the pending query first
            await chrome.storage.local.remove(['pendingQuery']);
            
            // Set the message in the input
            const messageInput = document.getElementById('messageInput');
            messageInput.value = result.pendingQuery;
            autoResizeTextarea();
            
            // Focus the input
            messageInput.focus();
            
            // Optionally auto-send if user isn't authenticated
            if (!settings.googleToken && !settings.apiKey) {
                showSetupModal();
            } else {
                // Create a new conversation if needed
                if (!currentConversation) {
                    newConversation();
                }
                
                // Auto-send the message
                await sendMessage();
            }
        }
    } catch (error) {
        console.error('Error checking pending query:', error);
    }
}

// ========== INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load data from storage
        await loadData();
        
        // Initialize UI systems
        initializeTheme();
        setupEventListeners();
        setupAccessibility();
        updateUI();
        
        // Setup tooltips
        setupTooltips();
        
        // Start monitoring for search imports
        startImportMonitoring();
        
        // Check for pending queries from context menu/omnibox
        await checkPendingQuery();
        
        // Create first conversation if none exist
        if (Object.keys(conversations).length === 0) {
            newConversation();
        }
        
        console.log('Branestawm initialized successfully');
        
    } catch (error) {
        console.error('Error initializing Branestawm:', error);
        showMessage('Error initializing application. Please refresh the page.', 'error');
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopImportMonitoring();
});