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
    autoSync: false,
    // Glooper Design System settings
    colorScheme: 'professional', // 'professional', 'warm', 'cool'
    themeMode: 'dark', // 'light', 'dark', 'auto'
    fontSize: 'standard', // 'compact', 'standard', 'large', 'xl'
    reducedMotion: false,
    highContrast: false
};

// Initialize settings page
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Branestawm settings page loading...');
    
    await loadSettings();
    initializeTheme();
    setupEventListeners();
    updateUI();
    
    console.log('Settings page loaded successfully');
});

// ========== DESIGN SYSTEM THEME MANAGEMENT ==========

function initializeTheme() {
    // Apply current theme settings
    applyTheme(settings.colorScheme, settings.themeMode);
    
    // Listen for system theme changes if auto mode
    if (settings.themeMode === 'auto') {
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
}

function handleSystemThemeChange(e) {
    if (settings.themeMode === 'auto') {
        const html = document.documentElement;
        html.setAttribute('data-mode', e.matches ? 'dark' : 'light');
    }
}

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
    
    document.getElementById('apiKeyOption').addEventListener('click', () => {
        selectAuthMethod('apikey');
    });
    
    // Google OAuth
    document.getElementById('googleSignInBtn').addEventListener('click', authenticateWithGoogle);
    document.getElementById('googleSignOutBtn').addEventListener('click', signOutFromGoogle);
    
    // Provider selection
    document.querySelectorAll('.provider-card').forEach(card => {
        card.addEventListener('click', () => {
            selectProvider(card.dataset.provider);
        });
    });
    
    // API configuration
    document.getElementById('apiEndpoint').addEventListener('input', function() {
        settings.apiEndpoint = this.value;
    });
    document.getElementById('apiModel').addEventListener('input', function() {
        settings.model = this.value;
    });
    document.getElementById('apiKey').addEventListener('input', function() {
        settings.apiKey = this.value;
    });
    
    // Test connection
    document.getElementById('testConnectionBtn').addEventListener('click', testConnection);
    
    // Appearance settings
    document.getElementById('colorScheme').addEventListener('change', function() {
        settings.colorScheme = this.value;
        applyTheme(settings.colorScheme, settings.themeMode);
    });
    
    document.getElementById('themeMode').addEventListener('change', function() {
        settings.themeMode = this.value;
        applyTheme(settings.colorScheme, settings.themeMode);
        
        // Setup/remove system theme listener
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        if (this.value === 'auto') {
            mediaQuery.addEventListener('change', handleSystemThemeChange);
        } else {
            mediaQuery.removeEventListener('change', handleSystemThemeChange);
        }
    });
    
    document.getElementById('showTooltips').addEventListener('change', function() {
        settings.showTooltips = this.checked;
        document.documentElement.classList.toggle('hide-tooltips', !this.checked);
    });
    
    // AI Behavior settings
    document.getElementById('systemPrompt').addEventListener('input', function() {
        settings.systemPrompt = this.value;
    });
    
    document.getElementById('autoWebSearch').addEventListener('change', function() {
        settings.autoWebSearch = this.checked;
    });
    
    // Sync settings
    document.getElementById('enableSync').addEventListener('change', function() {
        settings.autoSync = this.checked;
        document.getElementById('syncKeyGroup').style.display = this.checked ? 'block' : 'none';
        document.getElementById('uploadDataBtn').style.display = this.checked ? 'inline-block' : 'none';
        document.getElementById('downloadDataBtn').style.display = this.checked ? 'inline-block' : 'none';
    });
    
    document.getElementById('syncKey').addEventListener('input', function() {
        settings.syncKey = this.value;
    });
    
    document.getElementById('uploadDataBtn').addEventListener('click', uploadData);
    document.getElementById('downloadDataBtn').addEventListener('click', downloadData);
    
    // Form actions
    document.getElementById('resetSettingsBtn').addEventListener('click', resetSettings);
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
}

