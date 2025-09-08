// Branestawm Build System
// Simple build process for Chrome extension - minification and bundling

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BuildSystem {
    constructor() {
        this.sourceDir = __dirname;
        this.buildDir = path.join(__dirname, 'build');
        this.distDir = path.join(__dirname, 'dist');
        
        // Files to process
        this.jsFiles = [
            'security-utils.js',
            'logger.js',
            'performance-tracker.js',
            'analytics-tracker.js',
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
            'ollama-client.js',
            'llm-router.js',
            'model-manager.js',
            'main.js',
            'options.js',
            'background.js',
            'content-google.js',
            'content-perplexity.js'
        ];
        
        this.cssFiles = [
            'tokens.css',
            'layout.css',
            'components.css',
            'chat.css',
            'themes.css'
        ];
        
        this.htmlFiles = [
            'index.html',
            'options.html'
        ];
        
        // Files to copy as-is
        this.staticFiles = [
            'manifest.json',
            'icons/'
        ];
    }
    
    /**
     * Main build process
     */
    async build() {
        console.log('🚀 Starting Branestawm build process...');
        
        try {
            // Clean and create directories
            this.cleanDirs();
            this.createDirs();
            
            // Process files
            await this.processJavaScript();
            await this.processCSS();
            await this.processHTML();
            await this.copyStaticFiles();
            
            // Generate source maps in development
            if (process.env.NODE_ENV !== 'production') {
                await this.generateSourceMaps();
            }
            
            // Create distribution package
            await this.createDistribution();
            
            console.log('✅ Build completed successfully!');
            this.printBuildStats();
            
        } catch (error) {
            console.error('❌ Build failed:', error.message);
            process.exit(1);
        }
    }
    
    /**
     * Clean build directories
     */
    cleanDirs() {
        console.log('🧹 Cleaning build directories...');
        
        if (fs.existsSync(this.buildDir)) {
            fs.rmSync(this.buildDir, { recursive: true, force: true });
        }
        
        if (fs.existsSync(this.distDir)) {
            fs.rmSync(this.distDir, { recursive: true, force: true });
        }
    }
    
    /**
     * Create necessary directories
     */
    createDirs() {
        fs.mkdirSync(this.buildDir, { recursive: true });
        fs.mkdirSync(this.distDir, { recursive: true });
        fs.mkdirSync(path.join(this.buildDir, 'icons'), { recursive: true });
    }
    
    /**
     * Process and minify JavaScript files
     */
    async processJavaScript() {
        console.log('📦 Processing JavaScript files...');
        
        for (const file of this.jsFiles) {
            const sourcePath = path.join(this.sourceDir, file);
            const buildPath = path.join(this.buildDir, file);
            
            if (fs.existsSync(sourcePath)) {
                let content = fs.readFileSync(sourcePath, 'utf8');
                
                // Basic minification (remove comments and extra whitespace)
                content = this.minifyJS(content);
                
                fs.writeFileSync(buildPath, content, 'utf8');
                console.log(`  ✓ Processed ${file}`);
            } else {
                console.log(`  ⚠ Skipped ${file} (not found)`);
            }
        }
    }
    
    /**
     * Process and minify CSS files
     */
    async processCSS() {
        console.log('🎨 Processing CSS files...');
        
        for (const file of this.cssFiles) {
            const sourcePath = path.join(this.sourceDir, file);
            const buildPath = path.join(this.buildDir, file);
            
            if (fs.existsSync(sourcePath)) {
                let content = fs.readFileSync(sourcePath, 'utf8');
                
                // Basic CSS minification
                content = this.minifyCSS(content);
                
                fs.writeFileSync(buildPath, content, 'utf8');
                console.log(`  ✓ Processed ${file}`);
            } else {
                console.log(`  ⚠ Skipped ${file} (not found)`);
            }
        }
    }
    
    /**
     * Process HTML files
     */
    async processHTML() {
        console.log('🌐 Processing HTML files...');
        
        for (const file of this.htmlFiles) {
            const sourcePath = path.join(this.sourceDir, file);
            const buildPath = path.join(this.buildDir, file);
            
            if (fs.existsSync(sourcePath)) {
                let content = fs.readFileSync(sourcePath, 'utf8');
                
                // Basic HTML minification
                content = this.minifyHTML(content);
                
                fs.writeFileSync(buildPath, content, 'utf8');
                console.log(`  ✓ Processed ${file}`);
            }
        }
    }
    
    /**
     * Copy static files
     */
    async copyStaticFiles() {
        console.log('📁 Copying static files...');
        
        for (const file of this.staticFiles) {
            const sourcePath = path.join(this.sourceDir, file);
            const buildPath = path.join(this.buildDir, file);
            
            if (fs.existsSync(sourcePath)) {
                if (fs.statSync(sourcePath).isDirectory()) {
                    fs.cpSync(sourcePath, buildPath, { recursive: true });
                    console.log(`  ✓ Copied directory ${file}`);
                } else {
                    fs.copyFileSync(sourcePath, buildPath);
                    console.log(`  ✓ Copied ${file}`);
                }
            }
        }
    }
    
    /**
     * Basic JavaScript minification
     */
    minifyJS(content) {
        return content
            // Remove single line comments
            .replace(/\/\/.*$/gm, '')
            // Remove multi-line comments (but preserve JSDoc for important ones)
            .replace(/\/\*(?!\*)[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '')
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            // Remove whitespace around operators
            .replace(/\s*([{}();,:])\s*/g, '$1')
            // Remove leading/trailing whitespace
            .trim();
    }
    
    /**
     * Basic CSS minification
     */
    minifyCSS(content) {
        return content
            // Remove comments
            .replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '')
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            // Remove whitespace around CSS syntax
            .replace(/\s*([{}:;,>+~])\s*/g, '$1')
            // Remove leading/trailing whitespace
            .trim();
    }
    
    /**
     * Basic HTML minification
     */
    minifyHTML(content) {
        return content
            // Remove HTML comments (except IE conditionals)
            .replace(/<!--(?!\[if)[^>]*-->/g, '')
            // Remove extra whitespace between tags
            .replace(/>\s+</g, '><')
            // Remove leading/trailing whitespace
            .trim();
    }
    
    /**
     * Generate source maps for development
     */
    async generateSourceMaps() {
        console.log('🗺️ Generating source maps...');
        
        // Simple source map generation for development
        for (const file of this.jsFiles) {
            const sourcePath = path.join(this.sourceDir, file);
            const mapPath = path.join(this.buildDir, file + '.map');
            
            if (fs.existsSync(sourcePath)) {
                const sourceMap = {
                    version: 3,
                    file: file,
                    sourceRoot: '../',
                    sources: [file],
                    names: [],
                    mappings: '' // Simple mapping would go here
                };
                
                fs.writeFileSync(mapPath, JSON.stringify(sourceMap, null, 2));
            }
        }
    }
    
    /**
     * Create distribution package
     */
    async createDistribution() {
        console.log('📦 Creating distribution package...');
        
        // Copy build to dist
        fs.cpSync(this.buildDir, this.distDir, { recursive: true });
        
        // Create ZIP for Chrome Web Store
        const zipPath = path.join(this.distDir, 'branestawm-extension.zip');
        
        try {
            // Use system zip if available
            execSync(`cd "${this.buildDir}" && zip -r "${zipPath}" .`, { stdio: 'pipe' });
            console.log(`  ✓ Created ${zipPath}`);
        } catch (error) {
            console.log('  ⚠ Could not create ZIP (zip command not found)');
        }
    }
    
    /**
     * Print build statistics
     */
    printBuildStats() {
        const buildSize = this.getDirSize(this.buildDir);
        const sourceSize = this.getSourceSize();
        const reduction = ((sourceSize - buildSize) / sourceSize * 100).toFixed(1);
        
        console.log('\n📊 Build Statistics:');
        console.log(`   Source size: ${this.formatBytes(sourceSize)}`);
        console.log(`   Build size:  ${this.formatBytes(buildSize)}`);
        console.log(`   Reduction:   ${reduction}%`);
        console.log(`   Build dir:   ${this.buildDir}`);
        console.log(`   Dist dir:    ${this.distDir}`);
    }
    
    /**
     * Get directory size recursively
     */
    getDirSize(dirPath) {
        let size = 0;
        
        if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath);
            
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);
                
                if (stats.isDirectory()) {
                    size += this.getDirSize(filePath);
                } else {
                    size += stats.size;
                }
            }
        }
        
        return size;
    }
    
    /**
     * Get source files size
     */
    getSourceSize() {
        let size = 0;
        
        // Calculate size of all source files
        const allFiles = [...this.jsFiles, ...this.cssFiles, ...this.htmlFiles, ...this.staticFiles];
        
        for (const file of allFiles) {
            const filePath = path.join(this.sourceDir, file);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    size += this.getDirSize(filePath);
                } else {
                    size += stats.size;
                }
            }
        }
        
        return size;
    }
    
    /**
     * Format bytes to human readable string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// CLI interface
if (require.main === module) {
    const build = new BuildSystem();
    build.build().catch(console.error);
}

module.exports = BuildSystem;