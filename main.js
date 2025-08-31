// Branestawm - Your AI Chief of Staff
// Main application logic for full-page tab interface

// ========== GLOBAL STATE ==========

// Hybrid LLM System
let ollamaClient = null;
let llmRouter = null;
let modelManager = null;

let currentFolio = 'general';
let folios = {
    'general': {
        id: 'general',
        title: 'General Folio',
        description: 'General purpose folio for continuous dialogue',
        guidelines: '', // Inherits from assigned persona
        assignedPersona: 'core',
        messages: [], // Single continuous dialogue
        artifacts: [],
        sharedArtifacts: [],
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
    }
};
// Remove conversations concept - each folio has one continuous dialogue
// let conversations = {}; // No longer needed
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
            name: 'Core',
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
let recentFolios = ['general'];
// let recentConversations = []; // No longer needed - folios track their own dialogue
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
        // Ensure we have a current folio
        if (!currentFolio || !folios[currentFolio]) {
            return;
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
        addMessage(currentFolio, 'system', searchMessage);
        
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
    const googleSearchBtn = document.getElementById('searchGoogleBtn');
    if (googleSearchBtn) {
        googleSearchBtn.addEventListener('click', handleGoogleSearch);
    }
    
    const perplexitySearchBtn = document.getElementById('searchPerplexityBtn');
    if (perplexitySearchBtn) {
        perplexitySearchBtn.addEventListener('click', handlePerplexitySearch);
    }
    
    const webSearchInfoBtn = document.getElementById('webSearchInfoBtn');
    if (webSearchInfoBtn) {
        webSearchInfoBtn.addEventListener('click', toggleWebSearchInfoTooltip);
    }
    
    const googleInfoBtn = document.getElementById('googleInfoBtn');
    if (googleInfoBtn) {
        googleInfoBtn.addEventListener('click', toggleGoogleInfoTooltip);
    }
    
    const perplexityInfoBtn = document.getElementById('perplexityInfoBtn');
    if (perplexityInfoBtn) {
        perplexityInfoBtn.addEventListener('click', togglePerplexityInfoTooltip);
    }
    
    const cancelWebSearchBtn = document.getElementById('cancelWebSearchBtn');
    if (cancelWebSearchBtn) {
        cancelWebSearchBtn.addEventListener('click', () => closeModal('webSearchModal'));
    }
}

function toggleWebSearchInfoTooltip() {
    const tooltip = document.getElementById('webSearchInfoTooltip');
    const googleTooltip = document.getElementById('googleInfoTooltip');
    const perplexityTooltip = document.getElementById('perplexityInfoTooltip');
    
    // Hide other tooltips
    if (googleTooltip) {
        googleTooltip.classList.remove('show');
    }
    if (perplexityTooltip) {
        perplexityTooltip.classList.remove('show');
    }
    
    // Toggle this tooltip
    if (tooltip) {
        tooltip.classList.toggle('show');
    }
}

function toggleGoogleInfoTooltip() {
    const tooltip = document.getElementById('googleInfoTooltip');
    const perplexityTooltip = document.getElementById('perplexityInfoTooltip');
    const mainTooltip = document.getElementById('webSearchInfoTooltip');
    
    // Hide other tooltips
    if (perplexityTooltip) {
        perplexityTooltip.classList.remove('show');
    }
    if (mainTooltip) {
        mainTooltip.classList.remove('show');
    }
    
    // Toggle this tooltip
    if (tooltip) {
        tooltip.classList.toggle('show');
    }
}

function togglePerplexityInfoTooltip() {
    const tooltip = document.getElementById('perplexityInfoTooltip');
    const googleTooltip = document.getElementById('googleInfoTooltip');
    const mainTooltip = document.getElementById('webSearchInfoTooltip');
    
    // Hide other tooltips
    if (googleTooltip) {
        googleTooltip.classList.remove('show');
    }
    if (mainTooltip) {
        mainTooltip.classList.remove('show');
    }
    
    // Toggle this tooltip
    if (tooltip) {
        tooltip.classList.toggle('show');
    }
}

