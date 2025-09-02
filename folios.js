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
            messages: [],
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
    const card = document.createElement('div');
    card.className = 'folio-card';
    if (folio.id === currentFolio) {
        card.classList.add('current');
    }
    
    card.innerHTML = `
        <div class="folio-card-header">
            <div class="folio-card-title">${folio.title}</div>
            <div class="folio-card-menu">
                <button class="menu-btn" aria-label="Folio options">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z"/>
                    </svg>
                </button>
                <div class="menu-dropdown">
                    <button class="menu-item edit-folio-btn" data-folio-id="${folio.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                        Edit
                    </button>
                    <button class="menu-item delete-folio-btn" data-folio-id="${folio.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>
        </div>
        <div class="folio-card-description">${folio.description || 'No description'}</div>
    `;
    
    card.addEventListener('click', (e) => {
        // Don't select if clicking on menu buttons or menu items
        if (e.target.closest('.folio-card-menu')) return;
        selectFolio(folio.id);
    });
    
    return card;
}

function selectFolio(folioId) {
    switchFolio(folioId);
    closeModal('folioSelectionModal');
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


// ========== UTILITY FUNCTIONS ==========


function getFolioLastUsed(folioId) {
    const folio = folios[folioId];
    if (!folio) return new Date().toISOString();
    
    // For folios, use the lastUsed timestamp (updated when messages are added)
    return folio.lastUsed || folio.createdAt || new Date().toISOString();
}