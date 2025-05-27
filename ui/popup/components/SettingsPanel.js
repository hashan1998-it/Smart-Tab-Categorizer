/**
 * Settings Panel Component
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
      
      await this.loadSettings();
      await this.loadCustomRules();
      this.setupEventListeners();
      this.render();
      
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
   * Setup event listeners
   */
  setupEventListeners() {
    // Close button
    const closeBtn = this.panelElement.querySelector('#closeSettingsBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Settings form changes
    const autoOrganizeCheckbox = this.panelElement.querySelector('#autoOrganize');
    if (autoOrganizeCheckbox) {
      autoOrganizeCheckbox.addEventListener('change', () => this.handleSettingChange());
    }

    const showNotificationsCheckbox = this.panelElement.querySelector('#showNotifications');
    if (showNotificationsCheckbox) {
      showNotificationsCheckbox.addEventListener('change', () => this.handleSettingChange());
    }

    const themeSelect = this.panelElement.querySelector('#themeSelect');
    if (themeSelect) {
      themeSelect.addEventListener('change', () => this.handleSettingChange());
    }

    // Custom rules
    const addRuleBtn = this.panelElement.querySelector('#addRuleBtn');
    if (addRuleBtn) {
      addRuleBtn.addEventListener('click', () => this.handleAddRule());
    }

    const ruleValueInput = this.panelElement.querySelector('#ruleValue');
    if (ruleValueInput) {
      ruleValueInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleAddRule();
        }
      });
    }

    // Export/Import buttons
    const exportBtn = this.panelElement.querySelector('#exportSettings');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.handleExportSettings());
    }

    const importBtn = this.panelElement.querySelector('#importSettings');
    if (importBtn) {
      importBtn.addEventListener('click', () => this.handleImportSettings());
    }

    const resetBtn = this.panelElement.querySelector('#resetSettings');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.handleResetSettings());
    }
  }

  /**
   * Render the settings panel
   */
  render() {
    try {
      this.renderSettings();
      this.renderCustomRules();
    } catch (error) {
      debugUtils.error('Failed to render settings panel', 'SettingsPanel', error);
    }
  }

  /**
   * Render settings form
   */
  renderSettings() {
    const settingsContent = this.panelElement.querySelector('.settings-content');
    if (!settingsContent) return;

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

    // Re-setup event listeners for new elements
    this.setupEventListeners();
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
      rules.domains?.forEach(domain => {
        const ruleElement = this.createRuleElement(category, domain, 'domain');
        rulesList.appendChild(ruleElement);
      });

      // Render keywords
      rules.keywords?.forEach(keyword => {
        const ruleElement = this.createRuleElement(category, keyword, 'keyword');
        rulesList.appendChild(ruleElement);
      });
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
      removeBtn.addEventListener('click', () => this.handleRemoveRule(category, value, type));
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
        return;
      }

      // Save settings
      await chrome.storage.local.set({ settings: validation.sanitized });
      this.settings = validation.sanitized;

      // Update UI state
      UIStateManager.updateSettings(validation.sanitized);

      // Apply theme immediately
      this.applyTheme(validation.sanitized.theme);

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
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REFRESH_TABS });

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
          this.customRules[category].domains.length === 0 && 
          this.customRules[category].keywords.length === 0) {
        delete this.customRules[category];
      }

      // Save to storage
      await chrome.storage.local.set({ categoryRules: this.customRules });

      // Re-render
      this.renderCustomRules();

      // Notify background to refresh categorization
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REFRESH_TABS });

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
    const fileInput = this.panelElement.querySelector('#importFile');
    if (!fileInput) return;

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
          }
        }

        // Import custom rules
        if (importData.customRules) {
          this.customRules = importData.customRules;
          await chrome.storage.local.set({ categoryRules: this.customRules });
        }

        // Re-render and refresh
        this.render();
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REFRESH_TABS });

        this.showNotification('Settings imported successfully', 'success');
        debugUtils.info('Settings imported', 'SettingsPanel');
      } catch (error) {
        debugUtils.error('Failed to import settings', 'SettingsPanel', error);
        this.showNotification('Failed to import settings', 'error');
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

      // Re-render and refresh
      this.render();
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REFRESH_TABS });

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
      document.documentElement.setAttribute('data-theme', theme);
      
      if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      }
    } catch (error) {
      debugUtils.error('Failed to apply theme', 'SettingsPanel', error);
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
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
      DOMUtils.fadeOut(notification, 200).then(() => {
        DOMUtils.removeElement(notification);
      });
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
    this.panelElement.style.display = 'flex';
    this.panelElement.classList.add('show');
    this.isVisible = true;
    
    // Focus first input
    const firstInput = this.panelElement.querySelector('input, select, button');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }

  /**
   * Hide the settings panel
   */
  hide() {
    this.panelElement.classList.remove('show');
    setTimeout(() => {
      this.panelElement.style.display = 'none';
    }, 300);
    this.isVisible = false;
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
      settings: this.settings
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    try {
      this.hide();
      
      if (this.panelElement) {
        this.panelElement.innerHTML = '';
      }

      debugUtils.info('SettingsPanel component cleanup completed', 'SettingsPanel');
    } catch (error) {
      debugUtils.error('SettingsPanel component cleanup failed', 'SettingsPanel', error);
    }
  }
}

export default SettingsPanel;