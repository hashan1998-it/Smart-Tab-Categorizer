/**
 * Settings Manager - Complete Implementation
 * Handles all settings functionality including custom rules, data management, and preferences
 */

import { MESSAGE_TYPES, CATEGORIES, DEFAULT_SETTINGS } from '../../shared/constants/AppConstants.js';

export class SettingsManager {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.customRules = {};
    this.elements = {};
    this.initialized = false;
    this.notificationManager = null;
  }

  /**
   * Initialize settings manager
   */
  async init(notificationManager = null) {
    try {
      console.log('Initializing SettingsManager');
      
      this.notificationManager = notificationManager;
      this.setupDOMElements();
      this.setupEventListeners();
      
      // Load current settings
      await this.loadSettings();
      await this.loadCustomRules();
      
      // Populate UI
      this.populateSettingsUI();
      this.renderCustomRules();
      
      this.initialized = true;
      console.log('SettingsManager initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize SettingsManager:', error);
      throw error;
    }
  }

  /**
   * Setup DOM element references
   */
  setupDOMElements() {
    this.elements = {
      // General Settings
      autoOrganize: document.querySelector('#autoOrganize'),
      showNotifications: document.querySelector('#showNotifications'),
      themeSelect: document.querySelector('#themeSelect'),
      categorizationMode: document.querySelector('#categorizationMode'),
      
      // Custom Rules
      ruleCategorySelect: document.querySelector('#ruleCategorySelect'),
      ruleValueInput: document.querySelector('#ruleValueInput'),
      addRuleBtn: document.querySelector('#addRuleBtn'),
      customRulesList: document.querySelector('#customRulesList'),
      ruleCount: document.querySelector('#ruleCount'),
      
      // Data Management
      exportDataBtn: document.querySelector('#exportDataBtn'),
      importDataBtn: document.querySelector('#importDataBtn'),
      clearDataBtn: document.querySelector('#clearDataBtn'),
      importFileInput: document.querySelector('#importFileInput'),
      
      // About
      feedbackBtn: document.querySelector('#feedbackBtn'),
      helpBtn: document.querySelector('#helpBtn')
    };

    // Validate required elements
    const requiredElements = ['autoOrganize', 'addRuleBtn', 'customRulesList'];
    const missing = requiredElements.filter(key => !this.elements[key]);
    
    if (missing.length > 0) {
      console.warn(`Missing settings elements: ${missing.join(', ')}`);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // General Settings
    if (this.elements.autoOrganize) {
      this.elements.autoOrganize.addEventListener('change', (e) => {
        this.updateSetting('autoOrganize', e.target.checked);
      });
    }

    if (this.elements.showNotifications) {
      this.elements.showNotifications.addEventListener('change', (e) => {
        this.updateSetting('showNotifications', e.target.checked);
      });
    }

    if (this.elements.themeSelect) {
      this.elements.themeSelect.addEventListener('change', (e) => {
        this.updateSetting('theme', e.target.value);
        this.applyTheme(e.target.value);
      });
    }

    if (this.elements.categorizationMode) {
      this.elements.categorizationMode.addEventListener('change', (e) => {
        this.updateSetting('categorization', e.target.value);
      });
    }

    // Custom Rules
    if (this.elements.addRuleBtn) {
      this.elements.addRuleBtn.addEventListener('click', () => {
        this.handleAddRule();
      });
    }

    if (this.elements.ruleValueInput) {
      this.elements.ruleValueInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleAddRule();
        }
      });
    }

    // Data Management
    if (this.elements.exportDataBtn) {
      this.elements.exportDataBtn.addEventListener('click', () => {
        this.handleExportData();
      });
    }

    if (this.elements.importDataBtn) {
      this.elements.importDataBtn.addEventListener('click', () => {
        if (this.elements.importFileInput) {
          this.elements.importFileInput.click();
        }
      });
    }

    if (this.elements.importFileInput) {
      this.elements.importFileInput.addEventListener('change', (e) => {
        this.handleImportData(e);
      });
    }

    if (this.elements.clearDataBtn) {
      this.elements.clearDataBtn.addEventListener('click', () => {
        this.handleClearData();
      });
    }

    // About
    if (this.elements.feedbackBtn) {
      this.elements.feedbackBtn.addEventListener('click', () => {
        this.handleFeedback();
      });
    }

    if (this.elements.helpBtn) {
      this.elements.helpBtn.addEventListener('click', () => {
        this.handleHelp();
      });
    }

    console.log('Settings event listeners setup completed');
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      // Try to get from background first
      const response = await this.sendMessage({ type: 'GET_SETTINGS' });
      if (response?.success && response.data) {
        this.settings = { ...DEFAULT_SETTINGS, ...response.data };
        return;
      }
    } catch (error) {
      console.warn('Failed to load settings from background:', error);
    }

    // Fallback to chrome.storage
    try {
      const result = await chrome.storage.local.get(['settings']);
      if (result.settings) {
        this.settings = { ...DEFAULT_SETTINGS, ...result.settings };
      }
    } catch (error) {
      console.warn('Failed to load settings from storage:', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }

    console.log('Settings loaded:', this.settings);
  }

  /**
   * Load custom rules from storage
   */
  async loadCustomRules() {
    try {
      // Try to get from background first
      const response = await this.sendMessage({ type: 'GET_CUSTOM_RULES' });
      if (response?.success && response.data) {
        this.customRules = response.data;
        return;
      }
    } catch (error) {
      console.warn('Failed to load custom rules from background:', error);
    }

    // Fallback to chrome.storage
    try {
      const result = await chrome.storage.local.get(['categoryRules']);
      if (result.categoryRules) {
        this.customRules = result.categoryRules;
      }
    } catch (error) {
      console.warn('Failed to load custom rules from storage:', error);
      this.customRules = {};
    }

    console.log('Custom rules loaded:', this.customRules);
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    try {
      // Try background first
      const response = await this.sendMessage({ 
        type: 'SET_SETTINGS', 
        settings: this.settings 
      });
      if (response?.success) {
        return;
      }
    } catch (error) {
      console.warn('Failed to save settings via background:', error);
    }

    // Fallback to direct storage
    try {
      await chrome.storage.local.set({ settings: this.settings });
      console.log('Settings saved to storage');
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * Save custom rules to storage
   */
  async saveCustomRules() {
    try {
      // Try background first
      const response = await this.sendMessage({ 
        type: 'SET_CUSTOM_RULES', 
        rules: this.customRules 
      });
      if (response?.success) {
        return;
      }
    } catch (error) {
      console.warn('Failed to save custom rules via background:', error);
    }

    // Fallback to direct storage
    try {
      await chrome.storage.local.set({ categoryRules: this.customRules });
      console.log('Custom rules saved to storage');
    } catch (error) {
      console.error('Failed to save custom rules:', error);
      throw error;
    }
  }

  /**
   * Send message to background with timeout
   */
  async sendMessage(message) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Timeout' });
      }, 2000);

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeout);
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }

  /**
   * Populate settings UI with current values
   */
  populateSettingsUI() {
    // General Settings
    if (this.elements.autoOrganize) {
      this.elements.autoOrganize.checked = this.settings.autoOrganize;
    }

    if (this.elements.showNotifications) {
      this.elements.showNotifications.checked = this.settings.showNotifications;
    }

    if (this.elements.themeSelect) {
      this.elements.themeSelect.value = this.settings.theme;
    }

    if (this.elements.categorizationMode) {
      this.elements.categorizationMode.value = this.settings.categorization;
    }

    // Apply current theme
    this.applyTheme(this.settings.theme);

    console.log('Settings UI populated');
  }

  /**
   * Update a setting value
   */
  async updateSetting(key, value) {
    try {
      this.settings[key] = value;
      await this.saveSettings();
      
      if (this.notificationManager) {
        this.notificationManager.show(`Setting updated: ${key}`, 'success');
      }
      
      console.log(`Setting updated: ${key} = ${value}`);
    } catch (error) {
      console.error(`Failed to update setting ${key}:`, error);
      
      if (this.notificationManager) {
        this.notificationManager.show('Failed to save setting', 'error');
      }
    }
  }

  /**
   * Apply theme to the document
   */
  applyTheme(theme) {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      root.removeAttribute('data-theme');
    } else if (theme === 'auto') {
      // Follow system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.setAttribute('data-theme', 'dark');
      } else {
        root.removeAttribute('data-theme');
      }
    }
  }

  /**
   * Handle adding a custom rule
   */
  async handleAddRule() {
    const category = this.elements.ruleCategorySelect?.value;
    const value = this.elements.ruleValueInput?.value?.trim();

    if (!category || !value) {
      if (this.notificationManager) {
        this.notificationManager.show('Please select a category and enter a value', 'warning');
      }
      return;
    }

    // Validate input
    if (value.length > 100) {
      if (this.notificationManager) {
        this.notificationManager.show('Rule value is too long (max 100 characters)', 'error');
      }
      return;
    }

    // Determine rule type
    const type = value.includes('.') ? 'domain' : 'keyword';
    
    try {
      // Check if rule already exists
      if (this.customRules[category]) {
        const existing = type === 'domain' 
          ? this.customRules[category].domains || []
          : this.customRules[category].keywords || [];
        
        if (existing.includes(value.toLowerCase())) {
          if (this.notificationManager) {
            this.notificationManager.show('Rule already exists', 'warning');
          }
          return;
        }
      }

      // Add the rule
      if (!this.customRules[category]) {
        this.customRules[category] = { domains: [], keywords: [] };
      }

      const ruleArray = type === 'domain' ? 'domains' : 'keywords';
      this.customRules[category][ruleArray].push(value.toLowerCase());

      // Save to storage
      await this.saveCustomRules();

      // Clear input
      if (this.elements.ruleValueInput) {
        this.elements.ruleValueInput.value = '';
      }

      // Update UI
      this.renderCustomRules();

      if (this.notificationManager) {
        this.notificationManager.show(`Added ${type} rule for ${category}`, 'success');
      }

      console.log(`Added custom rule: ${category} - ${value} (${type})`);
      
    } catch (error) {
      console.error('Failed to add custom rule:', error);
      
      if (this.notificationManager) {
        this.notificationManager.show('Failed to add rule', 'error');
      }
    }
  }

  /**
   * Remove a custom rule
   */
  async removeCustomRule(category, value, type) {
    try {
      if (!this.customRules[category]) return;

      const ruleArray = type === 'domain' ? 'domains' : 'keywords';
      const rules = this.customRules[category][ruleArray];
      const index = rules.indexOf(value);

      if (index > -1) {
        rules.splice(index, 1);

        // Clean up empty categories
        if (rules.length === 0 && 
            this.customRules[category].domains.length === 0 && 
            this.customRules[category].keywords.length === 0) {
          delete this.customRules[category];
        }

        await this.saveCustomRules();
        this.renderCustomRules();

        if (this.notificationManager) {
          this.notificationManager.show(`Removed ${type} rule`, 'success');
        }

        console.log(`Removed custom rule: ${category} - ${value} (${type})`);
      }
    } catch (error) {
      console.error('Failed to remove custom rule:', error);
      
      if (this.notificationManager) {
        this.notificationManager.show('Failed to remove rule', 'error');
      }
    }
  }

  /**
   * Render custom rules list
   */
  renderCustomRules() {
    if (!this.elements.customRulesList) return;

    const rules = [];
    
    // Collect all rules
    Object.entries(this.customRules).forEach(([category, categoryRules]) => {
      (categoryRules.domains || []).forEach(domain => {
        rules.push({ category, value: domain, type: 'domain' });
      });
      (categoryRules.keywords || []).forEach(keyword => {
        rules.push({ category, value: keyword, type: 'keyword' });
      });
    });

    // Sort rules by category then by value
    rules.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.value.localeCompare(b.value);
    });

    // Render rules
    if (rules.length === 0) {
      this.elements.customRulesList.innerHTML = `
        <div class="no-rules-message" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
          <p>No custom rules yet. Add some rules to improve categorization!</p>
        </div>
      `;
    } else {
      this.elements.customRulesList.innerHTML = rules.map(rule => `
        <div class="custom-rule">
          <div class="rule-info">
            <span class="rule-category">${this.capitalizeFirst(rule.category)}</span>
            <span class="rule-type">${rule.type}</span>
            <span class="rule-value">${this.escapeHtml(rule.value)}</span>
          </div>
          <button class="rule-remove" 
                  onclick="settingsManager.removeCustomRule('${rule.category}', '${rule.value}', '${rule.type}')"
                  title="Remove rule">
            ×
          </button>
        </div>
      `).join('');
    }

    // Update rule count
    if (this.elements.ruleCount) {
      this.elements.ruleCount.textContent = rules.length;
    }
  }

  /**
   * Handle data export
   */
  async handleExportData() {
    try {
      // Get all data from storage
      const data = await chrome.storage.local.get();
      
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        settings: this.settings,
        customRules: this.customRules,
        tabs: data.tabs || {},
        metadata: {
          userAgent: navigator.userAgent,
          extensionVersion: chrome.runtime.getManifest().version
        }
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `smart-tab-organizer-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (this.notificationManager) {
        this.notificationManager.show('Data exported successfully', 'success');
      }

      console.log('Data exported successfully');
      
    } catch (error) {
      console.error('Failed to export data:', error);
      
      if (this.notificationManager) {
        this.notificationManager.show('Failed to export data', 'error');
      }
    }
  }

  /**
   * Handle data import
   */
  async handleImportData(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await this.readFile(file);
      const importData = JSON.parse(text);

      // Validate import data
      if (!importData.version || !importData.settings) {
        throw new Error('Invalid backup file format');
      }

      // Show confirmation dialog
      const confirmed = confirm(
        'This will replace your current settings and custom rules. ' +
        'Make sure you have exported your current data first. Continue?'
      );
      
      if (!confirmed) {
        event.target.value = ''; // Clear file input
        return;
      }

      // Import settings
      if (importData.settings) {
        this.settings = { ...DEFAULT_SETTINGS, ...importData.settings };
        await this.saveSettings();
        this.populateSettingsUI();
      }

      // Import custom rules
      if (importData.customRules) {
        this.customRules = importData.customRules;
        await this.saveCustomRules();
        this.renderCustomRules();
      }

      // Import tabs data if present
      if (importData.tabs) {
        await chrome.storage.local.set({ tabs: importData.tabs });
      }

      if (this.notificationManager) {
        this.notificationManager.show('Data imported successfully', 'success');
      }

      console.log('Data imported successfully');
      
    } catch (error) {
      console.error('Failed to import data:', error);
      
      if (this.notificationManager) {
        this.notificationManager.show('Failed to import data: ' + error.message, 'error');
      }
    } finally {
      event.target.value = ''; // Clear file input
    }
  }

  /**
   * Read file as text
   */
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  /**
   * Handle clear all data
   */
  async handleClearData() {
    const confirmed = confirm(
      'This will permanently delete ALL extension data including:\n' +
      '• All settings\n' +
      '• Custom categorization rules\n' +
      '• Tab history and statistics\n\n' +
      'This action cannot be undone. Are you sure?'
    );

    if (!confirmed) return;

    // Double confirmation for destructive action
    const doubleConfirmed = confirm(
      'Are you ABSOLUTELY sure? This will delete everything and cannot be undone.'
    );

    if (!doubleConfirmed) return;

    try {
      // Clear all storage
      await chrome.storage.local.clear();
      
      // Reset local state
      this.settings = { ...DEFAULT_SETTINGS };
      this.customRules = {};
      
      // Update UI
      this.populateSettingsUI();
      this.renderCustomRules();

      if (this.notificationManager) {
        this.notificationManager.show('All data cleared successfully', 'success');
      }

      console.log('All data cleared');
      
    } catch (error) {
      console.error('Failed to clear data:', error);
      
      if (this.notificationManager) {
        this.notificationManager.show('Failed to clear data', 'error');
      }
    }
  }

  /**
   * Handle feedback
   */
  handleFeedback() {
    const subject = encodeURIComponent('Smart Tab Organizer Feedback');
    const body = encodeURIComponent(
      'Hi there!\n\n' +
      'I\'d like to share some feedback about Smart Tab Organizer:\n\n' +
      '[Please describe your feedback here]\n\n' +
      '---\n' +
      `Extension Version: ${chrome.runtime.getManifest().version}\n` +
      `Browser: ${navigator.userAgent}\n` +
      `Date: ${new Date().toISOString()}`
    );
    
    // Open email client
    window.open(`mailto:feedback@example.com?subject=${subject}&body=${body}`);
  }

  /**
   * Handle help
   */
  handleHelp() {
    // Create help modal or redirect to documentation
    const helpContent = `
      <div style="max-width: 500px; padding: 20px;">
        <h2>Smart Tab Organizer Help</h2>
        
        <h3>🚀 Getting Started</h3>
        <p>The extension automatically categorizes your tabs based on their content and domain.</p>
        
        <h3>📋 Categories</h3>
        <ul>
          <li><strong>Development:</strong> GitHub, Stack Overflow, documentation sites</li>
          <li><strong>Social:</strong> Twitter, Facebook, LinkedIn</li>
          <li><strong>Productivity:</strong> Google Docs, Notion, Trello</li>
          <li><strong>Entertainment:</strong> YouTube, Netflix, Spotify</li>
          <li><strong>Shopping:</strong> Amazon, eBay, online stores</li>
          <li><strong>News:</strong> News websites and articles</li>
          <li><strong>Reference:</strong> Wikipedia, tutorials, guides</li>
        </ul>
        
        <h3>⚙️ Custom Rules</h3>
        <p>Add custom domain or keyword rules to improve categorization for your specific needs.</p>
        
        <h3>🔧 Settings</h3>
        <ul>
          <li><strong>Auto-organize:</strong> Automatically categorize new tabs</li>
          <li><strong>Theme:</strong> Choose light, dark, or system theme</li>
          <li><strong>Categorization Mode:</strong> Auto, manual, or hybrid</li>
        </ul>
        
        <h3>💾 Data Management</h3>
        <p>Export your settings and rules for backup, or import from another device.</p>
        
        <h3>🎯 Tips</h3>
        <ul>
          <li>Use the search bar to quickly find specific tabs</li>
          <li>Click category headers to collapse/expand sections</li>
          <li>Add custom rules for better categorization of your frequently used sites</li>
        </ul>
      </div>
    `;
    
    // For now, show alert with basic help. In a real implementation, 
    // you might create a modal or open a help page
    alert(
      'Smart Tab Organizer Help\n\n' +
      '• The extension automatically categorizes your tabs\n' +
      '• Use custom rules to improve categorization\n' +
      '• Search tabs using the search bar\n' +
      '• Export/import your settings for backup\n' +
      '• Visit the Chrome Web Store page for more detailed documentation'
    );
  }

  /**
   * Get current settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Get custom rules
   */
  getCustomRules() {
    return { ...this.customRules };
  }

  /**
   * Utility functions
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Cleanup method
   */
  cleanup() {
    // Remove event listeners if needed
    console.log('SettingsManager cleanup completed');
  }
}

export default SettingsManager;