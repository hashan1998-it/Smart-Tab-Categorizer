/**
 * Complete Fixed Popup Controller - Eliminates All Duplications
 * Full implementation with all fixes applied
 */

// Constants (inline since we can't import from shared in popup context)
const MESSAGE_TYPES = {
  PING: "ping",
  GET_ALL_TABS: "getAllTabs",
  REFRESH_TABS: "refreshTabs",
  FOCUS_TAB: "focusTab",
  CLOSE_TAB: "closeTab",
  MOVE_TABS: "moveTabs",
};

const CATEGORIES = {
  DEVELOPMENT: "development",
  SOCIAL: "social",
  PRODUCTIVITY: "productivity",
  ENTERTAINMENT: "entertainment",
  SHOPPING: "shopping",
  NEWS: "news",
  REFERENCE: "reference",
  OTHER: "other",
};

const CATEGORY_ICONS = {
  development: "💻",
  social: "🌐",
  productivity: "📋",
  entertainment: "🎥",
  shopping: "🛒",
  news: "📰",
  reference: "📚",
  other: "📁",
};

const DEFAULT_SETTINGS = {
  autoOrganize: true,
  showNotifications: true,
  theme: "light",
  categorization: "auto",
};

// Notification Manager Class with deduplication
class NotificationManager {
  constructor() {
    this.container = null;
    this.notifications = new Map();
    this.recentMessages = new Map(); // Track recent messages to prevent duplicates
    this.defaultDuration = 4000;
    this.maxNotifications = 1;
    this.initialized = false;
    this.deduplicationWindow = 2000; // 2 seconds
  }

  init() {
    try {
      this.setupContainer();
      this.initialized = true;
      console.log("NotificationManager initialized");
    } catch (error) {
      console.error("Failed to initialize NotificationManager:", error);
    }
  }

