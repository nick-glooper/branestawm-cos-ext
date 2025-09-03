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
        
        // Multi-layered context system with optimization
        let systemPromptContent;
        if (window.contextManager) {
            try {
                const optimizedContext = await window.contextManager.buildOptimalContext(currentFolio, message);
                systemPromptContent = await buildOptimizedPrompt(optimizedContext, message, currentFolio);
            } catch (error) {
                console.warn('Context optimization failed, falling back to traditional prompt:', error);
                systemPromptContent = await buildContextualPrompt(message, currentFolio);
            }
        } else {
            systemPromptContent = await buildContextualPrompt(message, currentFolio);
        }

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
        
        // Trigger background summarization if available
        if (window.summarizationEngine) {
            // Delay summarization to not block UI
            setTimeout(() => {
                window.summarizationEngine.updateFolioSummaries(currentFolio).catch(error => {
                    console.warn('Background summarization failed:', error);
                });
            }, 2000); // 2 second delay
        }
        
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

async function addMessage(folioId, role, content, options = {}) {
    if (!folios[folioId]) return;
    
    try {
        // Use MessageManager for enhanced message structure
        if (window.messageManager) {
            const message = await window.messageManager.addMessageToFolio(folioId, role, content, options);
            
            // Update global references for backward compatibility
            updateGlobalReferences();
            
            // Update UI
            displayMessage(message);
            scrollToBottom();
            
            return message;
        } else {
            // Fallback to legacy method
            const message = {
                id: generateId(),
                role: role,
                content: content,
                timestamp: new Date().toISOString()
            };
            
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
            
            return message;
        }
        
    } catch (error) {
        console.error('Error adding message:', error);
        if (window.errorManager) {
            window.errorManager.handleError(window.errorManager.createError('DATA_VALIDATION_FAILED', {
                operation: 'addMessage',
                folioId: folioId,
                role: role,
                error: error.message
            }));
        }
        
        // Emergency fallback
        const message = {
            id: generateId(),
            role: role,
            content: content,
            timestamp: new Date().toISOString()
        };
        folios[folioId].messages.push(message);
        folios[folioId].lastUsed = new Date().toISOString();
        displayMessage(message);
        scrollToBottom();
        
        return message;
    }
}

function displayMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;
    
    // Add enhanced message classes if available
    if (message.semanticType) {
        messageDiv.classList.add(`semantic-${message.semanticType}`);
    }
    if (message.importance >= 4) {
        messageDiv.classList.add('high-importance');
    }
    if (message.threadId) {
        messageDiv.setAttribute('data-thread-id', message.threadId);
    }
    if (message.parentId) {
        messageDiv.setAttribute('data-parent-id', message.parentId);
    }
    
    // Create message content
    const messageContent = formatMessage(message.content, message.role);
    
    // Add enhanced message metadata if available
    let enhancedContent = messageContent;
    if (message.schemaVersion >= 2 && message.semanticType && message.semanticType !== 'response') {
        const metadata = [];
        if (message.importance >= 4) metadata.push('❗ Important');
        if (message.semanticType === 'task') metadata.push('📋 Task');
        if (message.semanticType === 'query') metadata.push('❓ Query');
        if (message.semanticType === 'summary') metadata.push('📝 Summary');
        
        if (metadata.length > 0) {
            enhancedContent = `<div class="message-metadata">${metadata.join(' • ')}</div>${messageContent}`;
        }
    }
    
    messageDiv.innerHTML = enhancedContent;
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