function handleGoogleSearch() {
    chrome.tabs.create({ 
        url: 'https://www.google.com/search?q=AI+overview&udm=14',
        active: true
    });
    closeModal('webSearchModal');
    showMessage('Google AI Search opened. The "Import to Branestawm" button will appear on search results with AI Overview.', 'info');
}

function handlePerplexitySearch() {
    chrome.tabs.create({ 
        url: 'https://www.perplexity.ai',
        active: true
    });
    closeModal('webSearchModal');
    showMessage('Perplexity opened. The "Import to Branestawm" button will appear after you perform a search.', 'info');
}

// ========== WIDGETS AND UI UPDATES ==========

function updateUI() {
    updateCurrentFolioDisplay();
    updateRecentFoliosWidget();
    updateCanvasContent();
}

function updateCurrentFolioDisplay() {
    const folio = folios[currentFolio];
    if (!folio) return;
    
    const titleElement = document.getElementById('currentFolioTitle');
    const personaElement = document.getElementById('currentFolioPersona');
    const descriptionElement = document.getElementById('currentFolioDescription');
    
    if (titleElement) titleElement.textContent = folio.title;
    if (personaElement) {
        const persona = settings.personas[folio.assignedPersona] || settings.personas['core'];
        personaElement.textContent = persona.name;
    }
    if (descriptionElement) descriptionElement.textContent = folio.description || 'No description';
}

