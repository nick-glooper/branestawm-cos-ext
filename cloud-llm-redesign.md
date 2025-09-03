# Cloud LLM Settings Redesign

## Current Issues
1. Single custom API endpoint only
2. No unified LLM selection interface
3. No "Airplane Mode" fallback to local LLM
4. Settings page becoming too long and unwieldy
5. No easy way to manage multiple API configurations

## Proposed Solution

### 1. New Settings Structure
```javascript
settings = {
  // Current LLM selection
  activeLlm: 'google' | 'local' | 'custom-[id]',
  
  // Airplane mode
  airplaneMode: false,
  
  // Google OAuth (unchanged)
  googleToken: '',
  
  // Custom API endpoints (new structure)
  customEndpoints: {
    'endpoint-1': {
      id: 'endpoint-1',
      name: 'My OpenAI',
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-3.5-turbo',
      apiKey: 'sk-...',
      isActive: false
    },
    'endpoint-2': {
      id: 'endpoint-2', 
      name: 'My Cerebras',
      provider: 'cerebras',
      endpoint: 'https://api.cerebras.ai/v1/chat/completions',
      model: 'llama3.1-8b',
      apiKey: 'sk-...',
      isActive: false
    }
  }
}
```

### 2. UI Design

#### Main Settings Section
```html
<!-- LLM Selection Dropdown -->
<div class="form-group">
  <label for="activeLlmSelect" class="label">Active LLM</label>
  <select id="activeLlmSelect" class="input">
    <option value="local">🦙 Local (Ollama) - Airplane Mode</option>
    <option value="google">🚀 Google Gemini</option>
    <optgroup label="Custom Endpoints">
      <option value="custom-endpoint-1">My OpenAI</option>
      <option value="custom-endpoint-2">My Cerebras</option>
    </optgroup>
  </select>
</div>

<!-- Airplane Mode Toggle -->
<div class="form-group">
  <label class="checkbox-label">
    <input type="checkbox" id="airplaneModeToggle">
    <span>✈️ Airplane Mode (Force Local LLM Only)</span>
  </label>
</div>

<!-- Manage Cloud LLMs Button -->
<button class="btn secondary" id="manageCloudLlmsBtn">
  <svg>...</svg>
  Manage Cloud LLMs
</button>
```

#### Cloud LLM Management Modal
- Google OAuth section (unchanged)
- List of custom endpoints with edit/delete actions
- Add new endpoint button
- Provider templates (OpenAI, Cerebras, OpenRouter, Custom)

### 3. Benefits
- Cleaner main settings page
- Multiple API endpoint support
- Clear LLM selection interface
- Airplane mode for offline/privacy scenarios
- Better organization via modal
- Scalable architecture

### 4. Migration Plan
1. Create new settings structure with backward compatibility
2. Implement Cloud LLM modal
3. Update main settings page with dropdown and airplane mode
4. Migrate existing API settings to first custom endpoint
5. Update routing logic to support new structure