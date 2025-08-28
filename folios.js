// Branestawm - Folios Module
// Handles folio management, creation, editing, and switching (each folio = one continuous dialogue)

// ========== FOLIO DIALOGUE MANAGEMENT ==========
// Each folio has one continuous dialogue - no separate conversations

function switchFolio(folioId) {
    if (!folios[folioId]) return;
    
    currentFolio = folioId;
    
    // Update recent folios
    updateRecentFolios(folioId);
    
    // Clear and reload chat display with folio's dialogue
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    // Display all messages from this folio's dialogue
    if (folios[folioId].messages) {
        folios[folioId].messages.forEach(message => {
            displayMessage(message);
        });
    }
    
    scrollToBottom();
    updateUI();
    saveData();
}

function switchToConversation(conversationId) {
    if (!conversations[conversationId]) return;
    
    currentConversation = conversationId;
    
    // Clear and populate chat messages
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    // Display all messages from this conversation
    conversations[conversationId].messages.forEach(message => {
        displayMessage(message);
    });
    
    scrollToBottom();
    updateRecentConversationsWidget(); // Refresh to show active state
    saveData();
}

function editConversation(conversationId) {
    const conversation = conversations[conversationId];
    if (!conversation) return;
    
    // Populate the conversation modal with existing data
    document.getElementById('conversationTitle').value = conversation.title;
    document.getElementById('editConversationModalTitle').textContent = 'Edit Conversation';
    
    // Store the conversation ID for saving
    document.getElementById('editConversationModal').dataset.conversationId = conversationId;
    
    showModal('editConversationModal');
}

function saveConversationChanges() {
    const title = document.getElementById('conversationTitle').value.trim();
    const conversationModal = document.getElementById('editConversationModal');
    const conversationId = conversationModal.dataset.conversationId;
    
    if (!title) {
        showMessage('Conversation title is required', 'error');
        return;
    }
    
    if (!conversationId || !conversations[conversationId]) {
        showMessage('Conversation not found', 'error');
        return;
    }
    
    conversations[conversationId].title = title;
    conversations[conversationId].updatedAt = new Date().toISOString();
    
    // Clear modal data
    delete conversationModal.dataset.conversationId;
    
    closeModal('editConversationModal');
    updateUI();
    showMessage('Conversation updated successfully!', 'success');
    saveData();
}

function deleteConversation(conversationId) {
    deleteTarget = { type: 'conversation', id: conversationId };
    showModal('deleteConfirmationModal');
}

// ========== FOLIO MANAGEMENT ==========

function createFolio() {
    const title = document.getElementById('folioTitle').value.trim();
    const description = document.getElementById('folioDescription').value.trim();
    const guidelines = document.getElementById('folioGuidelines').value.trim();
    const assignedPersona = document.getElementById('folioPersona').value;
    
    if (!title) {
        showMessage('Folio title is required', 'error');
        return;
    }
    
    if (!assignedPersona || !settings.personas[assignedPersona]) {
        showMessage('Please select a valid persona', 'error');
        return;
    }
    
    const folioModal = document.getElementById('folioModal');
    const existingId = folioModal.dataset.folioId;
    
    if (existingId) {
        // Edit existing folio
        const folio = folios[existingId];
        if (folio) {
            folio.title = title;
            folio.description = description;
            folio.guidelines = guidelines;
            folio.assignedPersona = assignedPersona;
            folio.updatedAt = new Date().toISOString();
            showMessage(`Folio "${title}" updated successfully!`, 'success');
        }
        delete folioModal.dataset.folioId;
        document.getElementById('folioModalTitle').textContent = 'New Folio';
    } else {
        // Create new folio
        const folioId = generateId();
        const folio = {
            id: folioId,
            title: title,
            description: description,
            guidelines: guidelines,
            assignedPersona: assignedPersona,
            conversations: [],
            artifacts: [],
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
        };
        
        folios[folioId] = folio;
        currentFolio = folioId;
        updateRecentFolios(folioId);
        showMessage(`Folio "${title}" created successfully!`, 'success');
    }
    
    // Clear form
    document.getElementById('folioTitle').value = '';
    document.getElementById('folioDescription').value = '';
    document.getElementById('folioGuidelines').value = '';
    document.getElementById('folioPersona').value = 'core';
    
    closeModal('folioModal');
    updateUI();
    saveData();
}

