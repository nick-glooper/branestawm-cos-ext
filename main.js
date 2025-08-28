// Branestawm - Your AI Chief of Staff
// Main application logic for full-page tab interface

// Global state
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


// ========== GOOGLE OAUTH AUTHENTICATION ==========

async function authenticateWithGoogle() {
    try {
        showMessage('Connecting to Google...', 'info');
        
        const token = await new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: true }, (token) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(token);
                }
            });
        });
        
        // Test the token with a simple API call
        await testGoogleConnection(token);
        
        // Save auth method and token
        settings.authMethod = 'google';
        settings.googleToken = token;
        await saveData();
        
        closeModal('setupModal');
        showMessage('Successfully connected to Google Gemini! You have 1,500 free requests per day.', 'success');
        
        // Create first conversation if none exist
        if (Object.keys(conversations).length === 0) {
            newConversation();
        }
        
        updateUI();
        
    } catch (error) {
        console.error('Google auth error:', error);
        showMessage('Google authentication failed: ' + error.message + '. Try the Advanced Setup instead.', 'error');
    }
}

async function testGoogleConnection(token) {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    if (!response.ok) {
        throw new Error(`Connection test failed: ${response.status}`);
    }
    
    return true;
}

// ========== LLM API INTEGRATION ==========

async function callLLMAPI(messages) {
    if (settings.authMethod === 'google' && settings.googleToken) {
        return await callGoogleGeminiAPI(messages);
    } else if (settings.apiKey) {
        return await callGenericAPI(messages);
    } else {
        throw new Error('No authentication method configured. Please run setup again.');
    }
}

async function callGoogleGeminiAPI(messages) {
    try {
        // Convert messages to Gemini format
        const contents = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));
        
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.googleToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: contents,
                generationConfig: {
                    maxOutputTokens: 2048,
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40
                },
                safetySettings: [
                    {
                        category: 'HARM_CATEGORY_HARASSMENT',
                        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                    },
                    {
                        category: 'HARM_CATEGORY_HATE_SPEECH',
                        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                    }
                ]
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                // Token expired, clear it
                settings.googleToken = null;
                await saveData();
                throw new Error('Authentication expired. Please sign in again in Settings.');
            }
            const errorData = await response.text();
            throw new Error(`Google API Error (${response.status}): ${errorData}`);
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Invalid response format from Google Gemini');
        }
        
        return data.candidates[0].content.parts[0].text;
        
    } catch (error) {
        console.error('Google Gemini API error:', error);
        throw error;
    }
}

