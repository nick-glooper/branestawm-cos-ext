// Branestawm - Storage and Data Management Module
// Handles data persistence, import/export functionality

// ========== DATA PERSISTENCE ==========

async function loadData() {
    try {
        const data = await chrome.storage.local.get(['settings', 'projects', 'conversations', 'artifacts', 'currentProject', 'recentProjects', 'recentConversations']);
        
        if (data.settings) {
            settings = { ...settings, ...data.settings };
        }
        
        if (data.projects) {
            projects = data.projects;
        }
        
        if (data.conversations) {
            conversations = data.conversations;
        }
        
        if (data.artifacts) {
            artifacts = data.artifacts;
        }
        
        if (data.currentProject) {
            currentProject = data.currentProject;
        }
        
        if (data.recentProjects) {
            recentProjects = data.recentProjects;
        }
        
        if (data.recentConversations) {
            recentConversations = data.recentConversations;
        }
        
        console.log('Data loaded successfully');
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function saveData() {
    try {
        await chrome.storage.local.set({
            settings: settings,
            projects: projects,
            conversations: conversations,
            artifacts: artifacts,
            currentProject: currentProject,
            recentProjects: recentProjects,
            recentConversations: recentConversations
        });
        
        console.log('Data saved successfully');
        
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// ========== EXPORT FUNCTIONALITY ==========

async function exportConversationAsMarkdown(conversationId) {
    const conversation = conversations[conversationId];
    if (!conversation) {
        showMessage('Conversation not found', 'error');
        return;
    }
    
    let markdown = `# ${conversation.title}\n\n`;
    markdown += `**Project:** ${projects[conversation.projectId]?.name || 'Unknown'}\n`;
    markdown += `**Created:** ${new Date(conversation.createdAt).toLocaleString()}\n`;
    if (conversation.updatedAt) {
        markdown += `**Last Updated:** ${new Date(conversation.updatedAt).toLocaleString()}\n`;
    }
    markdown += `\n---\n\n`;
    
    conversation.messages.forEach(message => {
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
    a.download = `branestawm-${conversation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
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
    
    // Export all projects and their conversations
    for (const [projectId, project] of Object.entries(projects)) {
        allMarkdown += `# Project: ${project.name}\n\n`;
        if (project.description) {
            allMarkdown += `**Description:** ${project.description}\n\n`;
        }
        allMarkdown += `**Created:** ${new Date(project.createdAt || Date.now()).toLocaleString()}\n\n`;
        
        // Export conversations in this project
        const projectConversations = project.conversations || [];
        if (projectConversations.length > 0) {
            allMarkdown += `## Conversations\n\n`;
            
            for (const convId of projectConversations) {
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
        
        // Export notes/artifacts in this project
        const projectArtifacts = project.artifacts || [];
        if (projectArtifacts.length > 0) {
            allMarkdown += `## Notes\n\n`;
            
            for (const artifactId of projectArtifacts) {
                const artifact = artifacts[artifactId];
                if (!artifact) continue;
                
                allMarkdown += `### ${artifact.name}\n\n`;
                allMarkdown += `**Created:** ${new Date(artifact.createdAt || Date.now()).toLocaleString()}\n\n`;
                allMarkdown += `${artifact.content}\n\n`;
                allMarkdown += `---\n\n`;
            }
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