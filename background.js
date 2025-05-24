// Background service worker for Smart Tab Organizer
// Handles tab events and maintains state

class TabManager {
  constructor() {
    this.tabs = new Map();
    this.categories = new Map();
    this.isInitialized = false;

    this.init();
  }

  async init() {
    console.log(
      "🚀 Smart Tab Organizer: Initializing background service worker"
    );

    // Set up event listeners
    this.setupEventListeners();

    // Initialize with current tabs
    await this.refreshAllTabs();

    this.isInitialized = true;
    console.log("✅ Smart Tab Organizer: Initialization complete");
  }

  setupEventListeners() {
    // Tab created
    chrome.tabs.onCreated.addListener((tab) => {
      console.log("📝 Tab created:", tab.url);
      this.handleTabCreated(tab);
    });

    // Tab updated (URL or title changed)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete") {
        console.log("🔄 Tab updated:", tab.url);
        this.handleTabUpdated(tabId, tab);
      }
    });

    // Tab removed
    chrome.tabs.onRemoved.addListener((tabId) => {
      console.log("🗑️ Tab removed:", tabId);
      this.handleTabRemoved(tabId);
    });

    // Tab activated (switched to)
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivated(activeInfo.tabId);
    });

    // Window focus changed
    chrome.windows.onFocusChanged.addListener((windowId) => {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        this.handleWindowFocused(windowId);
      }
    });

    // Handle messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  async handleTabCreated(tab) {
    const tabData = this.createTabData(tab);
    this.tabs.set(tab.id, tabData);

    // Save to storage
    await this.saveTabData();

    // Notify popup if open
    this.notifyPopup("tabCreated", { tab: tabData });
  }

  async handleTabUpdated(tabId, tab) {
    if (this.tabs.has(tabId)) {
      const existingTab = this.tabs.get(tabId);
      const updatedTab = {
        ...existingTab,
        ...this.createTabData(tab),
        lastAccessed: existingTab.lastAccessed, // Preserve access time
      };

      this.tabs.set(tabId, updatedTab);
      await this.saveTabData();
      this.notifyPopup("tabUpdated", { tab: updatedTab });
    } else {
      // New tab that wasn't caught by onCreated
      await this.handleTabCreated(tab);
    }
  }

  async handleTabRemoved(tabId) {
    if (this.tabs.has(tabId)) {
      const tabData = this.tabs.get(tabId);
      this.tabs.delete(tabId);

      await this.saveTabData();
      this.notifyPopup("tabRemoved", { tabId, tab: tabData });
    }
  }

  async handleTabActivated(tabId) {
    if (this.tabs.has(tabId)) {
      const tabData = this.tabs.get(tabId);
      tabData.lastAccessed = Date.now();
      tabData.accessCount = (tabData.accessCount || 0) + 1;

      this.tabs.set(tabId, tabData);
      await this.saveTabData();
    }
  }

  handleWindowFocused(windowId) {
    // Could be used for future features like window-based organization
    console.log("🔍 Window focused:", windowId);
  }

  async handleMessage(message, sender, sendResponse) {
    console.log("📨 Received message:", message.type);

    try {
      switch (message.type) {
        case "getAllTabs":
          const allTabs = await this.getAllTabsWithCategories();
          sendResponse({ success: true, data: allTabs });
          break;

        case "refreshTabs":
          await this.refreshAllTabs();
          const refreshedTabs = await this.getAllTabsWithCategories();
          sendResponse({ success: true, data: refreshedTabs });
          break;

        case "focusTab":
          await this.focusTab(message.tabId);
          sendResponse({ success: true });
          break;

        case "closeTab":
          await this.closeTab(message.tabId);
          sendResponse({ success: true });
          break;

        case "moveTabs":
          await this.moveTabs(message.tabIds, message.category);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (error) {
      console.error("❌ Error handling message:", error);
      sendResponse({ success: false, error: error.message });
    }
  }

  createTabData(tab) {
    return {
      id: tab.id,
      title: tab.title || "Loading...",
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || "",
      active: tab.active || false,
      pinned: tab.pinned || false,
      windowId: tab.windowId,
      createdAt: Date.now(),
      lastAccessed: tab.active
        ? Date.now()
        : this.tabs.get(tab.id)?.lastAccessed || Date.now(),
      accessCount: this.tabs.get(tab.id)?.accessCount || 0,
      category: this.tabs.get(tab.id)?.category || "uncategorized",
    };
  }

  async refreshAllTabs() {
    console.log("🔄 Refreshing all tabs...");

    try {
      const currentTabs = await chrome.tabs.query({});
      const newTabsMap = new Map();

      for (const tab of currentTabs) {
        const tabData = this.createTabData(tab);
        newTabsMap.set(tab.id, tabData);
      }

      this.tabs = newTabsMap;
      await this.saveTabData();

      console.log(`✅ Refreshed ${this.tabs.size} tabs`);
    } catch (error) {
      console.error("❌ Error refreshing tabs:", error);
    }
  }

  async getAllTabsWithCategories() {
    const tabsArray = Array.from(this.tabs.values());
    const categorizedTabs = await this.categorizeTabs(tabsArray);

    return {
      tabs: categorizedTabs,
      categories: this.getCategoryStats(categorizedTabs),
      totalCount: tabsArray.length,
    };
  }

  async categorizeTabs(tabs) {
    // This is a placeholder for the AI categorization logic
    // For now, we'll use simple rule-based categorization
    return tabs.map((tab) => ({
      ...tab,
      category: this.categorizeTab(tab),
    }));
  }

  categorizeTab(tab) {
    if (!tab.url) return "other";

    const url = tab.url.toLowerCase();
    const title = (tab.title || "").toLowerCase();

    // Development
    if (
      url.includes("github.com") ||
      url.includes("stackoverflow.com") ||
      url.includes("developer.mozilla.org") ||
      url.includes("codepen.io") ||
      title.includes("api") ||
      title.includes("documentation")
    ) {
      return "development";
    }

    // Social Media
    if (
      url.includes("twitter.com") ||
      url.includes("facebook.com") ||
      url.includes("linkedin.com") ||
      url.includes("instagram.com") ||
      url.includes("reddit.com") ||
      url.includes("discord.com")
    ) {
      return "social";
    }

    // Productivity
    if (
      url.includes("google.com/drive") ||
      url.includes("docs.google.com") ||
      url.includes("notion.so") ||
      url.includes("trello.com") ||
      url.includes("slack.com") ||
      url.includes("zoom.us")
    ) {
      return "productivity";
    }

    // Entertainment
    if (
      url.includes("youtube.com") ||
      url.includes("netflix.com") ||
      url.includes("spotify.com") ||
      url.includes("twitch.tv") ||
      url.includes("music.") ||
      title.includes("video")
    ) {
      return "entertainment";
    }

    // Shopping
    if (
      url.includes("amazon.com") ||
      url.includes("ebay.com") ||
      url.includes("shop") ||
      url.includes("store") ||
      url.includes("cart") ||
      url.includes("checkout")
    ) {
      return "shopping";
    }

    // News
    if (
      url.includes("news") ||
      url.includes("cnn.com") ||
      url.includes("bbc.com") ||
      url.includes("reuters.com") ||
      title.includes("breaking") ||
      title.includes("latest")
    ) {
      return "news";
    }

    // Reference
    if (
      url.includes("wikipedia.org") ||
      url.includes("wiki") ||
      url.includes("reference") ||
      url.includes("tutorial") ||
      title.includes("how to") ||
      title.includes("guide")
    ) {
      return "reference";
    }

    return "other";
  }

  getCategoryStats(tabs) {
    const stats = {};

    tabs.forEach((tab) => {
      const category = tab.category || "other";
      stats[category] = (stats[category] || 0) + 1;
    });

    return stats;
  }

  async focusTab(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      await chrome.tabs.update(tabId, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });

      // Update access tracking
      if (this.tabs.has(tabId)) {
        const tabData = this.tabs.get(tabId);
        tabData.lastAccessed = Date.now();
        tabData.accessCount = (tabData.accessCount || 0) + 1;
        this.tabs.set(tabId, tabData);
        await this.saveTabData();
      }
    } catch (error) {
      console.error("❌ Error focusing tab:", error);
      throw error;
    }
  }

  async closeTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
      // The onRemoved listener will handle cleanup
    } catch (error) {
      console.error("❌ Error closing tab:", error);
      throw error;
    }
  }

  async moveTabs(tabIds, category) {
    try {
      for (const tabId of tabIds) {
        if (this.tabs.has(tabId)) {
          const tabData = this.tabs.get(tabId);
          tabData.category = category;
          this.tabs.set(tabId, tabData);
        }
      }

      await this.saveTabData();
      this.notifyPopup("tabsMoved", { tabIds, category });
    } catch (error) {
      console.error("❌ Error moving tabs:", error);
      throw error;
    }
  }

  async saveTabData() {
    try {
      const tabsData = Object.fromEntries(this.tabs);
      await chrome.storage.local.set({
        tabs: tabsData,
        lastUpdated: Date.now(),
      });
    } catch (error) {
      console.error("❌ Error saving tab data:", error);
    }
  }

  async loadTabData() {
    try {
      const result = await chrome.storage.local.get(["tabs"]);
      if (result.tabs) {
        this.tabs = new Map(Object.entries(result.tabs));
        console.log(`📂 Loaded ${this.tabs.size} tabs from storage`);
      }
    } catch (error) {
      console.error("❌ Error loading tab data:", error);
    }
  }

  notifyPopup(eventType, data) {
    // Try to send message to popup if it's open
    chrome.runtime
      .sendMessage({
        type: "backgroundEvent",
        eventType,
        data,
      })
      .catch(() => {
        // Popup is not open, ignore error
      });
  }
}

// Initialize the tab manager
const tabManager = new TabManager();

// Handle extension installation/startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("🎯 Smart Tab Organizer installed/updated:", details.reason);

  if (details.reason === "install") {
    // First time installation
    console.log("🎉 Welcome to Smart Tab Organizer!");

    // Set default settings
    await chrome.storage.local.set({
      settings: {
        autoOrganize: true,
        showNotifications: true,
        theme: "light",
        categorization: "auto",
      },
    });
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log("🔄 Browser started, initializing Smart Tab Organizer...");
});