async function callGenericAPI(messages) {
    try {
        const response = await fetch(settings.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify({
                model: settings.model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 2048,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from API');
        }
        
        return data.choices[0].message.content;
        
    } catch (error) {
        console.error('Generic API error:', error);
        throw error;
    }
}

// ========== EXPORT FUNCTIONALITY ==========

async function exportConversationAsMarkdown(conversationId) {
    const conversation = conversations[conversationId];
    if (!conversation) {
        showMessage('Conversation not found', 'error');
        return;
    }
    
    let markdown = `# ${conversation.title}\n\n`;
    markdown += `**Project:** ${projects[conversation.projectId]?.name || 'Unknown'}\n`;
    markdown += `**Created:** ${new Date(conversation.createdAt).toLocaleString()}\n`;
    if (conversation.updatedAt) {
        markdown += `**Last Updated:** ${new Date(conversation.updatedAt).toLocaleString()}\n`;
    }
    markdown += `\n---\n\n`;
    
    conversation.messages.forEach(message => {
        if (message.role === 'user') {
            markdown += `## You\n\n${message.content}\n\n`;
        } else if (message.role === 'assistant') {
            markdown += `## Branestawm\n\n${message.content}\n\n`;
        }
    });
    
    // Add footer
    markdown += `\n---\n\n*Exported from Branestawm - Your AI Chief of Staff*\n`;
    markdown += `*Export Date: ${new Date().toLocaleString()}*\n`;
    
    // Download as file
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `branestawm-${conversation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage('Conversation exported successfully!', 'success');
}

async function exportAllDataAsMarkdown() {
    let allMarkdown = `# Branestawm Complete Export\n\n`;
    allMarkdown += `**Exported:** ${new Date().toLocaleString()}\n`;
    allMarkdown += `**Extension Version:** ${chrome.runtime.getManifest().version}\n\n`;
    allMarkdown += `---\n\n`;
    
    // Export all projects and their conversations
    for (const [projectId, project] of Object.entries(projects)) {
        allMarkdown += `# Project: ${project.name}\n\n`;
        if (project.description) {
            allMarkdown += `**Description:** ${project.description}\n\n`;
        }
        allMarkdown += `**Created:** ${new Date(project.createdAt || Date.now()).toLocaleString()}\n\n`;
        
        // Export conversations in this project
        const projectConversations = project.conversations || [];
        if (projectConversations.length > 0) {
            allMarkdown += `## Conversations\n\n`;
            
            for (const convId of projectConversations) {
                const conversation = conversations[convId];
                if (!conversation) continue;
                
                allMarkdown += `### ${conversation.title}\n\n`;
                allMarkdown += `**Created:** ${new Date(conversation.createdAt).toLocaleString()}\n\n`;
                
                conversation.messages.forEach(message => {
                    if (message.role === 'user') {
                        allMarkdown += `**You:** ${message.content}\n\n`;
                    } else if (message.role === 'assistant') {
                        allMarkdown += `**Branestawm:** ${message.content}\n\n`;
                    }
                });
                allMarkdown += `---\n\n`;
            }
        }
        
        // Export notes/artifacts in this project
        const projectArtifacts = project.artifacts || [];
        if (projectArtifacts.length > 0) {
            allMarkdown += `## Notes\n\n`;
            
            for (const artifactId of projectArtifacts) {
                const artifact = artifacts[artifactId];
                if (!artifact) continue;
                
                allMarkdown += `### ${artifact.name}\n\n`;
                allMarkdown += `**Created:** ${new Date(artifact.createdAt || Date.now()).toLocaleString()}\n\n`;
                allMarkdown += `${artifact.content}\n\n`;
                allMarkdown += `---\n\n`;
            }
        }
        
        allMarkdown += `\n\n`;
    }
    
    // Add footer
    allMarkdown += `\n---\n\n`;
    allMarkdown += `*Complete export from Branestawm - Your AI Chief of Staff*\n`;
    allMarkdown += `*Your indispensable cognitive prosthetic for neurodivergent support*\n`;
    allMarkdown += `*Export Date: ${new Date().toLocaleString()}*\n`;
    
    // Download as file
    const blob = new Blob([allMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `branestawm-complete-export-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage('Complete data export successful! Your data is now saved as a markdown file.', 'success');
}

// ========== SETUP MODAL FUNCTIONS ==========

function showSetupModal() {
    document.getElementById('setupModal').classList.add('show');
}

// ========== CORE CHAT FUNCTIONALITY ==========

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) return;
    if (isProcessing) return;
    
    // Check if user is authenticated
    if (!settings.googleToken && !settings.apiKey) {
        showMessage('Please complete setup first. Click the settings button to configure your API.', 'error');
        showSetupModal();
        return;
    }
    
    if (!currentConversation) {
        newConversation();
    }
    
    isProcessing = true;
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    try {
        // Add user message
        addMessage(currentConversation, 'user', message);
        
        // Show typing indicator
        const typingDiv = addTypingIndicator();
        
        // Prepare messages for API
        const currentDate = new Date();
        const dateString = currentDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        const timeString = currentDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });
        
        let messages = [
            { 
                role: 'system', 
                content: `${settings.systemPrompt}

📅 CURRENT DATE AND TIME: ${dateString} at ${timeString}
🗓️ Today is: ${dateString}
⏰ Current time: ${timeString}

IMPORTANT: When users reference relative dates like "yesterday", "Saturday just gone", "last week", etc., calculate from TODAY'S date: ${dateString}. You have full access to current date/time information above.` 
            }
        ];
        
        // Add conversation history (last 10 messages to stay within context limits)
        const recentMessages = conversations[currentConversation].messages.slice(-10);
        messages = messages.concat(recentMessages);
        
        // Note: Web search is now handled via external import system
        
        // Get AI response
        const response = await callLLMAPI(messages);
        
        // Remove typing indicator
        removeTypingIndicator(typingDiv);
        
        // Add AI response
        addMessage(currentConversation, 'assistant', response);
        
        // Update conversation title if it's the first exchange
        const conv = conversations[currentConversation];
        if (conv.messages.length === 2 && conv.title === 'New Chat') {
            conv.title = generateConversationTitle(message);
            conv.updatedAt = new Date().toISOString();
            updateRecentConversationsWidget();
        }
        
        // Save data
        await saveData();
        
    } catch (error) {
        console.error('Error sending message:', error);
        
        // Remove typing indicator
        const typingDiv = document.querySelector('.message.typing');
        if (typingDiv) {
            removeTypingIndicator(typingDiv);
        }
        
        // Show error message
        addMessage(currentConversation, 'system', `Sorry, I encountered an error: ${error.message}. Please check your connection and try again.`);
        showMessage('Error: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// Note: Old web search integration removed - now handled via external import system

// ========== UI HELPER FUNCTIONS ==========

function addMessage(conversationId, role, content) {
    if (!conversations[conversationId]) return;
    
    const message = {
        id: generateId(),
        role: role,
        content: content,
        timestamp: new Date().toISOString()
    };
    
    conversations[conversationId].messages.push(message);
    conversations[conversationId].updatedAt = new Date().toISOString();
    
    // Update UI
    displayMessage(message);
    scrollToBottom();
}

function displayMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;
    messageDiv.innerHTML = formatMessage(message.content, message.role);
    chatMessages.appendChild(messageDiv);
}

function formatMessage(content, role) {
    if (role === 'system') {
        return content;
    }
    
    // Basic markdown formatting
    let formatted = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
    
    // Format lists
    formatted = formatted.replace(/^(\d+\.|\-|\*) (.+)$/gm, '<div class="list-item">$1 $2</div>');
    
    return formatted;
}

function addTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant typing';
    typingDiv.innerHTML = '<div class="typing-animation"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(typingDiv);
    scrollToBottom();
    return typingDiv;
}

function removeTypingIndicator(typingDiv) {
    if (typingDiv && typingDiv.parentNode) {
        typingDiv.parentNode.removeChild(typingDiv);
    }
}

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
    // Send message
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    
    // Enter key in input
    document.getElementById('messageInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Auto-resize textarea
    document.getElementById('messageInput').addEventListener('input', autoResizeTextarea);
    
    // Setup modal events
    document.getElementById('googleAuthBtn').addEventListener('click', authenticateWithGoogle);
    document.getElementById('advancedSetupBtn').addEventListener('click', () => {
        closeModal('setupModal');
        openSettings();
    });
    
    // Export events
    document.getElementById('exportBtn').addEventListener('click', () => {
        showModal('exportModal');
    });
    
    document.getElementById('exportCurrentBtn').addEventListener('click', () => {
        closeModal('exportModal');
        if (currentConversation) {
            exportConversationAsMarkdown(currentConversation);
        } else {
            showMessage('No conversation selected to export', 'error');
        }
    });
    
    document.getElementById('exportAllBtn').addEventListener('click', () => {
        closeModal('exportModal');
        exportAllDataAsMarkdown();
    });
    
    // Other UI events
    document.getElementById('webSearchBtn').addEventListener('click', showWebSearchModal);
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('syncBtn').addEventListener('click', () => showModal('syncModal'));
    document.getElementById('newProjectBtn').addEventListener('click', () => showModal('projectModal'));
    document.getElementById('newChatBtn').addEventListener('click', newConversation);
    document.getElementById('newArtifactBtn').addEventListener('click', () => showModal('artifactModal'));
    
    // Project and conversation selection
    document.getElementById('browseProjectsBtn').addEventListener('click', showProjectSelectionModal);
    document.getElementById('browseConversationsBtn').addEventListener('click', showConversationSelectionModal);
    
    // Edit conversation modal events
    document.getElementById('saveConversationBtn').addEventListener('click', saveConversationChanges);
    document.getElementById('cancelEditConversationBtn').addEventListener('click', () => closeModal('editConversationModal'));
    
    // Delete confirmation modal events
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => closeModal('deleteConfirmationModal'));
    
    // Modal action events
    document.getElementById('createProjectBtn').addEventListener('click', createProject);
    document.getElementById('cancelProjectBtn').addEventListener('click', () => closeModal('projectModal'));
    document.getElementById('saveArtifactBtn').addEventListener('click', saveArtifact);
    document.getElementById('cancelArtifactBtn').addEventListener('click', () => closeModal('artifactModal'));
    
    // Modal close events
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });
    
    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal(this.id);
            }
        });
    });
}

