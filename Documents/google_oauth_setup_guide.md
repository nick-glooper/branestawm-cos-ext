# 🔑 Google OAuth Setup - Step by Step Instructions

## **Overview**
This will enable users to authenticate with Google and use Gemini 1.5 Flash for free (1,500 requests/day) without needing their own API key.

---

## **Step 1: Create Google Cloud Project** 
*Estimated time: 3-5 minutes*

### 1.1 Go to Google Cloud Console
- Open [Google Cloud Console](https://console.cloud.google.com/) in your browser
- Sign in with your Google account

### 1.2 Create New Project
- Click the **project selector** dropdown (top left, next to "Google Cloud")
- Click **"NEW PROJECT"**
- Fill in project details:
  - **Project name**: `Branestawm Extension`
  - **Organization**: Leave as default (or select if you have one)
  - **Location**: Leave as default
- Click **"CREATE"**
- Wait for project creation (30-60 seconds)

### 1.3 Select Your Project
- Make sure your new project is selected in the project selector dropdown
- You should see "Branestawm Extension" in the top bar

---

## **Step 2: Enable Required APIs**
*Estimated time: 2-3 minutes*

### 2.1 Navigate to API Library
- In the left sidebar, click **"APIs & Services"** → **"Library"**
- Or use the search box and type "API Library"

### 2.2 Enable Generative Language API
- In the API Library search box, type: **"Generative Language API"**
- Click on **"Generative Language API"** from the results
- Click the blue **"ENABLE"** button
- Wait for enablement (30-60 seconds)

**✅ Confirmation:** You should see "API enabled" and be redirected to the API overview page.

---

## **Step 3: Configure OAuth Consent Screen**
*Estimated time: 5-7 minutes*

### 3.1 Navigate to OAuth Consent
- Go to **"APIs & Services"** → **"OAuth consent screen"**

### 3.2 Choose User Type
- Select **"External"** (allows anyone with a Google account)
- Click **"CREATE"**

### 3.3 Fill App Information
**OAuth consent screen (Page 1):**
- **App name**: `Branestawm - AI Chief of Staff`
- **User support email**: Your email address
- **App logo**: Skip for now (optional)
- **App domain** section:
  - **Application home page**: Leave blank
  - **Application privacy policy link**: Leave blank  
  - **Application terms of service link**: Leave blank
- **Authorized domains**: Leave empty
- **Developer contact information**: Your email address

Click **"SAVE AND CONTINUE"**

### 3.4 Configure Scopes (Page 2)
- Click **"ADD OR REMOVE SCOPES"**
- In the filter box, search for: `generative-language.retriever`
- Check the box next to: `https://www.googleapis.com/auth/generative-language.retriever`
- Click **"UPDATE"**
- Click **"SAVE AND CONTINUE"**

### 3.5 Add Test Users (Page 3)
- Click **"ADD USERS"**
- Add your email address (and any other testing emails)
- Click **"ADD"**
- Click **"SAVE AND CONTINUE"**

### 3.6 Review and Submit (Page 4)
- Review your settings
- Click **"BACK TO DASHBOARD"**

**✅ Confirmation:** You should see your app in "Testing" status, which is perfect for development.

---

## **Step 4: Create OAuth Client ID**
*Estimated time: 3-5 minutes*

### 4.1 Navigate to Credentials
- Go to **"APIs & Services"** → **"Credentials"**

### 4.2 Create OAuth Client ID
- Click **"CREATE CREDENTIALS"** → **"OAuth client ID"**

### 4.3 Configure Application Type
- **Application type**: Select **"Web application"**
- **Name**: `Branestawm Chrome Extension`

### 4.4 Add Authorized Origins
- Under **"Authorized JavaScript origins"**, click **"ADD URI"**
- Add: `chrome-extension://[EXTENSION_ID]`
  
  **❗ Important:** Replace `[EXTENSION_ID]` with your actual extension ID
  
  **How to get Extension ID:**
  1. Load your extension in Chrome developer mode first
  2. Go to `chrome://extensions/`
  3. Find your extension and copy the ID (looks like: `abcdefghijklmnopqrstuvwxyz123456`)
  4. Come back and replace `[EXTENSION_ID]` with the actual ID

### 4.5 Authorized Redirect URIs
- Under **"Authorized redirect URIs"**, click **"ADD URI"**
- Add: `https://[EXTENSION_ID].chromiumapp.org/`
  - Replace `[EXTENSION_ID]` with your actual extension ID

### 4.6 Create Client
- Click **"CREATE"**
- A popup will appear with your credentials

### 4.7 Save Your Client ID
- **Copy** the **Client ID** (looks like: `123456789-abcdef.apps.googleusercontent.com`)
- **Keep this secure** - you'll need it for the next step
- Click **"OK"**

---

## **Step 5: Update Extension Manifest**
*Estimated time: 1 minute*

### 5.1 Open manifest.json
Open your `manifest.json` file and find this section:
```json
"oauth2": {
  "client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/generative-language.retriever"
  ]
}
```

### 5.2 Replace Client ID
Replace `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID from Step 4.7.

**Example:**
```json
"oauth2": {
  "client_id": "123456789-abcdef123456.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/generative-language.retriever"
  ]
}
```

### 5.3 Save File
Save the `manifest.json` file.

---

## **Step 6: Load and Test Extension**
*Estimated time: 3-5 minutes*

### 6.1 Load Extension in Chrome
- Open Chrome and go to `chrome://extensions/`
- Enable **"Developer mode"** (toggle in top right)
- Click **"Load unpacked"**
- Select your extension folder
- **Copy the Extension ID** that appears

