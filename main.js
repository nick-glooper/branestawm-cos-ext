// Branestawm - Your AI Chief of Staff
// Main application logic for full-page tab interface

// ========== GLOBAL STATE ==========

let currentFolio = 'general';
let currentConversation = null;
let conversations = {};
let folios = {
    'general': {
        id: 'general',
        title: 'General Folio',
        description: 'General purpose folio for random questions and unstructured conversations',
        guidelines: '', // Inherits from assigned persona
        assignedPersona: 'core',
        conversations: [],
        artifacts: [],
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
    }
};
let artifacts = {};
let artifactTemplates = {
    'note': { name: 'General Note', icon: '📝', description: 'Simple markdown note' },
    'summary': { name: 'Summary Document', icon: '📋', description: 'AI-generated summary from conversation' },
    'plan': { name: 'Project Plan', icon: '📈', description: 'Structured project or task plan' },
    'research': { name: 'Research Document', icon: '🔬', description: 'Research findings and analysis' },
    'meeting': { name: 'Meeting Notes', icon: '👥', description: 'Meeting agenda, notes, and action items' },
    'report': { name: 'Report', icon: '📊', description: 'Formal report or analysis' },
    'template': { name: 'Custom Template', icon: '📄', description: 'Reusable document template' }
};
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
    highContrast: false,
    // Persona system
    personas: {
        'core': {
            id: 'core',
            name: 'Core Persona',
            identity: 'Helpful AI assistant and cognitive support specialist',
            communicationStyle: 'Clear, structured, and supportive',
            tone: 'Professional yet approachable',
            roleContext: 'General assistance, task breakdown, executive function support',
            isDefault: true,
            createdAt: new Date().toISOString()
        }
    }
};

let isProcessing = false;
let keepAlivePort = null;
let recentFolios = [];
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
    document.getElementById('artifactType').value = artifact.type || 'note';
    document.getElementById('artifactShared').checked = artifact.shared || false;
    document.getElementById('artifactModalTitle').textContent = 'Edit Document';
    
    // Store the artifact ID for saving
    document.getElementById('artifactModal').dataset.artifactId = artifactId;
    
    showModal('artifactModal');
}

function saveArtifact() {
    const title = document.getElementById('artifactTitle').value.trim();
    const content = document.getElementById('artifactText').value.trim();
    const type = document.getElementById('artifactType').value;
    const shared = document.getElementById('artifactShared').checked;
    
    if (!title) {
        showMessage('Document title is required', 'error');
        return;
    }
    
    const artifactModal = document.getElementById('artifactModal');
    const existingId = artifactModal.dataset.artifactId;
    
    if (existingId) {
        // Edit existing artifact
        const artifact = artifacts[existingId];
        artifact.title = title;
        artifact.content = content;
        artifact.type = type;
        artifact.shared = shared;
        artifact.updatedAt = new Date().toISOString();
        
        // Handle sharing status change
        updateArtifactSharing(existingId, shared);
        
        showMessage('Document updated successfully!', 'success');
    } else {
        // Create new artifact
        const artifactId = generateId();
        const artifact = {
            id: artifactId,
            title: title,
            content: content,
            type: type,
            folioId: currentFolio,
            shared: shared,
            createdAt: new Date().toISOString(),
            tags: [],
            references: []
        };
        
        artifacts[artifactId] = artifact;
        folios[currentFolio].artifacts.push(artifactId);
        
        // Add to shared artifacts if marked as shared
        if (shared) {
            addToSharedArtifacts(artifactId);
        }
        
        showMessage(`${artifactTemplates[type].name} created successfully!`, 'success');
    }
    
    // Clear form and modal data
    clearArtifactModal();
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
    updateCurrentFolioDisplay();
    updateRecentFoliosWidget();
    updateRecentConversationsWidget();
    updateArtifactsList();
}

function updateArtifactsList() {
    const artifactsList = document.getElementById('artifactsList');
    artifactsList.innerHTML = '';
    
    // Get artifacts for current folio (local + shared)
    const currentFolioArtifacts = folios[currentFolio]?.artifacts || [];
    const sharedArtifacts = folios[currentFolio]?.sharedArtifacts || [];
    const allArtifactIds = [...new Set([...currentFolioArtifacts, ...sharedArtifacts])];
    
    if (allArtifactIds.length === 0) {
        artifactsList.innerHTML = `
            <div class="empty-artifacts">
                <div class="empty-message">No documents yet</div>
                <div class="empty-actions">
                    <button class="btn small" onclick="showArtifactGenerationMenu()">Generate from Chat</button>
                    <button class="btn small secondary" onclick="createArtifactFromTemplate('note')">New Document</button>
                </div>
            </div>
        `;
        return;
    }
    
    // Sort artifacts by creation date (newest first)
    const sortedArtifacts = allArtifactIds
        .map(id => artifacts[id])
        .filter(artifact => artifact)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    
    // Group by type for better organization
    const groupedArtifacts = groupArtifactsByType(sortedArtifacts);
    
    Object.keys(groupedArtifacts).forEach(type => {
        if (groupedArtifacts[type].length === 0) return;
        
        const template = artifactTemplates[type];
        const groupHeader = document.createElement('div');
        groupHeader.className = 'artifact-group-header';
        groupHeader.innerHTML = `
            <span class="artifact-type-icon">${template.icon}</span>
            <span class="artifact-type-name">${template.name}s (${groupedArtifacts[type].length})</span>
        `;
        artifactsList.appendChild(groupHeader);
        
        groupedArtifacts[type].forEach(artifact => {
            const artifactItem = createArtifactItem(artifact);
            artifactsList.appendChild(artifactItem);
        });
    });
}