// ========== AUTH METHOD SELECTION ==========

function selectAuthMethod(method) {
    // Update UI
    document.querySelectorAll('.auth-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    document.querySelectorAll('.auth-section').forEach(section => {
        section.classList.remove('active');
    });
    
    if (method === 'google') {
        document.getElementById('googleAuthOption').classList.add('selected');
        document.getElementById('googleAuthSection').classList.add('active');
        settings.authMethod = 'google';
    } else {
        document.getElementById('apiKeyOption').classList.add('selected');
        document.getElementById('apiKeySection').classList.add('active');
        settings.authMethod = 'apikey';
    }
}

// ========== PROVIDER SELECTION ==========

function selectProvider(provider) {
    // Update UI
    document.querySelectorAll('.provider-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    document.querySelector(`[data-provider="${provider}"]`).classList.add('selected');
    
    // Update form fields based on provider
    const providerConfigs = {
        cerebras: {
            endpoint: 'https://api.cerebras.ai/v1/chat/completions',
            model: 'llama3.1-8b',
            instructions: `
                <h6>🚀 Cerebras Setup (Free):</h6>
                <ol>
                    <li>Go to <code>cloud.cerebras.ai</code></li>
                    <li>Sign up for a free account</li>
                    <li>Navigate to API Keys section</li>
                    <li>Create a new API key</li>
                    <li>Copy the key and paste it above</li>
                </ol>
                <p><strong>Benefits:</strong> Fast inference, generous free tier, Llama 3.1 70B model</p>
            `
        },
        openai: {
            endpoint: 'https://api.openai.com/v1/chat/completions',
            model: 'gpt-3.5-turbo',
            instructions: `
                <h6>🤖 OpenAI Setup:</h6>
                <ol>
                    <li>Go to <code>platform.openai.com</code></li>
                    <li>Sign in to your account</li>
                    <li>Navigate to API Keys</li>
                    <li>Create a new secret key</li>
                    <li>Copy the key (starts with sk-)</li>
                </ol>
                <p><strong>Models:</strong> GPT-3.5 Turbo, GPT-4, GPT-4 Turbo</p>
            `
        },
        openrouter: {
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            model: 'deepseek/deepseek-chat',
            instructions: `
                <h6>🌐 OpenRouter Setup:</h6>
                <ol>
                    <li>Go to <code>openrouter.ai</code></li>
                    <li>Create an account</li>
                    <li>Go to Keys section</li>
                    <li>Create a new API key</li>
                    <li>Add credits to your account</li>
                </ol>
                <p><strong>Benefits:</strong> 40+ models, competitive pricing, unified API</p>
            `
        },
        custom: {
            endpoint: '',
            model: '',
            instructions: `
                <h6>⚙️ Custom Endpoint Setup:</h6>
                <ol>
                    <li>Enter your OpenAI-compatible endpoint URL</li>
                    <li>Specify the model name</li>
                    <li>Add your API key</li>
                    <li>Test the connection</li>
                </ol>
                <p><strong>Compatible with:</strong> LocalAI, Ollama, vLLM, and other OpenAI-compatible servers</p>
            `
        }
    };
    
    const config = providerConfigs[provider];
    if (config) {
        document.getElementById('apiEndpoint').value = config.endpoint;
        document.getElementById('apiModel').value = config.model;
        document.getElementById('providerInstructions').innerHTML = config.instructions;
        
        settings.apiEndpoint = config.endpoint;
        settings.model = config.model;
    }
}

// ========== GOOGLE OAUTH ==========

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
        
        // Test the token
        await testGoogleConnection(token);
        
        // Save auth method and token
        settings.authMethod = 'google';
        settings.googleToken = token;
        
        showToast('Successfully connected to Google Gemini!', 'success');
        updateGoogleAuthStatus(true);
        
    } catch (error) {
        console.error('Google auth error:', error);
        showToast('Google authentication failed: ' + error.message, 'error');
        updateGoogleAuthStatus(false);
    }
}

