// Background service worker for Branestawm extension

let branestawmTabId = null;
let keepAliveInterval = null;

// Extension installation and updates
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        console.log('Branestawm extension installed');
        
        // Set default settings for new installation
        await chrome.storage.local.set({
            settings: {
                authMethod: null, // Will be set during onboarding
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
            }
        });
        
        // Initialize default project structure
        await chrome.storage.local.set({
            projects: {
                'default': {
                    id: 'default',
                    name: 'Default Project',
                    description: 'Default project for general conversations',
                    conversations: [],
                    artifacts: [],
                    createdAt: new Date().toISOString()
                }
            },
            conversations: {},
            artifacts: {},
            currentProject: 'default'
        });
        
        // Open Branestawm tab on first install
        await openBranestawmTab();
        
    } else if (details.reason === 'update') {
        console.log('Branestawm extension updated to version:', chrome.runtime.getManifest().version);
        
        // Handle any migration tasks here if needed
        await migrateDataIfNeeded();
    }
    
    // Set up context menus
    setupContextMenus();
});

// Handle extension icon click - open or focus Branestawm tab
if (chrome.action) {
    chrome.action.onClicked.addListener(async (tab) => {
        await openBranestawmTab();
    });
}

// Open or focus Branestawm tab
async function openBranestawmTab() {
    try {
        // Check if Branestawm tab already exists
        if (branestawmTabId) {
            try {
                const existingTab = await chrome.tabs.get(branestawmTabId);
                // Tab exists, focus it
                await chrome.tabs.update(branestawmTabId, { active: true });
                await chrome.windows.update(existingTab.windowId, { focused: true });
                return;
            } catch (error) {
                // Tab doesn't exist anymore
                branestawmTabId = null;
            }
        }
        
        // Create new tab
        const tab = await chrome.tabs.create({
            url: chrome.runtime.getURL('index.html'),
            active: true
        });
        
        branestawmTabId = tab.id;
        
        // Start keep-alive mechanism
        startKeepAlive();
        
    } catch (error) {
        console.error('Error opening Branestawm tab:', error);
    }
}

// Track tab closure for auto-sync
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    if (tabId === branestawmTabId) {
        branestawmTabId = null;
        
        // Stop keep-alive
        stopKeepAlive();
        
        // Trigger auto-sync if enabled
        const { settings } = await chrome.storage.local.get(['settings']);
        if (settings && settings.autoSync && settings.syncId) {
            console.log('Branestawm tab closed, triggering auto-sync...');
            try {
                await performAutoSync();
            } catch (error) {
                console.error('Auto-sync failed:', error);
            }
        }
    }
});

// Auto-sync function
async function performAutoSync() {
    try {
        const data = await chrome.storage.local.get(['settings', 'projects', 'conversations', 'artifacts']);
        const { settings } = data;
        
        if (!settings.syncId || !settings.syncKey) {
            console.log('Auto-sync skipped: missing sync credentials');
            return;
        }
        
        // Prepare sync data (same structure as main app)
        const syncData = {
            projects: data.projects || {},
            conversations: data.conversations || {},
            artifacts: data.artifacts || {},
            settings: {
                ...settings,
                apiKey: '', // Never sync API keys
                googleToken: null, // Never sync tokens
                jsonbinApiKey: '' // Never sync JSONBin keys
            },
            timestamp: new Date().toISOString()
        };
        
        // Encrypt if sync key provided
        let dataToUpload = syncData;
        if (settings.syncKey) {
            dataToUpload = await encryptData(JSON.stringify(syncData), settings.syncKey);
        }
        
        // Upload to JSONBin
        const endpoint = settings.usePrivateBins 
            ? `https://api.jsonbin.io/v3/b/${settings.syncId}`
            : `https://api.jsonbin.io/v3/b/${settings.syncId}`;
            
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (settings.usePrivateBins && settings.jsonbinApiKey) {
            headers['X-Master-Key'] = settings.jsonbinApiKey;
        }
        
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({
                data: dataToUpload,
                encrypted: !!settings.syncKey,
                syncType: settings.usePrivateBins ? 'private' : 'public',
                appVersion: chrome.runtime.getManifest().version,
                autoSynced: true
            })
        });
        
        if (response.ok) {
            console.log('Auto-sync completed successfully');
            
            // Update last sync timestamp
            await chrome.storage.local.set({
                settings: {
                    ...settings,
                    lastAutoSync: new Date().toISOString()
                }
            });
        } else {
            console.error('Auto-sync failed:', response.status, response.statusText);
        }
        
    } catch (error) {
        console.error('Auto-sync error:', error);
    }
}

// Context menu setup function
function setupContextMenus() {
    if (!chrome.contextMenus) {
        console.log('Context menus API not available');
        return;
    }
    
    try {
        chrome.contextMenus.create({
            id: 'branestawm-help',
            title: 'Ask Branestawm about this',
            contexts: ['selection']
        });
        
        chrome.contextMenus.create({
            id: 'branestawm-plan',
            title: 'Help me plan this task',
            contexts: ['selection']
        });
        
        chrome.contextMenus.create({
            id: 'branestawm-break-down',
            title: 'Break this down into steps',
            contexts: ['selection']
        });
    } catch (error) {
        console.error('Error setting up context menus:', error);
    }
}

