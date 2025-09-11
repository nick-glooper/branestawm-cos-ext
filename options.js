// Branestawm Options/Settings Page
// Handles all configuration and authentication

let settings = {
    // New LLM selection system
    activeLlm: 'local', // 'local', 'google', 'custom-[id]'
    airplaneMode: true, // Keep in sync with activeLlm: 'local'
    
    // Legacy settings (for backward compatibility)
    authMethod: null,
    googleToken: null,
    apiEndpoint: 'https://api.cerebras.ai/v1/chat/completions',
    apiKey: '',
    model: 'llama3.1-8b',
    
    // New custom endpoints structure
    customEndpoints: {},
    
    // User personalization
    userName: '',
    
    systemPrompt: 'You are Branestawm, an indispensable AI Chief of Staff designed to provide cognitive support for neurodivergent users. Always break down complex tasks into clear, manageable steps. Provide patient, structured guidance. Use numbered lists and clear headings to organize information. Focus on being helpful, supportive, and understanding of executive function challenges.',
    showTooltips: true,
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
    highContrast: false,
    // Persona system
    personas: {
        'core': {
            id: 'core',
            name: 'Core',
            identity: 'Helpful AI assistant and cognitive support specialist',
            communicationStyle: 'Clear, structured, and supportive',
            tone: 'Professional yet approachable',
            roleContext: 'General assistance, task breakdown, executive function support',
            isDefault: true,
            createdAt: new Date().toISOString()
        }
    }
};

// Debounced save function to avoid excessive saves
let saveTimeout;
function debouncedSave() {
    console.log('DEBUG: debouncedSave called');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        console.log('DEBUG: Executing saveSettings after debounce');
        saveSettings();
    }, 1000); // Save 1 second after last change
}

