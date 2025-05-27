/**
 * Settings Panel Component - FIXED VERSION
 * Manages extension settings and custom categorization rules
 */

import { CATEGORIES, LIMITS, MESSAGE_TYPES } from '../../shared/constants/AppConstants.js';
import debugUtils from '../../shared/utils/DebugUtils.js';
import DOMUtils from '../../shared/utils/DOMUtils.js';
import ValidationUtils from '../../shared/utils/ValidationUtils.js';
import UIStateManager from '../managers/UIStateManager.js';

class SettingsPanel {
  constructor(panelElement) {
    this.panelElement = panelElement;
    this.customRules = {};
    this.settings = {};
    this.initialized = false;
    this.isVisible = false;
    this.eventListeners = new Map(); // Track event listeners for proper cleanup
  }

  /**
   * Initialize the settings panel component
   */
  async init() {
    try {
      if (!this.panelElement) {
        throw new Error('Panel element is required');
      }

      debugUtils.info('Initializing SettingsPanel component', 'SettingsPanel');
      
      // Ensure panel is hidden initially
      this.panelElement.style.display = 'none';
      this.panelElement.classList.remove('show');
      
      await this.loadSettings();
      await this.loadCustomRules();
      this.render();
      this.setupEventListeners();
      
      this.initialized = true;
      debugUtils.info('SettingsPanel component initialized successfully', 'SettingsPanel');
    } catch (error) {
      debugUtils.error('Failed to initialize SettingsPanel component', 'SettingsPanel', error);
      throw error;
    }
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['settings']);
      this.settings = result.settings || {
        autoOrganize: true,
        showNotifications: true,
        theme: 'light',
        categorization: 'auto'
      };
      