// ========== CHECK FOR PENDING QUERY ==========

async function checkPendingQuery() {
    const result = await chrome.storage.local.get(['pendingQuery', 'pendingQueryTimestamp']);
    
    if (result.pendingQuery && result.pendingQueryTimestamp) {
        // Check if query is recent (within 5 minutes)
        const age = Date.now() - result.pendingQueryTimestamp;
        if (age < 5 * 60 * 1000) {
            // Create new conversation with the pending query
            if (!currentConversation) {
                newConversation();
            }
            
            // Set the query in the input
            document.getElementById('messageInput').value = result.pendingQuery;
            
            // Focus on the input
            document.getElementById('messageInput').focus();
            
            // Optionally auto-send after a brief delay
            setTimeout(() => {
                if (document.getElementById('messageInput').value === result.pendingQuery) {
                    sendMessage();
                }
            }, 500);
        }
        
        // Clear the pending query
        chrome.storage.local.remove(['pendingQuery', 'pendingQueryTimestamp']);
    }
}

// ========== UTILITY FUNCTIONS ==========

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function generateConversationTitle(firstMessage) {
    // Generate a title from the first message
    const words = firstMessage.split(' ').slice(0, 6);
    const title = words.join(' ');
    return title.length > 50 ? title.substring(0, 47) + '...' : title;
}

function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function autoResizeTextarea() {
    const textarea = document.getElementById('messageInput');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}

function showMessage(message, type = 'info') {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 4000);
}

function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// ========== DATA PERSISTENCE ==========

