// Branestawm Options/Settings Page
// Handles all configuration and authentication

let settings = {
    authMethod: null,
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
    autoSync: false
};

// Initialize settings page
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Branestawm settings page loading...');
    
    await loadSettings();
    setupEventListeners();
    updateUI();
    
    console.log('Settings page loaded successfully');
});

// ========== SETTINGS PERSISTENCE ==========

async function loadSettings() {
    try {
        const data = await chrome.storage.local.get(['settings']);
        if (data.settings) {
            settings = { ...settings, ...data.settings };
        }
        console.log('Settings loaded:', settings);
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveSettings() {
    try {
        await chrome.storage.local.set({ settings: settings });
        showToast('Settings saved successfully!', 'success');
        console.log('Settings saved:', settings);
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Error saving settings: ' + error.message, 'error');
    }
}

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
    // Auth method selection
    document.getElementById('googleAuthOption').addEventListener('click', () => {
        selectAuthMethod('google');
    });
    
    document.getElementById('apikeyAuthOption').addEventListener('click', () => {
        selectAuthMethod('apikey');
    });
    
    // Google OAuth
    document.getElementById('googleSignInBtn').addEventListener('click', authenticateWithGoogle);
    document.getElementById('googleSignOutBtn').addEventListener('click', signOutFromGoogle);
    
    // API configuration
    document.getElementById('apiEndpoint').addEventListener('change', handleEndpointChange);
    document.getElementById('apiKey').addEventListener('input', function() {
        settings.apiKey = this.value;
    });
    document.getElementById('model').addEventListener('input', function() {
        settings.model = this.value;
    });
    document.getElementById('customEndpoint').addEventListener('input', function() {
        settings.apiEndpoint = this.value;
    });
    
    // Test connection
    document.getElementById('testConnectionBtn').addEventListener('click', testConnection);
    
    // Behavior settings
    document.getElementById('systemPrompt').addEventListener('input', function() {
        settings.systemPrompt = this.value;
    });
    document.getElementById('autoWebSearch').addEventListener('change', function() {
        settings.autoWebSearch = this.checked;
    });
    document.getElementById('showTooltips').addEventListener('change', function() {
        settings.showTooltips = this.checked;
    });
    
    // Sync settings
    document.getElementById('syncId').addEventListener('input', function() {
        settings.syncId = this.value;
    });
    document.getElementById('syncKey').addEventListener('input', function() {
        settings.syncKey = this.value;
    });
    document.getElementById('jsonbinApiKey').addEventListener('input', function() {
        settings.jsonbinApiKey = this.value;
    });
    document.getElementById('usePrivateBins').addEventListener('change', function() {
        settings.usePrivateBins = this.checked;
    });
    document.getElementById('autoSync').addEventListener('change', function() {
        settings.autoSync = this.checked;
    });
    
    // Action buttons
    document.getElementById('saveBtn').addEventListener('click', saveSettings);
    document.getElementById('resetBtn').addEventListener('click', resetToDefaults);
}

// ========== AUTH METHOD SELECTION ==========

function selectAuthMethod(method) {
    // Update visual selection
    document.querySelectorAll('.auth-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    if (method === 'google') {
        document.getElementById('googleAuthOption').classList.add('selected');
        document.getElementById('googleAuthSection').classList.add('active');
        document.getElementById('apikeyAuthSection').classList.remove('active');
        settings.authMethod = 'google';
    } else {
        document.getElementById('apikeyAuthOption').classList.add('selected');
        document.getElementById('apikeyAuthSection').classList.add('active');
        document.getElementById('googleAuthSection').classList.remove('active');
        settings.authMethod = 'apikey';
    }
}

// ========== GOOGLE OAUTH INTEGRATION ==========

async function authenticateWithGoogle() {
    try {
        showToast('Connecting to Google...', 'info');
        
        const token = await new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive: true }, (token) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(token);
                }
            });
        });
        
        // Test the connection
        await testGoogleConnection(token);
        
        // Save token
        settings.googleToken = token;
        settings.authMethod = 'google';
        
        await saveSettings();
        updateGoogleStatus(true);
        
        showToast('Successfully connected to Google Gemini!', 'success');
        
    } catch (error) {
        console.error('Google auth error:', error);
        showToast('Google authentication failed: ' + error.message, 'error');
        updateGoogleStatus(false);
    }
}

async function signOutFromGoogle() {
    try {
        if (settings.googleToken) {
            // Revoke the token
            chrome.identity.removeCachedAuthToken({ token: settings.googleToken });
        }
        
        settings.googleToken = null;
        if (settings.authMethod === 'google') {
            settings.authMethod = null;
        }
        
        await saveSettings();
        updateGoogleStatus(false);
        
        showToast('Signed out from Google', 'info');
        
    } catch (error) {
        console.error('Google sign out error:', error);
        showToast('Error signing out: ' + error.message, 'error');
    }
}

