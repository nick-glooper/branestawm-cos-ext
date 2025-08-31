// Branestawm - Storage and Data Management Module
// Handles data persistence, import/export functionality

// ========== DATA PERSISTENCE ==========

async function loadData() {
    try {
        const data = await chrome.storage.local.get(['settings', 'folios', 'conversations', 'artifacts', 'currentFolio', 'recentFolios', 'recentConversations', 'artifactTemplates']);
        
        if (data.settings) {
            settings = { ...settings, ...data.settings };
            // Ensure personas exist in settings
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
        }
        
        if (data.folios) {
            folios = data.folios;
        }
        
        if (data.conversations) {
            conversations = data.conversations;
        }
        
        if (data.artifacts) {
            artifacts = data.artifacts;
        }
        
        if (data.currentFolio) {
            currentFolio = data.currentFolio;
        }
        
        if (data.recentFolios) {
            recentFolios = data.recentFolios;
        }
        
        if (data.recentConversations) {
            recentConversations = data.recentConversations;
        }
        
        // Ensure artifact templates exist
        if (data.artifactTemplates) {
            artifactTemplates = { ...artifactTemplates, ...data.artifactTemplates };
        }
        
        // Migrate shared artifacts for existing folios
        migrateSharedArtifacts();
        
        // Migrate persona names to remove "Persona" suffix
        migratePersonaNames();
        
        console.log('Data loaded successfully');
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function saveData() {
    try {
        await chrome.storage.local.set({
            settings: settings,
            folios: folios,
            conversations: conversations,
            artifacts: artifacts,
            artifactTemplates: artifactTemplates,
            currentFolio: currentFolio,
            recentFolios: recentFolios,
            recentConversations: recentConversations
        });
        
        console.log('Data saved successfully');
        
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// ========== EXPORT FUNCTIONALITY ==========

async function exportFolioAsMarkdown(folioId) {
    const folio = folios[folioId];
    if (!folio) {
        showMessage('Folio not found', 'error');
        return;
    }
    
    let markdown = `# ${folio.title}\n\n`;
    if (folio.description) {
        markdown += `**Description:** ${folio.description}\n`;
    }
    const persona = settings.personas[folio.assignedPersona];
    if (persona) {
        markdown += `**Persona:** ${persona.name}\n`;
    }
    markdown += `**Created:** ${new Date(folio.createdAt).toLocaleString()}\n`;
    if (folio.lastUsed) {
        markdown += `**Last Used:** ${new Date(folio.lastUsed).toLocaleString()}\n`;
    }
    markdown += `\n---\n\n`;
    
    folio.messages.forEach(message => {
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
    a.download = `branestawm-${folio.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
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
    
    // Export all folios and their conversations
    for (const [folioId, folio] of Object.entries(folios)) {
        allMarkdown += `# Folio: ${folio.title}\n\n`;
        if (folio.description) {
            allMarkdown += `**Description:** ${folio.description}\n\n`;
        }
        if (folio.guidelines) {
            allMarkdown += `**Guidelines:** ${folio.guidelines}\n\n`;
        }
        const persona = settings.personas[folio.assignedPersona];
        if (persona) {
            allMarkdown += `**Persona:** ${persona.name}\n\n`;
        }
        allMarkdown += `**Created:** ${new Date(folio.createdAt || Date.now()).toLocaleString()}\n\n`;
        
        // Export conversations in this folio
        const folioConversations = folio.conversations || [];
        if (folioConversations.length > 0) {
            allMarkdown += `## Conversations\n\n`;
            
            for (const convId of folioConversations) {
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
        
        // Export documents/artifacts in this folio
        const folioArtifacts = folio.artifacts || [];
        const folioSharedArtifacts = folio.sharedArtifacts || [];
        const allFolioArtifacts = [...new Set([...folioArtifacts, ...folioSharedArtifacts])];
        
        if (allFolioArtifacts.length > 0) {
            allMarkdown += `## Documents\n\n`;
            
            // Group by type
            const artifactsByType = {};
            allFolioArtifacts.forEach(artifactId => {
                const artifact = artifacts[artifactId];
                if (!artifact) return;
                
                const type = artifact.type || 'note';
                if (!artifactsByType[type]) artifactsByType[type] = [];
                artifactsByType[type].push(artifact);
            });
            
            // Export by type
            Object.keys(artifactsByType).forEach(type => {
                const template = artifactTemplates?.[type] || { name: 'Document', icon: '📄' };
                allMarkdown += `### ${template.icon} ${template.name}s\n\n`;
                
                artifactsByType[type].forEach(artifact => {
                    allMarkdown += `#### ${artifact.title}\n\n`;
                    allMarkdown += `**Type:** ${template.name}\n`;
                    allMarkdown += `**Created:** ${new Date(artifact.createdAt || Date.now()).toLocaleString()}\n`;
                    if (artifact.updatedAt) {
                        allMarkdown += `**Updated:** ${new Date(artifact.updatedAt).toLocaleString()}\n`;
                    }
                    if (artifact.shared) {
                        allMarkdown += `**Status:** Shared across all folios\n`;
                    }
                    if (artifact.generated) {
                        allMarkdown += `**Source:** AI Generated\n`;
                    }
                    if (artifact.folioId !== folioId) {
                        const sourceFolio = folios[artifact.folioId];
                        allMarkdown += `**Origin:** ${sourceFolio?.title || 'Unknown Folio'}\n`;
                    }
                    allMarkdown += `\n${artifact.content}\n\n`;
                    allMarkdown += `---\n\n`;
                });
            });
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

// ========== DATA MIGRATION ==========

function migrateSharedArtifacts() {
    // Ensure all folios have sharedArtifacts array
    Object.keys(folios).forEach(folioId => {
        if (!folios[folioId].sharedArtifacts) {
            folios[folioId].sharedArtifacts = [];
        }
    });
    
    // Find all shared artifacts and ensure they're in all folios' shared lists
    Object.values(artifacts).forEach(artifact => {
        if (artifact.shared) {
            Object.keys(folios).forEach(folioId => {
                if (!folios[folioId].sharedArtifacts.includes(artifact.id)) {
                    folios[folioId].sharedArtifacts.push(artifact.id);
                }
            });
        }
    });
    
    console.log('Shared artifacts migration completed');
}

// Migrate persona names to remove "Persona" suffix for cleaner display
function migratePersonaNames() {
    if (!settings.personas) return;
    
    let migrated = false;
    Object.values(settings.personas).forEach(persona => {
        if (persona.name && persona.name.endsWith(' Persona')) {
            const newName = persona.name.replace(/ Persona$/, '');
            console.log(`📝 Migrating persona name: "${persona.name}" → "${newName}"`);
            persona.name = newName;
            migrated = true;
        }
    });
    
    if (migrated) {
        saveData();
        console.log('📝 Persona names migration completed');
    }
}