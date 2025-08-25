# Branestawm Extension - Complete Implementation Guide

## 🎯 Project Status: Ready for Implementation

All core code files have been created and are ready for deployment. This guide will walk you through the final setup steps.

## 📁 Complete File Structure

```
branestawm-extension/
├── manifest.json              ✅ Created - Extension configuration
├── main.html                  ✅ Created - Full-page tab interface
├── main.js                    ✅ Created - Core application logic
├── background.js              ✅ Created - Service worker
├── styles.css                 ✅ Created - Complete styling
├── options.html               ✅ Created - Settings page
├── options.js                 ✅ Created - Settings logic
├── icons/                     ⚠️  Need to create PNG files
│   ├── icon16.png            
│   ├── icon32.png            
│   ├── icon48.png            
│   └── icon128.png           
└── README.md                  📝 Implementation docs
```

## 🔑 Google OAuth Setup (Required)

Before the extension can use Google authentication, you need to set up OAuth credentials:

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Generative Language API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Generative Language API" 
   - Click "Enable"

### Step 2: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type
3. Fill in required fields:
   - **App name**: `Branestawm - AI Chief of Staff`
   - **User support email**: Your email
   - **App domain**: Leave blank for development
   - **Developer contact**: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/generative-language.retriever`
5. Add test users (your email for testing)

### Step 3: Create OAuth Client ID

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Chrome extension" as application type
4. Add your extension ID (you'll get this after first install)
5. Copy the Client ID

### Step 4: Update Manifest

Replace `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com` in `manifest.json` with your actual client ID.

## 🎨 Icon Generation

Create PNG icons from this SVG code:

```svg
<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4299e1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#3182ce;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Main brain shape -->
  <path d="M64 16c-26.5 0-48 21.5-48 48 0 8 2 15.5 5.5 22l-5 12c-1 2.5 0.5 5.5 3 6.5l12-5c6.5 3.5 14 5.5 22 5.5s15.5-2 22-5.5l12 5c2.5 1 5.5-0.5 6.5-3l-5-12c3.5-6.5 5.5-14 5.5-22 0-26.5-21.5-48-48-48z" 
        fill="url(#brainGrad)" stroke="#2d3748" stroke-width="2"/>
  
  <!-- Brain details -->
  <path d="M40 45c0-8 6-12 14-10s12 8 10 16-6 12-14 10-10-8-10-16z" fill="#e2e8f0" opacity="0.3"/>
  <path d="M74 45c0-8 6-12 14-10s12 8 10 16-6 12-14 10-10-8-10-16z" fill="#e2e8f0" opacity="0.3"/>
  
  <!-- Gear overlay -->
  <g transform="translate(64,80)">
    <circle r="12" fill="#48bb78" stroke="#2d3748" stroke-width="1.5"/>
    <circle r="6" fill="#2d3748"/>
    <path d="M0,-12l2,-6l-4,0z M12,0l6,-2l0,4z M0,12l-2,6l4,0z M-12,0l-6,2l0,-4z" fill="#48bb78"/>
  </g>
  
  <!-- Title text -->
  <text x="64" y="118" font-family="Arial, sans-serif" font-size="10" font-weight="bold" 
        text-anchor="middle" fill="#2d3748">Branestawm</text>
</svg>
```

### Icon Creation Options:

**Option A: Online Converter (Easiest)**
1. Copy SVG code above
2. Go to [SVG to PNG Converter](https://convertio.co/svg-png/)
3. Convert to PNG at sizes: 16x16, 32x32, 48x48, 128x128
4. Save as `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`

**Option B: Design Tool**
1. Paste SVG into Figma/Sketch/Canva
2. Export as PNG at required sizes

**Option C: Command Line (if you have ImageMagick)**
```bash
# Save SVG code as icon.svg, then:
convert icon.svg -resize 16x16 icons/icon16.png
convert icon.svg -resize 32x32 icons/icon32.png
convert icon.svg -resize 48x48 icons/icon48.png
convert icon.svg -resize 128x128 icons/icon128.png
```

## 🧪 Testing Procedure

### 1. Load Extension for Development

**Chrome/Edge:**
1. Open `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select your extension folder
5. Note the Extension ID for OAuth setup

**Firefox:**
1. Open `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select `manifest.json`

### 2. Configure OAuth (Chrome Only)

1. Get Extension ID from `chrome://extensions/`
2. Add Extension ID to Google Cloud OAuth settings:
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Edit your OAuth client
   - Add extension ID to authorized extensions