async function loadData() {
    try {
        const data = await chrome.storage.local.get(['settings', 'projects', 'conversations', 'artifacts', 'currentProject', 'recentProjects', 'recentConversations']);
        
        if (data.settings) {
            settings = { ...settings, ...data.settings };
        }
        
        if (data.projects) {
            projects = data.projects;
        }
        
        if (data.conversations) {
            conversations = data.conversations;
        }
        
        if (data.artifacts) {
            artifacts = data.artifacts;
        }
        
        if (data.currentProject) {
            currentProject = data.currentProject;
        }
        
        if (data.recentProjects) {
            recentProjects = data.recentProjects;
        }
        
        if (data.recentConversations) {
            recentConversations = data.recentConversations;
        }
        
        console.log('Data loaded successfully');
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function saveData() {
    try {
        await chrome.storage.local.set({
            settings: settings,
            projects: projects,
            conversations: conversations,
            artifacts: artifacts,
            currentProject: currentProject,
            recentProjects: recentProjects,
            recentConversations: recentConversations
        });
        
        console.log('Data saved successfully');
        
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// ========== PLACEHOLDER FUNCTIONS ==========
// These functions maintain compatibility with existing features
// that will be implemented in subsequent updates

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
    
    // Clear chat display
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';
    
    updateUI();
    saveData();
}


function updateUI() {
    updateCurrentProjectDisplay();
    updateRecentProjectsWidget();
    updateRecentConversationsWidget();
    updateArtifactsList();
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

function openSettings() {
    chrome.runtime.openOptionsPage();
}

function createProject() {
    const name = document.getElementById('projectName').value.trim();
    const description = document.getElementById('projectDescription').value.trim();
    
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
    
    closeModal('projectModal');
    updateUI();
    saveData();
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

// ========== SEARCH RESULT IMPORT MONITORING ==========

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
            if (importData && importData.status === 'ready') {
                // Process the import
                await processSearchImport(importData, key);
                
                // Clean up the storage
                chrome.storage.local.remove([key]);
            }
        }
    } catch (error) {
        console.error('❌ Error checking for imported results:', error);
    }
}

async function processSearchImport(importData, storageKey) {
    console.log('📥 Processing search import from:', importData.source);
    
    // Ensure we have a current conversation
    if (!currentConversation) {
        newConversation();
    }
    
    // Format the imported content as a system message
    const importMessage = `🌐 **Search Results Imported from ${importData.source}**

**Query:** "${importData.query}"

**Content:**
${importData.content}

**Source:** ${importData.url}
**Imported:** ${new Date(importData.timestamp).toLocaleString()}

---

The above search results have been imported from ${importData.source}. You can now ask questions about this content or request analysis of the information provided.`;
    
    // Add to current conversation as a system message
    addMessage(currentConversation, 'system', importMessage);
    
    // Show user notification
    showMessage(`Search results imported from ${importData.source}!`, 'success');
    
    // Auto-focus on message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.focus();
        messageInput.placeholder = `Ask about the ${importData.source} results...`;
        
        // Reset placeholder after a few seconds
        setTimeout(() => {
            messageInput.placeholder = 'Type your message...';
        }, 5000);
    }
}

// ========== WEB SEARCH MODAL FUNCTIONS ==========

function showWebSearchModal() {
    showModal('webSearchModal');
    setupWebSearchEventListeners();
}

function setupWebSearchEventListeners() {
    // Remove existing listeners to avoid duplicates
    document.getElementById('searchGoogleBtn')?.removeEventListener('click', handleGoogleSearch);
    document.getElementById('searchPerplexityBtn')?.removeEventListener('click', handlePerplexitySearch);
    
    // Add new listeners
    document.getElementById('searchGoogleBtn')?.addEventListener('click', handleGoogleSearch);
    document.getElementById('searchPerplexityBtn')?.addEventListener('click', handlePerplexitySearch);
}

function handleGoogleSearch() {
    // Open Google with AI Overview enabled by default (using udm=50 parameter)
    const googleUrl = 'https://www.google.com/search?udm=50';
    chrome.tabs.create({ 
        url: googleUrl,
        active: true 
    });
    closeModal('webSearchModal');
    showMessage('Google AI search opened. The "Import to Branestawm" button will appear after you search with AI Overview enabled.', 'info');
}

function handlePerplexitySearch() {
    const perplexityUrl = 'https://www.perplexity.ai/';
    chrome.tabs.create({ 
        url: perplexityUrl,
        active: true 
    });
    closeModal('webSearchModal');
    showMessage('Perplexity opened. Look for the "Import to Branestawm" button after searching.', 'info');
}

function setupTooltips() {
    // Basic tooltip functionality
    document.querySelectorAll('[data-tooltip]').forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
    });
}

function showTooltip(e) {
    if (!settings.showTooltips) return;
    
    const tooltip = document.getElementById('tooltip');
    tooltip.textContent = e.target.dataset.tooltip;
    tooltip.style.display = 'block';
    
    const rect = e.target.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.bottom + 5 + 'px';
}

function hideTooltip() {
    document.getElementById('tooltip').style.display = 'none';
}

console.log('Branestawm main.js loaded successfully');
// ... existing code ...

// ========== DESIGN SYSTEM THEME MANAGEMENT ==========

function initializeTheme() {
    // Load theme preferences from storage
    const colorScheme = settings.colorScheme || 'professional';
    const themeMode = settings.themeMode || 'dark';
    
    // Apply theme to document
    applyTheme(colorScheme, themeMode);
    
    // Listen for system theme changes if auto mode
    if (themeMode === 'auto') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', handleSystemThemeChange);
    }
}

function applyTheme(colorScheme, themeMode) {
    const html = document.documentElement;
    
    // Set color scheme
    html.setAttribute('data-scheme', colorScheme);
    
    // Set theme mode (handle auto mode)
    if (themeMode === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.setAttribute('data-mode', prefersDark ? 'dark' : 'light');
    } else {
        html.setAttribute('data-mode', themeMode);
    }
    
    // Save to settings
    settings.colorScheme = colorScheme;
    settings.themeMode = themeMode;
}

