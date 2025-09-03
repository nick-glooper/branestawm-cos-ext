// Phase 4 Demo - Essential User Experience Enhancements
// Demonstrates user name integration and seamless folio switching

window.Phase4Demo = {
    
    /**
     * Demo user name integration
     */
    async demoUserName() {
        console.log('🎯 Phase 4.1 Demo: User Name Integration');
        
        // Set a demo user name
        const testName = 'Alex';
        if (window.dataManager) {
            const settings = window.dataManager.getSettings();
            settings.userName = testName;
            await window.dataManager.saveData();
            console.log(`✅ User name set to: ${testName}`);
        }
        
        // Test that the name appears in LLM prompts
        const testMessage = "Hello, I need help with my project";
        const contextualPrompt = await buildContextualPrompt(testMessage, currentFolio);
        
        if (contextualPrompt.includes(testName)) {
            console.log(`✅ User name "${testName}" found in LLM prompt`);
            console.log('📝 Example prompt section:');
            const nameSection = contextualPrompt.split('\n').find(line => line.includes(testName));
            console.log(`   "${nameSection}"`);
        } else {
            console.log(`❌ User name "${testName}" not found in prompt`);
        }
        
        return { success: contextualPrompt.includes(testName), userName: testName };
    },
    
    /**
     * Demo folio switching patterns
     */
    async demoFolioSwitching() {
        console.log('🎯 Phase 4.2 Demo: Seamless Folio Switching');
        
        if (!window.folioSwitcher) {
            console.log('❌ FolioSwitcher not available');
            return { success: false };
        }
        
        // Test different switch trigger patterns
        const testPatterns = [
            'Can we switch to discussing my personal project?',
            'I want to talk about something different - my creative writing',
            'Let\'s move this conversation to work-related stuff',
            'This might be better discussed in a different context'
        ];
        
        let detectedPatterns = 0;
        
        for (const pattern of testPatterns) {
            const mockMessage = { id: 'test', content: pattern, role: 'user' };
            
            // Test pattern matching
            const patterns = window.folioSwitcher.switchTriggerPatterns;
            const matches = patterns.filter(p => p.pattern.test(pattern));
            
            if (matches.length > 0) {
                console.log(`✅ Pattern detected: "${pattern}"`);
                console.log(`   Matched: ${matches[0].type} (confidence: ${matches[0].confidence})`);
                detectedPatterns++;
            } else {
                console.log(`❌ No pattern match: "${pattern}"`);
            }
        }
        
        console.log(`📊 Pattern detection: ${detectedPatterns}/${testPatterns.length} patterns detected`);
        
        return { 
            success: detectedPatterns > 0, 
            patternsDetected: detectedPatterns,
            totalPatterns: testPatterns.length 
        };
    },
    
    /**
     * Demo folio suggestions
     */
    async demoFolioSuggestions() {
        console.log('🎯 Phase 4.2 Demo: Folio Suggestions');
        
        if (!window.folioSwitcher || !window.dataManager) {
            console.log('❌ Required components not available');
            return { success: false };
        }
        
        // Create test folios if they don't exist
        await this.createTestFolios();
        
        // Test suggestion generation
        const testContent = 'I want to work on my creative writing project';
        const suggestions = await window.folioSwitcher.generateSwitchSuggestions(testContent, 'topic_change');
        
        console.log(`📋 Generated ${suggestions.length} folio suggestions for: "${testContent}"`);
        suggestions.forEach((suggestion, index) => {
            console.log(`   ${index + 1}. ${suggestion.title} (score: ${suggestion.relevanceScore})`);
            console.log(`      Reason: ${suggestion.reason}`);
        });
        
        return { 
            success: suggestions.length > 0, 
            suggestionCount: suggestions.length,
            suggestions 
        };
    },
    
    /**
     * Create test folios for demonstration
     */
    async createTestFolios() {
        const testFolios = [
            { id: 'creative', title: 'Creative Projects', description: 'Writing, art, and creative endeavors' },
            { id: 'work', title: 'Work Tasks', description: 'Professional projects and tasks' },
            { id: 'learning', title: 'Learning & Research', description: 'Study materials and research' }
        ];
        
        if (window.dataManager) {
            const folios = window.dataManager.getFolios();
            
            for (const testFolio of testFolios) {
                if (!folios[testFolio.id]) {
                    folios[testFolio.id] = {
                        id: testFolio.id,
                        title: testFolio.title,
                        description: testFolio.description,
                        messages: [],
                        artifacts: [],
                        sharedArtifacts: [],
                        assignedPersona: 'core',
                        created: new Date().toISOString(),
                        lastUsed: new Date().toISOString()
                    };
                    console.log(`📁 Created test folio: ${testFolio.title}`);
                }
            }
            
            await window.dataManager.saveData();
        }
    },
    
    /**
     * Demo context carryover
     */
    async demoContextCarryover() {
        console.log('🎯 Phase 4.2 Demo: Context Carryover');
        
        if (!window.folioSwitcher) {
            console.log('❌ FolioSwitcher not available');
            return { success: false };
        }
        
        // Simulate context carryover planning
        const triggerContent = 'Let\'s discuss my creative writing in a different space';
        const plan = await window.folioSwitcher.planContextCarryover(
            'general', 
            'creative', 
            triggerContent
        );
        
        console.log('📋 Context carryover plan:');
        console.log(`   Include recent messages: ${plan.includeRecentMessages}`);
        console.log(`   Include summary: ${plan.includeSummary}`);
        if (plan.bridgeMessage) {
            console.log(`   Bridge message: "${plan.bridgeMessage.substring(0, 100)}..."`);
        }
        if (plan.contextExplanation) {
            console.log(`   Context explanation: "${plan.contextExplanation.substring(0, 100)}..."`);
        }
        
        return { 
            success: !!plan, 
            plan 
        };
    },
    
    /**
     * Run complete Phase 4 demonstration
     */
    async runCompleteDemo() {
        console.log('🚀 Running Complete Phase 4 Demo: Essential User Experience Enhancements');
        console.log('');
        
        const results = {
            userNameIntegration: await this.demoUserName(),
            folioSwitching: await this.demoFolioSwitching(),
            folioSuggestions: await this.demoFolioSuggestions(),
            contextCarryover: await this.demoContextCarryover()
        };
        
        console.log('');
        console.log('📊 Phase 4 Demo Results Summary:');
        console.log(`   ✅ User Name Integration: ${results.userNameIntegration.success ? 'PASS' : 'FAIL'}`);
        console.log(`   ✅ Folio Switching Detection: ${results.folioSwitching.success ? 'PASS' : 'FAIL'}`);
        console.log(`   ✅ Folio Suggestions: ${results.folioSuggestions.success ? 'PASS' : 'FAIL'}`);
        console.log(`   ✅ Context Carryover: ${results.contextCarryover.success ? 'PASS' : 'FAIL'}`);
        
        const successCount = Object.values(results).filter(r => r.success).length;
        const totalTests = Object.keys(results).length;
        
        console.log('');
        console.log(`🎯 Overall Success Rate: ${successCount}/${totalTests} (${Math.round(successCount/totalTests*100)}%)`);
        
        if (successCount === totalTests) {
            console.log('🎉 Phase 4 Implementation: COMPLETE! All essential features working perfectly.');
            console.log('');
            console.log('Phase 4 delivers:');
            console.log('• 👋 Personal conversations with user name integration');
            console.log('• 🔄 Seamless folio switching with intelligent suggestions');
            console.log('• 🧠 Context carryover for continuous conversation experience');
            console.log('• 🎯 Ultra-simple interface that hides complexity from users');
        } else {
            console.log('⚠️ Some Phase 4 features need attention. Check individual results above.');
        }
        
        return results;
    }
};

// Auto-run demo if in development mode
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Wait for all systems to load, then run demo
    setTimeout(() => {
        if (window.Phase4Demo) {
            console.log('🔧 Development mode detected - running Phase 4 demo in 5 seconds...');
            setTimeout(() => window.Phase4Demo.runCompleteDemo(), 5000);
        }
    }, 2000);
}