if (chrome.contextMenus) {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const selectedText = info.selectionText;
    let query = '';
    
    switch (info.menuItemId) {
        case 'branestawm-help':
            query = `Help me understand this: "${selectedText}"`;
            break;
        case 'branestawm-plan':
            query = `Help me create a plan for this task: "${selectedText}"`;
            break;
        case 'branestawm-break-down':
            query = `Break this down into clear, manageable steps: "${selectedText}"`;
            break;
    }
    
    if (query) {
        // Open Branestawm with the query
        await openBranestawmTab();
        
        // Store query for pickup by main tab
        await chrome.storage.local.set({ 
            pendingQuery: query,
            pendingQueryTimestamp: Date.now()
        });
    }
    });
}

// Keep service worker alive during active sessions
function startKeepAlive() {
    if (keepAliveInterval) return;
    
    keepAliveInterval = setInterval(() => {
        // Simple ping to keep service worker active
        chrome.runtime.getPlatformInfo().then(() => {
            console.log('Service worker keepalive ping');
        });
    }, 25000);
}

function stopKeepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
}

// Handle connections from main tab
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'branestawm-keepalive') {
        // Tab is requesting keepalive service
        startKeepAlive();
        
        port.onDisconnect.addListener(() => {
            stopKeepAlive();
        });
    }
});

// Handle messages from main tab
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.type === 'SYNC_REQUEST') {
        // Handle sync requests from main tab
        try {
            await performAutoSync();
            sendResponse({ success: true });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
        return true; // Will respond asynchronously
    }
    
    if (message.type === 'GET_TAB_ID') {
        sendResponse({ tabId: branestawmTabId });
    }
    
    if (message.type === 'WEB_SEARCH') {
        console.log('🔍 Background: Performing web search for:', message.query);
        try {
            const results = await performBackgroundWebSearch(message.query);
            console.log('✅ Background: Web search completed');
            sendResponse({ success: true, results });
        } catch (error) {
            console.error('❌ Background: Web search failed:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true; // Will respond asynchronously
    }
});

// Web search functions (run in background with full permissions)
async function performBackgroundWebSearch(query) {
    console.log(`🔍 Background: Starting web search for: "${query}"`);
    
    // Try multiple search methods in order of preference
    const searchMethods = [
        () => searchWithDuckDuckGo(query),
        () => searchWithWikipedia(query),
        () => searchWithSimpleSearch(query)
    ];
    
    for (let i = 0; i < searchMethods.length; i++) {
        try {
            const results = await searchMethods[i]();
            if (results) {
                console.log(`✅ Background: Web search successful using method ${i + 1}`);
                return results;
            }
        } catch (error) {
            console.warn(`⚠️ Background: Search method ${i + 1} failed:`, error.message);
        }
    }
    
    console.error('❌ Background: All web search methods failed');
    return `🌐 Web search attempted but all methods failed. The search functionality is experiencing technical difficulties.`;
}

async function searchWithDuckDuckGo(query) {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`DuckDuckGo API error: ${response.status}`);
    
    const data = await response.json();
    let results = '';
    
    if (data.Abstract && data.Abstract.trim()) {
        results += `📝 **Summary:** ${data.Abstract}\n\n`;
    }
    
    if (data.Definition && data.Definition.trim()) {
        results += `📖 **Definition:** ${data.Definition}\n\n`;
    }
    
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        results += '🔗 **Related Information:**\n';
        data.RelatedTopics.slice(0, 3).forEach((topic, index) => {
            if (topic.Text) {
                results += `${index + 1}. ${topic.Text}\n`;
            }
        });
        results += '\n';
    }
    
    return results || null;
}

async function searchWithWikipedia(query) {
    // Clean up the query for Wikipedia - extract key terms
    const cleanQuery = query.replace(/^(can you|who won|what is|when did)/i, '').trim();
    const searchTerms = cleanQuery.split(' ').filter(word => word.length > 2).slice(0, 3).join(' ');
    
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerms)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Wikipedia API error: ${response.status}`);
    
    const data = await response.json();
    
    if (data.extract && data.extract.trim()) {
        let results = `📚 **Wikipedia Summary for "${searchTerms}":**\n${data.extract}\n\n`;
        
        if (data.content_urls && data.content_urls.desktop) {
            results += `🔗 **Source:** ${data.content_urls.desktop.page}\n\n`;
        }
        
        return results;
    }
    
    return null;
}

async function searchWithSimpleSearch(query) {
    // Fallback method - just provide a helpful message
    return `🔍 **Search Notice:** I attempted to search for "${query}" but couldn't retrieve specific results. For the most current information about sports scores, news, or recent events, please check reputable news sources or official websites directly.`;
}

// Migration function for updates
async function migrateDataIfNeeded() {
    const { settings } = await chrome.storage.local.get(['settings']);
    
    if (!settings) {
        console.log('No settings found, skipping migration');
        return;
    }
    
    // Add any future migration logic here
    // For example, if we need to update data structure between versions
    
    console.log('Data migration completed');
}

// Basic encryption function for auto-sync (simplified version)
async function encryptData(data, password) {
    try {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            encoder.encode(password),
            { name: "PBKDF2" },
            false,
            ["deriveBits", "deriveKey"]
        );
        
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 100000,
                hash: "SHA-256",
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
        
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedData = encoder.encode(data);
        
        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encodedData
        );
        
        // Combine salt + iv + encrypted data and encode as base64
        const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(encrypted), salt.length + iv.length);
        
        return btoa(String.fromCharCode(...combined));
    } catch (error) {
        console.error('Encryption failed:', error);
        throw error;
    }
}

console.log('Branestawm service worker loaded');
console.log('Version:', chrome.runtime.getManifest().version);