function handleSystemThemeChange(e) {
    if (settings.themeMode === 'auto') {
        const html = document.documentElement;
        html.setAttribute('data-mode', e.matches ? 'dark' : 'light');
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const currentMode = html.getAttribute('data-mode');
    const newMode = currentMode === 'dark' ? 'light' : 'dark';
    
    applyTheme(settings.colorScheme || 'professional', newMode);
    saveData();
}

// ========== ACCESSIBILITY ENHANCEMENTS ==========

function setupAccessibility() {
    // Add keyboard navigation for modals
    document.addEventListener('keydown', handleGlobalKeydown);
    
    // Setup focus management
    setupFocusManagement();
    
    // Setup reduced motion preferences
    setupReducedMotion();
    
    // Setup high contrast mode detection
    setupHighContrastMode();
}

function handleGlobalKeydown(e) {
    // Escape key closes modals
    if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal.show');
        if (openModal) {
            closeModal(openModal.id);
        }
    }
    
    // Enter key on setup options
    if (e.key === 'Enter' && e.target.classList.contains('setup-option')) {
        e.target.click();
    }
    
    // Ctrl/Cmd + Enter sends message
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && e.target.id === 'messageInput') {
        sendMessage();
    }
}

function setupFocusManagement() {
    // Trap focus in modals
    document.addEventListener('focusin', (e) => {
        const openModal = document.querySelector('.modal.show');
        if (openModal && !openModal.contains(e.target)) {
            const focusableElements = openModal.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements.length > 0) {
                focusableElements[0].focus();
            }
        }
    });
}

function setupReducedMotion() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    function handleReducedMotion(e) {
        document.documentElement.classList.toggle('reduce-motion', e.matches);
    }
    
    handleReducedMotion(prefersReducedMotion);
    prefersReducedMotion.addEventListener('change', handleReducedMotion);
}

function setupHighContrastMode() {
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
    
    function handleHighContrast(e) {
        document.documentElement.classList.toggle('high-contrast', e.matches);
    }
    
    handleHighContrast(prefersHighContrast);
    prefersHighContrast.addEventListener('change', handleHighContrast);
}

// ========== TOOLTIP MANAGEMENT ==========

function setupTooltips() {
    if (!settings.showTooltips) {
        document.documentElement.classList.add('hide-tooltips');
        return;
    }
    
    // Add ARIA labels for tooltips
    document.querySelectorAll('[data-tooltip]').forEach(element => {
        const tooltip = element.getAttribute('data-tooltip');
        element.setAttribute('aria-label', tooltip);
        element.setAttribute('title', tooltip);
    });
    
    // Handle tooltip visibility for keyboard users
    document.addEventListener('focusin', (e) => {
        if (e.target.hasAttribute('data-tooltip')) {
            showTooltip(e.target);
        }
    });
    
    document.addEventListener('focusout', (e) => {
        if (e.target.hasAttribute('data-tooltip')) {
            hideTooltip(e.target);
        }
    });
}

function showTooltip(element) {
    const tooltip = element.querySelector('.tooltip-content');
    if (tooltip) {
        tooltip.style.opacity = '1';
        tooltip.style.visibility = 'visible';
    }
}

function hideTooltip(element) {
    const tooltip = element.querySelector('.tooltip-content');
    if (tooltip) {
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
    }
}

// ========== ENHANCED UI UPDATES ==========

function updateArtifactsList() {
    const artifactsList = document.getElementById('artifactsList');
    const projectArtifacts = projects[currentProject]?.artifacts || [];
    
    artifactsList.innerHTML = '';
    
    if (projectArtifacts.length === 0) {
        artifactsList.innerHTML = `
            <div class="empty-state">
                <p>No notes yet</p>
                <p class="help-text">Click "New Note" to create your first note</p>
            </div>
        `;
        return;
    }
    
    projectArtifacts.forEach(artifactId => {
        const artifact = artifacts[artifactId];
        if (!artifact) return;
        
        const artifactElement = document.createElement('div');
        artifactElement.className = 'artifact-item';
        artifactElement.setAttribute('role', 'listitem');
        artifactElement.setAttribute('tabindex', '0');
        artifactElement.setAttribute('aria-label', `Note: ${artifact.title}`);
        
        const contentPreview = artifact.content.substring(0, 150) + '...';
        
        artifactElement.innerHTML = `
            <div class="artifact-title">${artifact.title}</div>
            <div class="artifact-content">${contentPreview}</div>
        `;
        
        artifactElement.addEventListener('click', () => editArtifact(artifact.id));
        artifactElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                editArtifact(artifact.id);
            }
        });
        
        artifactsList.appendChild(artifactElement);
    });
}