3. Update `manifest.json` with your OAuth client ID

### 3. Test Authentication Methods

**Test Google OAuth:**
1. Click extension icon
2. Choose "Easy Setup"
3. Click "Sign in with Google"
4. Should redirect to Google auth
5. Verify connection works

**Test API Key Setup:**
1. Go to Settings
2. Choose "API Key" method
3. Configure with Cerebras (free) or OpenAI
4. Test connection

### 4. Test Core Functionality

- ✅ Send basic chat message
- ✅ Test web search with "search: weather today"
- ✅ Create and edit notes
- ✅ Test cloud sync (upload/download)
- ✅ Export conversations as markdown
- ✅ Context menu integration (right-click selected text)

## 🚀 Deployment Options

### Chrome Web Store

1. **Package Extension:**
   ```bash
   zip -r branestawm-extension.zip * -x "*.DS_Store" "*.git*"
   ```

2. **Developer Dashboard:**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
   - Pay $5 one-time developer fee
   - Upload ZIP file
   - Complete store listing
   - Submit for review (5-7 days)

### Firefox Add-ons

1. **Update Manifest for Firefox:**
   ```json
   // Add to manifest.json for Firefox compatibility
   "browser_specific_settings": {
     "gecko": {
       "id": "branestawm@yourname.com",
       "strict_min_version": "109.0"
     }
   }
   ```

2. **Submit to Firefox:**
   - Go to [Firefox Add-on Developer Hub](https://addons.mozilla.org/developers/)
   - Upload ZIP package
   - Complete listing
   - Submit for review

### Self-Distribution

For internal use or beta testing:
1. Package as ZIP file
2. Users load via "Load unpacked" (Chrome) or "Load Temporary Add-on" (Firefox)
3. Share installation instructions

## 🔧 Configuration Examples

### Cerebras Setup (Recommended Free Option)
```
Endpoint: https://api.cerebras.ai/v1/chat/completions
Model: llama3.1-8b
API Key: [Get from cloud.cerebras.ai]
```

### OpenAI Setup
```
Endpoint: https://api.openai.com/v1/chat/completions  
Model: gpt-3.5-turbo
API Key: sk-[Your OpenAI key]
```

### OpenRouter Setup
```
Endpoint: https://openrouter.ai/api/v1/chat/completions
Model: deepseek/deepseek-chat
API Key: sk-or-[Your OpenRouter key]
```

## 🐛 Common Issues & Solutions

### "Invalid OAuth Client" Error
- **Cause:** Extension ID not added to Google OAuth settings
- **Solution:** Add extension ID to authorized extensions in Google Cloud Console

### "API Key Invalid" Error  
- **Cause:** Wrong API key or endpoint mismatch
- **Solution:** Verify key is correct and matches selected provider

### Extension Won't Load
- **Cause:** Missing files or syntax errors
- **Solution:** Check browser console for errors, ensure all files present

### Google Auth Not Working
- **Cause:** OAuth consent screen not configured
- **Solution:** Complete OAuth consent screen setup in Google Cloud Console

### Context Menu Not Appearing
- **Cause:** Missing permissions
- **Solution:** Ensure `contextMenus` permission in manifest (included)

## 📊 Success Metrics

After successful deployment:
- ✅ Extension loads without errors
- ✅ Both auth methods work (Google + API Key)
- ✅ Chat functionality working with chosen LLM
- ✅ Web search integration functional  
- ✅ Notes can be created and edited
- ✅ Cloud sync working (optional)
- ✅ Export functionality works
- ✅ Context menu integration active

## 🎯 Next Steps

1. **Generate Icons** - Create PNG files from SVG code
2. **Setup Google OAuth** - Create OAuth credentials  
3. **Load Extension** - Install in developer mode for testing
4. **Test All Features** - Verify complete functionality
5. **Package for Distribution** - Create store-ready package
6. **Submit to Stores** - Deploy to Chrome/Firefox stores

## 🎉 Launch Checklist

- [ ] All code files created and tested
- [ ] Icons generated (16, 32, 48, 128px)
- [ ] Google OAuth configured
- [ ] Extension tested in Chrome/Firefox
- [ ] All authentication methods working
- [ ] Core chat functionality verified
- [ ] Web search integration tested
- [ ] Export functionality confirmed
- [ ] Store listing materials prepared
- [ ] Privacy policy created (if required)
- [ ] Extension packaged for distribution

Your Branestawm extension is now ready for implementation! 🧠⚙️