function groupArtifactsByType(artifacts) {
    const grouped = {
        'note': [],
        'summary': [],
        'plan': [],
        'research': [],
        'meeting': [],
        'report': [],
        'template': []
    };
    
    artifacts.forEach(artifact => {
        const type = artifact.type || 'note';
        if (grouped[type]) {
            grouped[type].push(artifact);
        } else {
            grouped['note'].push(artifact);
        }
    });
    
    return grouped;
}

function createArtifactItem(artifact) {
    const template = artifactTemplates[artifact.type || 'note'];
    const isShared = artifact.shared;
    const isGenerated = artifact.generated;
    const isFromAnotherFolio = artifact.folioId !== currentFolio;
    
    const artifactItem = document.createElement('div');
    artifactItem.className = 'artifact-item';
    if (isShared) artifactItem.classList.add('shared');
    if (isGenerated) artifactItem.classList.add('generated');
    if (isFromAnotherFolio) artifactItem.classList.add('external');
    
    const badges = [];
    if (isShared) badges.push('<span class="artifact-badge shared">Shared</span>');
    if (isGenerated) badges.push('<span class="artifact-badge generated">AI Generated</span>');
    if (isFromAnotherFolio) {
        const sourceFolio = folios[artifact.folioId];
        badges.push(`<span class="artifact-badge external">From: ${sourceFolio?.title || 'Unknown'}</span>`);
    }
    
    artifactItem.innerHTML = `
        <div class="artifact-header">
            <div class="artifact-title-row">
                <span class="artifact-icon">${template.icon}</span>
                <div class="artifact-title">${artifact.title}</div>
            </div>
            <div class="artifact-actions">
                <button class="action-btn" onclick="duplicateArtifact('${artifact.id}')" title="Duplicate document">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"/>
                    </svg>
                </button>
                <button class="action-btn edit-btn" onclick="editArtifact('${artifact.id}')" title="Edit document">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                </button>
            </div>
        </div>
        ${badges.length > 0 ? `<div class="artifact-badges">${badges.join('')}</div>` : ''}
        <div class="artifact-preview">${artifact.content.substring(0, 120)}${artifact.content.length > 120 ? '...' : ''}</div>
        <div class="artifact-meta">
            <span class="artifact-date">Created ${new Date(artifact.createdAt || Date.now()).toLocaleDateString()}</span>
            ${artifact.updatedAt ? `<span class="artifact-updated">Updated ${new Date(artifact.updatedAt).toLocaleDateString()}</span>` : ''}
        </div>
    `;
    
    return artifactItem;
}

function duplicateArtifact(artifactId) {
    const originalArtifact = artifacts[artifactId];
    if (!originalArtifact) return;
    
    const duplicateId = generateId();
    const duplicate = {
        ...originalArtifact,
        id: duplicateId,
        title: `Copy of ${originalArtifact.title}`,
        folioId: currentFolio,
        shared: false, // Duplicates are not shared by default
        generated: false, // Mark as manually created
        createdAt: new Date().toISOString(),
        updatedAt: null
    };
    
    artifacts[duplicateId] = duplicate;
    folios[currentFolio].artifacts.push(duplicateId);
    
    updateUI();
    saveData();
    showMessage('Document duplicated successfully!', 'success');
}

