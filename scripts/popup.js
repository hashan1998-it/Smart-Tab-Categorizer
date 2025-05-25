class PopupManager {
  constructor() {
    this.tabs = [];
    this.categories = {};
    this.collapsedCategories = new Set();
    this.searchQuery = "";
    this.isLoading = false;

    // DOM elements
    this.setupDOMElements();

    // Event listeners
    this.setupEventListeners();

    // Initialize
    this.init();
  }

  setupDOMElements() {
    this.container = document.querySelector(".container");
    this.tabCount = document.getElementById("tabCount");
    this.searchInput = document.getElementById("searchInput");
    this.refreshBtn = document.getElementById("refreshBtn");
    this.settingsBtn = document.getElementById("settingsBtn");
    this.newTabBtn = document.getElementById("newTabBtn");
    this.retryBtn = document.getElementById("retryBtn");
    this.errorMessage = document.getElementById("errorMessage");
    this.categoriesContainer = document.getElementById("categoriesContainer");
    this.loadingState = document.getElementById("loadingState");
    this.emptyState = document.getElementById("emptyState");
    this.errorState = document.getElementById("errorState");
    this.settingsPanel = document.getElementById("settingsPanel");
    this.closeSettingsBtn = document.getElementById("closeSettingsBtn");
    this.autoOrganize = document.getElementById("autoOrganize");
    this.customRules = document.getElementById("customRules");
    this.ruleCategory = document.getElementById("ruleCategory");
    this.ruleValue = document.getElementById("ruleValue");
    this.addRuleBtn = document.getElementById("addRuleBtn");
  }

  setupEventListeners() {
    this.searchInput.addEventListener("input", () => this.handleSearch());
    this.refreshBtn.addEventListener("click", () => this.handleRefresh());
    this.newTabBtn.addEventListener("click", () => this.handleNewTab());
    this.retryBtn.addEventListener("click", () => this.handleRetry());
    this.settingsBtn.addEventListener("click", () => this.openSettings());
    this.closeSettingsBtn.addEventListener("click", () => this.closeSettings());
    this.autoOrganize.addEventListener("change", () => this.saveSettings());
    this.addRuleBtn.addEventListener("click", () => this.addCustomRule());

    // Drag-and-drop listeners
    this.categoriesContainer.addEventListener("dragstart", (e) => {
      const tabItem = e.target.closest(".tab-item");
      if (tabItem) {
        e.dataTransfer.setData("text/plain", tabItem.dataset.tabId);
        tabItem.classList.add("dragging");
      }
    });

    this.categoriesContainer.addEventListener("dragover", (e) => {
      e.preventDefault(); // Allow drop
    });

    this.categoriesContainer.addEventListener("drop", async (e) => {
      e.preventDefault();
      const tabId = parseInt(e.dataTransfer.getData("text/plain"));
      const target = e.target.closest(".tab-item, .category-section");

      if (!target) return;

      const sourceTab = this.tabs.find((tab) => tab.id === tabId);
      if (!sourceTab) return;

      if (target.classList.contains("tab-item")) {
        const targetTabId = parseInt(target.dataset.tabId);
        const targetTab = this.tabs.find((tab) => tab.id === targetTabId);
        if (sourceTab.category === targetTab.category) {
          await this.reorderTab(tabId, targetTabId);
        }
      } else if (target.classList.contains("category-section")) {
        const newCategory = target.dataset.category;
        await chrome.runtime.sendMessage({
          type: "moveTabs",
          tabIds: [tabId],
          category: newCategory,
        });
        await this.loadTabs();
      }

      document.querySelector(".dragging")?.classList.remove("dragging");
    });

    this.categoriesContainer.addEventListener("dragend", () => {
      document.querySelector(".dragging")?.classList.remove("dragging");
    });
  }

  async init() {
    await this.loadTabs();
  }

  async loadTabs() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoadingState();

    try {
      const response = await chrome.runtime.sendMessage({ type: "getAllTabs" });

      if (response.success) {
        this.tabs = response.data.tabs || [];
        this.categories = response.data.categories || {};
        this.updateUI();
      } else {
        throw new Error(response.error || "Failed to load tabs");
      }
    } catch (error) {
      console.error("❌ Error loading tabs:", error);
      this.showErrorState(error.message);
    } finally {
      this.isLoading = false;
    }
  }

  updateUI() {
    this.tabCount.textContent = this.tabs.length;

    if (this.tabs.length === 0) {
      this.showEmptyState();
      return;
    }

    const filteredTabs = this.filterTabs();
    this.renderCategories(filteredTabs);

    if (filteredTabs.length === 0 && this.searchQuery) {
      this.showEmptyState();
    } else {
      this.showCategories();
    }
  }

  filterTabs() {
    if (!this.searchQuery) return this.tabs;

    const query = this.searchQuery.toLowerCase();
    return this.tabs.filter(
      (tab) =>
        tab.title.toLowerCase().includes(query) ||
        tab.url.toLowerCase().includes(query)
    );
  }

  renderCategories(tabs) {
    this.categoriesContainer.innerHTML = "";

    const categoryOrder = [
      "development",
      "social",
      "productivity",
      "entertainment",
      "shopping",
      "news",
      "reference",
      "other",
    ];

    const categoriesToShow = new Set(tabs.map((tab) => tab.category));

    categoryOrder.forEach((category) => {
      if (categoriesToShow.has(category)) {
        const categoryTabs = tabs
          .filter((tab) => tab.category === category)
          .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

        if (categoryTabs.length > 0) {
          const categoryElement = this.createCategoryElement(
            category,
            categoryTabs
          );
          this.categoriesContainer.appendChild(categoryElement);
        }
      }
    });
  }

  createCategoryElement(category, tabs) {
    const categoryElement = document.createElement("div");
    categoryElement.className = "category-section";
    categoryElement.dataset.category = category;

    const header = this.createCategoryHeader(category, tabs.length);
    const tabList = document.createElement("div");
    tabList.className = `tab-list ${
      this.collapsedCategories.has(category) ? "collapsed" : ""
    }`;

    tabs.forEach((tab) => {
      const tabElement = this.createTabElement(tab);
      tabList.appendChild(tabElement);
    });

    categoryElement.appendChild(header);
    categoryElement.appendChild(tabList);

    return categoryElement;
  }

  createCategoryHeader(category, count) {
    const header = document.createElement("div");
    header.className = `category-header ${
      this.collapsedCategories.has(category) ? "collapsed" : ""
    }`;

    const capitalizedCategory =
      category.charAt(0).toUpperCase() + category.slice(1);
    const emojiMap = {
      development: "💻",
      social: "🌐",
      productivity: "📋",
      entertainment: "🎥",
      shopping: "🛒",
      news: "📰",
      reference: "📚",
      other: "📁",
    };

    header.innerHTML = `
      <div class="category-info">
        <span class="category-icon category-${category}">${
      emojiMap[category] || "📁"
    }</span>
        <span class="category-name">${capitalizedCategory}</span>
        <span class="category-count">${count}</span>
      </div>
      <svg class="category-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 9l6 6 6-6"/>
      </svg>
    `;

    header.addEventListener("click", () => {
      if (this.collapsedCategories.has(category)) {
        this.collapsedCategories.delete(category);
      } else {
        this.collapsedCategories.add(category);
      }
      this.updateUI();
    });

    return header;
  }

  createTabElement(tab) {
    const tabItem = document.createElement("div");
    tabItem.className = "tab-item";
    tabItem.dataset.tabId = tab.id;
    tabItem.draggable = true;

    const faviconUrl = tab.favIconUrl || this.getFallbackFavicon(tab.url);

    tabItem.innerHTML = `
      <img class="tab-favicon" src="${faviconUrl}" alt="">
      <div class="tab-info">
        <div class="tab-title">${this.escapeHtml(
          tab.title || "Loading..."
        )}</div>
        <div class="tab-url">${this.escapeHtml(this.formatUrl(tab.url))}</div>
      </div>
      <div class="tab-actions">
        <select class="tab-category-select" title="Change Category">
          <option value="">Move to...</option>
          <option value="development">Development</option>
          <option value="social">Social</option>
          <option value="productivity">Productivity</option>
          <option value="entertainment">Entertainment</option>
          <option value="shopping">Shopping</option>
          <option value="news">News</option>
          <option value="reference">Reference</option>
          <option value="other">Other</option>
        </select>
        <button class="tab-action" title="Focus Tab" data-action="focus">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <circle cx="12" cy="12" r="10"/>
          </svg>
        </button>
        <button class="tab-action" title="Close Tab" data-action="close">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;

    // Handle favicon error
    const faviconImg = tabItem.querySelector(".tab-favicon");
    faviconImg.addEventListener("error", () => {
      faviconImg.src =
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>';
    });

    // Event listeners
    tabItem.addEventListener("click", (e) => {
      if (!e.target.closest(".tab-action, .tab-category-select")) {
        this.handleTabClick(tab.id);
      }
    });

    const focusBtn = tabItem.querySelector('[data-action="focus"]');
    const closeBtn = tabItem.querySelector('[data-action="close"]');
    const categorySelect = tabItem.querySelector(".tab-category-select");

    focusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleTabFocus(tab.id);
    });

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleTabClose(tab.id);
    });

    categorySelect.addEventListener("change", async (e) => {
      const newCategory = e.target.value;
      if (newCategory) {
        try {
          await chrome.runtime.sendMessage({
            type: "moveTabs",
            tabIds: [tab.id],
            category: newCategory,
          });
          await this.loadTabs();
        } catch (error) {
          console.error("❌ Error moving tab:", error);
        }
      }
    });

    return tabItem;
  }

  async reorderTab(tabId, targetTabId) {
    try {
      const sourceTab = this.tabs.find((tab) => tab.id === tabId);
      const targetTab = this.tabs.find((tab) => tab.id === targetTabId);
      if (!sourceTab || !targetTab || sourceTab.category !== targetTab.category)
        return;

      // Get tabs in the same category, sorted by lastAccessed
      const tabsInCategory = this.tabs
        .filter((tab) => tab.category === sourceTab.category)
        .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

      // Find indices
      const sourceIndex = tabsInCategory.findIndex((tab) => tab.id === tabId);
      const targetIndex = tabsInCategory.findIndex(
        (tab) => tab.id === targetTabId
      );

      // Reorder locally
      const [movedTab] = tabsInCategory.splice(sourceIndex, 1);
      tabsInCategory.splice(targetIndex, 0, movedTab);

      // Update lastAccessed to reflect new order
      tabsInCategory.forEach((tab, index) => {
        tab.lastAccessed = Date.now() - index;
      });

      // Update tabs array
      this.tabs = this.tabs
        .filter((tab) => tab.category !== sourceTab.category)
        .concat(tabsInCategory);

      // Send updated order to background
      await chrome.runtime.sendMessage({
        type: "reorderTabs",
        tabIds: tabsInCategory.map((tab) => tab.id),
        category: sourceTab.category,
      });

      // Refresh UI
      this.updateUI();
    } catch (error) {
      console.error("❌ Error reordering tab:", error);
    }
  }

  async handleSearch() {
    this.searchQuery = this.searchInput.value.trim();
    this.updateUI();
  }

  async handleRefresh() {
    await this.loadTabs();
  }

  async handleNewTab() {
    await chrome.tabs.create({});
    await this.loadTabs();
  }

  async handleRetry() {
    await this.loadTabs();
  }

  async handleTabClick(tabId) {
    await this.handleTabFocus(tabId);
  }

  async handleTabFocus(tabId) {
    try {
      await chrome.runtime.sendMessage({ type: "focusTab", tabId });
      window.close();
    } catch (error) {
      console.error("❌ Error focusing tab:", error);
    }
  }

  async handleTabClose(tabId) {
    try {
      await chrome.runtime.sendMessage({ type: "closeTab", tabId });
      await this.loadTabs();
    } catch (error) {
      console.error("❌ Error closing tab:", error);
    }
  }

  async openSettings() {
    // Show settings panel with animation
    this.settingsPanel.style.display = "flex";
    this.settingsPanel.classList.add("show");
    
    // Hide other elements
    this.categoriesContainer.style.display = "none";
    this.loadingState.style.display = "none";
    this.emptyState.style.display = "none";
    this.errorState.style.display = "none";

    // Load settings
    try {
      const settings = await chrome.storage.local.get([
        "settings",
        "categoryRules",
      ]);
      this.autoOrganize.checked = settings.settings?.autoOrganize ?? true;
      this.renderCustomRules(settings.categoryRules || {});
    } catch (error) {
      console.error("❌ Error loading settings:", error);
    }
  }

  closeSettings() {
    // Hide settings panel with animation
    this.settingsPanel.classList.remove("show");
    setTimeout(() => {
      this.settingsPanel.style.display = "none";
    }, 300);
    
    // Show categories container
    this.categoriesContainer.style.display = "block";
    this.updateUI();
  }

  async saveSettings() {
    try {
      const settings = {
        autoOrganize: this.autoOrganize.checked,
      };
      await chrome.storage.local.set({ settings });
      console.log("✅ Settings saved:", settings);
    } catch (error) {
      console.error("❌ Error saving settings:", error);
    }
  }

  async addCustomRule() {
    const category = this.ruleCategory.value;
    const value = this.ruleValue.value.trim();
    if (!category || !value) return;

    try {
      const settings = await chrome.storage.local.get(["categoryRules"]);
      const categoryRules = settings.categoryRules || {};
      if (!categoryRules[category])
        categoryRules[category] = { domains: [], keywords: [] };

      if (value.includes(".")) {
        categoryRules[category].domains.push(value);
      } else {
        categoryRules[category].keywords.push(value);
      }

      await chrome.storage.local.set({ categoryRules });
      this.ruleValue.value = "";
      this.renderCustomRules(categoryRules);
      await this.loadTabs();
      console.log("✅ Custom rule added:", { category, value });
    } catch (error) {
      console.error("❌ Error adding custom rule:", error);
    }
  }

  renderCustomRules(categoryRules) {
    this.customRules.innerHTML = "";
    Object.entries(categoryRules).forEach(([category, rules]) => {
      rules.domains?.forEach((domain) =>
        this.addRuleElement(category, domain, "domain")
      );
      rules.keywords?.forEach((keyword) =>
        this.addRuleElement(category, keyword, "keyword")
      );
    });
  }

  addRuleElement(category, value, type) {
    const rule = document.createElement("div");
    rule.className = "custom-rule";
    rule.innerHTML = `
      <span>${
        type === "domain" ? "Domain" : "Keyword"
      }: ${value} (${category})</span>
      <button title="Remove Rule">🗑️</button>
    `;
    rule.querySelector("button").addEventListener("click", async () => {
      try {
        const settings = await chrome.storage.local.get(["categoryRules"]);
        const categoryRules = settings.categoryRules || {};
        if (categoryRules[category]) {
          categoryRules[category][type + "s"] = categoryRules[category][
            type + "s"
          ].filter((v) => v !== value);
          if (
            !categoryRules[category].domains.length &&
            !categoryRules[category].keywords.length
          ) {
            delete categoryRules[category];
          }
          await chrome.storage.local.set({ categoryRules });
          this.renderCustomRules(categoryRules);
          await this.loadTabs();
          console.log("✅ Custom rule removed:", { category, value, type });
        }
      } catch (error) {
        console.error("❌ Error removing custom rule:", error);
      }
    });
    this.customRules.appendChild(rule);
  }

  showLoadingState() {
    this.loadingState.style.display = "flex";
    this.categoriesContainer.style.display = "none";
    this.emptyState.style.display = "none";
    this.errorState.style.display = "none";
  }

  showCategories() {
    this.categoriesContainer.style.display = "block";
    this.loadingState.style.display = "none";
    this.emptyState.style.display = "none";
    this.errorState.style.display = "none";
  }

  showEmptyState() {
    this.emptyState.style.display = "flex";
    this.categoriesContainer.style.display = "none";
    this.loadingState.style.display = "none";
    this.errorState.style.display = "none";
  }

  showErrorState(message) {
    this.errorMessage.textContent = message;
    this.errorState.style.display = "flex";
    this.categoriesContainer.style.display = "none";
    this.loadingState.style.display = "none";
    this.emptyState.style.display = "none";
  }

  getFallbackFavicon(url) {
    try {
      const hostname = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}`;
    } catch {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>';
    }
  }

  formatUrl(url) {
    try {
      const { hostname, pathname } = new URL(url);
      return `${hostname}${pathname === "/" ? "" : pathname}`;
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
}

// Initialize the popup
const popup = new PopupManager();