// Initialize application with all features
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Branestawm initializing...');
    
    // Establish keepalive connection with service worker
    keepAlivePort = chrome.runtime.connect({ name: 'branestawm-keepalive' });
    
    // Load data and check setup status
    await loadData();
    
    // Initialize theme system
    initializeTheme();
    
    // Setup accessibility features
    setupAccessibility();
    
    // Check for pending query from context menu
    await checkPendingQuery();
    
    // Setup UI
    setupEventListeners();
    setupTooltips();
    updateUI();
    
    // Start monitoring for search result imports
    startImportMonitoring();
    
    // Check if user needs initial setup
    if (!settings.googleToken && !settings.apiKey) {
        showSetupModal();
    } else {
        // Create first conversation if none exist
        if (Object.keys(conversations).length === 0) {
            newConversation();
        }
    }
    
    console.log('Branestawm initialized successfully');
});

// ========== MODAL-BASED PROJECT AND CONVERSATION MANAGEMENT ==========

// Recent items tracking
let recentProjects = [];
let recentConversations = [];
const MAX_RECENT_ITEMS = 10;

// Project Selection Modal Functions
function showProjectSelectionModal() {
    populateProjectsGrid();
    showModal('projectSelectionModal');
    setupProjectSearch();
}

function populateProjectsGrid() {
    const grid = document.getElementById('projectsGrid');
    grid.innerHTML = '';
    
    const sortedProjects = Object.values(projects).sort((a, b) => {
        const aLastUsed = getProjectLastUsed(a.id);
        const bLastUsed = getProjectLastUsed(b.id);
        return bLastUsed - aLastUsed;
    });
    
    sortedProjects.forEach(project => {
        const projectCard = createProjectCard(project);
        grid.appendChild(projectCard);
    });
}

function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = `project-card ${project.id === currentProject ? 'active' : ''}`;
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Select project: ${project.name}`);
    
    const conversationCount = project.conversations ? project.conversations.length : 0;
    const artifactCount = project.artifacts ? project.artifacts.length : 0;
    const lastUsed = getProjectLastUsed(project.id);
    const lastUsedText = lastUsed ? new Date(lastUsed).toLocaleDateString() : 'Never used';
    
    card.innerHTML = `
        <div class="project-card-header">
            <h4 class="project-card-title">${project.name}</h4>
            ${project.id === currentProject ? '<div class="active-badge">Current</div>' : ''}
        </div>
        <div class="project-card-description">${project.description || 'No description'}</div>
        <div class="project-card-stats">
            <span class="stat">${conversationCount} chats</span>
            <span class="stat">${artifactCount} notes</span>
        </div>
        <div class="project-card-meta">Last used: ${lastUsedText}</div>
    `;
    
    card.addEventListener('click', () => selectProject(project.id));
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectProject(project.id);
        }
    });
    
    return card;
}

function setupProjectSearch() {
    const searchInput = document.getElementById('projectSearchInput');
    searchInput.addEventListener('input', (e) => {
        filterProjectsGrid(e.target.value);
    });
}

function filterProjectsGrid(searchTerm) {
    const cards = document.querySelectorAll('.project-card');
    const term = searchTerm.toLowerCase();
    
    cards.forEach(card => {
        const title = card.querySelector('.project-card-title').textContent.toLowerCase();
        const description = card.querySelector('.project-card-description').textContent.toLowerCase();
        const matches = title.includes(term) || description.includes(term);
        card.style.display = matches ? 'block' : 'none';
    });
}

function selectProject(projectId) {
    if (projectId !== currentProject) {
        switchProject(projectId);
        updateRecentProjects(projectId);
    }
    closeModal('projectSelectionModal');
}

// Conversation Selection Modal Functions
function showConversationSelectionModal() {
    populateConversationsGrid();
    showModal('conversationSelectionModal');
    setupConversationSearch();
}

function populateConversationsGrid() {
    const grid = document.getElementById('conversationsGrid');
    grid.innerHTML = '';
    
    // Get all conversations from current project
    const projectConversations = projects[currentProject]?.conversations || [];
    const conversationsInProject = projectConversations.map(id => conversations[id]).filter(Boolean);
    
    // Sort by last updated
    const sortedConversations = conversationsInProject.sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt).getTime();
        return bTime - aTime;
    });
    
    if (sortedConversations.length === 0) {
        grid.innerHTML = '<div class="empty-state">No conversations in this project yet</div>';
        return;
    }
    
    sortedConversations.forEach(conversation => {
        const conversationCard = createConversationCard(conversation);
        grid.appendChild(conversationCard);
    });
}

function createConversationCard(conversation) {
    const card = document.createElement('div');
    card.className = `conversation-card ${conversation.id === currentConversation ? 'active' : ''}`;
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Select conversation: ${conversation.title}`);
    
    const messageCount = conversation.messages.length;
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const preview = lastMessage ? lastMessage.content.substring(0, 150) + '...' : 'No messages yet';
    const lastUpdated = new Date(conversation.updatedAt || conversation.createdAt).toLocaleDateString();
    
    card.innerHTML = `
        <div class="conversation-card-header">
            <h4 class="conversation-card-title">${conversation.title}</h4>
            ${conversation.id === currentConversation ? '<div class="active-badge">Current</div>' : ''}
        </div>
        <div class="conversation-card-preview">${preview}</div>
        <div class="conversation-card-stats">
            <span class="stat">${messageCount} messages</span>
            <span class="stat">Updated ${lastUpdated}</span>
        </div>
    `;
    
    card.addEventListener('click', () => selectConversation(conversation.id));
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectConversation(conversation.id);
        }
    });
    
    return card;
}