async function testGoogleConnection(token) {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: {
            'Authorization': `Bearer ${token || settings.googleToken}`
        }
    });
    
    if (!response.ok) {
        throw new Error(`Connection test failed: ${response.status} ${response.statusText}`);
    }
    
    return true;
}

function updateGoogleStatus(connected) {
    const statusElement = document.getElementById('googleStatus');
    const signInBtn = document.getElementById('googleSignInBtn');
    const signOutBtn = document.getElementById('googleSignOutBtn');
    
    if (connected) {
        statusElement.className = 'status-indicator connected';
        statusElement.innerHTML = '<span class="status-dot">●</span> Connected';
        signInBtn.style.display = 'none';
        signOutBtn.style.display = 'inline-flex';
    } else {
        statusElement.className = 'status-indicator disconnected';
        statusElement.innerHTML = '<span class="status-dot">●</span> Not connected';
        signInBtn.style.display = 'inline-flex';
        signOutBtn.style.display = 'none';
    }
}

// ========== API KEY CONFIGURATION ==========

function handleEndpointChange() {
    const select = document.getElementById('apiEndpoint');
    const customGroup = document.getElementById('customEndpointGroup');
    const modelInput = document.getElementById('model');
    
    if (select.value === 'custom') {
        customGroup.style.display = 'block';
        settings.apiEndpoint = document.getElementById('customEndpoint').value || '';
    } else {
        customGroup.style.display = 'none';
        settings.apiEndpoint = select.value;
        
        // Set recommended models for different providers
        switch (select.value) {
            case 'https://api.cerebras.ai/v1/chat/completions':
                modelInput.value = 'llama3.1-8b';
                settings.model = 'llama3.1-8b';
                break;
            case 'https://api.openai.com/v1/chat/completions':
                modelInput.value = 'gpt-3.5-turbo';
                settings.model = 'gpt-3.5-turbo';
                break;
            case 'https://openrouter.ai/api/v1/chat/completions':
                modelInput.value = 'deepseek/deepseek-chat';
                settings.model = 'deepseek/deepseek-chat';
                break;
            case 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium':
                modelInput.value = 'microsoft/DialoGPT-medium';
                settings.model = 'microsoft/DialoGPT-medium';
                break;
        }
    }
}

