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
        
        // Get current project custom instructions
        const currentProjectObj = projects[currentProject];
        const customInstructions = currentProjectObj?.customInstructions || '';
        
        let systemPromptContent = `${settings.systemPrompt}

📅 CURRENT DATE AND TIME: ${dateString} at ${timeString}
🗓️ Today is: ${dateString}
⏰ Current time: ${timeString}

IMPORTANT: When users reference relative dates like "yesterday", "Saturday just gone", "last week", etc., calculate from TODAY'S date: ${dateString}. You have full access to current date/time information above.`;

        // Add custom instructions if they exist for this project
        if (customInstructions.trim()) {
            systemPromptContent += `

🎯 PROJECT-SPECIFIC INSTRUCTIONS: ${customInstructions}

Please follow these project-specific instructions in addition to your base behavior. These instructions take precedence for this conversation.`;
        }

        let messages = [
            { 
                role: 'system', 
                content: systemPromptContent
            }
        ];
        
        // Add conversation history (last 10 messages to stay within context limits)
        const recentMessages = conversations[currentConversation].messages.slice(-10);
        messages = messages.concat(recentMessages);
        
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

// ========== MESSAGE MANAGEMENT ==========

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