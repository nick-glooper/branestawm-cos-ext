// Branestawm Linter
// Simple linting for code quality and best practices

const fs = require('fs');
const path = require('path');

class BranestawmLinter {
    constructor() {
        this.rules = {
            // Security rules
            noConsoleLog: {
                pattern: /console\.log\s*\(/g,
                severity: 'warn',
                message: 'Use logger instead of console.log for production code'
            },
            noInnerHTMLWithoutEscape: {
                pattern: /\.innerHTML\s*=\s*[`"'].*\$\{(?!SecurityUtils\.escapeHtml)/g,
                severity: 'error',
                message: 'Use SecurityUtils.escapeHtml() when setting innerHTML with dynamic content'
            },
            noEval: {
                pattern: /\beval\s*\(/g,
                severity: 'error',
                message: 'eval() is dangerous and should be avoided'
            },
            
            // Performance rules
            noSyncFileSystem: {
                pattern: /fs\.(readFileSync|writeFileSync)\s*\(/g,
                severity: 'warn',
                message: 'Use async file operations for better performance'
            },
            
            // Code quality rules
            noUnusedVariables: {
                pattern: /(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=.*?\n(?![\s\S]*\b\1\b)/g,
                severity: 'info',
                message: 'Unused variable detected'
            },
            noHardcodedValues: {
                pattern: /(apiKey|password|secret|token)\s*[:=]\s*['"`][a-zA-Z0-9+/=]{10,}['"`]/gi,
                severity: 'error',
                message: 'Hardcoded sensitive values detected'
            },
            
            // Extension-specific rules
            noDirectChromeCalls: {
                pattern: /chrome\.(?!runtime\.getURL|runtime\.getManifest)[a-zA-Z]+\./g,
                severity: 'warn',
                message: 'Wrap Chrome API calls with error handling'
            },
            
            // Style rules
            noTrailingWhitespace: {
                pattern: /[ \t]+$/gm,
                severity: 'info',
                message: 'Trailing whitespace detected'
            },
            noMixedTabs: {
                pattern: /^(\t+ +| +\t)/gm,
                severity: 'warn',
                message: 'Mixed tabs and spaces for indentation'
            }
        };
        
        this.results = [];
        this.stats = {
            files: 0,
            errors: 0,
            warnings: 0,
            info: 0
        };
    }
    
    /**
     * Lint all JavaScript files
     */
    async lintAll() {
        console.log('🔍 Running Branestawm linter...\n');
        
        const jsFiles = this.getJavaScriptFiles();
        
        for (const file of jsFiles) {
            await this.lintFile(file);
        }
        
        this.printResults();
        return this.stats.errors === 0;
    }
    
    /**
     * Get all JavaScript files to lint
     */
    getJavaScriptFiles() {
        const files = [];
        const sourceDir = __dirname;
        
        const jsFiles = [
            'security-utils.js',
            'logger.js',
            'performance-tracker.js',
            'task-extractor.js',
            'task-templates.js',
            'task-storage.js',
            'task-scheduler.js',
            'task-renderer.js',
            'task-manager.js',
            'api.js',
            'storage.js',
            'ui.js',
            'folios.js',
            'chat.js',
            'main.js',
            'options.js',
            'background.js',
            'content-google.js',
            'content-perplexity.js'
        ];
        
        jsFiles.forEach(file => {
            const filePath = path.join(sourceDir, file);
            if (fs.existsSync(filePath)) {
                files.push(filePath);
            }
        });
        
        return files;
    }
    
    /**
     * Lint a single file
     */
    async lintFile(filePath) {
        const fileName = path.basename(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        console.log(`📄 Linting ${fileName}...`);
        
        let fileIssues = 0;
        
        // Apply each rule
        Object.entries(this.rules).forEach(([ruleName, rule]) => {
            const matches = [...content.matchAll(rule.pattern)];
            
            matches.forEach(match => {
                const lineNumber = this.getLineNumber(content, match.index);
                const column = this.getColumnNumber(content, match.index);
                
                const issue = {
                    file: fileName,
                    rule: ruleName,
                    severity: rule.severity,
                    message: rule.message,
                    line: lineNumber,
                    column: column,
                    text: lines[lineNumber - 1]?.trim() || ''
                };
                
                this.results.push(issue);
                fileIssues++;
                
                // Update stats
                this.stats[rule.severity]++;
            });
        });
        
        this.stats.files++;
        
        if (fileIssues === 0) {
            console.log(`  ✅ No issues found\n`);
        } else {
            console.log(`  ⚠️  Found ${fileIssues} issue(s)\n`);
        }
    }
    
    /**
     * Get line number from character index
     */
    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }
    
    /**
     * Get column number from character index
     */
    getColumnNumber(content, index) {
        const lines = content.substring(0, index).split('\n');
        return lines[lines.length - 1].length + 1;
    }
    
    /**
     * Print linting results
     */
    printResults() {
        console.log('📊 Linting Results:\n');
        
        if (this.results.length === 0) {
            console.log('✅ No issues found! Code looks great.\n');
            return;
        }
        
        // Group by severity
        const grouped = this.results.reduce((acc, result) => {
            if (!acc[result.severity]) acc[result.severity] = [];
            acc[result.severity].push(result);
            return acc;
        }, {});
        
        // Print errors first
        if (grouped.error) {
            console.log('❌ ERRORS:');
            grouped.error.forEach(issue => {
                console.log(`   ${issue.file}:${issue.line}:${issue.column} - ${issue.message}`);
                console.log(`      ${issue.text}\n`);
            });
        }
        
        // Then warnings
        if (grouped.warn) {
            console.log('⚠️  WARNINGS:');
            grouped.warn.forEach(issue => {
                console.log(`   ${issue.file}:${issue.line}:${issue.column} - ${issue.message}`);
                console.log(`      ${issue.text}\n`);
            });
        }
        
        // Finally info
        if (grouped.info) {
            console.log('ℹ️  INFO:');
            grouped.info.forEach(issue => {
                console.log(`   ${issue.file}:${issue.line}:${issue.column} - ${issue.message}`);
            });
            console.log('');
        }
        
        // Summary
        console.log('📈 Summary:');
        console.log(`   Files checked: ${this.stats.files}`);
        console.log(`   Errors: ${this.stats.errors}`);
        console.log(`   Warnings: ${this.stats.warnings}`);
        console.log(`   Info: ${this.stats.info}`);
        console.log(`   Total issues: ${this.results.length}\n`);
        
        if (this.stats.errors > 0) {
            console.log('❌ Linting failed - please fix errors before proceeding\n');
            process.exit(1);
        } else if (this.stats.warnings > 0) {
            console.log('⚠️  Linting completed with warnings\n');
        } else {
            console.log('✅ Linting passed!\n');
        }
    }
    
    /**
     * Fix automatically fixable issues
     */
    async autoFix() {
        console.log('🔧 Auto-fixing issues...\n');
        
        const fixableRules = ['noTrailingWhitespace', 'noMixedTabs'];
        const filesToFix = new Map();
        
        // Group fixable issues by file
        this.results.forEach(issue => {
            if (fixableRules.includes(issue.rule)) {
                if (!filesToFix.has(issue.file)) {
                    filesToFix.set(issue.file, []);
                }
                filesToFix.get(issue.file).push(issue);
            }
        });
        
        // Apply fixes
        for (const [fileName, issues] of filesToFix) {
            const filePath = path.join(__dirname, fileName);
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Fix trailing whitespace
            content = content.replace(/[ \t]+$/gm, '');
            
            // Fix mixed tabs (convert to spaces)
            content = content.replace(/\t/g, '    ');
            
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Fixed ${issues.length} issue(s) in ${fileName}`);
        }
        
        if (filesToFix.size === 0) {
            console.log('ℹ️  No auto-fixable issues found');
        }
    }
}

// CLI interface
if (require.main === module) {
    const linter = new BranestawmLinter();
    
    if (process.argv.includes('--fix')) {
        linter.lintAll().then(() => linter.autoFix());
    } else {
        linter.lintAll();
    }
}

module.exports = BranestawmLinter;