function setupConversationSearch() {
    const searchInput = document.getElementById('conversationSearchInput');
    searchInput.addEventListener('input', (e) => {
        filterConversationsGrid(e.target.value);
    });
}

function filterConversationsGrid(searchTerm) {
    const cards = document.querySelectorAll('.conversation-card');
    const term = searchTerm.toLowerCase();
    
    cards.forEach(card => {
        const title = card.querySelector('.conversation-card-title').textContent.toLowerCase();
        const preview = card.querySelector('.conversation-card-preview').textContent.toLowerCase();
        const matches = title.includes(term) || preview.includes(term);
        card.style.display = matches ? 'block' : 'none';
    });
}

function selectConversation(conversationId) {
    switchToConversation(conversationId);
    updateRecentConversations(conversationId);
    closeModal('conversationSelectionModal');
}

// Recent Items Management
function updateRecentProjects(projectId) {
    // Remove if already exists
    recentProjects = recentProjects.filter(id => id !== projectId);
    // Add to beginning
    recentProjects.unshift(projectId);
    // Keep only MAX_RECENT_ITEMS
    recentProjects = recentProjects.slice(0, MAX_RECENT_ITEMS);
    updateRecentProjectsWidget();
    saveData();
}

function updateRecentConversations(conversationId) {
    // Remove if already exists
    recentConversations = recentConversations.filter(id => id !== conversationId);
    // Add to beginning
    recentConversations.unshift(conversationId);
    // Keep only MAX_RECENT_ITEMS
    recentConversations = recentConversations.slice(0, MAX_RECENT_ITEMS);
    updateRecentConversationsWidget();
    saveData();
}

function updateRecentProjectsWidget() {
    const widget = document.getElementById('recentProjectsList');
    widget.innerHTML = '';
    
    const validRecentProjects = recentProjects.filter(id => projects[id]).slice(0, 10);
    
    if (validRecentProjects.length === 0) {
        widget.innerHTML = '<div class="empty-recent">No recent projects</div>';
        return;
    }
    
    validRecentProjects.forEach(projectId => {
        const project = projects[projectId];
        if (!project) return;
        
        const item = document.createElement('div');
        item.className = `recent-project-item ${projectId === currentProject ? 'active' : ''}`;
        item.setAttribute('aria-label', `Switch to project: ${project.name}`);
        
        const description = project.description || 'No description available';
        
        item.innerHTML = `
            <div class="item-header">
                <div class="item-title">${project.name}</div>
                <div class="item-actions">
                    <button class="action-btn edit-btn" aria-label="Edit project" onclick="editProject('${projectId}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z"/>
                        </svg>
                    </button>
                    <button class="action-btn delete-btn" aria-label="Delete project" onclick="deleteProject('${projectId}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="item-description">${description}</div>
        `;
        
        // Make the main area clickable (excluding action buttons)
        const mainArea = item.querySelector('.item-title');
        mainArea.style.cursor = 'pointer';
        mainArea.addEventListener('click', () => {
            selectProject(projectId);
        });
        
        widget.appendChild(item);
    });
}

function updateRecentConversationsWidget() {
    const widget = document.getElementById('recentConversationsList');
    widget.innerHTML = '';
    
    // Get valid recent conversations from current project
    const currentProjectConversations = projects[currentProject]?.conversations || [];
    const validRecentConversations = recentConversations
        .filter(id => conversations[id] && currentProjectConversations.includes(id))
        .slice(0, 10);
    
    if (validRecentConversations.length === 0) {
        widget.innerHTML = '<div class="empty-recent">No recent conversations</div>';
        return;
    }
    
    validRecentConversations.forEach(conversationId => {
        const conversation = conversations[conversationId];
        if (!conversation) return;
        
        const item = document.createElement('div');
        item.className = `recent-conversation-item ${conversationId === currentConversation ? 'active' : ''}`;
        item.setAttribute('aria-label', `Switch to conversation: ${conversation.title}`);
        
        const description = conversation.description || generateConversationPreview(conversation);
        
        item.innerHTML = `
            <div class="item-header">
                <div class="item-title">${conversation.title}</div>
                <div class="item-actions">
                    <button class="action-btn edit-btn" aria-label="Edit conversation" onclick="editConversation('${conversationId}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z"/>
                        </svg>
                    </button>
                    <button class="action-btn delete-btn" aria-label="Delete conversation" onclick="deleteConversation('${conversationId}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="item-description">${description}</div>
        `;
        
        // Make the main area clickable (excluding action buttons)
        const mainArea = item.querySelector('.item-title');
        mainArea.style.cursor = 'pointer';
        mainArea.addEventListener('click', () => {
            selectConversation(conversationId);
        });
        
        widget.appendChild(item);
    });
}

// Helper function to generate conversation preview
function generateConversationPreview(conversation) {
    if (conversation.messages && conversation.messages.length > 0) {
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        return lastMessage.content.substring(0, 80) + '...';
    }
    return 'No messages yet';
}