      debugUtils.debug('Settings loaded', 'SettingsPanel', this.settings);
    } catch (error) {
      debugUtils.error('Failed to load settings', 'SettingsPanel', error);
      // Use default settings on error
      this.settings = {
        autoOrganize: true,
        showNotifications: true,
        theme: 'light',
        categorization: 'auto'
      };
    }
  }

  /**
   * Load custom categorization rules
   */
  async loadCustomRules() {
    try {
      const result = await chrome.storage.local.get(['categoryRules']);
      this.customRules = result.categoryRules || {};
      
      debugUtils.debug('Custom rules loaded', 'SettingsPanel', this.customRules);
    } catch (error) {
      debugUtils.error('Failed to load custom rules', 'SettingsPanel', error);
      this.customRules = {};
    }
  }

  /**
   * Setup event listeners with proper cleanup tracking
   */
  setupEventListeners() {
    try {
      // Clear existing listeners first
      this.clearEventListeners();

      // Close button
      const closeBtn = this.panelElement.querySelector('#closeSettingsBtn');
      if (closeBtn) {
        const closeHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.hide();
        };
        closeBtn.addEventListener('click', closeHandler);
        this.eventListeners.set('closeBtn', { element: closeBtn, event: 'click', handler: closeHandler });
      }

      // Settings form changes
      this.setupSettingsListeners();
      this.setupCustomRulesListeners();
      this.setupDataManagementListeners();

      debugUtils.debug('Event listeners setup completed', 'SettingsPanel');
    } catch (error) {
      debugUtils.error('Failed to setup event listeners', 'SettingsPanel', error);
    }
  }

  /**
   * Setup settings form listeners
   */
  setupSettingsListeners() {
    const autoOrganizeCheckbox = this.panelElement.querySelector('#autoOrganize');
    if (autoOrganizeCheckbox) {
      const handler = () => this.handleSettingChange();
      autoOrganizeCheckbox.addEventListener('change', handler);
      this.eventListeners.set('autoOrganize', { element: autoOrganizeCheckbox, event: 'change', handler });
    }

    const showNotificationsCheckbox = this.panelElement.querySelector('#showNotifications');
    if (showNotificationsCheckbox) {
      const handler = () => this.handleSettingChange();
      showNotificationsCheckbox.addEventListener('change', handler);
      this.eventListeners.set('showNotifications', { element: showNotificationsCheckbox, event: 'change', handler });
    }

    const themeSelect = this.panelElement.querySelector('#themeSelect');
    if (themeSelect) {
      const handler = () => this.handleSettingChange();
      themeSelect.addEventListener('change', handler);
      this.eventListeners.set('themeSelect', { element: themeSelect, event: 'change', handler });
    }
  }

  /**
   * Setup custom rules listeners
   */
  setupCustomRulesListeners() {
    const addRuleBtn = this.panelElement.querySelector('#addRuleBtn');
    if (addRuleBtn) {
      const handler = (e) => {
        e.preventDefault();
        this.handleAddRule();
      };
      addRuleBtn.addEventListener('click', handler);
      this.eventListeners.set('addRuleBtn', { element: addRuleBtn, event: 'click', handler });
    }

    const ruleValueInput = this.panelElement.querySelector('#ruleValue');
    if (ruleValueInput) {
      const handler = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleAddRule();
        }
      };
      ruleValueInput.addEventListener('keypress', handler);
      this.eventListeners.set('ruleValueInput', { element: ruleValueInput, event: 'keypress', handler });
    }
  }

  /**
   * Setup data management listeners
   */
  setupDataManagementListeners() {
    const exportBtn = this.panelElement.querySelector('#exportSettings');
    if (exportBtn) {
      const handler = (e) => {
        e.preventDefault();
        this.handleExportSettings();
      };
      exportBtn.addEventListener('click', handler);
      this.eventListeners.set('exportBtn', { element: exportBtn, event: 'click', handler });
    }

    const importBtn = this.panelElement.querySelector('#importSettings');
    if (importBtn) {
      const handler = (e) => {
        e.preventDefault();
        this.handleImportSettings();
      };
      importBtn.addEventListener('click', handler);
      this.eventListeners.set('importBtn', { element: importBtn, event: 'click', handler });
    }

    const resetBtn = this.panelElement.querySelector('#resetSettings');
    if (resetBtn) {
      const handler = (e) => {
        e.preventDefault();
        this.handleResetSettings();
      };
      resetBtn.addEventListener('click', handler);
      this.eventListeners.set('resetBtn', { element: resetBtn, event: 'click', handler });
    }
  }

  /**
   * Clear all event listeners
   */
  clearEventListeners() {
    this.eventListeners.forEach((listener, key) => {
      try {
        listener.element.removeEventListener(listener.event, listener.handler);
      } catch (error) {
        debugUtils.warn(`Failed to remove listener: ${key}`, 'SettingsPanel', error);
      }
    });
    this.eventListeners.clear();
  }

  /**
   * Render the settings panel
   */
  render() {
    try {
      this.renderSettings();
      this.renderCustomRules();
      // Re-setup event listeners after rendering
      this.setupEventListeners();
    } catch (error) {
      debugUtils.error('Failed to render settings panel', 'SettingsPanel', error);
    }
  }

  /**
   * Render settings form
   */
  renderSettings() {
    let settingsContent = this.panelElement.querySelector('.settings-content');
    if (!settingsContent) {
      // Create settings content if it doesn't exist
      settingsContent = DOMUtils.createElement('div', {
        classes: ['settings-content']
      });
      this.panelElement.appendChild(settingsContent);
    }

    // Clear existing content
    settingsContent.innerHTML = '';

    // Basic settings section
    const basicSettingsSection = DOMUtils.createElement('div', {
      classes: ['setting-section'],
      innerHTML: `
        <h3>General Settings</h3>
        <div class="setting-item">
          <label>
            <input type="checkbox" id="autoOrganize" ${this.settings.autoOrganize ? 'checked' : ''}>
            <span>Auto-organize tabs</span>
          </label>
          <p class="setting-description">Automatically categorize new tabs as they are created</p>
        </div>
        <div class="setting-item">
          <label>
            <input type="checkbox" id="showNotifications" ${this.settings.showNotifications ? 'checked' : ''}>
            <span>Show notifications</span>
          </label>
          <p class="setting-description">Display notifications when tabs are organized</p>
        </div>
        <div class="setting-item">
          <label for="themeSelect">Theme</label>
          <select id="themeSelect">
            <option value="light" ${this.settings.theme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${this.settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
            <option value="auto" ${this.settings.theme === 'auto' ? 'selected' : ''}>Auto</option>
          </select>
          <p class="setting-description">Choose your preferred color theme</p>
        </div>
      `
    });

    settingsContent.appendChild(basicSettingsSection);

    // Custom rules section
    const customRulesSection = DOMUtils.createElement('div', {
      classes: ['setting-section'],
      innerHTML: `
        <h3>Custom Category Rules</h3>
        <p class="section-description">Add custom domains or keywords to improve tab categorization</p>
        <div id="customRulesList"></div>
        <div class="add-rule-form">
          <select id="ruleCategory">
            ${Object.values(CATEGORIES).map(category => 
              `<option value="${category}">${category.charAt(0).toUpperCase() + category.slice(1)}</option>`
            ).join('')}
          </select>
          <input type="text" id="ruleValue" placeholder="example.com or keyword" maxlength="100">
          <button id="addRuleBtn" class="btn btn-primary">Add Rule</button>
        </div>
        <p class="rule-count">Rules: <span id="ruleCount">${this.getRuleCount()}</span>/${LIMITS.MAX_CUSTOM_RULES}</p>
      `
    });

    settingsContent.appendChild(customRulesSection);

    // Data management section
    const dataSection = DOMUtils.createElement('div', {
      classes: ['setting-section'],
      innerHTML: `
        <h3>Data Management</h3>
        <div class="data-actions">
          <button id="exportSettings" class="btn btn-secondary">Export Settings</button>
          <button id="importSettings" class="btn btn-secondary">Import Settings</button>
          <button id="resetSettings" class="btn btn-danger">Reset All Settings</button>
        </div>
        <input type="file" id="importFile" accept=".json" style="display: none;">
      `
    });

    settingsContent.appendChild(dataSection);
  }

  /**
   * Render custom rules list
   */
  renderCustomRules() {
    const rulesList = this.panelElement.querySelector('#customRulesList');
    if (!rulesList) return;

    rulesList.innerHTML = '';

    Object.entries(this.customRules).forEach(([category, rules]) => {
      // Render domains
      if (rules.domains) {
        rules.domains.forEach(domain => {
          const ruleElement = this.createRuleElement(category, domain, 'domain');
          rulesList.appendChild(ruleElement);
        });
      }

      // Render keywords
      if (rules.keywords) {
        rules.keywords.forEach(keyword => {
          const ruleElement = this.createRuleElement(category, keyword, 'keyword');
          rulesList.appendChild(ruleElement);
        });
      }
    });

    // Update rule count
    const ruleCountElement = this.panelElement.querySelector('#ruleCount');
    if (ruleCountElement) {
      ruleCountElement.textContent = this.getRuleCount();
    }
  }

  /**
   * Create a rule element
   */
  createRuleElement(category, value, type) {
    const ruleElement = DOMUtils.createElement('div', {
      classes: ['custom-rule'],
      innerHTML: `
        <div class="rule-info">
          <span class="rule-category">${category}</span>
          <span class="rule-type">${type}</span>
          <span class="rule-value">${ValidationUtils.sanitizeHtml(value)}</span>
        </div>
        <button class="rule-remove" title="Remove Rule" aria-label="Remove ${type} rule: ${value}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `
    });

    // Add remove event listener
    const removeBtn = ruleElement.querySelector('.rule-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleRemoveRule(category, value, type);
      });
    }

    return ruleElement;
  }

  /**
   * Handle setting changes
   */
  async handleSettingChange() {
    try {
      const autoOrganize = this.panelElement.querySelector('#autoOrganize')?.checked ?? true;
      const showNotifications = this.panelElement.querySelector('#showNotifications')?.checked ?? true;
      const theme = this.panelElement.querySelector('#themeSelect')?.value ?? 'light';

      const newSettings = {
        autoOrganize,
        showNotifications,
        theme,
        categorization: this.settings.categorization || 'auto'
      };

      // Validate settings
      const validation = ValidationUtils.validateSettings(newSettings);
      if (!validation.valid) {
        debugUtils.warn('Invalid settings', 'SettingsPanel', validation.errors);
        this.showNotification(validation.errors[0], 'error');
        return;
      }

      // Save settings
      await chrome.storage.local.set({ settings: validation.sanitized });
      this.settings = validation.sanitized;

      // Update UI state
      UIStateManager.updateSettings(validation.sanitized);

      // Apply theme immediately
      this.applyTheme(validation.sanitized.theme);

      this.showNotification('Settings saved successfully', 'success');
      debugUtils.info('Settings saved', 'SettingsPanel', validation.sanitized);
    } catch (error) {
      debugUtils.error('Failed to save settings', 'SettingsPanel', error);
      this.showNotification('Failed to save settings', 'error');
    }
  }

  /**
   * Handle adding a custom rule
   */
  async handleAddRule() {
    try {
      const categorySelect = this.panelElement.querySelector('#ruleCategory');
      const valueInput = this.panelElement.querySelector('#ruleValue');

      if (!categorySelect || !valueInput) return;

      const category = categorySelect.value;
      const value = valueInput.value.trim();

      if (!value) {
        this.showNotification('Please enter a domain or keyword', 'warning');
        valueInput.focus();
        return;
      }

      // Check rule limit
      if (this.getRuleCount() >= LIMITS.MAX_CUSTOM_RULES) {
        this.showNotification(`Maximum ${LIMITS.MAX_CUSTOM_RULES} rules allowed`, 'warning');
        return;
      }

      // Validate rule
      const validation = ValidationUtils.validateCustomRule(category, value);
      if (!validation.valid) {
        this.showNotification(validation.errors[0], 'error');
        valueInput.focus();
        return;
      }

      // Add rule to local state
      if (!this.customRules[category]) {
        this.customRules[category] = { domains: [], keywords: [] };
      }

      const ruleArray = validation.type === 'domain' ? 'domains' : 'keywords';
      const cleanValue = validation.sanitized;

      // Check for duplicates
      if (this.customRules[category][ruleArray].includes(cleanValue)) {
        this.showNotification('This rule already exists', 'warning');
        valueInput.focus();
        return;
      }

      // Add the rule
      this.customRules[category][ruleArray].push(cleanValue);

      // Save to storage
      await chrome.storage.local.set({ categoryRules: this.customRules });

      // Clear input and re-render
      valueInput.value = '';
      this.renderCustomRules();

      // Notify background to refresh categorization
      try {
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REFRESH_TABS });
      } catch (error) {
        debugUtils.warn('Failed to notify background about rule change', 'SettingsPanel', error);
      }

      this.showNotification('Rule added successfully', 'success');
      debugUtils.info('Custom rule added', 'SettingsPanel', { category, value: cleanValue, type: validation.type });
    } catch (error) {
      debugUtils.error('Failed to add custom rule', 'SettingsPanel', error);
      this.showNotification('Failed to add rule', 'error');
    }
  }

  /**
   * Handle removing a custom rule
   */
  async handleRemoveRule(category, value, type) {
    try {
      if (!this.customRules[category]) return;

      const ruleArray = type === 'domain' ? 'domains' : 'keywords';
      const rules = this.customRules[category][ruleArray];
      const index = rules.indexOf(value);

      if (index === -1) return;

      // Remove the rule
      rules.splice(index, 1);

      // Clean up empty categories
      if (rules.length === 0 && 
          (!this.customRules[category].domains || this.customRules[category].domains.length === 0) && 
          (!this.customRules[category].keywords || this.customRules[category].keywords.length === 0)) {
        delete this.customRules[category];
      }

      // Save to storage
      await chrome.storage.local.set({ categoryRules: this.customRules });

      // Re-render
      this.renderCustomRules();

      // Notify background to refresh categorization
      try {
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REFRESH_TABS });
      } catch (error) {
        debugUtils.warn('Failed to notify background about rule removal', 'SettingsPanel', error);
      }

      this.showNotification('Rule removed', 'success');
      debugUtils.info('Custom rule removed', 'SettingsPanel', { category, value, type });
    } catch (error) {
      debugUtils.error('Failed to remove custom rule', 'SettingsPanel', error);
      this.showNotification('Failed to remove rule', 'error');
    }
  }

  /**
   * Handle export settings
   */
  async handleExportSettings() {
    try {
      const exportData = {
        settings: this.settings,
        customRules: this.customRules,
        exportDate: new Date().toISOString(),
        version: '1.0.0'
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smart-tab-organizer-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showNotification('Settings exported successfully', 'success');
      debugUtils.info('Settings exported', 'SettingsPanel');
    } catch (error) {
      debugUtils.error('Failed to export settings', 'SettingsPanel', error);
      this.showNotification('Failed to export settings', 'error');
    }
  }

  /**
   * Handle import settings
   */
  handleImportSettings() {
    let fileInput = this.panelElement.querySelector('#importFile');
    if (!fileInput) {
      // Create file input if it doesn't exist
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.style.display = 'none';
      fileInput.id = 'importFile';
      this.panelElement.appendChild(fileInput);
    }

    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        // Validate import data
        if (!importData.settings && !importData.customRules) {
          throw new Error('Invalid settings file format');
        }

        // Import settings
        if (importData.settings) {
          const validation = ValidationUtils.validateSettings(importData.settings);
          if (validation.valid) {
            this.settings = validation.sanitized;
            await chrome.storage.local.set({ settings: validation.sanitized });
            UIStateManager.updateSettings(validation.sanitized);
            this.applyTheme(validation.sanitized.theme);
          }
        }

        // Import custom rules
        if (importData.customRules) {
          this.customRules = importData.customRules;
          await chrome.storage.local.set({ categoryRules: this.customRules });
        }

        // Re-render and refresh
        this.render();
        
        try {
          chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REFRESH_TABS });
        } catch (error) {
          debugUtils.warn('Failed to notify background about import', 'SettingsPanel', error);
        }

        this.showNotification('Settings imported successfully', 'success');
        debugUtils.info('Settings imported', 'SettingsPanel');
      } catch (error) {
        debugUtils.error('Failed to import settings', 'SettingsPanel', error);
        this.showNotification('Failed to import settings. Please check the file format.', 'error');
      }

      // Reset file input
      fileInput.value = '';
    };

    fileInput.click();
  }

  /**
   * Handle reset settings
   */
  async handleResetSettings() {
    if (!confirm('Are you sure you want to reset all settings? This cannot be undone.')) {
      return;
    }

    try {
      // Reset to defaults
      this.settings = {
        autoOrganize: true,
        showNotifications: true,
        theme: 'light',
        categorization: 'auto'
      };
      this.customRules = {};

      // Save to storage
      await chrome.storage.local.set({ 
        settings: this.settings,
        categoryRules: this.customRules
      });

      // Update UI state
      UIStateManager.updateSettings(this.settings);
      this.applyTheme(this.settings.theme);

      // Re-render and refresh
      this.render();
      
      try {
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REFRESH_TABS });
      } catch (error) {
        debugUtils.warn('Failed to notify background about reset', 'SettingsPanel', error);
      }

      this.showNotification('Settings reset successfully', 'success');
      debugUtils.info('Settings reset', 'SettingsPanel');
    } catch (error) {
      debugUtils.error('Failed to reset settings', 'SettingsPanel', error);
      this.showNotification('Failed to reset settings', 'error');
    }
  }

  /**
   * Apply theme
   */
  applyTheme(theme) {
    try {
      if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
    } catch (error) {
      debugUtils.error('Failed to apply theme', 'SettingsPanel', error);
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = this.panelElement.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
      DOMUtils.removeElement(notification);
    });

    // Create notification element
    const notification = DOMUtils.createElement('div', {
      classes: ['notification', `notification-${type}`],
      innerHTML: `
        <span class="notification-message">${ValidationUtils.sanitizeHtml(message)}</span>
        <button class="notification-close">&times;</button>
      `
    });

    // Add to panel
    this.panelElement.appendChild(notification);

    // Setup close handler
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        DOMUtils.fadeOut(notification, 200).then(() => {
          DOMUtils.removeElement(notification);
        });
      });
    }

    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        DOMUtils.fadeOut(notification, 200).then(() => {
          DOMUtils.removeElement(notification);
        });
      }
    }, 3000);

    // Animate in
    DOMUtils.fadeIn(notification, 200);
  }

  /**
   * Get total rule count
   */
  getRuleCount() {
    return Object.values(this.customRules).reduce((total, rules) => 
      total + (rules.domains?.length || 0) + (rules.keywords?.length || 0), 0
    );
  }

  /**
   * Show the settings panel
   */
  show() {
    try {
      debugUtils.info('Showing settings panel', 'SettingsPanel');
      
      this.panelElement.style.display = 'flex';
      
      // Force reflow before adding show class
      this.panelElement.offsetHeight;
      
      this.panelElement.classList.add('show');
      this.isVisible = true;
      
      // Focus first input
      setTimeout(() => {
        const firstInput = this.panelElement.querySelector('input, select, button');
        if (firstInput) {
          firstInput.focus();
        }
      }, 100);
      
      debugUtils.debug('Settings panel shown', 'SettingsPanel');
    } catch (error) {
      debugUtils.error('Failed to show settings panel', 'SettingsPanel', error);
    }
  }

  /**
   * Hide the settings panel
   */
  hide() {
    try {
      debugUtils.info('Hiding settings panel', 'SettingsPanel');
      
      this.panelElement.classList.remove('show');
      this.isVisible = false;
      
      setTimeout(() => {
        this.panelElement.style.display = 'none';
      }, 300);
      
      debugUtils.debug('Settings panel hidden', 'SettingsPanel');
    } catch (error) {
      debugUtils.error('Failed to hide settings panel', 'SettingsPanel', error);
    }
  }

  /**
   * Toggle panel visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Get component metrics
   */
  getMetrics() {
    return {
      initialized: this.initialized,
      isVisible: this.isVisible,
      ruleCount: this.getRuleCount(),
      settings: this.settings,
      eventListenersCount: this.eventListeners.size
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    try {
      // Hide panel
      this.hide();
      
      // Clear event listeners
      this.clearEventListeners();
      
      // Clear content
      if (this.panelElement) {
        const settingsContent = this.panelElement.querySelector('.settings-content');
        if (settingsContent) {
          settingsContent.innerHTML = '';
        }
      }

      debugUtils.info('SettingsPanel component cleanup completed', 'SettingsPanel');
    } catch (error) {
      debugUtils.error('SettingsPanel component cleanup failed', 'SettingsPanel', error);
    }
  }
}

export default SettingsPanel;