### 6.2 Update OAuth Settings (If First Time)
If this is your first time loading the extension:
1. Copy the new Extension ID
2. Go back to Google Cloud Console → Credentials
3. Edit your OAuth client ID
4. Update the authorized origins and redirect URIs with the correct Extension ID
5. Save changes

### 6.3 Test Authentication
- Click the extension icon in Chrome toolbar
- Click **"Easy Setup"**  
- Click **"Sign in with Google"**
- You should see Google's OAuth consent screen
- Click **"Allow"**
- You should be redirected back to the extension

**✅ Success indicators:**
- Extension shows "Connected to Google Gemini"
- No error messages appear
- You can send a test chat message

---

## **Step 7: Troubleshooting Common Issues**

### Issue: "Invalid Client ID" Error
**Cause:** Extension ID doesn't match OAuth settings
**Solution:** 
1. Get correct Extension ID from `chrome://extensions/`
2. Update OAuth client settings in Google Cloud Console
3. Reload extension

### Issue: "Redirect URI Mismatch" Error  
**Cause:** Wrong redirect URI format
**Solution:**
- Ensure redirect URI is: `https://[EXTENSION_ID].chromiumapp.org/`
- Include the trailing slash

### Issue: "Access Blocked" Error
**Cause:** App not approved for production
**Solution:**
- This is normal for testing - your app is in "Testing" mode
- Add your email as a test user in OAuth consent screen
- For production, you'll need to submit for verification

### Issue: "Scope Not Authorized" Error
**Cause:** Wrong or missing scopes
**Solution:**
- Verify scope is exactly: `https://www.googleapis.com/auth/generative-language.retriever`
- Check OAuth consent screen configuration

---

## **📋 Quick Checklist**

Before marking this complete, verify:

- [ ] ✅ Google Cloud project created
- [ ] ✅ Generative Language API enabled  
- [ ] ✅ OAuth consent screen configured
- [ ] ✅ Test users added (your email)
- [ ] ✅ OAuth client ID created
- [ ] ✅ Client ID copied and saved
- [ ] ✅ manifest.json updated with real client ID
- [ ] ✅ Extension loaded in Chrome
- [ ] ✅ Extension ID copied
- [ ] ✅ OAuth settings updated with extension ID
- [ ] ✅ Authentication flow tested successfully

---

## **🎉 You're Done!**

Your Branestawm extension now has Google OAuth configured and users can:
- Sign in with Google in ~30 seconds
- Get 1,500 free Gemini requests per day
- No API key required
- Professional authentication experience

**Time to completion: ~15-20 minutes total**

---

## **📁 File Location**
This guide is saved as: `Documents/google_oauth_setup_guide.md`