async function buildContextualPrompt(query, folioId) {
    const folio = folios[folioId];
    const persona = settings.personas[folio?.assignedPersona] || settings.personas['core'];
    
    // Use optimized context with summarization if available
    let contextData;
    if (window.summarizationEngine) {
        try {
            contextData = await window.summarizationEngine.getOptimalContext(folioId, query, 4000);
        } catch (error) {
            console.warn('Failed to get optimal context, falling back to data lake:', error);
            contextData = null;
        }
    }
    
    // Fallback to data lake context if summarization not available
    if (!contextData) {
        const dataLake = buildDataLakeContext();
        contextData = {
            dataLakeContext: formatDataLakeForLLM(dataLake, folioId),
            compressionAchieved: false
        };
    }
    
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

    // Add optimized context - either summarized or data lake
    if (contextData.dataLakeContext) {
        // Traditional data lake context
        prompt += `${contextData.dataLakeContext}

`;
    } else if (contextData.summaries || contextData.messages) {
        // Optimized context with summaries
        prompt += `OPTIMIZED CONVERSATION CONTEXT:
📊 Context Optimization: ${contextData.compressionAchieved ? 'ACTIVE' : 'STANDARD'}
💬 Recent Messages: ${contextData.messages?.length || 0}
📝 Summary Insights: ${contextData.summaries?.length || 0}
🔢 Token Usage: ${contextData.tokenCount || 0}

`;

        // Add summaries if available
        if (contextData.summaries && contextData.summaries.length > 0) {
            prompt += `CONVERSATION SUMMARIES:
`;
            contextData.summaries.forEach(summary => {
                prompt += `📋 ${summary.type} Summary (${summary.metadata?.timespan ? formatTimespan(summary.metadata.timespan) : 'Recent'}):
${summary.content}

`;
            });
        }

        // Add recent messages context
        if (contextData.messages && contextData.messages.length > 0) {
            prompt += `RECENT CONVERSATION HISTORY:
`;
            contextData.messages.slice(-5).forEach(msg => {
                const role = msg.role === 'user' ? 'You' : 'Assistant';
                const importance = msg.importance >= 4 ? ' [IMPORTANT]' : '';
                const semantic = msg.semanticType ? ` [${msg.semanticType.toUpperCase()}]` : '';
                prompt += `${role}${importance}${semantic}: ${msg.content}

`;
            });
        }
    }

    // Add current context
    prompt += `CURRENT CONTEXT:
The user is currently working in the "${folio?.title || 'General Folio'}" folio. ${contextData.compressionAchieved ? 'Context has been optimized using intelligent summarization to focus on relevant information.' : 'Full conversation history is available.'}

ENHANCED CAPABILITIES:
${contextData.summaries ? `- Access to ${contextData.summaries.length} conversation summaries with key insights
` : ''}${contextData.compressionAchieved ? `- Intelligent context compression (${Math.round((1 - contextData.tokenCount / 8000) * 100)}% token savings)
` : ''}${contextData.messages ? `- Recent conversation continuity with ${contextData.messages.length} contextual messages
` : ''}- Cross-folio search capability for comprehensive information access
- Semantic understanding of message types and importance levels

INSTRUCTIONS:
- Respond using the specified persona's identity, communication style, and tone
- Apply any folio-specific guidelines when relevant
- Leverage summarized insights for comprehensive understanding
- Reference specific information from summaries when relevant
- Maintain conversation continuity using recent message context
- Use cross-folio search to find relevant information regardless of source
- Maintain consistency with the persona's role context and communication preferences`;

    // Helper function for formatting timespan
    function formatTimespan(ms) {
        const hours = Math.floor(ms / (60 * 60 * 1000));
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
        return 'Recent';
    }

    return prompt;
}

/**
 * Build optimized prompt using ContextManager results
 */
async function buildOptimizedPrompt(optimizedContext, query, folioId) {
    let prompt = optimizedContext.systemPrompt;
    
    // Add optimization context information
    prompt += `\nCONTEXT OPTIMIZATION:
📊 Token Usage: ${optimizedContext.metadata.totalTokens} tokens
💬 Messages Included: ${optimizedContext.messages.length}
📝 Summaries Included: ${optimizedContext.summaries.length}
📄 Artifacts Included: ${optimizedContext.artifacts.length}
⚡ Processing Time: ${optimizedContext.metadata.processingTime}ms
🎯 Sources: ${optimizedContext.metadata.sources.join(', ')}
${optimizedContext.metadata.compressionAchieved ? '✅ Context compression achieved for optimal performance' : '📋 Full context provided'}

`;

    // Add summaries if available
    if (optimizedContext.summaries && optimizedContext.summaries.length > 0) {
        prompt += `CONVERSATION SUMMARIES:\n`;
        optimizedContext.summaries.forEach(summary => {
            const timespan = summary.metadata?.timespan ? formatTimespan(summary.metadata.timespan) : 'Recent';
            const importance = summary.metadata?.importance >= 4 ? ' [IMPORTANT]' : '';
            prompt += `📋 ${summary.type} Summary (${timespan})${importance}:
${summary.content}

`;
        });
    }

    // Add optimized message history
    if (optimizedContext.messages && optimizedContext.messages.length > 0) {
        prompt += `OPTIMIZED CONVERSATION HISTORY:\n`;
        optimizedContext.messages.forEach(msg => {
            const role = msg.role === 'user' ? 'You' : 'Assistant';
            const importance = msg.importance >= 4 ? ' [IMPORTANT]' : '';
            const semantic = msg.semanticType ? ` [${msg.semanticType.toUpperCase()}]` : '';
            const relevance = msg.relevance ? ` (relevance: ${Math.round(msg.relevance * 100)}%)` : '';
            const truncated = msg.truncated ? ' [TRUNCATED]' : '';
            
            prompt += `${role}${importance}${semantic}${truncated}: ${msg.content}${relevance}

`;
        });
    }

    // Add relevant artifacts
    if (optimizedContext.artifacts && optimizedContext.artifacts.length > 0) {
        prompt += `RELEVANT ARTIFACTS:\n`;
        optimizedContext.artifacts.forEach(artifact => {
            const relevance = artifact.relevance ? ` (relevance: ${Math.round(artifact.relevance * 100)}%)` : '';
            prompt += `📄 ${artifact.title} [${artifact.type}]${relevance}:
${artifact.content.substring(0, 300)}${artifact.content.length > 300 ? '...[truncated]' : ''}

`;
        });
    }

    // Add instructions
    prompt += `ENHANCED CONTEXT INSTRUCTIONS:
- This context has been intelligently optimized for relevance and token efficiency
- Use the provided summaries to understand broader conversation themes
- Reference specific information from the optimized message history
- Leverage artifact content when relevant to the current query
- Maintain conversation continuity using the selected contextual messages
- The context selection prioritizes relevance, importance, and recency

CURRENT QUERY CONTEXT:
The user is asking: "${query}"
Respond using the optimized context above while maintaining your persona and folio guidelines.`;

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