function editFolio(folioId) {
    const folio = folios[folioId];
    if (!folio) return;
    
    // Populate the folio modal with existing data
    document.getElementById('folioTitle').value = folio.title;
    document.getElementById('folioDescription').value = folio.description || '';
    document.getElementById('folioGuidelines').value = folio.guidelines || '';
    document.getElementById('folioPersona').value = folio.assignedPersona || 'core';
    document.getElementById('folioModalTitle').textContent = 'Edit Folio';
    
    // Store the folio ID for saving
    document.getElementById('folioModal').dataset.folioId = folioId;
    
    showModal('folioModal');
}

function switchFolio(folioId) {
    if (!folios[folioId]) return;
    
    currentFolio = folioId;
    currentConversation = null;
    
    // Update recent folios
    updateRecentFolios(folioId);
    
    // Clear chat display
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    updateUI();
    saveData();
}

function deleteFolio(folioId) {
    deleteTarget = { type: 'folio', id: folioId };
    showModal('deleteConfirmationModal');
}

function updateCurrentFolioDisplay() {
    const folio = folios[currentFolio];
    if (!folio) return;
    
    const folioSelector = document.querySelector('.folio-selector');
    if (folioSelector) {
        folioSelector.textContent = folio.title;
    }
}

// ========== FOLIO AND CONVERSATION GRIDS ==========

function showFolioSelectionModal() {
    populateFoliosGrid();
    showModal('folioSelectionModal');
}

function populateFoliosGrid() {
    const grid = document.getElementById('foliosGrid');
    grid.innerHTML = '';
    
    // Sort folios by last used (most recent first)
    const sortedFolios = Object.values(folios).sort((a, b) => {
        const aLastUsed = getFolioLastUsed(a.id);
        const bLastUsed = getFolioLastUsed(b.id);
        return new Date(bLastUsed) - new Date(aLastUsed);
    });
    
    sortedFolios.forEach(folio => {
        const folioCard = createFolioCard(folio);
        grid.appendChild(folioCard);
    });
}

function createFolioCard(folio) {
    const lastUsedDate = getFolioLastUsed(folio.id);
    const lastUsedText = lastUsedDate ? new Date(lastUsedDate).toLocaleDateString() : 'Never';
    
    const conversationCount = folio.conversations?.length || 0;
    const artifactCount = folio.artifacts?.length || 0;
    const persona = settings.personas[folio.assignedPersona];
    
    const card = document.createElement('div');
    card.className = 'folio-card';
    if (folio.id === currentFolio) {
        card.classList.add('current');
    }
    
    card.innerHTML = `
        <div class="folio-card-header">
            <div class="folio-card-title">${folio.title}</div>
            <div class="folio-card-actions">
                <button class="action-btn edit-btn" aria-label="Edit folio" onclick="editFolio('${folio.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                </button>
                <button class="action-btn delete-btn" aria-label="Delete folio" onclick="deleteFolio('${folio.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="folio-card-description">${folio.description || 'No description'}</div>
        <div class="folio-card-stats">
            <span class="stat">${conversationCount} chats</span>
            <span class="stat">${artifactCount} notes</span>
            ${persona ? `<span class="stat persona-indicator">${persona.name}</span>` : ''}
        </div>
        <div class="folio-card-meta">Last used: ${lastUsedText}</div>
    `;
    
    card.addEventListener('click', (e) => {
        // Don't select if clicking on action buttons
        if (e.target.closest('.action-btn')) return;
        selectFolio(folio.id);
    });
    
    return card;
}