function updateCanvasContent() {
    const canvasContent = document.getElementById('canvasContent');
    const canvasEmpty = document.getElementById('canvasEmpty');
    
    if (!canvasContent) return;
    
    const currentFolioArtifacts = folios[currentFolio]?.artifacts || [];
    const sharedArtifacts = folios[currentFolio]?.sharedArtifacts || [];
    const allArtifactIds = [...new Set([...currentFolioArtifacts, ...sharedArtifacts])];
    
    if (allArtifactIds.length === 0) {
        if (canvasEmpty) canvasEmpty.style.display = 'flex';
    } else {
        if (canvasEmpty) canvasEmpty.style.display = 'none';
        // Could show artifact list or editing interface here
    }
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
    updatePinnedFoliosWidget();
    
    const widget = document.getElementById('recentFoliosList');
    const itemsList = widget;
    
    itemsList.innerHTML = '';
    
    if (!recentFolios || recentFolios.length === 0) {
        itemsList.innerHTML = '<div class="empty-recent">No recent folios</div>';
        return;
    }
    
    // Create a list with current folio first, then other recent folios
    const displayFolios = [];
    const pinnedFolios = settings.pinnedFolios || [];
    
    // Add current folio first (if not pinned)
    if (currentFolio && folios[currentFolio] && !pinnedFolios.includes(currentFolio)) {
        displayFolios.push(currentFolio);
    }
    
    // Add other recent folios (excluding current folio and pinned folios to avoid duplicates)
    recentFolios.slice(0, 8).forEach(folioId => {
        if (folioId !== currentFolio && folios[folioId] && !pinnedFolios.includes(folioId)) {
            displayFolios.push(folioId);
        }
    });
    
    displayFolios.forEach(folioId => {
        const folio = folios[folioId];
        if (!folio) return;
        
        const isActive = folioId === currentFolio;
        const item = document.createElement('div');
        item.className = `recent-item${isActive ? ' active' : ''}`;
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
                    <div class="dropdown">
                        <button class="action-btn menu-btn" aria-label="Folio actions" data-folio-id="${folioId}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                            </svg>
                        </button>
                        <div class="dropdown-menu" id="menu-${folioId}">
                            <button class="dropdown-item edit-item" data-folio-id="${folioId}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                </svg>
                                Edit
                            </button>
                            <button class="dropdown-item duplicate-item" data-folio-id="${folioId}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                </svg>
                                Duplicate
                            </button>
                            <button class="dropdown-item pin-item" data-folio-id="${folioId}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/>
                                </svg>
                                <span class="pin-text">Pin</span>
                            </button>
                            <button class="dropdown-item delete-item" data-folio-id="${folioId}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                </svg>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="item-description">${description}</div>
        `;
        
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.action-btn') && !e.target.closest('.dropdown-menu')) {
                switchFolio(folioId);
            }
        });
        
        // Add event listeners for dropdown actions
        const menuBtn = item.querySelector('.menu-btn');
        const editBtn = item.querySelector('.edit-item');
        const duplicateBtn = item.querySelector('.duplicate-item');
        const pinBtn = item.querySelector('.pin-item');
        const deleteBtn = item.querySelector('.delete-item');
        
        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => toggleFolioMenu(e, folioId));
        }
        if (editBtn) {
            editBtn.addEventListener('click', () => editFolio(folioId));
        }
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', () => duplicateFolio(folioId));
        }
        if (pinBtn) {
            pinBtn.addEventListener('click', () => togglePinFolio(folioId));
        }
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deleteFolio(folioId));
        }
        
        itemsList.appendChild(item);
    });
}

function updatePinnedFoliosWidget() {
    console.log('📌 Updating pinned folios widget');
    const pinnedSection = document.getElementById('pinnedSection');
    const pinnedList = document.getElementById('pinnedFoliosList');
    const pinnedFolios = settings.pinnedFolios || [];
    console.log('📌 Found pinned folios:', pinnedFolios);
    
    // Show/hide pinned section based on whether there are pinned folios
    if (pinnedFolios.length === 0) {
        console.log('📌 No pinned folios, hiding section');
        if (pinnedSection) pinnedSection.style.display = 'none';
        return;
    }
    
    pinnedSection.style.display = 'block';
    pinnedList.innerHTML = '';
    
    pinnedFolios.forEach(folioId => {
        const folio = folios[folioId];
        if (!folio) return;
        
        const isActive = folioId === currentFolio;
        const item = document.createElement('div');
        item.className = `recent-item${isActive ? ' active' : ''}`;
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
                    <div class="dropdown">
                        <button class="action-btn menu-btn" aria-label="Folio actions" data-folio-id="${folioId}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                            </svg>
                        </button>
                        <div class="dropdown-menu" id="menu-${folioId}">
                            <button class="dropdown-item edit-item" data-folio-id="${folioId}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                                </svg>
                                Edit
                            </button>
                            <button class="dropdown-item duplicate-item" data-folio-id="${folioId}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                </svg>
                                Duplicate
                            </button>
                            <button class="dropdown-item pin-item" data-folio-id="${folioId}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/>
                                </svg>
                                <span class="pin-text">Unpin</span>
                            </button>
                            <button class="dropdown-item delete-item" data-folio-id="${folioId}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                </svg>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="item-description">${description}</div>
        `;
        
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.action-btn') && !e.target.closest('.dropdown-menu')) {
                switchFolio(folioId);
            }
        });
        
        // Add event listeners for dropdown actions
        const menuBtn = item.querySelector('.menu-btn');
        const editBtn = item.querySelector('.edit-item');
        const duplicateBtn = item.querySelector('.duplicate-item');
        const pinBtn = item.querySelector('.pin-item');
        const deleteBtn = item.querySelector('.delete-item');
        
        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => toggleFolioMenu(e, folioId));
        }
        if (editBtn) {
            editBtn.addEventListener('click', () => editFolio(folioId));
        }
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', () => duplicateFolio(folioId));
        }
        if (pinBtn) {
            pinBtn.addEventListener('click', () => togglePinFolio(folioId));
        }
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => deleteFolio(folioId));
        }
        
        pinnedList.appendChild(item);
    });
}

// ========== DROPDOWN MENU FUNCTIONALITY ==========

