// Branestawm - Chat Module
// Handles message sending, display, and conversation functionality

// ========== MESSAGE SENDING ==========

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
    
    // No need to create conversations - each folio has continuous dialogue
    
    isProcessing = true;
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    try {
        // Add user message to current folio's dialogue
        await addMessage(currentFolio, 'user', message);
        
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
        
        // Multi-layered context system
        const systemPromptContent = buildContextualPrompt(message, currentFolio);

        let messages = [
            { 
                role: 'system', 
                content: systemPromptContent
            }
        ];
        
        // Add dialogue history (last 20 messages - no context limits due to full data lake access)
        const recentMessages = folios[currentFolio].messages.slice(-20);
        messages = messages.concat(recentMessages);
        
        // Get AI response using hybrid routing
        const response = await getHybridLLMResponse(messages, message);
        
        // Remove typing indicator
        removeTypingIndicator(typingDiv);
        
        // Add AI response to current folio's dialogue
        await addMessage(currentFolio, 'assistant', response);
        
        // Update folio title if it's the first exchange
        const folio = folios[currentFolio];
        if (folio.messages.length === 2 && folio.title === 'General Folio') {
            folio.title = generateConversationTitle(message);
            folio.lastUsed = new Date().toISOString();
        }
        
        // Save data through AppState for consistency
        await appState.saveData();
        
    } catch (error) {
        console.error('Error sending message:', error);
        
        // Remove typing indicator
        const typingDiv = document.querySelector('.message.typing');
        if (typingDiv) {
            removeTypingIndicator(typingDiv);
        }
        
        // Show error message
        await addMessage(currentFolio, 'system', `Sorry, I encountered an error: ${error.message}. Please check your connection and try again.`);
        showMessage('Error: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// ========== MESSAGE MANAGEMENT ==========

async function addMessage(folioId, role, content) {
    if (!folios[folioId]) return;
    
    const message = {
        id: generateId(),
        role: role,
        content: content,
        timestamp: new Date().toISOString()
    };
    
    try {
        // Use AppState for proper async data handling
        const folio = await appState.getFolio(folioId);
        if (!folio) {
            console.error(`Folio ${folioId} not found`);
            return;
        }
        
        // Add message and update timestamp
        const updatedMessages = [...folio.messages, message];
        await appState.updateFolio(folioId, {
            messages: updatedMessages,
            lastUsed: new Date().toISOString()
        });
        
        // Update global references for backward compatibility
        updateGlobalReferences();
        
        // Update UI
        displayMessage(message);
        scrollToBottom();
        
    } catch (error) {
        console.error('Error adding message:', error);
        // Fallback to old method
        folios[folioId].messages.push(message);
        folios[folioId].lastUsed = new Date().toISOString();
        displayMessage(message);
        scrollToBottom();
    }
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

// ========== TYPING INDICATOR ==========

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

// ========== DATA LAKE ACCESS ==========

function buildDataLakeContext() {
    const dataLake = {
        folios: {},
        artifacts: {},
        totalMessages: 0,
        totalArtifacts: 0
    };
    
    // Aggregate all folio data
    Object.entries(folios).forEach(([folioId, folio]) => {
        if (!folio || !folio.messages) return;
        
        dataLake.folios[folioId] = {
            title: folio.title,
            description: folio.description || '',
            guidelines: folio.guidelines || '',
            assignedPersona: folio.assignedPersona,
            createdAt: folio.createdAt,
            lastUsed: folio.lastUsed,
            messageCount: folio.messages.length,
            artifactCount: (folio.artifacts || []).length,
            // Include recent messages for context (last 10 per folio to manage size)
            recentMessages: folio.messages.slice(-10).map(msg => ({
                role: msg.role,
                content: msg.content.substring(0, 500), // Truncate very long messages
                timestamp: msg.timestamp
            })),
            // Include all artifacts from this folio
            artifacts: (folio.artifacts || []).map(artifact => ({
                title: artifact.title || 'Untitled',
                content: artifact.content.substring(0, 1000), // Truncate very long content
                type: artifact.type,
                createdAt: artifact.createdAt,
                id: artifact.id
            }))
        };
        
        dataLake.totalMessages += folio.messages.length;
        dataLake.totalArtifacts += (folio.artifacts || []).length;
    });
    
    // Add shared artifacts
    Object.entries(artifacts).forEach(([artifactId, artifact]) => {
        if (artifact.shared) {
            dataLake.artifacts[artifactId] = {
                title: artifact.title || 'Untitled',
                content: artifact.content.substring(0, 1000),
                type: artifact.type,
                createdAt: artifact.createdAt,
                shared: true
            };
        }
    });
    
    return dataLake;
}

function formatDataLakeForLLM(dataLake, currentFolioId) {
    let context = `DATA LAKE SUMMARY:
📊 Total Folios: ${Object.keys(dataLake.folios).length}
💬 Total Messages: ${dataLake.totalMessages}
📝 Total Artifacts: ${dataLake.totalArtifacts + Object.keys(dataLake.artifacts).length}

`;

    // Current folio details (primary context)
    if (dataLake.folios[currentFolioId]) {
        const currentFolio = dataLake.folios[currentFolioId];
        context += `CURRENT FOLIO DETAILS:
📁 Active: ${currentFolio.title}
📄 Description: ${currentFolio.description}
👤 Persona: ${currentFolio.assignedPersona}
💬 Messages: ${currentFolio.messageCount}
📝 Artifacts: ${currentFolio.artifactCount}

`;
    }

    // All folios overview (for cross-folio searches)
    context += `ALL FOLIOS OVERVIEW:\n`;
    Object.entries(dataLake.folios).forEach(([folioId, folio]) => {
        const isActive = folioId === currentFolioId;
        context += `${isActive ? '🟢' : '⚪'} ${folio.title} (${folio.messageCount} msgs, ${folio.artifactCount} artifacts)`;
        if (folio.description) {
            context += ` - ${folio.description.substring(0, 100)}`;
        }
        context += `\n`;
    });
    
    context += `\n`;

    // Recent cross-folio content (for searchable context)
    context += `RECENT CROSS-FOLIO CONTENT:\n`;
    Object.entries(dataLake.folios).forEach(([folioId, folio]) => {
        if (folio.recentMessages.length > 0) {
            context += `--- ${folio.title} (Recent) ---\n`;
            folio.recentMessages.slice(-3).forEach(msg => {
                if (msg.role === 'user') {
                    context += `Q: ${msg.content}\n`;
                } else if (msg.role === 'assistant') {
                    context += `A: ${msg.content}\n`;
                }
            });
            context += `\n`;
        }
    });

    // All artifacts (searchable content)
    context += `ARTIFACTS & NOTES:\n`;
    Object.entries(dataLake.folios).forEach(([folioId, folio]) => {
        folio.artifacts.forEach(artifact => {
            context += `📝 [${folio.title}] ${artifact.title}: ${artifact.content}\n`;
        });
    });
    
    // Shared artifacts
    Object.entries(dataLake.artifacts).forEach(([artifactId, artifact]) => {
        context += `🔗 [Shared] ${artifact.title}: ${artifact.content}\n`;
    });

    return context;
}

// ========== CONTEXTUAL PROMPT SYSTEM ==========

function buildContextualPrompt(query, folioId) {
    const folio = folios[folioId];
    const persona = settings.personas[folio?.assignedPersona] || settings.personas['core'];
    
    // Build and format complete data lake context
    const dataLake = buildDataLakeContext();
    const dataLakeContext = formatDataLakeForLLM(dataLake, folioId);
    
    // Prepare date/time context
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
    
    // Build multi-layered prompt
    let prompt = `SYSTEM CONTEXT (PERSONA):
Identity: ${persona.identity}
Communication Style: ${persona.communicationStyle}
Tone: ${persona.tone}
Role Context: ${persona.roleContext}

`;

    // Add folio context if available
    if (folio && (folio.guidelines?.trim() || folio.description?.trim())) {
        prompt += `DOMAIN CONTEXT (FOLIO):
Folio: ${folio.title}`;
        
        if (folio.description?.trim()) {
            prompt += `
Description: ${folio.description}`;
        }
        
        if (folio.guidelines?.trim()) {
            prompt += `
Guidelines: ${folio.guidelines}`;
        }
        
        prompt += `

`;
    }

    // Add personal context (original system prompt)
    prompt += `PERSONAL CONTEXT:
${settings.systemPrompt}

`;

    // Add temporal context
    prompt += `TEMPORAL CONTEXT:
📅 CURRENT DATE AND TIME: ${dateString} at ${timeString}
🗓️ Today is: ${dateString}
⏰ Current time: ${timeString}

IMPORTANT: When users reference relative dates like "yesterday", "Saturday just gone", "last week", etc., calculate from TODAY'S date: ${dateString}. You have full access to current date/time information above.

`;

    // Add comprehensive data lake context
    prompt += `${dataLakeContext}

`;

    // Add current context
    prompt += `CURRENT CONTEXT:
The user is currently working in the "${folio?.title || 'General Folio'}" folio. Apply the persona characteristics and folio guidelines appropriately while maintaining access to your complete knowledge base.

CROSS-FOLIO SEARCH CAPABILITY:
You have full access to all conversations, artifacts, and data across ALL folios in the data lake above. When answering queries:
- Search across all folios for relevant information (meetings, events, notes, etc.)
- Reference specific folios by name when citing information
- Combine information from multiple folios when relevant
- Maintain context of which folio information originated from

INSTRUCTIONS:
- Respond using the specified persona's identity, communication style, and tone
- Apply any folio-specific guidelines when relevant
- Access your complete historical knowledge and data lake while filtering through the current persona/folio context
- Use cross-folio search to find relevant information regardless of which folio it's stored in
- Maintain consistency with the persona's role context and communication preferences`;

    return prompt;
}

function getRelevantHistoricalContext(query, folioId, maxEntries = 5) {
    // Future enhancement: Implement semantic search through folio dialogue history
    // For now, return recent messages from current folio
    const recentMessages = folios[folioId]?.messages?.slice(-maxEntries) || [];
    return recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
}

// ========== UTILITY FUNCTIONS ==========

function generateConversationTitle(firstMessage) {
    // Generate a title from the first message (max 50 chars)
    let title = firstMessage.substring(0, 47);
    if (firstMessage.length > 47) {
        title += '...';
    }
    return title || 'New Chat';
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}