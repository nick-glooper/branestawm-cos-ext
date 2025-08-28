// Branestawm - UI Module
// Handles modals, messages, tooltips, themes, and accessibility

// ========== MODAL MANAGEMENT ==========

function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// ========== MESSAGE SYSTEM ==========

function showMessage(message, type = 'info') {
    const messageContainer = document.getElementById('messageContainer');
    
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    messageEl.innerHTML = `
        <span class="message-content">${message}</span>
        <button class="message-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    messageContainer.appendChild(messageEl);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.remove();
        }
    }, 5000);
}

// ========== THEME SYSTEM ==========

function initializeTheme() {
    const savedColorScheme = settings.colorScheme || 'professional';
    const savedThemeMode = settings.themeMode || 'dark';
    
    // Set initial theme
    applyTheme(savedColorScheme, savedThemeMode);
}

function applyTheme(colorScheme, themeMode) {
    document.documentElement.className = '';
    document.documentElement.classList.add(`scheme-${colorScheme}`);
    document.documentElement.classList.add(`theme-${themeMode}`);
    
    // Handle system theme changes
    if (themeMode === 'auto') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const actualTheme = mediaQuery.matches ? 'dark' : 'light';
        document.documentElement.classList.remove('theme-auto');
        document.documentElement.classList.add(`theme-${actualTheme}`);
        
        if (!mediaQuery.addEventListener) {
            mediaQuery.addListener(handleSystemThemeChange);
        } else {
            mediaQuery.addEventListener('change', handleSystemThemeChange);
        }
    }
}

function handleSystemThemeChange(e) {
    if (settings.themeMode === 'auto') {
        const newTheme = e.matches ? 'dark' : 'light';
        document.documentElement.classList.remove('theme-light', 'theme-dark');
        document.documentElement.classList.add(`theme-${newTheme}`);
    }
}

function toggleTheme() {
    const currentMode = settings.themeMode || 'dark';
    const newMode = currentMode === 'dark' ? 'light' : 'dark';
    settings.themeMode = newMode;
    applyTheme(settings.colorScheme || 'professional', newMode);
    saveData();
}

// ========== ACCESSIBILITY ==========

function setupAccessibility() {
    // Keyboard navigation for modals
    document.addEventListener('keydown', handleGlobalKeydown);
    
    setupFocusManagement();
    
    // Reduced motion support
    setupReducedMotion();
    
    // High contrast mode
    setupHighContrastMode();
}

function handleGlobalKeydown(e) {
    // Close modal on Escape
    if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal.show');
        if (openModal) {
            e.preventDefault();
            closeModal(openModal.id);
        }
    }
    
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'TEXTAREA') {
            const form = activeElement.closest('form') || activeElement.closest('.modal');
            if (form) {
                const submitBtn = form.querySelector('.btn:not(.secondary)');
                if (submitBtn && !submitBtn.disabled) {
                    submitBtn.click();
                }
            }
        }
    }
}

function setupFocusManagement() {
    // Trap focus within modals
    document.addEventListener('focusin', (e) => {
        const activeModal = document.querySelector('.modal.show');
        if (activeModal && !activeModal.contains(e.target)) {
            const firstFocusable = activeModal.querySelector('input, textarea, button, [tabindex]:not([tabindex="-1"])');
            if (firstFocusable) {
                firstFocusable.focus();
            }
        }
    });
}

function setupReducedMotion() {
    if (settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.documentElement.classList.add('reduced-motion');
    }
    
    // Listen for system preference changes
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
        if (e.matches || settings.reducedMotion) {
            document.documentElement.classList.add('reduced-motion');
        } else {
            document.documentElement.classList.remove('reduced-motion');
        }
    });
}

function setupHighContrastMode() {
    if (settings.highContrast || window.matchMedia('(prefers-contrast: high)').matches) {
        document.documentElement.classList.add('high-contrast');
    }
    
    // Listen for system preference changes
    window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
        if (e.matches || settings.highContrast) {
            document.documentElement.classList.add('high-contrast');
        } else {
            document.documentElement.classList.remove('high-contrast');
        }
    });
}

// ========== TOOLTIP SYSTEM ==========

function setupTooltips() {
    if (!settings.showTooltips) {
        // Remove all existing tooltips
        document.querySelectorAll('.tooltip').forEach(tooltip => tooltip.remove());
        return;
    }
    
    // Add tooltips to elements with data-tooltip attribute
    const tooltipElements = document.querySelectorAll('[data-tooltip]:not(.tooltip-initialized)');
    tooltipElements.forEach(element => {
        element.classList.add('tooltip-initialized');
        
        element.addEventListener('mouseenter', (e) => {
            showTooltip(e.target);
        });
        
        element.addEventListener('mouseleave', (e) => {
            hideTooltip(e.target);
        });
    });
}

function showTooltip(element) {
    const tooltipText = element.getAttribute('data-tooltip');
    if (!tooltipText) return;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = tooltipText;
    document.body.appendChild(tooltip);
    
    // Position tooltip
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
    
    element._tooltip = tooltip;
}

function hideTooltip(element) {
    if (element._tooltip) {
        element._tooltip.remove();
        delete element._tooltip;
    }
}

// ========== UTILITY FUNCTIONS ==========

function autoResizeTextarea() {
    const textarea = document.getElementById('messageInput');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}