function toggleFolioMenu(event, folioId) {
    console.log('📝 toggleFolioMenu called for:', folioId);
    event.stopPropagation();
    
    // Close any other open menus
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        if (menu.id !== `menu-${folioId}`) {
            menu.classList.remove('show');
        }
    });
    
    const menu = document.getElementById(`menu-${folioId}`);
    console.log('📝 Menu found:', menu ? 'yes' : 'no');
    if (menu) {
        menu.classList.toggle('show');
        console.log('📝 Menu toggled, now has show class:', menu.classList.contains('show'));
        
        // Update pin button text based on current state
        const pinItem = menu.querySelector('.pin-item .pin-text');
        const isPinned = settings.pinnedFolios && settings.pinnedFolios.includes(folioId);
        if (pinItem) {
            pinItem.textContent = isPinned ? 'Unpin' : 'Pin';
        }
    }
}

function duplicateFolio(folioId) {
    const originalFolio = folios[folioId];
    if (!originalFolio) return;
    
    const newFolioId = generateId();
    const newFolio = {
        ...originalFolio,
        id: newFolioId,
        title: `${originalFolio.title} (Copy)`,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
    };
    
    folios[newFolioId] = newFolio;
    saveData();
    updateRecentFoliosWidget();
    showMessage('Folio duplicated successfully', 'success');
    
    // Close the menu
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
}

function togglePinFolio(folioId) {
    console.log('📌 togglePinFolio called for:', folioId);
    if (!settings.pinnedFolios) settings.pinnedFolios = [];
    
    const isPinned = settings.pinnedFolios.includes(folioId);
    console.log('📌 Is currently pinned:', isPinned);
    
    if (isPinned) {
        // Unpin
        settings.pinnedFolios = settings.pinnedFolios.filter(id => id !== folioId);
        showMessage('Folio unpinned', 'info');
        console.log('📌 Folio unpinned, new pinned array:', settings.pinnedFolios);
    } else {
        // Pin (max 3)
        if (settings.pinnedFolios.length >= 3) {
            showMessage('Maximum 3 folios can be pinned. Unpin one first.', 'warning');
            return;
        }
        settings.pinnedFolios.push(folioId);
        showMessage('Folio pinned', 'success');
        console.log('📌 Folio pinned, new pinned array:', settings.pinnedFolios);
    }
    
    saveData();
    updateRecentFoliosWidget();
    
    // Close the menu
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
}