// Initialize settings page
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Branestawm settings page loading...');
    
    await loadSettings();
    initializeTheme();
    setupEventListeners();
    initializeLocalAiSettings();
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
        
        // Ensure consistency between activeLlm and airplaneMode
        ensureToggleConsistency();
        
        console.log('Settings loaded:', settings);
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Ensure activeLlm and airplaneMode are always in sync
function ensureToggleConsistency() {
    if (settings.activeLlm === 'local') {
        settings.airplaneMode = true;
    } else {
        settings.airplaneMode = false;
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
    console.log('DEBUG: Setting up event listeners...');
    
    // Note: Old auth method selection and API configuration elements moved to modal
    // These elements no longer exist in the main settings page
    
    // Appearance settings
    const colorScheme = document.getElementById('colorScheme');
    if (colorScheme) {
        colorScheme.addEventListener('change', function() {
            settings.colorScheme = this.value;
            applyTheme(settings.colorScheme, settings.themeMode);
        });
    }
    
    const themeMode = document.getElementById('themeMode');
    if (themeMode) {
        themeMode.addEventListener('change', function() {
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
    }
    
    const showTooltips = document.getElementById('showTooltips');
    if (showTooltips) {
        showTooltips.addEventListener('change', function() {
            settings.showTooltips = this.checked;
            document.documentElement.classList.toggle('hide-tooltips', !this.checked);
        });
    }
    
    // AI Behavior settings
    const userName = document.getElementById('userName');
    if (userName) {
        userName.addEventListener('input', function() {
            settings.userName = this.value.trim();
        });
    }
    
    const systemPrompt = document.getElementById('systemPrompt');
    if (systemPrompt) {
        systemPrompt.addEventListener('input', function() {
            settings.systemPrompt = this.value;
        });
    }
    
    // Persona management
    const newPersonaBtn = document.getElementById('newPersonaBtn');
    if (newPersonaBtn) {
        newPersonaBtn.addEventListener('click', () => {
            showPersonaModal();
        });
    }
    
    // Persona modal events
    const personaModalClose = document.querySelector('#personaModal .modal-close');
    if (personaModalClose) {
        personaModalClose.addEventListener('click', closePersonaModal);
    }
    
    const cancelPersonaBtn = document.getElementById('cancelPersonaBtn');
    if (cancelPersonaBtn) {
        cancelPersonaBtn.addEventListener('click', closePersonaModal);
    }
    
    const savePersonaBtn = document.getElementById('savePersonaBtn');
    if (savePersonaBtn) {
        savePersonaBtn.addEventListener('click', savePersona);
    }
    
    // Event delegation for persona buttons
    document.addEventListener('click', function(e) {
        if (e.target.closest('.edit-persona-btn')) {
            const personaId = e.target.closest('.edit-persona-btn').getAttribute('data-persona-id');
            editPersona(personaId);
        } else if (e.target.closest('.delete-persona-btn')) {
            const personaId = e.target.closest('.delete-persona-btn').getAttribute('data-persona-id');
            deletePersona(personaId);
        }
    });
    
    // Character counter for persona name
    document.getElementById('personaName').addEventListener('input', function() {
        const charCount = document.getElementById('nameCharCount');
        charCount.textContent = this.value.length;
        charCount.style.color = this.value.length > 25 ? 'var(--warning)' : 'var(--text-secondary)';
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
    
    // Back to Branestawm button
    const backToBranestawmBtn = document.getElementById('backToBranestawmBtn');
    if (backToBranestawmBtn) {
        backToBranestawmBtn.addEventListener('click', () => {
            // Try to close the current tab
            if (chrome.tabs) {
                chrome.tabs.getCurrent((tab) => {
                    if (tab) {
                        chrome.tabs.remove(tab.id);
                    } else {
                        // Fallback: close window if not in a tab
                        window.close();
                    }
                });
            } else {
                // Fallback: close window
                window.close();
            }
        });
    }
    
    // ========== NEW THREE-TIER AI SETUP SYSTEM ==========
    
    // Primary Setup: Google Gemini OAuth - now handled dynamically by updateGoogleGeminiStatus
    
    // Advanced Setup: Custom API Keys - Expand/Collapse
    const expandApiSetupBtn = document.getElementById('expandApiSetup');
    const apiSetupAdvanced = document.getElementById('apiSetupAdvanced');
    if (expandApiSetupBtn && apiSetupAdvanced) {
        expandApiSetupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isExpanded = apiSetupAdvanced.style.display !== 'none';
            apiSetupAdvanced.style.display = isExpanded ? 'none' : 'block';
            expandApiSetupBtn.innerHTML = isExpanded ? 
                '🔽 Show Advanced API Setup' : 
                '🔼 Hide Advanced API Setup';
        });
    }
    
    // Provider selection buttons
    document.querySelectorAll('.provider-option').forEach(option => {
        option.addEventListener('click', function() {
            selectApiProvider(this.dataset.provider);
        });
    });
    
    // API Key input and test
    const apiKeyInput = document.getElementById('advancedApiKey');
    const testApiBtn = document.getElementById('testAdvancedApi');
    if (apiKeyInput) {
        apiKeyInput.addEventListener('input', function() {
            settings.apiKey = this.value.trim();
        });
    }
    if (testApiBtn) {
        testApiBtn.addEventListener('click', testAdvancedApiConnection);
    }
    
    // Create New Profile button
    const expandProfileSetupBtn = document.getElementById('expandProfileSetup');
    const profileSetupAdvanced = document.getElementById('profileSetupAdvanced');
    if (expandProfileSetupBtn && profileSetupAdvanced) {
        expandProfileSetupBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isExpanded = profileSetupAdvanced.style.display !== 'none';
            profileSetupAdvanced.style.display = isExpanded ? 'none' : 'block';
            expandProfileSetupBtn.textContent = isExpanded ? 
                'Create New Profile' : 
                'Cancel';
        });
    }
    
    // Profile creation button
    const createProfileBtn = document.getElementById('createProfile');
    if (createProfileBtn) {
        createProfileBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await createCustomProfile();
        });
    }
    
    // AI Provider Exclusive Toggle System - declare all toggles first
    const googleGeminiToggle = document.getElementById('googleGeminiToggle');
    const customAIToggle = document.getElementById('customAIToggle');
    const airplaneModeToggle = document.getElementById('airplaneModeToggle');
    
    console.log('DEBUG: Toggle elements found:', {
        googleGeminiToggle: !!googleGeminiToggle,
        customAIToggle: !!customAIToggle,
        airplaneModeToggle: !!airplaneModeToggle
    });
    
    const expandOllamaBtn = document.getElementById('expandOllamaSetup');
    const ollamaAdvanced = document.getElementById('ollamaAdvanced');
    
    // Airplane Mode Toggle with exclusivity
    if (airplaneModeToggle) {
        console.log('DEBUG: Adding event listener to airplaneModeToggle');
        airplaneModeToggle.addEventListener('change', (e) => {
            console.log('DEBUG: Airplane Mode toggle changed to:', e.target.checked);
            if (e.target.checked) {
                // Turn off other toggles when airplane mode is turned on
                if (googleGeminiToggle) googleGeminiToggle.checked = false;
                if (customAIToggle) customAIToggle.checked = false;
                
                settings.activeLlm = 'local';
                ensureToggleConsistency();
            } else {
                // Don't allow unchecking if no other AI is selected - keep at least one active
                if (!googleGeminiToggle?.checked && !customAIToggle?.checked) {
                    e.target.checked = true;
                    return;
                }
                settings.airplaneMode = false;
            }
            console.log('DEBUG: Settings after toggle:', { activeLlm: settings.activeLlm, airplaneMode: settings.airplaneMode });
            updateAirplaneModeUI();
            debouncedSave();
        });
    } else {
        console.log('DEBUG: airplaneModeToggle not found!');
    }
    
    if (googleGeminiToggle) {
        console.log('DEBUG: Adding event listener to googleGeminiToggle');
        googleGeminiToggle.addEventListener('change', (e) => {
            console.log('DEBUG: Google Gemini toggle changed to:', e.target.checked);
            if (e.target.checked) {
                // Turn off other toggles
                if (customAIToggle) customAIToggle.checked = false;
                if (airplaneModeToggle) airplaneModeToggle.checked = false;
                
                settings.activeLlm = 'google';
                ensureToggleConsistency();
                console.log('DEBUG: Settings after Google toggle:', { activeLlm: settings.activeLlm, airplaneMode: settings.airplaneMode });
                updateAirplaneModeUI();
                debouncedSave();
            } else {
                // Don't allow unchecking if no other AI is selected - keep at least one active
                if (!customAIToggle?.checked && !airplaneModeToggle?.checked) {
                    e.target.checked = true;
                    return;
                }
            }
        });
    } else {
        console.log('DEBUG: googleGeminiToggle not found!');
    }
    
    if (customAIToggle) {
        console.log('DEBUG: Adding event listener to customAIToggle');
        customAIToggle.addEventListener('change', (e) => {
            console.log('DEBUG: Custom AI toggle changed to:', e.target.checked);
            if (e.target.checked) {
                // Turn off other toggles
                if (googleGeminiToggle) googleGeminiToggle.checked = false;
                if (airplaneModeToggle) airplaneModeToggle.checked = false;
                
                settings.activeLlm = 'custom';
                ensureToggleConsistency();
                console.log('DEBUG: Settings after Custom toggle:', { activeLlm: settings.activeLlm, airplaneMode: settings.airplaneMode });
                updateAirplaneModeUI();
                debouncedSave();
            } else {
                // Don't allow unchecking if no other AI is selected - keep at least one active
                if (!googleGeminiToggle?.checked && !airplaneModeToggle?.checked) {
                    e.target.checked = true;
                    return;
                }
            }
        });
    } else {
        console.log('DEBUG: customAIToggle not found!');
    }
    
    // Update airplaneMode toggle to also handle exclusivity - need to replace the existing handler
    // (The original handler is already set up above, this extends it with exclusivity logic)
    
    if (expandOllamaBtn && ollamaAdvanced) {
        expandOllamaBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isExpanded = ollamaAdvanced.style.display !== 'none';
            ollamaAdvanced.style.display = isExpanded ? 'none' : 'block';
            expandOllamaBtn.innerHTML = isExpanded ? 
                '🔽 Show Airplane Mode Setup' : 
                '🔼 Hide Airplane Mode Setup';
        });
    }
    
    // Old LLM management system removed - now using three-tier setup
    
    console.log('DEBUG: setupEventListeners completed successfully');
}