async function signOutFromGoogle() {
    try {
        if (settings.googleToken) {
            await new Promise((resolve) => {
                chrome.identity.removeCachedAuthToken({ token: settings.googleToken }, resolve);
            });
        }
        
        settings.authMethod = null;
        settings.googleToken = null;
        
        showToast('Signed out from Google', 'info');
        updateGoogleAuthStatus(false);
        
    } catch (error) {
        console.error('Sign out error:', error);
        showToast('Error signing out: ' + error.message, 'error');
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

function updateGoogleAuthStatus(connected) {
    const statusElement = document.getElementById('googleStatus');
    const statusText = document.getElementById('googleStatusText');
    const signInBtn = document.getElementById('googleSignInBtn');
    const signOutBtn = document.getElementById('googleSignOutBtn');
    
    if (connected) {
        statusElement.className = 'status-indicator connected';
        statusText.textContent = 'Connected to Google Gemini';
        signInBtn.style.display = 'none';
        signOutBtn.style.display = 'inline-flex';
    } else {
        statusElement.className = 'status-indicator disconnected';
        statusText.textContent = 'Not connected';
        signInBtn.style.display = 'inline-flex';
        signOutBtn.style.display = 'none';
    }
}

// ========== API KEY TESTING ==========

async function testConnection() {
    if (!settings.apiEndpoint || !settings.apiKey) {
        showTestResult('Please fill in API endpoint and key', 'error');
        return;
    }
    
    const testBtn = document.getElementById('testConnectionBtn');
    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    
    try {
        const response = await fetch(settings.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify({
                model: settings.model,
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 10
            })
        });
        
        if (response.ok) {
            showTestResult('✅ Connection successful!', 'success');
            updateApiKeyStatus(true);
        } else {
            const errorText = await response.text();
            showTestResult(`❌ Connection failed: ${response.status} - ${errorText}`, 'error');
            updateApiKeyStatus(false);
        }
        
    } catch (error) {
        showTestResult(`❌ Connection failed: ${error.message}`, 'error');
        updateApiKeyStatus(false);
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = 'Test Connection';
    }
}

function showTestResult(message, type) {
    const resultElement = document.getElementById('testResult');
    resultElement.textContent = message;
    resultElement.className = `test-result ${type}`;
    resultElement.style.display = 'block';
}

function updateApiKeyStatus(connected) {
    const statusElement = document.getElementById('apiKeyStatus');
    const statusText = document.getElementById('apiKeyStatusText');
    
    if (connected) {
        statusElement.className = 'status-indicator connected';
        statusText.textContent = 'API key configured and tested';
    } else {
        statusElement.className = 'status-indicator disconnected';
        statusText.textContent = 'Not configured';
    }
}

// ========== SYNC FUNCTIONALITY ==========

async function uploadData() {
    if (!settings.syncKey) {
        showToast('Please enter an encryption key first', 'error');
        return;
    }
    
    try {
        showToast('Uploading data...', 'info');
        
        // Get all data from main extension
        const allData = await chrome.storage.local.get(null);
        
        // Encrypt the data
        const encryptedData = await encryptData(JSON.stringify(allData), settings.syncKey);
        
        // Upload to JSONBin
        const response = await fetch('https://api.jsonbin.io/v3/b', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': settings.jsonbinApiKey || '$2a$10$...' // Default key
            },
            body: JSON.stringify({ data: encryptedData })
        });
        
        if (response.ok) {
            const result = await response.json();
            settings.syncId = result.metadata.id;
            showToast('Data uploaded successfully!', 'success');
        } else {
            throw new Error('Upload failed');
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Upload failed: ' + error.message, 'error');
    }
}