async function testConnection() {
    if (!settings.apiKey) {
        showToast('Please enter an API key first', 'error');
        return;
    }
    
    if (!settings.apiEndpoint) {
        showToast('Please select or enter an API endpoint', 'error');
        return;
    }
    
    const testBtn = document.getElementById('testConnectionBtn');
    const originalText = testBtn.textContent;
    
    try {
        testBtn.textContent = 'Testing...';
        testBtn.disabled = true;
        
        // Send a simple test message
        const testMessage = {
            model: settings.model || 'llama3.1-8b',
            messages: [
                {
                    role: 'user',
                    content: 'Hello, this is a connection test. Please respond with "Connection successful".'
                }
            ],
            max_tokens: 50,
            temperature: 0.1
        };
        
        const response = await fetch(settings.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify(testMessage)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        // Check response format
        if (data.choices && data.choices[0] && data.choices[0].message) {
            showToast('✅ Connection test successful!', 'success');
            updateAPIStatus(true);
        } else if (data.generated_text) {
            // Hugging Face format
            showToast('✅ Connection test successful!', 'success');
            updateAPIStatus(true);
        } else {
            throw new Error('Unexpected response format. Check your model name and endpoint.');
        }
        
    } catch (error) {
        console.error('Connection test failed:', error);
        showToast('❌ Connection test failed: ' + error.message, 'error');
        updateAPIStatus(false);
    } finally {
        testBtn.textContent = originalText;
        testBtn.disabled = false;
    }
}

function updateAPIStatus(connected) {
    const statusElement = document.getElementById('apikeyStatus');
    
    if (connected) {
        statusElement.className = 'status-indicator connected';
        statusElement.innerHTML = '<span class="status-dot">●</span> Connected';
    } else {
        statusElement.className = 'status-indicator disconnected';
        statusElement.innerHTML = '<span class="status-dot">●</span> Not configured';
    }
}

// ========== UI UPDATES ==========

function updateUI() {
    // Set form values
    document.getElementById('apiEndpoint').value = settings.apiEndpoint;
    document.getElementById('apiKey').value = settings.apiKey;
    document.getElementById('model').value = settings.model;
    document.getElementById('systemPrompt').value = settings.systemPrompt;
    document.getElementById('autoWebSearch').checked = settings.autoWebSearch;
    document.getElementById('showTooltips').checked = settings.showTooltips;
    document.getElementById('syncId').value = settings.syncId;
    document.getElementById('syncKey').value = settings.syncKey;
    document.getElementById('jsonbinApiKey').value = settings.jsonbinApiKey;
    document.getElementById('usePrivateBins').checked = settings.usePrivateBins;
    document.getElementById('autoSync').checked = settings.autoSync;
    
    // Update auth method selection
    if (settings.authMethod === 'google') {
        selectAuthMethod('google');
        updateGoogleStatus(!!settings.googleToken);
    } else if (settings.authMethod === 'apikey') {
        selectAuthMethod('apikey');
        updateAPIStatus(!!settings.apiKey);
    } else {
        // No auth method selected, show Google as default option
        selectAuthMethod('google');
        updateGoogleStatus(false);
    }
    
    // Handle custom endpoint
    if (settings.apiEndpoint && !document.querySelector('#apiEndpoint option[value="' + settings.apiEndpoint + '"]')) {
        document.getElementById('apiEndpoint').value = 'custom';
        document.getElementById('customEndpoint').value = settings.apiEndpoint;
        document.getElementById('customEndpointGroup').style.display = 'block';
    }
    
    // Update API status based on current settings
    if (settings.apiKey && settings.apiEndpoint) {
        updateAPIStatus(true);
    }
}

// ========== RESET FUNCTIONALITY ==========

async function resetToDefaults() {
    if (!confirm('Are you sure you want to reset all settings to defaults? This will sign you out and clear all API keys.')) {
        return;
    }
    
    try {
        // Sign out from Google if connected
        if (settings.googleToken) {
            chrome.identity.removeCachedAuthToken({ token: settings.googleToken });
        }
        
        // Reset to default settings
        settings = {
            authMethod: null,
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
            autoSync: false
        };
        
        await saveSettings();
        updateUI();
        
        showToast('Settings reset to defaults', 'info');
        
    } catch (error) {
        console.error('Error resetting settings:', error);
        showToast('Error resetting settings: ' + error.message, 'error');
    }
}

// ========== TOAST NOTIFICATIONS ==========

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    
    // Position the toast
    toast.style.display = 'block';
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '9999';
    toast.style.padding = '1rem 1.5rem';
    toast.style.borderRadius = '0.5rem';
    toast.style.fontSize = '0.875rem';
    toast.style.fontWeight = '500';
    toast.style.maxWidth = '400px';
    toast.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    
    // Set colors based on type
    switch (type) {
        case 'success':
            toast.style.background = '#065f46';
            toast.style.color = '#d1fae5';
            toast.style.border = '1px solid #10b981';
            break;
        case 'error':
            toast.style.background = '#7f1d1d';
            toast.style.color = '#fecaca';
            toast.style.border = '1px solid #ef4444';
            break;
        case 'warning':
            toast.style.background = '#78350f';
            toast.style.color = '#fed7aa';
            toast.style.border = '1px solid #f97316';
            break;
        default:
            toast.style.background = '#1e3a8a';
            toast.style.color = '#dbeafe';
            toast.style.border = '1px solid #3b82f6';
    }
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 4000);
}

// ========== PROVIDER HELP ==========

// Add click handlers for provider cards to show setup instructions
document.addEventListener('DOMContentLoaded', function() {
    const providerCards = document.querySelectorAll('.provider-card');
    providerCards.forEach(card => {
        card.addEventListener('click', function() {
            const providerName = this.querySelector('h4').textContent;
            showProviderInstructions(providerName);
        });
    });
});

function showProviderInstructions(provider) {
    let instructions = '';
    let url = '';
    
    switch (provider) {
        case 'Cerebras (Recommended)':
            url = 'https://cloud.cerebras.ai/';
            instructions = `
1. Go to cloud.cerebras.ai
2. Sign up for a free account
3. Go to API Keys in the dashboard
4. Create a new API key
5. Copy the key and paste it above
6. Use model: llama3.1-8b

✅ Completely free, no credit card required!
            `;
            break;
            
        case 'OpenAI':
            url = 'https://platform.openai.com/api-keys';
            instructions = `
1. Go to platform.openai.com
2. Sign in or create account
3. Go to API Keys
4. Create new secret key
5. Copy the key and paste it above
6. Use model: gpt-3.5-turbo or gpt-4

⚠️ Requires payment and credit card
            `;
            break;
            
        case 'OpenRouter':
            url = 'https://openrouter.ai/';
            instructions = `
1. Go to openrouter.ai
2. Sign up for account
3. Add $10 minimum credit
4. Go to API Keys
5. Copy the key and paste it above
6. Use model: deepseek/deepseek-chat

💡 Access to 40+ different models
            `;
            break;
            
        case 'Hugging Face':
            url = 'https://huggingface.co/settings/tokens';
            instructions = `
1. Go to huggingface.co
2. Sign up for account
3. Go to Settings > Access Tokens
4. Create new token with 'read' permission
5. Copy token and paste it above
6. Use model: microsoft/DialoGPT-medium

🔬 Great for research and experimentation
            `;
            break;
    }
    
    if (confirm(`Setup Instructions for ${provider}:\n\n${instructions}\n\nWould you like to open the provider's website?`)) {
        chrome.tabs.create({ url: url });
    }
}

console.log('Branestawm options.js loaded successfully');