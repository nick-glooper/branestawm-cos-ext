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
    autoWebSearch: true,
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

// Initialize application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Branestawm initializing...');
    
    // Establish keepalive connection with service worker
    keepAlivePort = chrome.runtime.connect({ name: 'branestawm-keepalive' });
    
    // Load data and check setup status
    await loadData();
    
    // Check for pending query from context menu
    await checkPendingQuery();
    
    // Setup UI
    setupEventListeners();
    setupTooltips();
    updateUI();
    
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
        let messages = [
            { role: 'system', content: settings.systemPrompt }
        ];
        
        // Add conversation history (last 10 messages to stay within context limits)
        const recentMessages = conversations[currentConversation].messages.slice(-10);
        messages = messages.concat(recentMessages);
        
        // Handle web search if needed
        const searchQuery = extractSearchQuery(message);
        if (searchQuery || (settings.autoWebSearch && shouldSearchWeb(message))) {
            const query = searchQuery || message;
            const searchResults = await performWebSearch(query);
            
            if (searchResults) {
                const searchContext = `Web search results for "${query}":\n\n${searchResults}\n\n`;
                messages.push({
                    role: 'system',
                    content: searchContext + 'Please provide a helpful response based on the search results and the user\'s question.'
                });
            }
        }
        
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
            updateConversationsList();
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

// ========== WEB SEARCH INTEGRATION ==========

function extractSearchQuery(message) {
    const searchMatch = message.match(/^search:\s*(.+)/i);
    return searchMatch ? searchMatch[1].trim() : null;
}

function shouldSearchWeb(message) {
    // Simple heuristics to determine if web search is needed
    const searchIndicators = [
        /what.*current/i, /latest/i, /recent/i, /today/i, /now/i,
        /price/i, /cost/i, /weather/i, /news/i, /stock/i,
        /when.*happen/i, /what.*happen/i, /who.*won/i
    ];
    
    return searchIndicators.some(pattern => pattern.test(message));
}

async function performWebSearch(query) {
    try {
        // Use DuckDuckGo instant answer API
        const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`);
        
        if (!response.ok) {
            throw new Error('Search request failed');
        }
        
        const data = await response.json();
        
        let results = '';
        
        // Add abstract if available
        if (data.Abstract) {
            results += `${data.Abstract}\n\n`;
        }
        
        // Add definition if available
        if (data.Definition) {
            results += `Definition: ${data.Definition}\n\n`;
        }
        
        // Add related topics
        if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            results += 'Related information:\n';
            data.RelatedTopics.slice(0, 3).forEach(topic => {
                if (topic.Text) {
                    results += `• ${topic.Text}\n`;
                }
            });
            results += '\n';
        }
        
        return results || `I searched for "${query}" but couldn't find specific current information. Let me help you with what I know.`;
        
    } catch (error) {
        console.error('Web search error:', error);
        return null;
    }
}

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
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('syncBtn').addEventListener('click', () => showModal('syncModal'));
    document.getElementById('newProjectBtn').addEventListener('click', () => showModal('projectModal'));
    document.getElementById('newChatBtn').addEventListener('click', newConversation);
    document.getElementById('newArtifactBtn').addEventListener('click', () => showModal('artifactModal'));
    
    // Project selector
    document.getElementById('projectSelect').addEventListener('change', function() {
        switchProject(this.value);
    });
    
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
        const data = await chrome.storage.local.get(['settings', 'projects', 'conversations', 'artifacts', 'currentProject']);
        
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
            currentProject: currentProject
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

function switchProject(projectId) {
    currentProject = projectId;
    currentConversation = null;
    updateUI();
    saveData();
}

function updateUI() {
    updateProjectSelector();
    updateConversationsList();
    updateArtifactsList();
}

function updateProjectSelector() {
    const selector = document.getElementById('projectSelect');
    selector.innerHTML = '';
    
    for (const project of Object.values(projects)) {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        if (project.id === currentProject) {
            option.selected = true;
        }
        selector.appendChild(option);
    }
}

function updateConversationsList() {
    // Placeholder - implement conversation list UI
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
    updateConversationsList(); // Refresh to show active state
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
    
    // Clear form
    document.getElementById('projectName').value = '';
    document.getElementById('projectDescription').value = '';
    
    closeModal('projectModal');
    updateUI();
    saveData();
    showMessage(`Project "${name}" created successfully!`, 'success');
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

function updateConversationsList() {
    const conversationsList = document.getElementById('conversationsList');
    const projectConversations = projects[currentProject]?.conversations || [];
    
    conversationsList.innerHTML = '';
    
    if (projectConversations.length === 0) {
        conversationsList.innerHTML = `
            <div class="empty-state">
                <p>No conversations yet</p>
                <p class="help-text">Click "New Chat" to start your first conversation</p>
            </div>
        `;
        return;
    }
    
    projectConversations.forEach(conversationId => {
        const conversation = conversations[conversationId];
        if (!conversation) return;
        
        const conversationElement = document.createElement('div');
        conversationElement.className = `conversation-item ${conversation.id === currentConversation ? 'active' : ''}`;
        conversationElement.setAttribute('role', 'listitem');
        conversationElement.setAttribute('tabindex', '0');
        conversationElement.setAttribute('aria-label', `Conversation: ${conversation.title}`);
        
        const preview = conversation.messages.length > 0 
            ? conversation.messages[conversation.messages.length - 1].content.substring(0, 100) + '...'
            : 'No messages yet';
            
        const lastUpdate = conversation.updatedAt 
            ? new Date(conversation.updatedAt).toLocaleDateString()
            : new Date(conversation.createdAt).toLocaleDateString();
        
        conversationElement.innerHTML = `
            <div class="conversation-title">${conversation.title}</div>
            <div class="conversation-preview">${preview}</div>
            <div class="conversation-meta">${lastUpdate}</div>
        `;
        
        conversationElement.addEventListener('click', () => switchToConversation(conversation.id));
        conversationElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                switchToConversation(conversation.id);
            }
        });
        
        conversationsList.appendChild(conversationElement);
    });
}

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

// Update the initialization to include new features
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

// ... existing code ...