// Old auth method selection removed - now handled by three-tier system

// Old provider selection removed - now handled by selectApiProvider in three-tier system

// ========== THREE-TIER AI SETUP SYSTEM ==========

async function authenticateWithGoogleGemini() {
    try {
        showToast('Connecting to Google Gemini...', 'info');
        
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
        
        // Save as primary setup method
        settings.authMethod = 'google';
        settings.googleToken = token;
        settings.activeLlm = 'google';
        
        showToast('Successfully connected to Google Gemini!', 'success');
        updateGoogleGeminiStatus(true);
        
    } catch (error) {
        console.error('Google Gemini auth error:', error);
        showToast('Google Gemini authentication failed: ' + error.message, 'error');
        updateGoogleGeminiStatus(false);
    }
}

async function signOutFromGoogleGemini() {
    try {
        if (settings.googleToken) {
            await new Promise((resolve) => {
                chrome.identity.removeCachedAuthToken({ token: settings.googleToken }, resolve);
            });
        }
        
        settings.authMethod = null;
        settings.googleToken = null;
        settings.activeLlm = 'local'; // fallback
        
        showToast('Signed out from Google Gemini', 'info');
        updateGoogleGeminiStatus(false);
        
    } catch (error) {
        console.error('Sign out error:', error);
        showToast('Error signing out: ' + error.message, 'error');
    }
}

