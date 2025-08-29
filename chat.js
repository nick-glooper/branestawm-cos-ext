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
        addMessage(currentFolio, 'user', message);
        
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
        addMessage(currentFolio, 'assistant', response);
        
        // Update folio title if it's the first exchange
        const folio = folios[currentFolio];
        if (folio.messages.length === 2 && folio.title === 'General Folio') {
            folio.title = generateConversationTitle(message);
            folio.lastUsed = new Date().toISOString();
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
        addMessage(currentFolio, 'system', `Sorry, I encountered an error: ${error.message}. Please check your connection and try again.`);
        showMessage('Error: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// ========== MESSAGE MANAGEMENT ==========

function addMessage(folioId, role, content) {
    if (!folios[folioId]) return;
    
    const message = {
        id: generateId(),
        role: role,
        content: content,
        timestamp: new Date().toISOString()
    };
    
    // Add to folio's continuous dialogue
    folios[folioId].messages.push(message);
    folios[folioId].lastUsed = new Date().toISOString();
    
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

// ========== CONTEXTUAL PROMPT SYSTEM ==========

function buildContextualPrompt(query, folioId) {
    const folio = folios[folioId];
    const persona = settings.personas[folio?.assignedPersona] || settings.personas['core'];
    
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

    // Add historical context instruction
    prompt += `HISTORICAL CONTEXT:
You have access to the entire conversation history and can reference previous discussions, artifacts, and interactions from across all folios. Use this knowledge to provide contextually aware and informed responses.

`;

    // Add current context
    prompt += `CURRENT CONTEXT:
The user is currently working in the "${folio?.title || 'General Folio'}" folio. Apply the persona characteristics and folio guidelines appropriately while maintaining access to your complete knowledge base.

INSTRUCTIONS:
- Respond using the specified persona's identity, communication style, and tone
- Apply any folio-specific guidelines when relevant
- Access your complete historical knowledge while filtering through the current persona/folio context
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