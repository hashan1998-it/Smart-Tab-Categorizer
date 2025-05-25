// Smart Tab Organizer - Popup Interface Logic

class PopupManager {
  constructor() {
    this.tabs = [];
    this.categories = {};
    this.filteredTabs = [];
    this.collapsedCategories = new Set();

    this.init();
  }

  async init() {
    console.log("🎨 Initializing popup interface...");

    // Set up DOM elements
    this.setupDOMElements();

    // Set up event listeners
    this.setupEventListeners();

    // Load initial data
    await this.loadTabs();

    console.log("✅ Popup interface ready");
  }

  setupDOMElements() {
    // Main containers
    this.loadingState = document.getElementById("loadingState");
    this.categoriesContainer = document.getElementById("categoriesContainer");
    this.emptyState = document.getElementById("emptyState");
    this.errorState = document.getElementById("errorState");

    // Header elements
    this.totalTabsSpan = document.getElementById("totalTabs");
    this.refreshBtn = document.getElementById("refreshBtn");
    this.settingsBtn = document.getElementById("settingsBtn");

    // Search
    this.searchInput = document.getElementById("searchInput");

    // Action buttons
    this.retryBtn = document.getElementById("retryBtn");
  }

  setupEventListeners() {
    // Header actions
    this.refreshBtn.addEventListener("click", () => this.handleRefresh());
    this.settingsBtn.addEventListener("click", () => this.handleSettings());

    // Search
    this.searchInput.addEventListener("input", (e) =>
      this.handleSearch(e.target.value)
    );
    this.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.handleSearchEnter();
      }
    });

    // Retry button
    this.retryBtn.addEventListener("click", () => this.loadTabs());

    // Listen for background events
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "backgroundEvent") {
        this.handleBackgroundEvent(message);
      }
    });
  }

  async loadTabs() {
    try {
      this.showLoadingState();

      console.log("📡 Requesting tabs from background...");

      const response = await chrome.runtime.sendMessage({ type: "getAllTabs" });

      if (response.success) {
        this.tabs = response.data.tabs;
        this.categories = response.data.categories;
        this.filteredTabs = [...this.tabs];

        console.log(
          `📋 Loaded ${this.tabs.length} tabs in ${
            Object.keys(this.categories).length
          } categories`
        );

        this.updateUI();
      } else {
        throw new Error(response.error || "Failed to load tabs");
      }
    } catch (error) {
      console.error("❌ Error loading tabs:", error);
      this.showErrorState();
    }
  }

  updateUI() {
    // Update tab count
    this.totalTabsSpan.textContent = this.tabs.length;

    if (this.tabs.length === 0) {
      this.showEmptyState();
    } else {
      this.renderCategories();
      this.showCategoriesContainer();
    }
  }

  renderCategories() {
    // Group filtered tabs by category
    const groupedTabs = this.groupTabsByCategory(this.filteredTabs);

    // Clear existing content
    this.categoriesContainer.innerHTML = "";

    // Render each category
    Object.entries(groupedTabs).forEach(([categoryName, categoryTabs]) => {
      const categoryElement = this.createCategoryElement(
        categoryName,
        categoryTabs
      );
      this.categoriesContainer.appendChild(categoryElement);
    });
  }

  groupTabsByCategory(tabs) {
    const grouped = {};

    tabs.forEach((tab) => {
      const category = tab.category || "other";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(tab);
    });

    // Sort tabs within each category by last accessed (most recent first)
    Object.values(grouped).forEach((categoryTabs) => {
      categoryTabs.sort(
        (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)
      );
    });

    return grouped;
  }

  createCategoryElement(categoryName, tabs) {
    const categorySection = document.createElement("div");
    categorySection.className = "category-section";
    categorySection.dataset.category = categoryName;

    // Category header
    const header = this.createCategoryHeader(categoryName, tabs.length);
    categorySection.appendChild(header);

    // Tab list
    const tabList = this.createTabList(tabs);
    categorySection.appendChild(tabList);

    return categorySection;
  }

  createCategoryHeader(categoryName, tabCount) {
    const header = document.createElement("div");
    header.className = "category-header";

    if (this.collapsedCategories.has(categoryName)) {
      header.classList.add("collapsed");
    }

    header.innerHTML = `
            <div class="category-info">
                <div class="category-icon category-${categoryName}">
                    ${this.getCategoryIcon(categoryName)}
                </div>
                <span class="category-name">${this.getCategoryDisplayName(
                  categoryName
                )}</span>
                <span class="category-count">${tabCount}</span>
            </div>
            <div class="category-toggle">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
            </div>
        `;

    // Add click handler for collapse/expand
    header.addEventListener("click", () => this.toggleCategory(categoryName));

    return header;
  }

  createTabList(tabs) {
    const tabList = document.createElement("div");
    tabList.className = "tab-list";

    if (this.collapsedCategories.has(tabs[0]?.category)) {
      tabList.classList.add("collapsed");
    }

    tabs.forEach((tab) => {
      const tabElement = this.createTabElement(tab);
      tabList.appendChild(tabElement);
    });

    return tabList;
  }

  createTabElement(tab) {
    const tabItem = document.createElement("div");
    tabItem.className = "tab-item";
    tabItem.dataset.tabId = tab.id;

    const faviconUrl = tab.favIconUrl || this.getFallbackFavicon(tab.url);

    tabItem.innerHTML = `
      <img class="tab-favicon" src="${faviconUrl}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2364748b%22 stroke-width=%222%22><circle cx=%2212%22 cy=%2212%22 r=%223%22/></svg>'">
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
          await this.loadTabs(); // Refresh UI
        } catch (error) {
          console.error("❌ Error moving tab:", error);
        }
      }
    });

    return tabItem;
  }

  // Event Handlers
  async handleRefresh() {
    console.log("🔄 Refreshing tabs...");
    await this.loadTabs();
  }

  handleSettings() {
    console.log("⚙️ Opening settings...");
    // TODO: Implement settings panel
    alert("Settings panel coming soon!");
  }

  handleSearch(query) {
    const searchTerm = query.toLowerCase().trim();

    if (searchTerm === "") {
      this.filteredTabs = [...this.tabs];
    } else {
      this.filteredTabs = this.tabs.filter(
        (tab) =>
          (tab.title || "").toLowerCase().includes(searchTerm) ||
          (tab.url || "").toLowerCase().includes(searchTerm)
      );
    }

    this.renderCategories();
  }

  handleSearchEnter() {
    // Focus first visible tab if any
    const firstTab = this.filteredTabs[0];
    if (firstTab) {
      this.handleTabFocus(firstTab.id);
    }
  }

  async handleTabClick(tabId) {
    await this.handleTabFocus(tabId);
  }

  async handleTabFocus(tabId) {
    try {
      await chrome.runtime.sendMessage({
        type: "focusTab",
        tabId: tabId,
      });
      // Close popup after focusing tab
      window.close();
    } catch (error) {
      console.error("❌ Error focusing tab:", error);
    }
  }

  async handleTabClose(tabId) {
    try {
      await chrome.runtime.sendMessage({
        type: "closeTab",
        tabId: tabId,
      });

      // Remove from local state
      this.tabs = this.tabs.filter((tab) => tab.id !== tabId);
      this.filteredTabs = this.filteredTabs.filter((tab) => tab.id !== tabId);

      // Update UI
      this.updateUI();
    } catch (error) {
      console.error("❌ Error closing tab:", error);
    }
  }

  toggleCategory(categoryName) {
    const categorySection = document.querySelector(
      `[data-category="${categoryName}"]`
    );
    const header = categorySection.querySelector(".category-header");
    const tabList = categorySection.querySelector(".tab-list");

    if (this.collapsedCategories.has(categoryName)) {
      // Expand
      this.collapsedCategories.delete(categoryName);
      header.classList.remove("collapsed");
      tabList.classList.remove("collapsed");
    } else {
      // Collapse
      this.collapsedCategories.add(categoryName);
      header.classList.add("collapsed");
      tabList.classList.add("collapsed");
    }
  }

  handleBackgroundEvent(message) {
    console.log("📨 Background event:", message.eventType);

    switch (message.eventType) {
      case "tabCreated":
      case "tabUpdated":
      case "tabRemoved":
        // Refresh the view
        this.loadTabs();
        break;
    }
  }

  // UI State Management
  showLoadingState() {
    this.loadingState.style.display = "flex";
    this.categoriesContainer.style.display = "none";
    this.emptyState.style.display = "none";
    this.errorState.style.display = "none";
  }

  showCategoriesContainer() {
    this.loadingState.style.display = "none";
    this.categoriesContainer.style.display = "block";
    this.emptyState.style.display = "none";
    this.errorState.style.display = "none";
  }

  showEmptyState() {
    this.loadingState.style.display = "none";
    this.categoriesContainer.style.display = "none";
    this.emptyState.style.display = "flex";
    this.errorState.style.display = "none";
  }

  showErrorState() {
    this.loadingState.style.display = "none";
    this.categoriesContainer.style.display = "none";
    this.emptyState.style.display = "none";
    this.errorState.style.display = "flex";
  }

  // Helper Methods
  getCategoryIcon(category) {
    const icons = {
      development: "💻",
      social: "👥",
      productivity: "📊",
      entertainment: "🎬",
      shopping: "🛒",
      news: "📰",
      reference: "📚",
      other: "📄",
    };
    return icons[category] || icons.other;
  }

  getCategoryDisplayName(category) {
    const names = {
      development: "Development",
      social: "Social Media",
      productivity: "Productivity",
      entertainment: "Entertainment",
      shopping: "Shopping",
      news: "News",
      reference: "Reference",
      other: "Other",
    };
    return names[category] || "Other";
  }

  getFallbackFavicon(url) {
    if (!url) return "";

    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
      return "";
    }
  }

  formatUrl(url) {
    if (!url) return "";

    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname;
    } catch {
      return url;
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize popup when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const popupManager = new PopupManager();
});
