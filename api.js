// Branestawm - API Integration Module
// Handles authentication and LLM API calls

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
        
        // Save auth method and token through DataManager
        if (window.dataManager) {
            await window.dataManager.updateState('settings.authMethod', 'google');
            await window.dataManager.updateState('settings.googleToken', token);
        } else {
            // Fallback for backward compatibility
            settings.authMethod = 'google';
            settings.googleToken = token;
            await saveData();
        }
        
        closeModal('setupModal');
        showMessage('Successfully connected to Google Gemini! You have 1,500 free requests per day.', 'success');
        
        // Create first conversation if none exist
        if (Object.keys(conversations).length === 0) {
            newConversation();
        }
        
        updateUI();
        
    } catch (error) {
        console.error('Google auth error:', error);
        
        // Use ErrorManager for structured error handling
        if (window.errorManager) {
            window.errorManager.handleAPIError('google-auth', error);
        }
        
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
    // Check new activeLlm setting first (takes priority)
    if (settings.activeLlm === 'local') {
        return await callLocalAI(messages);
    } 
    // Check legacy authMethod settings for backward compatibility
    else if (settings.authMethod === 'local' || settings.authMethod === 'localAI') {
        return await callLocalAI(messages);
    } else if (settings.authMethod === 'google' && settings.googleToken) {
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
                // Token expired, clear it through DataManager
                if (window.dataManager) {
                    await window.dataManager.updateState('settings.googleToken', null);
                } else {
                    settings.googleToken = null;
                    await saveData();
                }
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

// ========== LOCAL AI INTEGRATION ==========

async function callLocalAI(messages) {
    try {
        // Check if Local AI is ready by sending a status check
        const statusResponse = await chrome.runtime.sendMessage({
            type: 'CHECK_LOCAL_AI_STATUS'
        });
        
        if (!statusResponse || !statusResponse.ready) {
            throw new Error('Local AI is not ready. Please wait for models to load or check the Local AI settings.');
        }
        
        // Send message to Local AI for processing
        // For now, we'll use the text generation capability
        const prompt = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n') + '\n\nassistant:';
        
        const response = await chrome.runtime.sendMessage({
            type: 'GENERATE_TEXT',
            data: {
                prompt: prompt,
                maxLength: 2048,
                temperature: 0.7
            }
        });
        
        if (!response || !response.success) {
            throw new Error(response?.error || 'Local AI processing failed');
        }
        
        return response.text;
        
    } catch (error) {
        console.error('Local AI error:', error);
        throw error;
    }
}