function selectFolio(folioId) {
    switchFolio(folioId);
    closeModal('folioSelectionModal');
}

function showConversationSelectionModal() {
    populateConversationsGrid();
    showModal('conversationSelectionModal');
}

function populateConversationsGrid() {
    const grid = document.getElementById('conversationsGrid');
    grid.innerHTML = '';
    
    const folioConversations = folios[currentFolio]?.conversations || [];
    
    if (folioConversations.length === 0) {
        grid.innerHTML = '<div class="empty-state">No conversations yet. Start a new chat!</div>';
        return;
    }
    
    // Sort conversations by last updated (most recent first)
    const sortedConversations = folioConversations
        .map(id => conversations[id])
        .filter(conv => conv)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    
    sortedConversations.forEach(conversation => {
        const conversationCard = createConversationCard(conversation);
        grid.appendChild(conversationCard);
    });
}

function createConversationCard(conversation) {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const preview = lastMessage ? generateConversationPreview(conversation) : 'No messages yet';
    const lastUpdated = new Date(conversation.updatedAt || conversation.createdAt).toLocaleDateString();
    
    const card = document.createElement('div');
    card.className = 'conversation-card';
    if (conversation.id === currentConversation) {
        card.classList.add('current');
    }
    
    card.innerHTML = `
        <div class="conversation-card-header">
            <div class="conversation-card-title">${conversation.title}</div>
            <div class="conversation-card-actions">
                <button class="action-btn edit-btn" aria-label="Edit conversation" onclick="editConversation('${conversation.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                </button>
                <button class="action-btn delete-btn" aria-label="Delete conversation" onclick="deleteConversation('${conversation.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="conversation-card-preview">${preview}</div>
        <div class="conversation-card-meta">
            <span class="message-count">${conversation.messages.length} messages</span>
            <span class="last-updated">Updated ${lastUpdated}</span>
        </div>
    `;
    
    card.addEventListener('click', (e) => {
        // Don't select if clicking on action buttons
        if (e.target.closest('.action-btn')) return;
        selectConversation(conversation.id);
    });
    
    return card;
}

function selectConversation(conversationId) {
    switchToConversation(conversationId);
    closeModal('conversationSelectionModal');
}

// ========== RECENT ITEMS MANAGEMENT ==========

function updateRecentFolios(folioId) {
    if (!recentFolios) recentFolios = [];
    
    // Remove if already exists
    recentFolios = recentFolios.filter(id => id !== folioId);
    
    // Add to beginning
    recentFolios.unshift(folioId);
    
    // Keep only last 10
    recentFolios = recentFolios.slice(0, 10);
    
    saveData();
}

function updateRecentConversations(conversationId) {
    if (!recentConversations) recentConversations = [];
    
    // Remove if already exists
    recentConversations = recentConversations.filter(id => id !== conversationId);
    
    // Add to beginning
    recentConversations.unshift(conversationId);
    
    // Keep only last 10
    recentConversations = recentConversations.slice(0, 10);
    
    saveData();
}

// ========== UTILITY FUNCTIONS ==========

function generateConversationPreview(conversation) {
    if (!conversation.messages || conversation.messages.length === 0) {
        return 'No messages yet';
    }
    
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const preview = lastMessage.content.substring(0, 100);
    return preview + (lastMessage.content.length > 100 ? '...' : '');
}

function getFolioLastUsed(folioId) {
    const folio = folios[folioId];
    if (!folio || !folio.conversations) return folio?.createdAt || new Date().toISOString();
    
    let lastUsed = folio.lastUsed || folio.createdAt || new Date().toISOString();
    
    folio.conversations.forEach(convId => {
        const conversation = conversations[convId];
        if (conversation && conversation.updatedAt) {
            if (new Date(conversation.updatedAt) > new Date(lastUsed)) {
                lastUsed = conversation.updatedAt;
            }
        }
    });
    
    return lastUsed;
}