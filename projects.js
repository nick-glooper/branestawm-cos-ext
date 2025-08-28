// Branestawm - Projects and Conversations Module
// Handles project and conversation management, creation, editing, and switching

// ========== CONVERSATION MANAGEMENT ==========

function newConversation() {
    const id = generateId();
    const conversation = {
        id: id,
        title: 'New Chat',
        messages: [],
        projectId: currentProject,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    conversations[id] = conversation;
    projects[currentProject].conversations.push(id);
    
    currentConversation = id;
    
    // Add to recent conversations
    updateRecentConversations(id);
    
    // Clear chat display
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
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

// ========== PROJECT MANAGEMENT ==========

function createProject() {
    const name = document.getElementById('projectName').value.trim();
    const description = document.getElementById('projectDescription').value.trim();
    const customInstructions = document.getElementById('projectInstructions').value.trim();
    
    if (!name) {
        showMessage('Project name is required', 'error');
        return;
    }
    
    const projectModal = document.getElementById('projectModal');
    const existingId = projectModal.dataset.projectId;
    
    if (existingId) {
        // Edit existing project
        const project = projects[existingId];
        if (project) {
            project.name = name;
            project.description = description;
            project.customInstructions = customInstructions;
            project.updatedAt = new Date().toISOString();
            showMessage(`Project "${name}" updated successfully!`, 'success');
        }
        delete projectModal.dataset.projectId;
        document.getElementById('projectModalTitle').textContent = 'New Project';
    } else {
        // Create new project
        const projectId = generateId();
        const project = {
            id: projectId,
            name: name,
            description: description,
            customInstructions: customInstructions,
            conversations: [],
            artifacts: [],
            createdAt: new Date().toISOString()
        };
        
        projects[projectId] = project;
        currentProject = projectId;
        updateRecentProjects(projectId);
        showMessage(`Project "${name}" created successfully!`, 'success');
    }
    
    // Clear form
    document.getElementById('projectName').value = '';
    document.getElementById('projectDescription').value = '';
    document.getElementById('projectInstructions').value = '';
    
    closeModal('projectModal');
    updateUI();
    saveData();
}

function editProject(projectId) {
    const project = projects[projectId];
    if (!project) return;
    
    // Populate the project modal with existing data
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectDescription').value = project.description || '';
    document.getElementById('projectInstructions').value = project.customInstructions || '';
    document.getElementById('projectModalTitle').textContent = 'Edit Project';
    
    // Store the project ID for saving
    document.getElementById('projectModal').dataset.projectId = projectId;
    
    showModal('projectModal');
}

function switchProject(projectId) {
    if (!projects[projectId]) return;
    
    currentProject = projectId;
    currentConversation = null;
    
    // Update recent projects
    updateRecentProjects(projectId);
    
    // Clear chat display
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    updateUI();
    saveData();
}

function deleteProject(projectId) {
    deleteTarget = { type: 'project', id: projectId };
    showModal('deleteConfirmationModal');
}

function updateCurrentProjectDisplay() {
    const project = projects[currentProject];
    if (!project) return;
    
    const projectSelector = document.querySelector('.project-selector');
    if (projectSelector) {
        projectSelector.textContent = project.name;
    }
}

// ========== PROJECT AND CONVERSATION GRIDS ==========

function showProjectSelectionModal() {
    populateProjectsGrid();
    showModal('projectSelectionModal');
}

function populateProjectsGrid() {
    const grid = document.getElementById('projectsGrid');
    grid.innerHTML = '';
    
    // Sort projects by last used (most recent first)
    const sortedProjects = Object.values(projects).sort((a, b) => {
        const aLastUsed = getProjectLastUsed(a.id);
        const bLastUsed = getProjectLastUsed(b.id);
        return new Date(bLastUsed) - new Date(aLastUsed);
    });
    
    sortedProjects.forEach(project => {
        const projectCard = createProjectCard(project);
        grid.appendChild(projectCard);
    });
}

function createProjectCard(project) {
    const lastUsedDate = getProjectLastUsed(project.id);
    const lastUsedText = lastUsedDate ? new Date(lastUsedDate).toLocaleDateString() : 'Never';
    
    const conversationCount = project.conversations?.length || 0;
    const artifactCount = project.artifacts?.length || 0;
    
    const card = document.createElement('div');
    card.className = 'project-card';
    if (project.id === currentProject) {
        card.classList.add('current');
    }
    
    card.innerHTML = `
        <div class="project-card-header">
            <div class="project-card-title">${project.name}</div>
            <div class="project-card-actions">
                <button class="action-btn edit-btn" aria-label="Edit project" onclick="editProject('${project.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                </button>
                <button class="action-btn delete-btn" aria-label="Delete project" onclick="deleteProject('${project.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="project-card-description">${project.description || 'No description'}</div>
        <div class="project-card-stats">
            <span class="stat">${conversationCount} chats</span>
            <span class="stat">${artifactCount} notes</span>
            ${project.customInstructions ? '<span class="stat custom-instructions-indicator">Custom Instructions</span>' : ''}
        </div>
        <div class="project-card-meta">Last used: ${lastUsedText}</div>
    `;
    
    card.addEventListener('click', (e) => {
        // Don't select if clicking on action buttons
        if (e.target.closest('.action-btn')) return;
        selectProject(project.id);
    });
    
    return card;
}

function selectProject(projectId) {
    switchProject(projectId);
    closeModal('projectSelectionModal');
}

function showConversationSelectionModal() {
    populateConversationsGrid();
    showModal('conversationSelectionModal');
}

function populateConversationsGrid() {
    const grid = document.getElementById('conversationsGrid');
    grid.innerHTML = '';
    
    const projectConversations = projects[currentProject]?.conversations || [];
    
    if (projectConversations.length === 0) {
        grid.innerHTML = '<div class="empty-state">No conversations yet. Start a new chat!</div>';
        return;
    }
    
    // Sort conversations by last updated (most recent first)
    const sortedConversations = projectConversations
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

function updateRecentProjects(projectId) {
    if (!recentProjects) recentProjects = [];
    
    // Remove if already exists
    recentProjects = recentProjects.filter(id => id !== projectId);
    
    // Add to beginning
    recentProjects.unshift(projectId);
    
    // Keep only last 10
    recentProjects = recentProjects.slice(0, 10);
    
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

function getProjectLastUsed(projectId) {
    const project = projects[projectId];
    if (!project || !project.conversations) return project?.createdAt || new Date().toISOString();
    
    let lastUsed = project.createdAt || new Date().toISOString();
    
    project.conversations.forEach(convId => {
        const conversation = conversations[convId];
        if (conversation && conversation.updatedAt) {
            if (new Date(conversation.updatedAt) > new Date(lastUsed)) {
                lastUsed = conversation.updatedAt;
            }
        }
    });
    
    return lastUsed;
}