// Background service worker for Smart Tab Organizer
// Handles tab events, categorization, and state management

class TabManager {
  constructor() {
    this.tabs = new Map();
    this.categories = new Map();
    this.isInitialized = false;

    this.init();
  }

  async init() {
    console.log("🚀 Smart Tab Organizer: Initializing background service worker");

    try {
      // Load any existing tab data first
      await this.loadTabData();
      
      // Set up event listeners
      this.setupEventListeners();

      // Initialize with current tabs
      await this.refreshAllTabs();

      this.isInitialized = true;
      console.log("✅ Smart Tab Organizer: Initialization complete");
    } catch (error) {
      console.error("❌ Error during initialization:", error);
      this.isInitialized = false;
    }
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

    // Handle action button click to open side panel
    chrome.action.onClicked.addListener(async (tab) => {
      try {
        // Open side panel for the current window
        await chrome.sidePanel.open({ windowId: tab.windowId });
      } catch (error) {
        console.error("Error opening side panel:", error);
      }
    });

    // Handle messages from popup/sidebar
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  async handleTabCreated(tab) {
    const tabData = await this.createTabData(tab);
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
        ...(await this.createTabData(tab)),
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
    console.log("🔍 Window focused:", windowId);
    // Could be used for future window-based organization
  }

  async handleMessage(message, sender, sendResponse) {
    console.log("📨 Received message:", message.type);

    try {
      // Ensure we're initialized before handling requests
      if (!this.isInitialized && message.type !== "ping") {
        console.log("⏳ Not initialized yet, initializing...");
        await this.init();
      }

      switch (message.type) {
        case "ping":
          sendResponse({ success: true, initialized: this.isInitialized });
          break;

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

        case "reorderTabs":
          await this.reorderTabs(message.tabIds, message.category);
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

  async createTabData(tab) {
    const existingTab = this.tabs.get(tab.id);
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
        : existingTab?.lastAccessed || Date.now(),
      accessCount: existingTab?.accessCount || 0,
      category: existingTab?.category || (await this.categorizeTab(tab)), // Preserve manual category
    };
  }

  async refreshAllTabs() {
    console.log("🔄 Refreshing all tabs...");

    try {
      const currentTabs = await chrome.tabs.query({});
      const newTabsMap = new Map();

      for (const tab of currentTabs) {
        const tabData = await this.createTabData(tab);
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
    return Promise.all(tabs.map(async (tab) => ({
      ...tab,
      category: await this.categorizeTab(tab),
    })));
  }

  async categorizeTab(tab) {
    if (!tab.url || !tab.title) return "other";

    const url = tab.url.toLowerCase();
    const title = tab.title.toLowerCase();
    const hostname = new URL(tab.url).hostname;

    // Load custom rules
    const { categoryRules: customRules = {} } = await chrome.storage.local.get(["categoryRules"]);

    const defaultRules = {
      development: {
        domains: [
          "github.com",
          "stackoverflow.com",
          "developer.mozilla.org",
          "codepen.io",
          "gitlab.com",
          "bitbucket.org",
          "dev.to",
        ],
        keywords: [
          "api",
          "documentation",
          "code",
          "programming",
          "developer",
          "tutorial",
          "debug",
        ],
        weight: 1.0,
      },
      social: {
        domains: [
          "twitter.com",
          "facebook.com",
          "linkedin.com",
          "instagram.com",
          "reddit.com",
          "discord.com",
          "tiktok.com",
        ],
        keywords: ["social", "post", "feed", "follow", "chat", "messenger"],
        weight: 0.9,
      },
      productivity: {
        domains: [
          "google.com/drive",
          "docs.google.com",
          "notion.so",
          "trello.com",
          "slack.com",
          "zoom.us",
          "asana.com",
          "monday.com",
        ],
        keywords: ["task", "project", "document", "meeting", "calendar", "email"],
        weight: 0.8,
      },
      entertainment: {
        domains: [
          "youtube.com",
          "netflix.com",
          "spotify.com",
          "twitch.tv",
          "hulu.com",
          "disneyplus.com",
        ],
        keywords: ["video", "music", "stream", "movie", "series", "podcast"],
        weight: 0.7,
      },
      shopping: {
        domains: [
          "amazon.com",
          "ebay.com",
          "etsy.com",
          "walmart.com",
          "target.com",
          "aliexpress.com",
        ],
        keywords: ["shop", "store", "cart", "checkout", "buy", "order"],
        weight: 0.6,
      },
      news: {
        domains: [
          "cnn.com",
          "bbc.com",
          "reuters.com",
          "nytimes.com",
          "theguardian.com",
          "news.google.com",
        ],
        keywords: ["news", "breaking", "latest", "article", "report"],
        weight: 0.6,
      },
      reference: {
        domains: ["wikipedia.org", "britannica.com", "scholar.google.com"],
        keywords: [
          "wiki",
          "reference",
          "tutorial",
          "how to",
          "guide",
          "research",
          "study",
        ],
        weight: 0.6,
      },
      other: {
        domains: [],
        keywords: [],
        weight: 0.1,
      },
    };

    // Merge custom and default rules
    const mergedRules = { ...defaultRules };
    Object.entries(customRules).forEach(([category, custom]) => {
      if (!mergedRules[category]) {
        mergedRules[category] = { domains: [], keywords: [], weight: 0.6 };
      }
      mergedRules[category].domains = [
        ...(mergedRules[category].domains || []),
        ...(custom.domains || []),
      ];
      mergedRules[category].keywords = [
        ...(mergedRules[category].keywords || []),
        ...(custom.keywords || []),
      ];
    });

    let maxScore = 0;
    let bestCategory = "other";
    const keywordThreshold = 2;

    Object.entries(mergedRules).forEach(([category, rules]) => {
      let score = 0;

      // Domain matching
      if (rules.domains.some((domain) => hostname.includes(domain))) {
        score += rules.weight * 2; // Domains are strong indicators
      }

      // Keyword matching in URL and title
      const keywordMatches = rules.keywords.filter(
        (keyword) => url.includes(keyword) || title.includes(keyword)
      ).length;
      score += (keywordMatches / keywordThreshold) * rules.weight;

      // Boost for frequently accessed tabs
      if (tab.accessCount > 3) {
        score += 0.2;
      }

      if (score > maxScore) {
        maxScore = score;
        bestCategory = category;
      }
    });

    return maxScore > 0.5 ? bestCategory : "other";
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

  async reorderTabs(tabIds, category) {
    try {
      // Update tab order in local state
      const tabsInCategory = Array.from(this.tabs.values())
        .filter((tab) => tab.category === category)
        .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

      // Reorder based on provided tabIds
      const orderedTabs = tabIds
        .map((id) => tabsInCategory.find((tab) => tab.id === id))
        .filter(Boolean);

      // Update lastAccessed to reflect new order
      orderedTabs.forEach((tab, index) => {
        tab.lastAccessed = Date.now() - index;
        this.tabs.set(tab.id, tab);
      });

      await this.saveTabData();
      this.notifyPopup("tabsReordered", { tabIds, category });
    } catch (error) {
      console.error("❌ Error reordering tabs:", error);
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

    // Enable side panel for all windows
    try {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    } catch (error) {
      console.error("Error setting panel behavior:", error);
    }
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log("🔄 Browser started, initializing Smart Tab Organizer...");
});