function updateGoogleGeminiStatus(connected) {
    const setupBtn = document.getElementById('googleSetupBtn');
    const buttonText = document.getElementById('googleButtonText');
    
    if (setupBtn && buttonText) {
        if (connected) {
            buttonText.textContent = 'Sign Out';
            setupBtn.onclick = (e) => {
                e.preventDefault();
                signOutFromGoogleGemini();
            };
        } else {
            buttonText.textContent = 'Sign In';
            setupBtn.onclick = (e) => {
                e.preventDefault();
                authenticateWithGoogleGemini();
            };
        }
    }
}

function selectApiProvider(provider) {
    // Update UI selection
    document.querySelectorAll('.provider-option').forEach(option => {
        option.classList.remove('selected');
    });
    document.querySelector(`[data-provider="${provider}"]`).classList.add('selected');
    
    // Update provider-specific settings
    const providerConfigs = {
        cerebras: {
            endpoint: 'https://api.cerebras.ai/v1/chat/completions',
            model: 'llama3.1-8b',
            name: 'Cerebras'
        },
        openai: {
            endpoint: 'https://api.openai.com/v1/chat/completions',
            model: 'gpt-3.5-turbo',
            name: 'OpenAI'
        },
        openrouter: {
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            model: 'meta-llama/llama-3.2-3b-instruct:free',
            name: 'OpenRouter'
        }
    };
    
    const config = providerConfigs[provider];
    if (config) {
        settings.apiEndpoint = config.endpoint;
        settings.model = config.model;
        settings.selectedProvider = provider;
        
        // Update status text
        const statusText = document.getElementById('advancedApiStatusText');
        if (statusText) {
            statusText.textContent = `${config.name} selected - Add API key to test`;
        }
    }
}

async function testAdvancedApiConnection() {
    if (!settings.apiEndpoint || !settings.apiKey) {
        showToast('Please select a provider and add your API key', 'error');
        return;
    }
    
    const testBtn = document.getElementById('testAdvancedApi');
    const statusElement = document.getElementById('advancedApiStatus');
    const statusText = document.getElementById('advancedApiStatusText');
    
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
            settings.authMethod = 'apikey';
            settings.activeLlm = 'custom';
            statusElement.className = 'status-indicator connected';
            statusText.textContent = 'API key working! Ready to use.';
            showToast('✅ API connection successful!', 'success');
            await saveSettings();
        } else {
            const errorText = await response.text();
            statusElement.className = 'status-indicator disconnected';
            statusText.textContent = `Connection failed: ${response.status}`;
            showToast(`❌ Connection failed: ${response.status}`, 'error');
        }
        
    } catch (error) {
        statusElement.className = 'status-indicator disconnected';
        statusText.textContent = 'Connection error';
        showToast(`❌ Connection failed: ${error.message}`, 'error');
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = 'Test Connection';
    }
}

function updateAirplaneModeUI() {
    const checkbox = document.getElementById('airplaneModeToggle');
    const statusContainer = document.getElementById('localAIStatus');
    const statusText = document.getElementById('statusText');
    const statusIndicator = document.getElementById('statusIndicator');
    
    if (checkbox && checkbox.checked) {
        settings.activeLlm = 'local';
        
        if (statusContainer) statusContainer.style.display = 'block';
        if (statusIndicator) statusIndicator.style.background = '#10b981';
        if (statusText) statusText.textContent = 'Local AI Active - Using EmbeddingGemma';
        
        // Check actual EmbeddingGemma status
        updateLocalAiConnectionStatus();
    } else {
        if (statusContainer) statusContainer.style.display = 'block';
        if (statusIndicator) statusIndicator.style.background = '#6b7280';
        if (statusText) statusText.textContent = 'Local AI Disabled';
    }
}