async function downloadData() {
    if (!settings.syncKey || !settings.syncId) {
        showToast('Please enter encryption key and sync ID', 'error');
        return;
    }
    
    try {
        showToast('Downloading data...', 'info');
        
        // Download from JSONBin
        const response = await fetch(`https://api.jsonbin.io/v3/b/${settings.syncId}`, {
            headers: {
                'X-Master-Key': settings.jsonbinApiKey || '$2a$10$...' // Default key
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // Decrypt the data
            const decryptedData = await decryptData(result.record.data, settings.syncKey);
            const allData = JSON.parse(decryptedData);
            
            // Save to local storage
            await chrome.storage.local.set(allData);
            
            showToast('Data downloaded successfully! Please refresh the page.', 'success');
        } else {
            throw new Error('Download failed');
        }
        
    } catch (error) {
        console.error('Download error:', error);
        showToast('Download failed: ' + error.message, 'error');
    }
}

// ========== ENCRYPTION HELPERS ==========

async function encryptData(data, key) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(key),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const derivedKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        derivedKey,
        encoder.encode(data)
    );
    
    return {
        salt: Array.from(salt),
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted))
    };
}

async function decryptData(encryptedData, key) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(key),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    
    const salt = new Uint8Array(encryptedData.salt);
    const derivedKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );
    
    const iv = new Uint8Array(encryptedData.iv);
    const data = new Uint8Array(encryptedData.data);
    
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        derivedKey,
        data
    );
    
    return decoder.decode(decrypted);
}

// ========== UI UPDATES ==========

function updateUI() {
    // Update auth method selection
    if (settings.authMethod === 'google') {
        selectAuthMethod('google');
        updateGoogleAuthStatus(!!settings.googleToken);
    } else if (settings.authMethod === 'apikey') {
        selectAuthMethod('apikey');
        updateApiKeyStatus(!!settings.apiKey);
    }
    
    // Update form fields
    document.getElementById('apiEndpoint').value = settings.apiEndpoint || '';
    document.getElementById('apiModel').value = settings.model || '';
    document.getElementById('apiKey').value = settings.apiKey || '';
    document.getElementById('systemPrompt').value = settings.systemPrompt || '';
    document.getElementById('autoWebSearch').checked = settings.autoWebSearch;
    document.getElementById('showTooltips').checked = settings.showTooltips;
    
    // Update appearance settings
    document.getElementById('colorScheme').value = settings.colorScheme || 'professional';
    document.getElementById('themeMode').value = settings.themeMode || 'dark';
    
    // Update sync settings
    document.getElementById('enableSync').checked = settings.autoSync;
    document.getElementById('syncKey').value = settings.syncKey || '';
    document.getElementById('syncKeyGroup').style.display = settings.autoSync ? 'block' : 'none';
    document.getElementById('uploadDataBtn').style.display = settings.autoSync ? 'inline-block' : 'none';
    document.getElementById('downloadDataBtn').style.display = settings.autoSync ? 'inline-block' : 'none';
    
    // Apply tooltip visibility
    document.documentElement.classList.toggle('hide-tooltips', !settings.showTooltips);
}

// ========== UTILITY FUNCTIONS ==========

function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
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
            autoSync: false,
            colorScheme: 'professional',
            themeMode: 'dark',
            fontSize: 'standard',
            reducedMotion: false,
            highContrast: false
        };
        
        updateUI();
        applyTheme(settings.colorScheme, settings.themeMode);
        showToast('Settings reset to defaults', 'info');
    }
}

function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Style the toast
    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-lg)',
        color: 'var(--text-inverse)',
        fontWeight: '500',
        fontSize: 'var(--font-size-sm)',
        zIndex: '1000',
        opacity: '0',
        transform: 'translateY(-20px)',
        transition: 'all var(--duration-300) var(--ease-out)'
    });
    
    // Set background color based on type
    const colors = {
        success: 'var(--success)',
        error: 'var(--error)',
        warning: 'var(--warning)',
        info: 'var(--info)'
    };
    toast.style.backgroundColor = colors[type] || colors.info;
    
    // Add to page
    document.body.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });
    
    // Remove after delay
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}