// Helper Functions
function getProjectLastUsed(projectId) {
    const projectConversations = projects[projectId]?.conversations || [];
    let lastUsed = 0;
    
    projectConversations.forEach(convId => {
        const conversation = conversations[convId];
        if (conversation) {
            const updated = new Date(conversation.updatedAt || conversation.createdAt).getTime();
            lastUsed = Math.max(lastUsed, updated);
        }
    });
    
    return lastUsed;
}

// Update existing functions to use new system
function switchProject(projectId) {
    currentProject = projectId;
    currentConversation = null;
    updateRecentProjects(projectId);
    updateCurrentProjectDisplay();
    updateUI();
    saveData();
}

function updateCurrentProjectDisplay() {
    const currentProjectNameEl = document.getElementById('currentProjectName');
    const project = projects[currentProject];
    if (currentProjectNameEl && project) {
        currentProjectNameEl.textContent = project.name;
    }
}

// ========== EDIT AND DELETE FUNCTIONS ==========

let itemToDelete = null;
let itemTypeToDelete = null;
let conversationToEdit = null;

// Edit Project Function (reuse existing project modal)
function editProject(projectId) {
    const project = projects[projectId];
    if (!project) return;
    
    // Populate the project modal with existing data
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectDescription').value = project.description || '';
    document.getElementById('projectModalTitle').textContent = 'Edit Project';
    
    // Store the project ID for saving
    document.getElementById('projectModal').dataset.projectId = projectId;
    
    showModal('projectModal');
}

// Edit Conversation Function
function editConversation(conversationId) {
    const conversation = conversations[conversationId];
    if (!conversation) return;
    
    conversationToEdit = conversationId;
    
    // Populate the conversation modal with existing data
    document.getElementById('conversationTitle').value = conversation.title;
    document.getElementById('conversationDescription').value = conversation.description || '';
    
    showModal('editConversationModal');
}

// Save Conversation Changes
function saveConversationChanges() {
    if (!conversationToEdit) return;
    
    const title = document.getElementById('conversationTitle').value.trim();
    const description = document.getElementById('conversationDescription').value.trim();
    
    if (!title) {
        showMessage('Conversation title is required', 'error');
        return;
    }
    
    const conversation = conversations[conversationToEdit];
    conversation.title = title;
    conversation.description = description;
    conversation.updatedAt = new Date().toISOString();
    
    closeModal('editConversationModal');
    updateRecentConversationsWidget();
    saveData();
    showMessage('Conversation updated successfully!', 'success');
    
    conversationToEdit = null;
}

// Delete Project Function
function deleteProject(projectId) {
    const project = projects[projectId];
    if (!project) return;
    
    itemToDelete = projectId;
    itemTypeToDelete = 'project';
    
    const message = `Are you sure you want to delete the project "${project.name}"? This will also delete all conversations and notes in this project. This action cannot be undone.`;
    document.getElementById('deleteMessage').textContent = message;
    
    showModal('deleteConfirmationModal');
}

// Delete Conversation Function
function deleteConversation(conversationId) {
    const conversation = conversations[conversationId];
    if (!conversation) return;
    
    itemToDelete = conversationId;
    itemTypeToDelete = 'conversation';
    
    const message = `Are you sure you want to delete the conversation "${conversation.title}"? This action cannot be undone.`;
    document.getElementById('deleteMessage').textContent = message;
    
    showModal('deleteConfirmationModal');
}

// Confirm Delete Function
function confirmDelete() {
    if (!itemToDelete || !itemTypeToDelete) return;
    
    if (itemTypeToDelete === 'project') {
        // Delete project and all its conversations and artifacts
        const project = projects[itemToDelete];
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
            recentProjects = recentProjects.filter(id => id !== itemToDelete);
            
            // Delete the project
            delete projects[itemToDelete];
            
            // Switch to default project if this was current
            if (currentProject === itemToDelete) {
                currentProject = 'default';
                currentConversation = null;
            }
            
            showMessage(`Project "${project.name}" deleted successfully`, 'success');
        }
    } else if (itemTypeToDelete === 'conversation') {
        // Delete conversation
        const conversation = conversations[itemToDelete];
        if (conversation) {
            // Remove from project's conversation list
            const project = projects[conversation.projectId];
            if (project && project.conversations) {
                project.conversations = project.conversations.filter(id => id !== itemToDelete);
            }
            
            // Remove from recent conversations
            recentConversations = recentConversations.filter(id => id !== itemToDelete);
            
            // Clear current conversation if this was it
            if (currentConversation === itemToDelete) {
                currentConversation = null;
                const chatMessages = document.getElementById('chatMessages');
                chatMessages.innerHTML = '<div class="message system" role="status">Conversation deleted. Start a new conversation or select an existing one.</div>';
            }
            
            // Delete the conversation
            delete conversations[itemToDelete];
            
            showMessage(`Conversation "${conversation.title}" deleted successfully`, 'success');
        }
    }
    
    closeModal('deleteConfirmationModal');
    updateUI();
    saveData();
    
    // Reset delete state
    itemToDelete = null;
    itemTypeToDelete = null;
}