async function updateLocalAiConnectionStatus() {
    const statusContainer = document.getElementById('localAIStatus');
    const statusText = document.getElementById('statusText');
    const statusIndicator = document.getElementById('statusIndicator');
    const setupBtn = document.getElementById('setupLocalAI');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    if (!statusContainer || !statusText) return;
    
    // Show status container
    statusContainer.style.display = 'block';
    
    try {
        // Check if EmbeddingGemma is available
        const response = await chrome.runtime.sendMessage({
            type: 'CHECK_LOCAL_AI_STATUS'
        });
        
        if (response && response.ready) {
            if (statusIndicator) statusIndicator.style.background = '#10b981';
            statusText.textContent = 'EmbeddingGemma Ready ✅';
            if (setupBtn) setupBtn.textContent = 'Local AI Ready';
            if (progressContainer) progressContainer.style.display = 'none';
        } else if (response && response.loading) {
            if (statusIndicator) statusIndicator.style.background = '#f59e0b';
            statusText.textContent = 'Loading EmbeddingGemma...';
            if (setupBtn) setupBtn.textContent = 'Setting up...';
            if (progressContainer) {
                progressContainer.style.display = 'block';
                if (progressText) progressText.textContent = 'Downloading model (first time only)...';
            }
        } else {
            if (statusIndicator) statusIndicator.style.background = '#6b7280';
            statusText.textContent = 'EmbeddingGemma not loaded';
            if (setupBtn) setupBtn.textContent = 'Enable Local AI';
            if (progressContainer) progressContainer.style.display = 'none';
        }
    } catch (error) {
        if (statusIndicator) statusIndicator.style.background = '#ef4444';
        statusText.textContent = 'Local AI unavailable';
        if (setupBtn) setupBtn.textContent = 'Enable Local AI';
        if (progressContainer) progressContainer.style.display = 'none';
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

// Legacy Google Auth Status (kept for compatibility)
function updateGoogleAuthStatus(connected) {
    updateGoogleGeminiStatus(connected);
}

// ========== API KEY TESTING ==========

// Old connection testing functions removed - now handled by testAdvancedApiConnection

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
    // Update basic form fields
    const userName = document.getElementById('userName');
    const systemPrompt = document.getElementById('systemPrompt');
    const showTooltips = document.getElementById('showTooltips');
    
    if (userName) userName.value = settings.userName || '';
    if (systemPrompt) systemPrompt.value = settings.systemPrompt || '';
    if (showTooltips) showTooltips.checked = settings.showTooltips;
    
    // Update appearance settings
    const colorScheme = document.getElementById('colorScheme');
    const themeMode = document.getElementById('themeMode');
    if (colorScheme) colorScheme.value = settings.colorScheme || 'professional';
    if (themeMode) themeMode.value = settings.themeMode || 'dark';
    
    // Update sync settings
    const enableSync = document.getElementById('enableSync');
    const syncKey = document.getElementById('syncKey');
    const syncKeyGroup = document.getElementById('syncKeyGroup');
    const uploadDataBtn = document.getElementById('uploadDataBtn');
    const downloadDataBtn = document.getElementById('downloadDataBtn');
    
    if (enableSync) enableSync.checked = settings.autoSync;
    if (syncKey) syncKey.value = settings.syncKey || '';
    if (syncKeyGroup) syncKeyGroup.style.display = settings.autoSync ? 'block' : 'none';
    if (uploadDataBtn) uploadDataBtn.style.display = settings.autoSync ? 'inline-block' : 'none';
    if (downloadDataBtn) downloadDataBtn.style.display = settings.autoSync ? 'inline-block' : 'none';
    
    // Update personas
    updatePersonasList();
    
    // ========== THREE-TIER AI SETUP SYSTEM UPDATES ==========
    
    // Update Google Gemini status
    updateGoogleGeminiStatus(!!settings.googleToken);
    
    // Update Advanced API status
    if (settings.selectedProvider && settings.apiKey) {
        const statusElement = document.getElementById('advancedApiStatus');
        const statusText = document.getElementById('advancedApiStatusText');
        if (statusElement) statusElement.className = 'status-indicator connected';
        if (statusText) statusText.textContent = `${settings.selectedProvider} API configured`;
        
        // Auto-select the provider
        const providerOption = document.querySelector(`[data-provider="${settings.selectedProvider}"]`);
        if (providerOption) {
            document.querySelectorAll('.provider-option').forEach(option => {
                option.classList.remove('selected');
            });
            providerOption.classList.add('selected');
        }
    }
    
    // Update AI Provider Toggle states based on activeLlm (consistent system)
    const googleGeminiToggle = document.getElementById('googleGeminiToggle');
    const customAIToggle = document.getElementById('customAIToggle');
    const airplaneModeToggle = document.getElementById('airplaneModeToggle');
    
    if (googleGeminiToggle) {
        googleGeminiToggle.checked = settings.activeLlm === 'google';
    }
    if (customAIToggle) {
        customAIToggle.checked = settings.activeLlm === 'custom';
    }
    if (airplaneModeToggle) {
        airplaneModeToggle.checked = settings.activeLlm === 'local';
        // Keep airplaneMode in sync with activeLlm
        settings.airplaneMode = settings.activeLlm === 'local';
        updateAirplaneModeUI();
    }
    
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
            userName: '',
            systemPrompt: 'You are Branestawm, an indispensable AI Chief of Staff designed to provide cognitive support for neurodivergent users. Always break down complex tasks into clear, manageable steps. Provide patient, structured guidance. Use numbered lists and clear headings to organize information. Focus on being helpful, supportive, and understanding of executive function challenges.',
            showTooltips: true,
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

// ========== PERSONA MANAGEMENT ==========

let currentEditingPersona = null;

function updatePersonasList() {
    const personasList = document.getElementById('personasList');
    personasList.innerHTML = '';
    
    if (!settings.personas) {
        settings.personas = {
            'core': {
                id: 'core',
                name: 'Core',
                identity: 'Helpful AI assistant and cognitive support specialist',
                communicationStyle: 'Clear, structured, and supportive',
                tone: 'Professional yet approachable',
                roleContext: 'General assistance, task breakdown, executive function support',
                isDefault: true,
                createdAt: new Date().toISOString()
            }
        };
    }
    
    Object.values(settings.personas).forEach(persona => {
        const personaCard = createPersonaCard(persona);
        personasList.appendChild(personaCard);
    });
}

function createPersonaCard(persona) {
    const card = document.createElement('div');
    card.className = 'persona-card';
    if (persona.isDefault) {
        card.classList.add('default');
    }
    
    card.innerHTML = `
        <div class="persona-header">
            <div class="persona-title">
                ${persona.name}
                ${persona.isDefault ? '<span class="persona-default-badge">Default</span>' : ''}
            </div>
            <div class="persona-actions">
                <button class="btn secondary small edit-persona-btn" data-persona-id="${persona.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                    Edit
                </button>
                ${!persona.isDefault ? `<button class="btn secondary small delete-persona-btn" data-persona-id="${persona.id}" style="color: var(--error);">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                    Delete
                </button>` : ''}
            </div>
        </div>
        <div class="persona-identity">${persona.coreIdentity || persona.identity || ''}</div>
        <div class="persona-meta">
            <div class="persona-meta-item">
                <div class="persona-meta-label">Context</div>
                <div class="persona-meta-value">${persona.companyContext || 'Not specified'}</div>
            </div>
            <div class="persona-meta-item">
                <div class="persona-meta-label">Role Focus</div>
                <div class="persona-meta-value">${persona.roleFocus || persona.roleContext || 'Not specified'}</div>
            </div>
        </div>
    `;
    
    return card;
}

function showPersonaModal(personaId = null) {
    currentEditingPersona = personaId;
    const modal = document.getElementById('personaModal');
    const modalTitle = document.getElementById('personaModalTitle');
    
    if (personaId) {
        // Edit existing persona
        const persona = settings.personas[personaId];
        modalTitle.textContent = 'Edit Persona';
        document.getElementById('personaName').value = persona.name;
        
        // Handle both old and new persona structure
        document.getElementById('companyContext').value = persona.companyContext || '';
        document.getElementById('coreIdentity').value = persona.coreIdentity || persona.identity || '';
        document.getElementById('communicationPreferences').value = persona.communicationPreferences || persona.communicationStyle || '';
        document.getElementById('priorityFramework').value = persona.priorityFramework || '';
        document.getElementById('roleFocus').value = persona.roleFocus || persona.roleContext || '';
        document.getElementById('cognitiveMode').value = persona.cognitiveMode || '';
        document.getElementById('workingStyle').value = persona.workingStyle || '';
        
        // Update character count
        const charCount = document.getElementById('nameCharCount');
        charCount.textContent = persona.name.length;
        charCount.style.color = persona.name.length > 25 ? 'var(--warning)' : 'var(--text-secondary)';
    } else {
        // Create new persona
        modalTitle.textContent = 'New Persona';
        document.getElementById('personaName').value = '';
        document.getElementById('companyContext').value = '';
        document.getElementById('coreIdentity').value = '';
        document.getElementById('communicationPreferences').value = '';
        document.getElementById('priorityFramework').value = '';
        document.getElementById('roleFocus').value = '';
        document.getElementById('cognitiveMode').value = '';
        document.getElementById('workingStyle').value = '';
        
        // Reset character count
        const charCount = document.getElementById('nameCharCount');
        charCount.textContent = '0';
        charCount.style.color = 'var(--text-secondary)';
    }
    
    modal.classList.add('show');
    document.getElementById('personaName').focus();
}

function closePersonaModal() {
    const modal = document.getElementById('personaModal');
    modal.classList.remove('show');
    currentEditingPersona = null;
}

function savePersona() {
    const name = document.getElementById('personaName').value.trim();
    const companyContext = document.getElementById('companyContext').value.trim();
    const coreIdentity = document.getElementById('coreIdentity').value.trim();
    const communicationPreferences = document.getElementById('communicationPreferences').value.trim();
    const priorityFramework = document.getElementById('priorityFramework').value.trim();
    const roleFocus = document.getElementById('roleFocus').value.trim();
    const cognitiveMode = document.getElementById('cognitiveMode').value.trim();
    const workingStyle = document.getElementById('workingStyle').value.trim();
    
    // Validation - only required fields
    if (!name || !companyContext || !coreIdentity || !roleFocus) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    // Check name length
    if (name.length > 30) {
        showToast('Persona name must be 30 characters or less', 'error');
        return;
    }
    
    // Check for duplicate names (excluding current persona being edited)
    const existingPersona = Object.values(settings.personas).find(
        p => p.name.toLowerCase() === name.toLowerCase() && p.id !== currentEditingPersona
    );
    
    if (existingPersona) {
        showToast('A persona with this name already exists', 'error');
        return;
    }
    
    if (currentEditingPersona) {
        // Update existing persona
        const persona = settings.personas[currentEditingPersona];
        persona.name = name;
        persona.companyContext = companyContext;
        persona.coreIdentity = coreIdentity;
        persona.communicationPreferences = communicationPreferences;
        persona.priorityFramework = priorityFramework;
        persona.roleFocus = roleFocus;
        persona.cognitiveMode = cognitiveMode;
        persona.workingStyle = workingStyle;
        persona.updatedAt = new Date().toISOString();
        showToast('Persona updated successfully!', 'success');
    } else {
        // Create new persona
        const personaId = generateId();
        settings.personas[personaId] = {
            id: personaId,
            name: name,
            companyContext: companyContext,
            coreIdentity: coreIdentity,
            communicationPreferences: communicationPreferences,
            priorityFramework: priorityFramework,
            roleFocus: roleFocus,
            cognitiveMode: cognitiveMode,
            workingStyle: workingStyle,
            isDefault: false,
            createdAt: new Date().toISOString()
        };
        showToast('Persona created successfully!', 'success');
    }
    
    closePersonaModal();
    updatePersonasList();
    saveSettings();
}

function editPersona(personaId) {
    showPersonaModal(personaId);
}

function deletePersona(personaId) {
    const persona = settings.personas[personaId];
    
    if (persona.isDefault) {
        showToast('Cannot delete the default persona', 'error');
        return;
    }
    
    if (confirm(`Are you sure you want to delete the persona "${persona.name}"? This action cannot be undone.`)) {
        delete settings.personas[personaId];
        updatePersonasList();
        saveSettings();
        showToast('Persona deleted successfully', 'success');
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ========== LOCAL AI (EmbeddingGemma) SETTINGS ==========

/**
 * Initialize Local AI settings UI
 */
function initializeLocalAiSettings() {
    const setupBtn = document.getElementById('setupLocalAI');
    
    // Set up event listeners
    if (setupBtn) {
        setupBtn.addEventListener('click', async () => {
            await initializeLocalAi();
        });
    }
    
    // Initial status check
    updateLocalAiStatus();
    
    // Update status every 10 seconds while loading
    const statusInterval = setInterval(async () => {
        await updateLocalAiStatus();
        // Stop checking if model is ready
        const response = await chrome.runtime.sendMessage({ type: 'CHECK_LOCAL_AI_STATUS' });
        if (response && response.ready) {
            clearInterval(statusInterval);
        }
    }, 10000);
}

/**
 * Update Local AI connection status
 */
async function updateLocalAiStatus() {
    await updateLocalAiConnectionStatus();
}

/**
 * Initialize Local AI (EmbeddingGemma)
 */
async function initializeLocalAi() {
    const setupBtn = document.getElementById('setupLocalAI');
    const statusContainer = document.getElementById('localAIStatus');
    const statusText = document.getElementById('statusText');
    const statusIndicator = document.getElementById('statusIndicator');
    const progressContainer = document.getElementById('progressContainer');
    const progressText = document.getElementById('progressText');
    
    if (setupBtn) {
        setupBtn.disabled = true;
        setupBtn.textContent = 'Initializing...';
    }
    
    // Show status container
    if (statusContainer) statusContainer.style.display = 'block';
    
    try {
        // Send message to background script to initialize offscreen document
        console.log('DEBUG: Sending INIT_LOCAL_AI message to background');
        const response = await chrome.runtime.sendMessage({
            type: 'INIT_LOCAL_AI'
        });
        
        console.log('DEBUG: Received response from background:', response);
        
        if (response && response.success) {
            showToast('Local AI initialization started!', 'info');
            
            // Update UI immediately
            if (statusIndicator) statusIndicator.style.background = '#f59e0b';
            if (statusText) statusText.textContent = 'Loading EmbeddingGemma...';
            if (progressContainer) {
                progressContainer.style.display = 'block';
                if (progressText) progressText.textContent = 'Setting up offscreen document...';
            }
            
            // Wait for offscreen document to load, then try to initialize the model
            setTimeout(async () => {
                try {
                    console.log('🧠 Waiting for offscreen document to be ready...');
                    if (progressText) progressText.textContent = 'Initializing EmbeddingGemma...';
                    
                    // Start monitoring status
                    monitorLocalAiInitialization();
                } catch (error) {
                    console.error('Failed to start monitoring:', error);
                    if (progressText) progressText.textContent = 'Initialization failed';
                    if (statusIndicator) statusIndicator.style.background = '#ef4444';
                    if (statusText) statusText.textContent = 'Failed to load model';
                }
            }, 1000);
            
        } else {
            throw new Error(response?.error || 'Failed to initialize Local AI');
        }
        
    } catch (error) {
        console.error('Error initializing Local AI:', error);
        showToast('Failed to initialize Local AI: ' + error.message, 'error');
        
        if (setupBtn) {
            setupBtn.disabled = false;
            setupBtn.textContent = 'Enable Local AI';
        }
        
        if (statusIndicator) statusIndicator.style.background = '#ef4444';
        if (statusText) statusText.textContent = 'Failed to initialize';
        if (progressContainer) progressContainer.style.display = 'none';
    }
}

/**
 * Monitor Local AI initialization progress
 */
function monitorLocalAiInitialization() {
    const checkStatus = async () => {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'CHECK_LOCAL_AI_STATUS'
            });
            
            if (response && response.ready) {
                // Model is ready!
                updateLocalAiConnectionStatus();
                showToast('EmbeddingGemma loaded successfully! ✅', 'success');
                return; // Stop monitoring
            } else if (response && response.loading) {
                // Still loading, continue monitoring
                setTimeout(checkStatus, 2000);
            } else {
                // Something went wrong
                updateLocalAiConnectionStatus();
                setTimeout(checkStatus, 5000);
            }
        } catch (error) {
            console.error('Error checking Local AI status:', error);
            setTimeout(checkStatus, 5000);
        }
    };
    
    // Start monitoring
    checkStatus();
}

// ========== CUSTOM PROFILE MANAGEMENT ==========

async function createCustomProfile() {
    const nameInput = document.getElementById('profileName');
    const urlInput = document.getElementById('profileUrl');
    const modelInput = document.getElementById('profileModel');
    const apiKeyInput = document.getElementById('profileApiKey');
    
    if (!nameInput || !urlInput || !modelInput || !apiKeyInput) {
        showToast('Profile form elements not found', 'error');
        return;
    }
    
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    const model = modelInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    
    if (!name || !url || !model || !apiKey) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    try {
        // Initialize custom endpoints if not exists
        if (!settings.customEndpoints) {
            settings.customEndpoints = {};
        }
        
        // Generate unique ID
        const profileId = `custom_${Date.now()}`;
        
        // Create profile
        settings.customEndpoints[profileId] = {
            id: profileId,
            name: name,
            endpoint: url,
            model: model,
            apiKey: apiKey,
            createdAt: new Date().toISOString()
        };
        
        // Save settings
        await saveSettings();
        
        // Clear form
        nameInput.value = '';
        urlInput.value = '';
        modelInput.value = '';
        apiKeyInput.value = '';
        
        // Hide form
        const profileSetupAdvanced = document.getElementById('profileSetupAdvanced');
        if (profileSetupAdvanced) {
            profileSetupAdvanced.style.display = 'none';
        }
        
        // Reset button text
        const expandProfileSetupBtn = document.getElementById('expandProfileSetup');
        if (expandProfileSetupBtn) {
            expandProfileSetupBtn.textContent = 'Create New Profile';
        }
        
        showToast('Profile created successfully!', 'success');
        
        // Update UI
        updateUI();
        
    } catch (error) {
        console.error('Error creating profile:', error);
        showToast('Failed to create profile: ' + error.message, 'error');
    }
}

// ========== OLD CLOUD LLM SYSTEM FUNCTIONS - REMOVED ==========
// Replaced with three-tier system: Google Gemini OAuth / Advanced API / Airplane Mode

// All old endpoint management, modal functions, and complex LLM switching removed.
// The new system uses a simplified three-tier approach as implemented in options.html

// End of options.js - Clean implementation of three-tier AI setup system