  setupContainer() {
    this.container = document.querySelector("#notificationContainer");

    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "notificationContainer";
      this.container.style.cssText = `
        position: fixed;
        top: 80px;
        left: 16px;
        right: 16px;
        z-index: 1000;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 8px;
      `;
      document.body.appendChild(this.container);
    }
  }

  show(message, type = "info", duration = null) {
    if (!this.initialized) {
      console.warn("NotificationManager not initialized");
      return null;
    }

    // Check for recent duplicates
    const messageKey = `${type}:${message}`;
    const now = Date.now();

    if (this.recentMessages.has(messageKey)) {
      const lastShown = this.recentMessages.get(messageKey);
      if (now - lastShown < this.deduplicationWindow) {
        console.log("Preventing duplicate notification:", message);
        return null;
      }
    }

    // Update recent messages tracker
    this.recentMessages.set(messageKey, now);

    // Clean up old entries
    this.cleanupRecentMessages();

    const id = this.generateId();
    const notificationDuration = duration || this.defaultDuration;

    if (this.notifications.size >= this.maxNotifications) {
      const oldestId = this.notifications.keys().next().value;
      this.hide(oldestId);
    }

    const notification = this.createNotificationElement(id, message, type);
    this.container.appendChild(notification);

    this.notifications.set(id, {
      element: notification,
      type,
      message,
      createdAt: Date.now(),
    });

    requestAnimationFrame(() => {
      notification.style.opacity = "1";
      notification.style.transform = "translateY(0)";
    });

    if (notificationDuration > 0) {
      setTimeout(() => {
        this.hide(id);
      }, notificationDuration);
    }

    return id;
  }

  cleanupRecentMessages() {
    const now = Date.now();
    for (const [key, timestamp] of this.recentMessages.entries()) {
      if (now - timestamp > this.deduplicationWindow) {
        this.recentMessages.delete(key);
      }
    }
  }

  createNotificationElement(id, message, type) {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.dataset.id = id;
    notification.style.cssText = `
      background: var(--background);
      border: 1px solid var(--border);
      border-radius: var(--radius-md, 8px);
      box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1));
      padding: var(--spacing-md, 12px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spacing-sm, 8px);
      opacity: 0;
      transform: translateY(-20px);
      transition: all 0.3s ease;
      pointer-events: auto;
      color: var(--text-primary);
      font-size: var(--font-size-sm, 13px);
    `;

    // Add type-specific styling
    const typeStyles = {
      success:
        "border-color: var(--success-color, #10b981); background: var(--success-bg, #f0fdf4);",
      error:
        "border-color: var(--error-color, #ef4444); background: var(--error-bg, #fef2f2);",
      warning:
        "border-color: var(--warning-color, #f59e0b); background: var(--warning-bg, #fefce8);",
      info: "border-color: var(--primary-color, #3b82f6); background: var(--info-bg, #dbeafe);",
    };

    if (typeStyles[type]) {
      notification.style.cssText += typeStyles[type];
    }

    const icon = this.getIcon(type);

    const iconSpan = document.createElement("span");
    iconSpan.style.fontSize = "16px";
    iconSpan.textContent = icon;

    const messageSpan = document.createElement("span");
    messageSpan.className = "notification-message";
    messageSpan.textContent = message;
    messageSpan.style.cssText =
      "color: var(--text-primary); flex: 1; margin-left: 8px;";

    const closeBtn = document.createElement("button");
    closeBtn.className = "notification-close";
    closeBtn.title = "Close";
    closeBtn.textContent = "×";
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: var(--font-size-lg, 16px);
      padding: 0;
      margin-left: var(--spacing-sm, 8px);
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm, 4px);
      transition: all var(--transition-normal, 0.3s ease);
    `;

    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.color = "var(--text-primary)";
      closeBtn.style.background = "rgba(0, 0, 0, 0.1)";
    });

    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.color = "var(--text-secondary)";
      closeBtn.style.background = "none";
    });

    closeBtn.addEventListener("click", () => this.hide(id));

    const contentDiv = document.createElement("div");
    contentDiv.style.cssText = "display: flex; align-items: center; flex: 1;";
    contentDiv.appendChild(iconSpan);
    contentDiv.appendChild(messageSpan);

    notification.appendChild(contentDiv);
    notification.appendChild(closeBtn);

    return notification;
  }

  getIcon(type) {
    const icons = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️",
    };
    return icons[type] || icons.info;
  }

  hide(id) {
    const notification = this.notifications.get(id);
    if (!notification) return;

    const element = notification.element;
    element.style.opacity = "0";
    element.style.transform = "translateY(-20px)";

    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      this.notifications.delete(id);
    }, 300);
  }

  success(message, duration = null) {
    return this.show(message, "success", duration);
  }

  error(message, duration = null) {
    return this.show(message, "error", duration || 6000);
  }

  warning(message, duration = null) {
    return this.show(message, "warning", duration);
  }

  info(message, duration = null) {
    return this.show(message, "info", duration);
  }

  generateId() {
    return (
      "notification_" +
      Date.now() +
      "_" +
      Math.random().toString(36).substr(2, 9)
    );
  }

  destroy() {
    this.notifications.forEach((_, id) => this.hide(id));
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.notifications.clear();
    this.recentMessages.clear();
    this.initialized = false;
  }
}

// Settings Manager Class with fixed duplications
class SettingsManager {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.customRules = {};
    this.elements = {};
    this.initialized = false;
    this.notificationManager = null;
    this.eventListenersSetup = false; // Prevent duplicate listeners
    this.operationInProgress = new Set(); // Track ongoing operations
  }

  async init(notificationManager = null) {
    try {
      console.log("Initializing SettingsManager");

      this.notificationManager = notificationManager;
      this.setupDOMElements();

      // Only setup event listeners once
      if (!this.eventListenersSetup) {
        this.setupEventListeners();
        this.eventListenersSetup = true;
      }

      await this.loadSettings();
      await this.loadCustomRules();

      this.populateSettingsUI();
      this.renderCustomRules();

      this.initialized = true;
      console.log("SettingsManager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize SettingsManager:", error);
      // Don't throw - allow popup to work without settings
    }
  }

  setupDOMElements() {
    this.elements = {
      autoOrganize: document.querySelector("#autoOrganize"),
      showNotifications: document.querySelector("#showNotifications"),
      themeSelect: document.querySelector("#themeSelect"),
      categorizationMode: document.querySelector("#categorizationMode"),
      ruleCategorySelect: document.querySelector("#ruleCategorySelect"),
      ruleValueInput: document.querySelector("#ruleValueInput"),
      addRuleBtn: document.querySelector("#addRuleBtn"),
      customRulesList: document.querySelector("#customRulesList"),
      ruleCount: document.querySelector("#ruleCount"),
      exportDataBtn: document.querySelector("#exportDataBtn"),
      importDataBtn: document.querySelector("#importDataBtn"),
      clearDataBtn: document.querySelector("#clearDataBtn"),
      importFileInput: document.querySelector("#importFileInput"),
      feedbackBtn: document.querySelector("#feedbackBtn"),
      helpBtn: document.querySelector("#helpBtn"),
    };
  }

  setupEventListeners() {
    // General Settings
    if (this.elements.autoOrganize) {
      this.elements.autoOrganize.addEventListener("change", (e) => {
        this.updateSetting("autoOrganize", e.target.checked);
      });
    }

    if (this.elements.showNotifications) {
      this.elements.showNotifications.addEventListener("change", (e) => {
        this.updateSetting("showNotifications", e.target.checked);
      });
    }

    if (this.elements.themeSelect) {
      this.elements.themeSelect.addEventListener("change", (e) => {
        this.updateSetting("theme", e.target.value);
        this.applyTheme(e.target.value);
      });
    }

    if (this.elements.categorizationMode) {
      this.elements.categorizationMode.addEventListener("change", (e) => {
        this.updateSetting("categorization", e.target.value);
      });
    }

    // Custom Rules
    if (this.elements.addRuleBtn) {
      this.elements.addRuleBtn.addEventListener("click", () => {
        this.handleAddRule();
      });
    }

    if (this.elements.ruleValueInput) {
      this.elements.ruleValueInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.handleAddRule();
        }
      });
    }

    // Data Management
    if (this.elements.exportDataBtn) {
      this.elements.exportDataBtn.addEventListener("click", () => {
        this.handleExportData();
      });
    }

    if (this.elements.importDataBtn) {
      this.elements.importDataBtn.addEventListener("click", () => {
        if (this.elements.importFileInput) {
          this.elements.importFileInput.click();
        }
      });
    }

    if (this.elements.importFileInput) {
      this.elements.importFileInput.addEventListener("change", (e) => {
        this.handleImportData(e);
      });
    }

    if (this.elements.clearDataBtn) {
      this.elements.clearDataBtn.addEventListener("click", () => {
        this.handleClearData();
      });
    }

    // About
    if (this.elements.feedbackBtn) {
      this.elements.feedbackBtn.addEventListener("click", () => {
        this.handleFeedback();
      });
    }

    if (this.elements.helpBtn) {
      this.elements.helpBtn.addEventListener("click", () => {
        this.handleHelp();
      });
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(["settings"]);
      if (result.settings) {
        this.settings = { ...DEFAULT_SETTINGS, ...result.settings };
      }
    } catch (error) {
      console.warn("Failed to load settings:", error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  async loadCustomRules() {
    try {
      const result = await chrome.storage.local.get(["categoryRules"]);
      if (result.categoryRules) {
        this.customRules = result.categoryRules;
      }
    } catch (error) {
      console.warn("Failed to load custom rules:", error);
      this.customRules = {};
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set({ settings: this.settings });
    } catch (error) {
      console.error("Failed to save settings:", error);
      throw error;
    }
  }

  async saveCustomRules() {
    try {
      await chrome.storage.local.set({ categoryRules: this.customRules });
    } catch (error) {
      console.error("Failed to save custom rules:", error);
      throw error;
    }
  }

  populateSettingsUI() {
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

    this.applyTheme(this.settings.theme);
  }

  async updateSetting(key, value) {
    // Prevent duplicate update operations
    const operationKey = `update_${key}`;
    if (this.operationInProgress.has(operationKey)) {
      return;
    }

    this.operationInProgress.add(operationKey);

    try {
      this.settings[key] = value;
      await this.saveSettings();

      // Only show notification for user-initiated changes
      if (this.notificationManager && this.initialized) {
        this.notificationManager.success("Setting updated");
      }
    } catch (error) {
      console.error(`Failed to update setting ${key}:`, error);

      if (this.notificationManager) {
        this.notificationManager.error("Failed to save setting");
      }
    } finally {
      this.operationInProgress.delete(operationKey);
    }
  }

  applyTheme(theme) {
    const root = document.documentElement;

    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else if (theme === "light") {
      root.removeAttribute("data-theme");
    } else if (theme === "auto") {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      if (prefersDark) {
        root.setAttribute("data-theme", "dark");
      } else {
        root.removeAttribute("data-theme");
      }
    }
  }

  async handleAddRule() {
    // Prevent duplicate add operations
    if (this.operationInProgress.has("addRule")) {
      return;
    }

    this.operationInProgress.add("addRule");

    try {
      const category = this.elements.ruleCategorySelect?.value;
      const value = this.elements.ruleValueInput?.value?.trim();

      if (!category || !value) {
        if (this.notificationManager) {
          this.notificationManager.warning(
            "Please select a category and enter a value"
          );
        }
        return;
      }

      if (value.length > 100) {
        if (this.notificationManager) {
          this.notificationManager.error(
            "Rule value is too long (max 100 characters)"
          );
        }
        return;
      }

      const type = value.includes(".") ? "domain" : "keyword";

      if (!this.customRules[category]) {
        this.customRules[category] = { domains: [], keywords: [] };
      }

      const ruleArray = type === "domain" ? "domains" : "keywords";
      const existing = this.customRules[category][ruleArray] || [];

      if (existing.includes(value.toLowerCase())) {
        if (this.notificationManager) {
          this.notificationManager.warning("Rule already exists");
        }
        return;
      }

      this.customRules[category][ruleArray].push(value.toLowerCase());
      await this.saveCustomRules();

      if (this.elements.ruleValueInput) {
        this.elements.ruleValueInput.value = "";
      }

      this.renderCustomRules();

      if (this.notificationManager) {
        this.notificationManager.success(`Added ${type} rule for ${category}`);
      }
    } catch (error) {
      console.error("Failed to add custom rule:", error);

      if (this.notificationManager) {
        this.notificationManager.error("Failed to add rule");
      }
    } finally {
      this.operationInProgress.delete("addRule");
    }
  }

  async removeCustomRule(category, value, type) {
    // Prevent duplicate remove operations
    const operationKey = `removeRule_${category}_${value}_${type}`;
    if (this.operationInProgress.has(operationKey)) {
      return;
    }

    this.operationInProgress.add(operationKey);

    try {
      if (!this.customRules[category]) return;

      const ruleArray = type === "domain" ? "domains" : "keywords";
      const rules = this.customRules[category][ruleArray];
      const index = rules.indexOf(value);

      if (index > -1) {
        rules.splice(index, 1);

        if (
          rules.length === 0 &&
          this.customRules[category].domains.length === 0 &&
          this.customRules[category].keywords.length === 0
        ) {
          delete this.customRules[category];
        }

        await this.saveCustomRules();
        this.renderCustomRules();

        if (this.notificationManager) {
          this.notificationManager.success(`Removed ${type} rule`);
        }
      }
    } catch (error) {
      console.error("Failed to remove custom rule:", error);

      if (this.notificationManager) {
        this.notificationManager.error("Failed to remove rule");
      }
    } finally {
      this.operationInProgress.delete(operationKey);
    }
  }

  renderCustomRules() {
    if (!this.elements.customRulesList) return;

    const rules = [];

    Object.entries(this.customRules).forEach(([category, categoryRules]) => {
      (categoryRules.domains || []).forEach((domain) => {
        rules.push({ category, value: domain, type: "domain" });
      });
      (categoryRules.keywords || []).forEach((keyword) => {
        rules.push({ category, value: keyword, type: "keyword" });
      });
    });

    rules.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.value.localeCompare(b.value);
    });

    if (rules.length === 0) {
      this.elements.customRulesList.innerHTML = `
        <div class="no-rules-message" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
          <p>No custom rules yet. Add some rules to improve categorization!</p>
        </div>
      `;
    } else {
      this.elements.customRulesList.innerHTML = "";

      rules.forEach((rule) => {
        const ruleDiv = document.createElement("div");
        ruleDiv.className = "custom-rule";

        const infoDiv = document.createElement("div");
        infoDiv.className = "rule-info";

        const categorySpan = document.createElement("span");
        categorySpan.className = "rule-category";
        categorySpan.textContent = this.capitalizeFirst(rule.category);

        const typeSpan = document.createElement("span");
        typeSpan.className = "rule-type";
        typeSpan.textContent = rule.type;

        const valueSpan = document.createElement("span");
        valueSpan.className = "rule-value";
        valueSpan.textContent = rule.value;

        infoDiv.appendChild(categorySpan);
        infoDiv.appendChild(typeSpan);
        infoDiv.appendChild(valueSpan);

        const removeBtn = document.createElement("button");
        removeBtn.className = "rule-remove";
        removeBtn.title = "Remove rule";
        removeBtn.textContent = "×";

        // Use arrow function to prevent 'this' binding issues
        removeBtn.addEventListener("click", () => {
          this.removeCustomRule(rule.category, rule.value, rule.type);
        });

        ruleDiv.appendChild(infoDiv);
        ruleDiv.appendChild(removeBtn);

        this.elements.customRulesList.appendChild(ruleDiv);
      });
    }

    if (this.elements.ruleCount) {
      this.elements.ruleCount.textContent = rules.length;
    }
  }

  async handleExportData() {
    // Prevent multiple export operations
    if (this.operationInProgress.has("exportData")) {
      return;
    }

    this.operationInProgress.add("exportData");

    try {
      const data = await chrome.storage.local.get();

      const exportData = {
        version: "1.0.0",
        exportDate: new Date().toISOString(),
        settings: this.settings,
        customRules: this.customRules,
        tabs: data.tabs || {},
        metadata: {
          userAgent: navigator.userAgent,
          extensionVersion: chrome.runtime.getManifest().version,
        },
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `smart-tab-organizer-backup-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (this.notificationManager) {
        this.notificationManager.success("Data exported successfully");
      }
    } catch (error) {
      console.error("Failed to export data:", error);

      if (this.notificationManager) {
        this.notificationManager.error("Failed to export data");
      }
    } finally {
      this.operationInProgress.delete("exportData");
    }
  }

  async handleImportData(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Prevent multiple import operations
    if (this.operationInProgress.has("importData")) {
      event.target.value = "";
      return;
    }

    this.operationInProgress.add("importData");

    try {
      const text = await this.readFile(file);
      const importData = JSON.parse(text);

      if (!importData.version || !importData.settings) {
        throw new Error("Invalid backup file format");
      }

      // Single confirmation dialog
      const confirmed = confirm(
        "This will replace your current settings and custom rules. " +
          "Make sure you have exported your current data first. Continue?"
      );

      if (!confirmed) {
        return;
      }

      if (importData.settings) {
        this.settings = { ...DEFAULT_SETTINGS, ...importData.settings };
        await this.saveSettings();
        this.populateSettingsUI();
      }

      if (importData.customRules) {
        this.customRules = importData.customRules;
        await this.saveCustomRules();
        this.renderCustomRules();
      }

      if (importData.tabs) {
        await chrome.storage.local.set({ tabs: importData.tabs });
      }

      if (this.notificationManager) {
        this.notificationManager.success("Data imported successfully");
      }
    } catch (error) {
      console.error("Failed to import data:", error);

      if (this.notificationManager) {
        this.notificationManager.error(
          "Failed to import data: " + error.message
        );
      }
    } finally {
      event.target.value = "";
      this.operationInProgress.delete("importData");
    }
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  async handleClearData() {
    // Prevent multiple clear operations
    if (this.operationInProgress.has("clearData")) {
      return;
    }

    this.operationInProgress.add("clearData");

    try {
      // Single confirmation dialog
      const confirmed = confirm(
        "This will permanently delete ALL extension data including:\n" +
          "• All settings\n" +
          "• Custom categorization rules\n" +
          "• Tab history and statistics\n\n" +
          "This action cannot be undone. Are you sure?"
      );

      if (!confirmed) {
        return;
      }

      await chrome.storage.local.clear();

      this.settings = { ...DEFAULT_SETTINGS };
      this.customRules = {};

      this.populateSettingsUI();
      this.renderCustomRules();

      if (this.notificationManager) {
        this.notificationManager.success("All data cleared");
      }
    } catch (error) {
      console.error("Failed to clear data:", error);

      if (this.notificationManager) {
        this.notificationManager.error("Failed to clear data");
      }
    } finally {
      this.operationInProgress.delete("clearData");
    }
  }

  handleFeedback() {
    const subject = encodeURIComponent("Smart Tab Organizer Feedback");
    const body = encodeURIComponent(
      "Hi there!\n\n" +
        "I'd like to share some feedback about Smart Tab Organizer:\n\n" +
        "[Please describe your feedback here]\n\n" +
        "---\n" +
        `Extension Version: ${chrome.runtime.getManifest().version}\n` +
        `Browser: ${navigator.userAgent}\n` +
        `Date: ${new Date().toISOString()}`
    );

    window.open(`mailto:feedback@example.com?subject=${subject}&body=${body}`);
  }

  handleHelp() {
    alert(
      "Smart Tab Organizer Help\n\n" +
        "• The extension automatically categorizes your tabs\n" +
        "• Use custom rules to improve categorization\n" +
        "• Search tabs using the search bar\n" +
        "• Export/import your settings for backup\n" +
        "• Visit the Chrome Web Store page for more detailed documentation"
    );
  }

  getSettings() {
    return { ...this.settings };
  }

  getCustomRules() {
    return { ...this.customRules };
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  cleanup() {
    this.operationInProgress.clear();
    console.log("SettingsManager cleanup completed");
  }
}

// Main Popup Controller with fixed duplications
class PopupController {
  constructor() {
    this.initialized = false;
    this.isLoading = false;
    this.tabs = [];
    this.filteredTabs = [];
    this.categories = {};
    this.elements = {};
    this.retryCount = 0;
    this.maxRetries = 3;
    this.currentSearchQuery = "";
    this.eventHandlers = new Map();
    this.operationInProgress = new Set(); // Track ongoing operations
    this.eventListenersSetup = false; // Prevent duplicate event listeners

    this.notificationManager = new NotificationManager();
    this.settingsManager = new SettingsManager();

    console.log("PopupController: Starting initialization");
  }

  async init() {
    try {
      console.log("Initializing PopupController");

      await this.waitForDOM();

      this.notificationManager.init();
      await this.settingsManager.init(this.notificationManager);

      this.setupDOMElements();
      this.showLoadingState();
      this.setupEventListeners();

      await this.loadInitialData();

      this.initialized = true;
      console.log("PopupController initialized successfully");
    } catch (error) {
      console.error("Failed to initialize PopupController:", error);
      this.handleInitializationError(error);
    } finally {
      this.hideLoadingState();
    }
  }

  waitForDOM() {
    return new Promise((resolve) => {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", resolve, { once: true });
      } else {
        resolve();
      }
    });
  }

  setupDOMElements() {
    this.elements = {
      container: document.querySelector(".container"),
      categoriesContainer: document.querySelector("#categoriesContainer"),
      tabCount: document.querySelector("#tabCount"),
      refreshBtn: document.querySelector("#refreshBtn"),
      settingsBtn: document.querySelector("#settingsBtn"),
      searchInput: document.querySelector("#searchInput"),
      searchClear: document.querySelector("#searchClear"),
      loadingState: document.querySelector("#loadingState"),
      emptyState: document.querySelector("#emptyState"),
      errorState: document.querySelector("#errorState"),
      errorMessage: document.querySelector("#errorMessage"),
      newTabBtn: document.querySelector("#newTabBtn"),
      retryBtn: document.querySelector("#retryBtn"),
      settingsPanel: document.querySelector("#settingsPanel"),
      closeSettingsBtn: document.querySelector("#closeSettingsBtn"),
      closeBtn: document.querySelector("#closeBtn"),
    };

    const required = ["container", "categoriesContainer", "loadingState"];
    const missing = required.filter((key) => !this.elements[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required DOM elements: ${missing.join(", ")}`);
    }

    console.log("DOM elements setup completed");
  }

  setupEventListeners() {
    // Prevent duplicate event listeners
    if (this.eventListenersSetup) {
      return;
    }
    this.eventListenersSetup = true;

    const handlers = new Map();

    if (this.elements.refreshBtn) {
      const refreshHandler = () => this.handleRefresh();
      this.elements.refreshBtn.addEventListener("click", refreshHandler);
      handlers.set("refreshBtn", {
        element: this.elements.refreshBtn,
        event: "click",
        handler: refreshHandler,
      });
    }

    if (this.elements.settingsBtn) {
      const settingsHandler = () => this.openSettings();
      this.elements.settingsBtn.addEventListener("click", settingsHandler);
      handlers.set("settingsBtn", {
        element: this.elements.settingsBtn,
        event: "click",
        handler: settingsHandler,
      });
    }

    if (this.elements.closeSettingsBtn) {
      const closeSettingsHandler = () => this.closeSettings();
      this.elements.closeSettingsBtn.addEventListener(
        "click",
        closeSettingsHandler
      );
      handlers.set("closeSettingsBtn", {
        element: this.elements.closeSettingsBtn,
        event: "click",
        handler: closeSettingsHandler,
      });
    }

    if (this.elements.settingsPanel) {
      const backdropHandler = (e) => {
        if (e.target === this.elements.settingsPanel) {
          this.closeSettings();
        }
      };
      this.elements.settingsPanel.addEventListener("click", backdropHandler);
      handlers.set("settingsBackdrop", {
        element: this.elements.settingsPanel,
        event: "click",
        handler: backdropHandler,
      });
    }

    const escapeHandler = (e) => {
      if (
        e.key === "Escape" &&
        this.elements.settingsPanel &&
        this.elements.settingsPanel.classList.contains("show")
      ) {
        this.closeSettings();
      }
    };
    document.addEventListener("keydown", escapeHandler);
    handlers.set("escapeKey", {
      element: document,
      event: "keydown",
      handler: escapeHandler,
    });

    if (this.elements.newTabBtn) {
      const newTabHandler = () => this.handleNewTab();
      this.elements.newTabBtn.addEventListener("click", newTabHandler);
      handlers.set("newTabBtn", {
        element: this.elements.newTabBtn,
        event: "click",
        handler: newTabHandler,
      });
    }

    if (this.elements.retryBtn) {
      const retryHandler = () => this.handleRetry();
      this.elements.retryBtn.addEventListener("click", retryHandler);
      handlers.set("retryBtn", {
        element: this.elements.retryBtn,
        event: "click",
        handler: retryHandler,
      });
    }

    if (this.elements.searchInput) {
      let searchTimeout;

      const searchInputHandler = (e) => {
        const query = e.target.value.trim();
        this.updateSearchClearButton(query);
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.handleSearch(query);
        }, 300);
      };

      this.elements.searchInput.addEventListener("input", searchInputHandler);
      handlers.set("searchInput", {
        element: this.elements.searchInput,
        event: "input",
        handler: searchInputHandler,
      });

      const searchKeyHandler = (e) => {
        if (e.key === "Enter") {
          clearTimeout(searchTimeout);
          const query = e.target.value.trim();
          this.handleSearch(query);
        }
      };

      this.elements.searchInput.addEventListener("keydown", searchKeyHandler);
      handlers.set("searchKey", {
        element: this.elements.searchInput,
        event: "keydown",
        handler: searchKeyHandler,
      });
    }

    if (this.elements.closeBtn) {
      const closeHandler = () => this.handleClose();
      this.elements.closeBtn.addEventListener("click", closeHandler);
      handlers.set("closeBtn", {
        element: this.elements.closeBtn,
        event: "click",
        handler: closeHandler,
      });
    }

    if (this.elements.searchClear) {
      const clearHandler = () => {
        if (this.elements.searchInput) {
          this.elements.searchInput.value = "";
          this.currentSearchQuery = "";
          this.updateSearchClearButton("");
          this.handleSearch("");
          this.elements.searchInput.focus();
        }
      };

      this.elements.searchClear.addEventListener("click", clearHandler);
      handlers.set("searchClear", {
        element: this.elements.searchClear,
        event: "click",
        handler: clearHandler,
      });
    }

    // Global keyboard shortcuts
    const keyboardHandler = (e) => this.handleKeyboardShortcuts(e);
    document.addEventListener("keydown", keyboardHandler);
    handlers.set("keyboard", {
      element: document,
      event: "keydown",
      handler: keyboardHandler,
    });

    this.eventHandlers = handlers;
    console.log("Event listeners setup completed");
  }

  handleKeyboardShortcuts(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "k") {
      event.preventDefault();
      if (this.elements.searchInput) {
        this.elements.searchInput.focus();
        this.elements.searchInput.select();
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "r") {
      event.preventDefault();
      this.handleRefresh();
    }

    if ((event.ctrlKey || event.metaKey) && event.key === ",") {
      event.preventDefault();
      this.openSettings();
    }

    if (event.key === "Escape") {
      if (
        this.elements.settingsPanel &&
        this.elements.settingsPanel.classList.contains("show")
      ) {
        this.closeSettings();
      } else {
        event.preventDefault();
        this.handleClose();
      }
    }
  }

  updateSearchClearButton(query) {
    if (this.elements.searchClear) {
      this.elements.searchClear.style.display = query ? "block" : "none";
    }
  }

  async loadInitialData() {
    try {
      await this.loadFromBackground();
      console.log("Data loaded from background successfully");
      return;
    } catch (error) {
      console.warn("Background loading failed:", error);
    }

    try {
      await this.loadTabsDirectly();
      console.log("Data loaded directly successfully");
      return;
    } catch (error) {
      console.warn("Direct loading failed:", error);
    }

    this.loadMockData();
    console.log("Using mock data");
  }

  async loadFromBackground() {
    try {
      const pingResponse = await Promise.race([
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PING }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Ping timeout")), 1000)
        ),
      ]);

      if (!pingResponse || !pingResponse.success) {
        throw new Error("Background not ready");
      }
    } catch (error) {
      throw new Error("Background script not responding");
    }

    const response = await Promise.race([
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_ALL_TABS }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), 3000)
      ),
    ]);

    if (!response || !response.success || !response.data) {
      throw new Error("Invalid response from background");
    }

    this.tabs = response.data.tabs || [];
    this.filteredTabs = [...this.tabs];
    this.categories = response.data.categories || {};
    this.updateTabCount(response.data.totalCount || 0);
  }

  async loadTabsDirectly() {
    const chromeTabs = await chrome.tabs.query({});

    this.tabs = chromeTabs.map((tab) => ({
      id: tab.id,
      title: tab.title || "Loading...",
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || "",
      active: tab.active || false,
      pinned: tab.pinned || false,
      windowId: tab.windowId,
      category: this.categorizeTab(tab),
    }));

    this.filteredTabs = [...this.tabs];

    this.categories = {};
    this.tabs.forEach((tab) => {
      const category = tab.category || "other";
      this.categories[category] = (this.categories[category] || 0) + 1;
    });

    this.updateTabCount(this.tabs.length);
  }

  loadMockData() {
    this.tabs = [
      {
        id: 1,
        title: "GitHub - Your repositories",
        url: "https://github.com",
        favIconUrl: "https://github.com/favicon.ico",
        active: false,
        pinned: false,
        windowId: 1,
        category: "development",
      },
      {
        id: 2,
        title: "YouTube",
        url: "https://youtube.com",
        favIconUrl: "https://youtube.com/favicon.ico",
        active: true,
        pinned: false,
        windowId: 1,
        category: "entertainment",
      },
      {
        id: 3,
        title: "Google Docs",
        url: "https://docs.google.com",
        favIconUrl: "https://docs.google.com/favicon.ico",
        active: false,
        pinned: true,
        windowId: 1,
        category: "productivity",
      },
    ];

    this.filteredTabs = [...this.tabs];
    this.categories = {
      development: 1,
      entertainment: 1,
      productivity: 1,
    };
    this.updateTabCount(this.tabs.length);
  }

  categorizeTab(tab) {
    if (!tab.url) return "other";

    const url = tab.url.toLowerCase();
    const title = (tab.title || "").toLowerCase();

    const customRules = this.settingsManager.getCustomRules();

    for (const [category, rules] of Object.entries(customRules)) {
      if (
        rules.domains &&
        rules.domains.some((domain) => url.includes(domain))
      ) {
        return category;
      }

      if (
        rules.keywords &&
        rules.keywords.some(
          (keyword) => url.includes(keyword) || title.includes(keyword)
        )
      ) {
        return category;
      }
    }

    if (
      url.includes("github.com") ||
      url.includes("stackoverflow.com") ||
      title.includes("code")
    ) {
      return "development";
    }
    if (
      url.includes("youtube.com") ||
      url.includes("netflix.com") ||
      url.includes("spotify.com")
    ) {
      return "entertainment";
    }
    if (
      url.includes("twitter.com") ||
      url.includes("facebook.com") ||
      url.includes("linkedin.com")
    ) {
      return "social";
    }
    if (
      url.includes("docs.google.com") ||
      url.includes("notion.so") ||
      url.includes("trello.com")
    ) {
      return "productivity";
    }
    if (
      url.includes("amazon.com") ||
      url.includes("ebay.com") ||
      title.includes("shop")
    ) {
      return "shopping";
    }
    if (
      url.includes("news") ||
      url.includes("cnn.com") ||
      url.includes("bbc.com")
    ) {
      return "news";
    }
    if (url.includes("wikipedia.org") || title.includes("tutorial")) {
      return "reference";
    }

    return "other";
  }

  updateTabCount(count) {
    if (this.elements.tabCount) {
      this.elements.tabCount.textContent = count;
    }
  }

  showLoadingState() {
    this.showState("loading");
    this.isLoading = true;
  }

  hideLoadingState() {
    this.isLoading = false;
    if (this.filteredTabs.length === 0 && this.tabs.length === 0) {
      this.showEmptyState();
    } else {
      this.showCategories();
      this.renderTabs();
    }
  }

  showCategories() {
    this.showState("categories");
  }

  showEmptyState() {
    this.showState("empty");
  }

  showErrorState(message) {
    if (this.elements.errorMessage) {
      this.elements.errorMessage.textContent = message;
    }
    this.showState("error");
  }

  showState(state) {
    const states = {
      loading: this.elements.loadingState,
      empty: this.elements.emptyState,
      error: this.elements.errorState,
      categories: this.elements.categoriesContainer,
    };

    Object.values(states).forEach((element) => {
      if (element) {
        element.style.display = "none";
        element.classList.remove("show");
      }
    });

    const targetElement = states[state];
    if (targetElement) {
      targetElement.style.display = state === "categories" ? "block" : "flex";
      setTimeout(() => targetElement.classList.add("show"), 10);
    }
  }

  handleSearch(query) {
    console.log("Searching for:", query);

    this.currentSearchQuery = query;

    if (!query || query.trim() === "") {
      this.filteredTabs = [...this.tabs];
      console.log("Search cleared, showing all tabs");
    } else {
      const searchTerm = query.toLowerCase().trim();

      this.filteredTabs = this.tabs.filter((tab) => {
        const title = (tab.title || "").toLowerCase();
        const url = (tab.url || "").toLowerCase();

        return (
          title.includes(searchTerm) ||
          url.includes(searchTerm) ||
          this.getDomainFromUrl(url).includes(searchTerm)
        );
      });

      console.log(`Found ${this.filteredTabs.length} tabs matching "${query}"`);
    }

    this.renderTabs();
    this.updateTabCount(this.filteredTabs.length);

    if (this.filteredTabs.length === 0 && query) {
      this.showNoResultsState(query);
    } else if (this.filteredTabs.length === 0) {
      this.showEmptyState();
    } else {
      this.showCategories();
    }
  }

  getDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return "";
    }
  }

  showNoResultsState(query) {
    if (!this.elements.categoriesContainer) return;

    const clearSearchBtn = document.createElement("button");
    clearSearchBtn.className = "btn btn-secondary";
    clearSearchBtn.textContent = "Clear Search";
    clearSearchBtn.addEventListener("click", () => this.clearSearch());

    this.elements.categoriesContainer.innerHTML = `
      <div class="empty-state show" style="display: flex; position: relative; background: transparent;">
        <span class="empty-icon" aria-hidden="true">🔍</span>
        <h3>No Results Found</h3>
        <p>No tabs match "${this.escapeHtml(query)}"</p>
      </div>
    `;

    const emptyState =
      this.elements.categoriesContainer.querySelector(".empty-state");
    if (emptyState) {
      emptyState.appendChild(clearSearchBtn);
    }
  }

  clearSearch() {
    if (this.elements.searchInput) {
      this.elements.searchInput.value = "";
    }
    this.handleSearch("");
    this.updateSearchClearButton("");
  }

  renderTabs() {
    if (!this.elements.categoriesContainer) return;

    console.log(
      `Rendering ${this.filteredTabs.length} tabs (filtered from ${this.tabs.length})`
    );

    this.elements.categoriesContainer.innerHTML = "";

    if (this.filteredTabs.length === 0) {
      if (this.currentSearchQuery) {
        this.showNoResultsState(this.currentSearchQuery);
      } else {
        this.showEmptyState();
      }
      return;
    }

    const grouped = {};
    this.filteredTabs.forEach((tab) => {
      const category = tab.category || "other";
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(tab);
    });

    const sortedCategories = Object.entries(grouped).sort(
      ([, a], [, b]) => b.length - a.length
    );

    sortedCategories.forEach(([category, categoryTabs]) => {
      this.renderCategory(category, categoryTabs);
    });

    if (this.currentSearchQuery) {
      this.addSearchSummary();
    }
  }

  addSearchSummary() {
    if (!this.elements.categoriesContainer || !this.currentSearchQuery) return;

    const summaryDiv = document.createElement("div");
    summaryDiv.className = "search-summary";
    summaryDiv.innerHTML = `
      <div style="padding: 12px 16px; background: var(--surface); border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--border);">
        <div style="font-size: 13px; color: var(--text-secondary);">
          Found <strong>${this.filteredTabs.length}</strong> tab${
      this.filteredTabs.length === 1 ? "" : "s"
    } 
          matching "<strong>${this.escapeHtml(
            this.currentSearchQuery
          )}</strong>"
        </div>
      </div>
    `;

    this.elements.categoriesContainer.insertBefore(
      summaryDiv,
      this.elements.categoriesContainer.firstChild
    );
  }

  renderCategory(category, tabs) {
    const categoryDiv = document.createElement("div");
    categoryDiv.className = "category-section";
    categoryDiv.dataset.category = category;

    const icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.other;
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);

    const headerDiv = document.createElement("div");
    headerDiv.className = "category-header";
    headerDiv.innerHTML = `
      <div class="category-info">
        <span class="category-icon category-${category}">${icon}</span>
        <span class="category-name">${categoryName}</span>
        <span class="category-count">${tabs.length}</span>
      </div>
      <svg class="category-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9l6 6 6-6"/>
      </svg>
    `;

    headerDiv.addEventListener("click", () => {
      const tabList = categoryDiv.querySelector(".tab-list");
      if (tabList) {
        tabList.classList.toggle("collapsed");
        headerDiv.classList.toggle("collapsed");
      }
    });

    const tabListDiv = document.createElement("div");
    tabListDiv.className = "tab-list";

    tabs.forEach((tab) => {
      const tabElement = this.createTabElement(tab);
      tabListDiv.appendChild(tabElement);
    });

    categoryDiv.appendChild(headerDiv);
    categoryDiv.appendChild(tabListDiv);
    this.elements.categoriesContainer.appendChild(categoryDiv);
  }

  createTabElement(tab) {
    const tabDiv = document.createElement("div");
    tabDiv.className = "tab-item";
    tabDiv.dataset.tabId = tab.id;

    const faviconUrl = tab.favIconUrl || this.getFallbackFavicon(tab.url);
    let title = this.escapeHtml(tab.title || "Loading...");
    let url = this.escapeHtml(this.formatUrl(tab.url));

    if (this.currentSearchQuery) {
      const query = this.currentSearchQuery.toLowerCase();
      const titleLower = title.toLowerCase();
      const urlLower = url.toLowerCase();

      if (titleLower.includes(query)) {
        const regex = new RegExp(`(${this.escapeRegex(query)})`, "gi");
        title = title.replace(
          regex,
          '<mark style="background: #fef08a; padding: 0 2px; border-radius: 2px;">$1</mark>'
        );
      }

      if (urlLower.includes(query)) {
        const regex = new RegExp(`(${this.escapeRegex(query)})`, "gi");
        url = url.replace(
          regex,
          '<mark style="background: #fef08a; padding: 0 2px; border-radius: 2px;">$1</mark>'
        );
      }
    }

    const favicon = document.createElement("img");
    favicon.className = "tab-favicon";
    favicon.src = faviconUrl;
    favicon.alt = "";
    favicon.onerror = () => {
      favicon.src =
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%2364748b" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>';
    };

    const tabInfo = document.createElement("div");
    tabInfo.className = "tab-info";
    tabInfo.innerHTML = `
      <div class="tab-title">${title}</div>
      <div class="tab-url">${url}</div>
    `;

    const tabActions = document.createElement("div");
    tabActions.className = "tab-actions";

    const focusBtn = document.createElement("button");
    focusBtn.className = "tab-action";
    focusBtn.title = "Focus Tab";
    focusBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <circle cx="12" cy="12" r="10"/>
      </svg>
    `;
    focusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.focusTab(tab.id);
    });

    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-action";
    closeBtn.title = "Close Tab";
    closeBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    `;
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeTab(tab.id);
    });

    tabActions.appendChild(focusBtn);
    tabActions.appendChild(closeBtn);

    tabDiv.appendChild(favicon);
    tabDiv.appendChild(tabInfo);
    tabDiv.appendChild(tabActions);

    return tabDiv;
  }

  escapeRegex(string) {
    return string.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\// Main Popup Controller with fixed duplications"
    );
  }

  getFallbackFavicon(url) {
    if (!url)
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%2364748b" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>';

    try {
      const hostname = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;
    } catch {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%2364748b" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>';
    }
  }

  formatUrl(url) {
    if (!url) return "";
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + (urlObj.pathname !== "/" ? urlObj.pathname : "");
    } catch {
      return url;
    }
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async handleRefresh() {
    // Prevent multiple refresh operations
    if (this.isLoading || this.operationInProgress.has("refresh")) {
      return;
    }

    this.operationInProgress.add("refresh");
    console.log("Refreshing tabs...");

    const currentQuery = this.currentSearchQuery;
    this.showLoadingState();

    try {
      await this.loadInitialData();

      if (currentQuery) {
        this.currentSearchQuery = currentQuery;
        if (this.elements.searchInput) {
          this.elements.searchInput.value = currentQuery;
        }
        this.handleSearch(currentQuery);
      } else {
        this.renderTabs();
      }

      if (this.notificationManager && this.initialized) {
        this.notificationManager.success("Tabs refreshed");
      }
    } catch (error) {
      console.error("Refresh failed:", error);
      this.showErrorState("Failed to refresh tabs");
      if (this.notificationManager) {
        this.notificationManager.error("Failed to refresh tabs");
      }
    } finally {
      this.hideLoadingState();
      this.operationInProgress.delete("refresh");
    }
  }

  async handleNewTab() {
    try {
      await chrome.tabs.create({});
      window.close();
    } catch (error) {
      console.error("Failed to create new tab:", error);
      if (this.notificationManager) {
        this.notificationManager.error("Failed to create new tab");
      }
    }
  }

  async handleRetry() {
    this.retryCount = 0;
    await this.loadInitialData();
    this.renderTabs();
  }

  async focusTab(tabId) {
    // Prevent multiple focus operations on same tab
    const operationKey = `focus_${tabId}`;
    if (this.operationInProgress.has(operationKey)) {
      return;
    }

    this.operationInProgress.add(operationKey);

    try {
      await chrome.tabs.update(tabId, { active: true });
      const tab = await chrome.tabs.get(tabId);
      await chrome.windows.update(tab.windowId, { focused: true });

      if (this.notificationManager && this.initialized) {
        this.notificationManager.success("Tab focused", 1500);
      }
      setTimeout(() => window.close(), 500);
    } catch (error) {
      console.error(`Failed to focus tab ${tabId}:`, error);
      if (this.notificationManager) {
        this.notificationManager.error("Failed to focus tab");
      }
    } finally {
      this.operationInProgress.delete(operationKey);
    }
  }

  async closeTab(tabId) {
    // Prevent multiple close operations on same tab
    const operationKey = `close_${tabId}`;
    if (this.operationInProgress.has(operationKey)) {
      return;
    }

    this.operationInProgress.add(operationKey);

    try {
      await chrome.tabs.remove(tabId);

      this.tabs = this.tabs.filter((tab) => tab.id !== tabId);
      this.filteredTabs = this.filteredTabs.filter((tab) => tab.id !== tabId);

      this.updateTabCount(this.filteredTabs.length);
      this.renderTabs();

      if (this.notificationManager && this.initialized) {
        this.notificationManager.success("Tab closed", 1500);
      }
    } catch (error) {
      console.error(`Failed to close tab ${tabId}:`, error);
      if (this.notificationManager) {
        this.notificationManager.error("Failed to close tab");
      }
    } finally {
      this.operationInProgress.delete(operationKey);
    }
  }

  openSettings() {
    if (this.elements.settingsPanel) {
      this.elements.settingsPanel.style.display = "flex";
      setTimeout(() => this.elements.settingsPanel.classList.add("show"), 10);

      const firstInput = this.elements.settingsPanel.querySelector(
        "input, select, button"
      );
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }
  }

  closeSettings() {
    if (this.elements.settingsPanel) {
      this.elements.settingsPanel.classList.remove("show");
      setTimeout(() => {
        this.elements.settingsPanel.style.display = "none";
      }, 300);

      if (this.elements.settingsBtn) {
        this.elements.settingsBtn.focus();
      }
    }
  }
  handleClose() {
    try {
      window.close();
    } catch (error) {
      console.error("Failed to close popup:", error);

      try {
        if (chrome.sidePanel && chrome.sidePanel.close) {
          chrome.sidePanel.close();
        } else if (chrome.action && chrome.action.setPopup) {
          chrome.action.setPopup({ popup: "" });
        }
      } catch (fallbackError) {
        console.error("Fallback close method failed:", fallbackError);

        if (this.notificationManager) {
          this.notificationManager.info("Extension minimized", 2000);
        }
      }
    }
  }

  handleInitializationError(error) {
    console.error("Initialization error:", error);

    this.retryCount++;
    if (this.retryCount < this.maxRetries) {
      console.log(
        `Retrying initialization (${this.retryCount}/${this.maxRetries})`
      );
      setTimeout(() => this.init(), 1000 * this.retryCount);
      return;
    }

    this.showErrorState(
      "Failed to initialize extension. Please refresh the page."
    );
  }

  cleanup() {
    try {
      // Clear all ongoing operations
      this.operationInProgress.clear();

      // Remove all event listeners
      for (const [key, handler] of this.eventHandlers.entries()) {
        if (handler.element && handler.handler) {
          handler.element.removeEventListener(handler.event, handler.handler);
        }
      }
      this.eventHandlers.clear();

      if (this.notificationManager) {
        this.notificationManager.destroy();
      }

      if (this.settingsManager) {
        this.settingsManager.cleanup();
      }

      console.log("PopupController cleanup completed");
    } catch (error) {
      console.error("PopupController cleanup failed:", error);
    }
  }
}

// Initialize - Single instance creation
let popupController;
let initializationInProgress = false;

document.addEventListener("DOMContentLoaded", async () => {
  // Prevent multiple initializations
  if (initializationInProgress || popupController) {
    return;
  }

  initializationInProgress = true;
  console.log("DOM loaded, initializing popup controller");

  popupController = new PopupController();

  try {
    await popupController.init();
    console.log("Popup controller initialized successfully");
  } catch (error) {
    console.error("Failed to initialize popup controller:", error);

    const errorState = document.querySelector("#errorState");
    const errorMessage = document.querySelector("#errorMessage");
    const loadingState = document.querySelector("#loadingState");

    if (loadingState) {
      loadingState.style.display = "none";
      loadingState.classList.remove("show");
    }

    if (errorState) {
      errorState.style.display = "flex";
      errorState.classList.add("show");
      if (errorMessage) {
        errorMessage.textContent =
          "Failed to initialize extension. Please refresh the page.";
      }
    }
  } finally {
    initializationInProgress = false;
  }

  // Global access for debugging only
  if (typeof window !== "undefined") {
    window.popupController = popupController;
  }
});

// Handle already loaded DOM
if (document.readyState !== "loading") {
  setTimeout(() => {
    const event = new Event("DOMContentLoaded");
    document.dispatchEvent(event);
  }, 0);
}

// Cleanup on unload
window.addEventListener("beforeunload", () => {
  if (popupController) {
    popupController.cleanup();
  }
});

// Prevent multiple script executions
if (window.popupControllerLoaded) {
  console.warn("Popup controller script already loaded");
} else {
  window.popupControllerLoaded = true;
}

export { PopupController, NotificationManager, SettingsManager };
export default PopupController;