function updateRecentFoliosWidget() {
    const widget = document.getElementById('recentFoliosList');
    const itemsList = widget;
    
    itemsList.innerHTML = '';
    
    if (!recentFolios || recentFolios.length === 0) {
        itemsList.innerHTML = '<div class="empty-recent">No recent folios</div>';
        return;
    }
    
    recentFolios.slice(0, 5).forEach(folioId => {
        const folio = folios[folioId];
        if (!folio) return;
        
        const item = document.createElement('div');
        item.className = 'recent-item';
        item.setAttribute('aria-label', `Switch to folio: ${folio.title}`);
        
        const description = folio.description || 'No description available';
        const persona = settings.personas[folio.assignedPersona];
        
        item.innerHTML = `
            <div class="item-header">
                <div class="item-title">
                    ${folio.title}
                    ${persona ? `<span class="persona-badge">${persona.name}</span>` : ''}
                </div>
                <div class="item-actions">
                    <button class="action-btn edit-btn" aria-label="Edit folio" onclick="editFolio('${folioId}')">
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
                switchFolio(folioId);
            }
        });
        
        itemsList.appendChild(item);
    });
}

function updateRecentConversationsWidget() {
    const widget = document.getElementById('recentConversationsList');
    const itemsList = widget;
    
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
    
    if (deleteTarget.type === 'folio') {
        const folio = folios[deleteTarget.id];
        if (folio) {
            // Delete all conversations in this folio
            if (folio.conversations) {
                folio.conversations.forEach(convId => {
                    delete conversations[convId];
                });
            }
            
            // Delete all artifacts in this folio
            if (folio.artifacts) {
                folio.artifacts.forEach(artifactId => {
                    delete artifacts[artifactId];
                });
            }
            
            // Remove from recent folios
            recentFolios = recentFolios.filter(id => id !== deleteTarget.id);
            
            // Delete the folio
            delete folios[deleteTarget.id];
            
            // Switch to general folio if we deleted the current one
            if (currentFolio === deleteTarget.id) {
                currentFolio = 'general';
                currentConversation = null;
            }
            
            showMessage(`Folio "${folio.title}" deleted successfully`, 'success');
        }
    } else if (deleteTarget.type === 'conversation') {
        const conversation = conversations[deleteTarget.id];
        if (conversation) {
            // Remove from folio's conversations list
            const folio = folios[conversation.folioId];
            if (folio && folio.conversations) {
                folio.conversations = folio.conversations.filter(id => id !== deleteTarget.id);
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
    document.getElementById('browseFoliosBtn').addEventListener('click', showFolioSelectionModal);
    document.getElementById('browseConversationsBtn').addEventListener('click', showConversationSelectionModal);
    
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
    document.getElementById('newFolioBtn').addEventListener('click', () => showModal('folioModal'));
    document.getElementById('webSearchBtn').addEventListener('click', showWebSearchModal);
    document.getElementById('newArtifactBtn').addEventListener('click', () => createArtifactFromTemplate('note'));
    document.getElementById('generateArtifactBtn').addEventListener('click', showArtifactGenerationMenu);
    
    // Modal form handlers
    document.getElementById('saveEditConversationBtn').addEventListener('click', saveConversationChanges);
    document.getElementById('cancelEditConversationBtn').addEventListener('click', () => closeModal('editConversationModal'));
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => closeModal('deleteConfirmationModal'));
    
    document.getElementById('createFolioBtn').addEventListener('click', createFolio);
    document.getElementById('cancelFolioBtn').addEventListener('click', () => closeModal('folioModal'));
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

// ========== ENHANCED ARTIFACT MANAGEMENT ==========

function updateArtifactSharing(artifactId, shared) {
    if (shared) {
        addToSharedArtifacts(artifactId);
    } else {
        removeFromSharedArtifacts(artifactId);
    }
}

function addToSharedArtifacts(artifactId) {
    // Add artifact to all folios' shared artifacts list
    Object.keys(folios).forEach(folioId => {
        if (!folios[folioId].sharedArtifacts) {
            folios[folioId].sharedArtifacts = [];
        }
        if (!folios[folioId].sharedArtifacts.includes(artifactId)) {
            folios[folioId].sharedArtifacts.push(artifactId);
        }
    });
}

function removeFromSharedArtifacts(artifactId) {
    // Remove artifact from all folios' shared artifacts list
    Object.keys(folios).forEach(folioId => {
        if (folios[folioId].sharedArtifacts) {
            folios[folioId].sharedArtifacts = folios[folioId].sharedArtifacts.filter(id => id !== artifactId);
        }
    });
}

function generateArtifactFromConversation(conversationId, type = 'summary') {
    if (!conversations[conversationId]) {
        showMessage('Conversation not found', 'error');
        return;
    }
    
    const conversation = conversations[conversationId];
    const template = artifactTemplates[type];
    
    // Create AI prompt for artifact generation
    const prompt = buildArtifactGenerationPrompt(conversation, type);
    
    // Show loading state
    showMessage('Generating document from conversation...', 'info');
    
    // Call AI to generate artifact content
    generateArtifactContent(prompt, type, conversation.title);
}

function buildArtifactGenerationPrompt(conversation, type) {
    const messages = conversation.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
    
    const prompts = {
        'summary': `Create a comprehensive summary document from this conversation. Include key points, decisions, and action items.\n\nConversation:\n${messages}`,
        'plan': `Create a structured project plan based on this conversation. Include objectives, tasks, timeline, and resources.\n\nConversation:\n${messages}`,
        'research': `Create a research document summarizing findings and insights from this conversation. Include key data points and conclusions.\n\nConversation:\n${messages}`,
        'meeting': `Create meeting notes from this conversation. Include agenda items discussed, decisions made, and action items.\n\nConversation:\n${messages}`,
        'report': `Create a formal report based on this conversation. Include executive summary, findings, and recommendations.\n\nConversation:\n${messages}`
    };
    
    return prompts[type] || prompts['summary'];
}

async function generateArtifactContent(prompt, type, conversationTitle) {
    try {
        const messages = [
            { role: 'system', content: 'You are an expert document creator. Generate well-structured, professional documents in markdown format.' },
            { role: 'user', content: prompt }
        ];
        
        const response = await callLLMAPI(messages);
        
        // Create new artifact with generated content
        const artifactId = generateId();
        const template = artifactTemplates[type];
        
        const artifact = {
            id: artifactId,
            title: `${template.name}: ${conversationTitle}`,
            content: response,
            type: type,
            folioId: currentFolio,
            shared: false,
            generated: true,
            sourceConversation: conversations[currentConversation]?.id,
            createdAt: new Date().toISOString(),
            tags: ['ai-generated'],
            references: []
        };
        
        artifacts[artifactId] = artifact;
        folios[currentFolio].artifacts.push(artifactId);
        
        updateUI();
        saveData();
        
        showMessage(`${template.name} generated successfully!`, 'success');
        
        // Optionally open the created artifact for editing
        setTimeout(() => editArtifact(artifactId), 500);
        
    } catch (error) {
        console.error('Error generating artifact:', error);
        showMessage('Error generating document: ' + error.message, 'error');
    }
}

function clearArtifactModal() {
    document.getElementById('artifactTitle').value = '';
    document.getElementById('artifactText').value = '';
    document.getElementById('artifactType').value = 'note';
    document.getElementById('artifactShared').checked = false;
    const modal = document.getElementById('artifactModal');
    delete modal.dataset.artifactId;
}

function showArtifactGenerationMenu() {
    if (!currentConversation) {
        showMessage('No active conversation to generate document from', 'error');
        return;
    }
    
    showModal('artifactGenerationModal');
}

function createArtifactFromTemplate(type) {
    const template = artifactTemplates[type];
    
    // Populate modal with template
    document.getElementById('artifactTitle').value = `New ${template.name}`;
    document.getElementById('artifactType').value = type;
    document.getElementById('artifactModalTitle').textContent = `Create ${template.name}`;
    
    // Set template content based on type
    const templateContent = getTemplateContent(type);
    document.getElementById('artifactText').value = templateContent;
    
    showModal('artifactModal');
}

function getTemplateContent(type) {
    const templates = {
        'note': '# Notes\n\n## Key Points\n- \n\n## Additional Information\n\n',
        'summary': '# Summary\n\n## Overview\n\n## Key Points\n- \n\n## Conclusions\n\n',
        'plan': '# Project Plan\n\n## Objective\n\n## Tasks\n- [ ] \n\n## Timeline\n\n## Resources Required\n\n',
        'research': '# Research Document\n\n## Research Question\n\n## Methodology\n\n## Findings\n- \n\n## Analysis\n\n## Conclusions\n\n',
        'meeting': '# Meeting Notes\n\n**Date:** \n**Attendees:** \n\n## Agenda\n- \n\n## Discussion Points\n\n## Decisions Made\n- \n\n## Action Items\n- [ ] \n\n',
        'report': '# Report\n\n## Executive Summary\n\n## Background\n\n## Findings\n\n## Recommendations\n\n## Conclusion\n\n'
    };
    
    return templates[type] || templates['note'];
}

// ========== PERSONA DROPDOWN MANAGEMENT ==========

function populatePersonaDropdown() {
    const personaSelect = document.getElementById('folioPersona');
    if (!personaSelect) return;
    
    // Clear existing options except the core persona
    personaSelect.innerHTML = '';
    
    // Populate with available personas
    Object.values(settings.personas || {}).forEach(persona => {
        const option = document.createElement('option');
        option.value = persona.id;
        option.textContent = `${persona.name} - ${persona.identity}`;
        personaSelect.appendChild(option);
    });
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
        populatePersonaDropdown();
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

// Make functions globally accessible for HTML onclick handlers
window.editArtifact = editArtifact;
window.duplicateArtifact = duplicateArtifact;
window.generateArtifactFromConversation = generateArtifactFromConversation;
window.createArtifactFromTemplate = createArtifactFromTemplate;
window.showArtifactGenerationMenu = showArtifactGenerationMenu;