// Close dropdown menus when clicking outside
document.addEventListener('click', (event) => {
    if (!event.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    }
});

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
    // Helper function to safely add event listeners
    function addListener(id, event, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Element with ID '${id}' not found, skipping event listener`);
        }
    }
    
    // Core chat functionality
    addListener('sendBtn', 'click', sendMessage);
    
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        messageInput.addEventListener('input', autoResizeTextarea);
    }
    
    // Navigation
    addListener('browseFoliosBtn', 'click', showFolioSelectionModal);
    
    // Modals and settings
    addListener('settingsBtn', 'click', openSettings);
    addListener('advancedSetupBtn', 'click', openSettings);
    addListener('exportBtn', 'click', () => showModal('exportModal'));
    addListener('exportCurrentBtn', 'click', () => {
        if (!currentFolio) {
            showMessage('No folio selected to export', 'error');
            return;
        }
        exportFolioAsMarkdown(currentFolio);
        closeModal('exportModal');
    });
    addListener('exportAllBtn', 'click', () => {
        exportAllDataAsMarkdown();
        closeModal('exportModal');
    });
    addListener('syncBtn', 'click', () => showModal('syncModal'));
    addListener('newFolioBtn', 'click', () => showModal('folioModal'));
    addListener('webSearchBtn', 'click', showWebSearchModal);
    addListener('webSearchInfoBtn', 'click', toggleWebSearchInfoTooltip);
    addListener('newArtifactBtn', 'click', () => createArtifactFromTemplate('note'));
    addListener('generateArtifactBtn', 'click', showArtifactGenerationMenu);
    
    // Modal form handlers
    addListener('cancelEditConversationBtn', 'click', () => closeModal('editConversationModal'));
    addListener('confirmDeleteBtn', 'click', confirmDelete);
    addListener('cancelDeleteBtn', 'click', () => closeModal('deleteConfirmationModal'));
    
    addListener('createFolioBtn', 'click', createFolio);
    addListener('cancelFolioBtn', 'click', () => closeModal('folioModal'));
    addListener('saveArtifactBtn', 'click', saveArtifact);
    addListener('cancelArtifactBtn', 'click', () => closeModal('artifactModal'));
    
    // Web search setup
    setupWebSearchEventListeners();
    
    // Global modal close handlers
    document.querySelectorAll('.modal').forEach(modal => {
        // Click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('Closing modal by clicking outside:', modal.id);
                closeModal(modal.id);
            }
        });
        
        // Close button handler
        const closeBtn = modal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Closing modal by close button:', modal.id);
                closeModal(modal.id);
            });
        }
    });
    
    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                console.log('Closing modal with Escape key:', openModal.id);
                closeModal(openModal.id);
            }
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
                // Ensure current folio exists
                if (!currentFolio || !folios[currentFolio]) {
                    return;
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

function generateArtifactFromFolio(folioId, type = 'summary') {
    if (!folios[folioId]) {
        showMessage('Folio not found', 'error');
        return;
    }
    
    const folio = folios[folioId];
    const template = artifactTemplates[type];
    
    // Create AI prompt for artifact generation
    const prompt = buildArtifactGenerationPrompt(folio, type);
    
    // Show loading state
    showMessage('Generating document from folio dialogue...', 'info');
    
    // Call AI to generate artifact content
    generateArtifactContent(prompt, type, folio.title);
}

function buildArtifactGenerationPrompt(folio, type) {
    const messages = folio.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
    
    const prompts = {
        'summary': `Create a comprehensive summary document from this folio dialogue. Include key points, decisions, and action items.\n\nDialogue:\n${messages}`,
        'plan': `Create a structured project plan based on this folio dialogue. Include objectives, tasks, timeline, and resources.\n\nDialogue:\n${messages}`,
        'research': `Create a research document summarizing findings and insights from this folio dialogue. Include key data points and conclusions.\n\nDialogue:\n${messages}`,
        'meeting': `Create meeting notes from this folio dialogue. Include agenda items discussed, decisions made, and action items.\n\nDialogue:\n${messages}`,
        'report': `Create a formal report based on this folio dialogue. Include executive summary, findings, and recommendations.\n\nDialogue:\n${messages}`
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
            sourceFolio: folios[currentFolio]?.id,
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
    if (!currentFolio || !folios[currentFolio] || !folios[currentFolio].messages.length) {
        showMessage('No active folio with messages to generate document from', 'error');
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
        
        // Initialize hybrid LLM system
        await initializeHybridLLMSystem();
        
        updateUI();
        
        // Setup tooltips
        setupTooltips();
        
        // Start monitoring for search imports
        startImportMonitoring();
        
        // Check for pending queries from context menu/omnibox
        await checkPendingQuery();
        
        // Load existing folio dialogue if available
        if (folios[currentFolio] && folios[currentFolio].messages) {
            // Display existing messages
            folios[currentFolio].messages.forEach(message => {
                displayMessage(message);
            });
            scrollToBottom();
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

// ========== HYBRID LLM SYSTEM ==========

/**
 * Initialize the hybrid LLM system
 */
async function initializeHybridLLMSystem() {
    try {
        // Initialize Ollama client
        ollamaClient = new OllamaClient();
        
        // Initialize LLM router
        llmRouter = new LLMRouter(ollamaClient);
        
        // Initialize model manager
        modelManager = new ModelManager(ollamaClient, llmRouter);
        
        console.log('Hybrid LLM system initialized');
        
        // Log connection status
        setTimeout(() => {
            if (ollamaClient.isConnected()) {
                const models = ollamaClient.getAvailableModels();
                const activeModel = ollamaClient.getActiveModel();
                console.log(`Ollama connected with ${models.length} models. Active: ${activeModel}`);
            } else {
                console.log('Ollama not available - using cloud-only mode');
            }
        }, 2000); // Give it time to establish connection
        
    } catch (error) {
        console.error('Error initializing hybrid LLM system:', error);
        // Continue without Ollama if initialization fails
        console.log('Falling back to cloud-only mode');
    }
}

/**
 * Get LLM response using hybrid routing
 */
async function getHybridLLMResponse(messages, originalMessage) {
    try {
        // If hybrid system not available, use cloud fallback
        if (!llmRouter) {
            console.log('Hybrid system not available, using cloud API');
            return await callLLMAPI(messages);
        }
        
        // Use hybrid routing
        const response = await llmRouter.query(originalMessage, messages);
        
        // Log routing decision for debugging
        console.log(`LLM routed to: ${response.source} (${response.routing})`);
        
        return response.content;
        
    } catch (error) {
        console.error('Hybrid LLM error:', error);
        
        // Fallback to cloud API if hybrid fails
        console.log('Falling back to cloud API due to hybrid system error');
        return await callLLMAPI(messages);
    }
}

/**
 * Get current model information for display
 */
function getCurrentModelInfo() {
    if (!ollamaClient || !ollamaClient.isConnected()) {
        return {
            source: 'cloud',
            model: settings.apiProvider || 'Cloud LLM',
            available: true
        };
    }
    
    const activeModel = ollamaClient.getActiveModel();
    const modelInfo = modelManager ? modelManager.getModelDisplayName(activeModel) : activeModel;
    
    return {
        source: 'local',
        model: modelInfo || 'Local LLM',
        available: !!activeModel
    };
}

/**
 * Check if local LLM is available
 */
function isLocalLLMAvailable() {
    return ollamaClient && ollamaClient.isConnected() && ollamaClient.getActiveModel();
}

/**
 * Force local routing for next request
 */
function forceLocalRouting() {
    return { forceLocal: true };
}

/**
 * Force cloud routing for next request  
 */
function forceCloudRouting() {
    return { forceCloud: true };
}

/**
 * Get routing statistics
 */
function getRoutingStatistics() {
    if (!llmRouter) return null;
    
    return llmRouter.getPerformanceStats();
}

/**
 * Refresh Ollama connection and models
 */
async function refreshOllamaConnection() {
    if (ollamaClient) {
        try {
            const status = await ollamaClient.refresh();
            console.log('Ollama refresh result:', status);
            return status;
        } catch (error) {
            console.error('Error refreshing Ollama:', error);
            return { connected: false, error: error.message };
        }
    }
    return { connected: false, error: 'Ollama client not initialized' };
}

// Make functions globally accessible for HTML onclick handlers
window.editArtifact = editArtifact;
window.duplicateArtifact = duplicateArtifact;
window.generateArtifactFromFolio = generateArtifactFromFolio;
window.createArtifactFromTemplate = createArtifactFromTemplate;
window.showArtifactGenerationMenu = showArtifactGenerationMenu;

// Make hybrid LLM functions accessible
window.getCurrentModelInfo = getCurrentModelInfo;
window.isLocalLLMAvailable = isLocalLLMAvailable;
window.forceLocalRouting = forceLocalRouting;
window.forceCloudRouting = forceCloudRouting;
window.getRoutingStatistics = getRoutingStatistics;
window.refreshOllamaConnection = refreshOllamaConnection;

// Make web search function accessible
window.showWebSearchModal = showWebSearchModal;

// Make dropdown menu functions accessible
window.toggleFolioMenu = toggleFolioMenu;
window.duplicateFolio = duplicateFolio;
window.togglePinFolio = togglePinFolio;