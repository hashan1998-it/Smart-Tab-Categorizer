/**
 * Core tab lifecycle management
 * Handles tab creation, updates, removal, and state management
 */

import { LIMITS, ERROR_MESSAGES } from '../../shared/constants/AppConstants.js';
import debugUtils from '../../shared/utils/DebugUtils.js';
import StorageManager from './StorageManager.js';
import CategoryManager from './CategoryManager.js';

class TabManager {
  constructor() {
    this.tabs = new Map();
    this.initialized = false;
    this.isRefreshing = false;
    
    // Performance tracking
    this.metrics = {
      tabsCreated: 0,
      tabsUpdated: 0,
      tabsRemoved: 0,
      categorizedTabs: 0
    };
  }

  /**
   * Initialize tab manager
   */
  async init() {
    try {
      debugUtils.info('Initializing TabManager', 'TabManager');
      
      // Load existing tab data
      await this.loadTabData();
      
      // Initialize with current browser tabs
      await this.refreshAllTabs();
      
      this.initialized = true;
      debugUtils.info('TabManager initialized successfully', 'TabManager', {
        tabCount: this.tabs.size
      });
    } catch (error) {
      debugUtils.error('Failed to initialize TabManager', 'TabManager', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Load tab data from storage
   */
  async loadTabData() {
    try {
      const tabsMap = await StorageManager.getTabs();
      this.tabs = tabsMap;
      
      debugUtils.info(`Loaded ${this.tabs.size} tabs from storage`, 'TabManager');
    } catch (error) {
      debugUtils.error('Failed to load tab data', 'TabManager', error);
      this.tabs = new Map();
    }
  }

  /**
   * Save tab data to storage
   */
  async saveTabData(immediate = false) {
    try {
      await StorageManager.setTabs(this.tabs, immediate);
      debugUtils.debug(`Saved ${this.tabs.size} tabs to storage`, 'TabManager');
    } catch (error) {
      debugUtils.error('Failed to save tab data', 'TabManager', error);
      throw error;
    }
  }

  /**
   * Create tab data structure
   */
  async createTabData(chromeTab) {
    const existingTab = this.tabs.get(chromeTab.id);
    const now = Date.now();
    
    const tabData = {
      id: chromeTab.id,
      title: chromeTab.title || 'Loading...',
      url: chromeTab.url || '',
      favIconUrl: chromeTab.favIconUrl || '',
      active: chromeTab.active || false,
      pinned: chromeTab.pinned || false,
      windowId: chromeTab.windowId,
      createdAt: existingTab?.createdAt || now,
      lastAccessed: chromeTab.active ? now : (existingTab?.lastAccessed || now),
      accessCount: existingTab?.accessCount || 0,
      category: existingTab?.category || await CategoryManager.categorizeTab(chromeTab)
    };

    return tabData;
  }

  /**
   * Handle tab creation
   */
  async handleTabCreated(chromeTab) {
    try {
      debugUtils.info(`Tab created: ${chromeTab.url}`, 'TabManager');
      
      const tabData = await this.createTabData(chromeTab);
      this.tabs.set(chromeTab.id, tabData);
      
      await this.saveTabData();
      this.metrics.tabsCreated++;
      
      return tabData;
    } catch (error) {
      debugUtils.error('Failed to handle tab creation', 'TabManager', error);
      throw error;
    }
  }

  /**
   * Handle tab updates
   */
  async handleTabUpdated(tabId, chromeTab) {
    try {
      debugUtils.debug(`Tab updated: ${chromeTab.url}`, 'TabManager');
      
      if (this.tabs.has(tabId)) {
        const existingTab = this.tabs.get(tabId);
        const updatedTab = {
          ...existingTab,
          ...(await this.createTabData(chromeTab)),
          lastAccessed: existingTab.lastAccessed, // Preserve access time unless active
          createdAt: existingTab.createdAt // Preserve creation time
        };

        this.tabs.set(tabId, updatedTab);
        this.metrics.tabsUpdated++;
      } else {
        // New tab that wasn't caught by onCreated
        await this.handleTabCreated(chromeTab);
      }
      
      await this.saveTabData();
      return this.tabs.get(tabId);
    } catch (error) {
      debugUtils.error('Failed to handle tab update', 'TabManager', error);
      throw error;
    }
  }

  /**
   * Handle tab removal
   */
  async handleTabRemoved(tabId) {
    try {
      debugUtils.info(`Tab removed: ${tabId}`, 'TabManager');
      
      const tabData = this.tabs.get(tabId);
      if (tabData) {
        this.tabs.delete(tabId);
        await this.saveTabData();
        this.metrics.tabsRemoved++;
        return tabData;
      }
      
      return null;
    } catch (error) {
      debugUtils.error('Failed to handle tab removal', 'TabManager', error);
      throw error;
    }
  }

  /**
   * Handle tab activation (focus)
   */
  async handleTabActivated(tabId) {
    try {
      if (this.tabs.has(tabId)) {
        const tabData = this.tabs.get(tabId);
        tabData.lastAccessed = Date.now();
        tabData.accessCount = (tabData.accessCount || 0) + 1;
        
        this.tabs.set(tabId, tabData);
        await this.saveTabData();
        
        debugUtils.debug(`Tab activated: ${tabData.title}`, 'TabManager');
      }
    } catch (error) {
      debugUtils.error('Failed to handle tab activation', 'TabManager', error);
    }
  }

  /**
   * Refresh all tabs from browser
   */
  async refreshAllTabs() {
    if (this.isRefreshing) {
      debugUtils.warn('Refresh already in progress', 'TabManager');
      return;
    }

    this.isRefreshing = true;
    
    try {
      debugUtils.info('Refreshing all tabs', 'TabManager');
      const startTime = debugUtils.startTimer('Refresh All Tabs');
      
      const currentTabs = await chrome.tabs.query({});
      const newTabsMap = new Map();
      
      // Process tabs in parallel but limit concurrency
      const batchSize = 10;
      for (let i = 0; i < currentTabs.length; i += batchSize) {
        const batch = currentTabs.slice(i, i + batchSize);
        const tabDataPromises = batch.map(tab => this.createTabData(tab));
        const tabDataResults = await Promise.all(tabDataPromises);
        
        batch.forEach((tab, index) => {
          newTabsMap.set(tab.id, tabDataResults[index]);
        });
      }
      
      this.tabs = newTabsMap;
      await this.saveTabData(true); // Immediate save for refresh
      
      debugUtils.endTimer('Refresh All Tabs', startTime);
      debugUtils.info(`Refreshed ${this.tabs.size} tabs`, 'TabManager');
    } catch (error) {
      debugUtils.error('Failed to refresh tabs', 'TabManager', error);
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Get all tabs with categories
   */
  async getAllTabsWithCategories() {
    try {
      const tabsArray = Array.from(this.tabs.values());
      const categorizedTabs = await CategoryManager.categorizeTabs(tabsArray);
      
      return {
        tabs: categorizedTabs,
        categories: CategoryManager.getCategoryStats(categorizedTabs),
        totalCount: tabsArray.length,
        metrics: this.getMetrics()
      };
    } catch (error) {
      debugUtils.error('Failed to get tabs with categories', 'TabManager', error);
      throw error;
    }
  }

  /**
   * Focus a specific tab
   */
  async focusTab(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      await chrome.tabs.update(tabId, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      
      // Update access tracking
      await this.handleTabActivated(tabId);
      
      debugUtils.info(`Focused tab: ${tab.title}`, 'TabManager');
    } catch (error) {
      debugUtils.error(`Failed to focus tab ${tabId}`, 'TabManager', error);
      throw new Error(ERROR_MESSAGES.FOCUS_TAB_FAILED);
    }
  }

  /**
   * Close a specific tab
   */
  async closeTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
      // The onRemoved listener will handle cleanup
      debugUtils.info(`Closed tab: ${tabId}`, 'TabManager');
    } catch (error) {
      debugUtils.error(`Failed to close tab ${tabId}`, 'TabManager', error);
      throw new Error(ERROR_MESSAGES.CLOSE_TAB_FAILED);
    }
  }

  /**
   * Move tabs to a different category
   */
  async moveTabs(tabIds, category) {
    try {
      let movedCount = 0;
      
      for (const tabId of tabIds) {
        if (this.tabs.has(tabId)) {
          const tabData = this.tabs.get(tabId);
          tabData.category = category;
          tabData.lastAccessed = Date.now(); // Update access time
          this.tabs.set(tabId, tabData);
          movedCount++;
        }
      }
      
      if (movedCount > 0) {
        await this.saveTabData();
        debugUtils.info(`Moved ${movedCount} tabs to ${category}`, 'TabManager');
      }
      
      return movedCount;
    } catch (error) {
      debugUtils.error('Failed to move tabs', 'TabManager', error);
      throw error;
    }
  }

  /**
   * Reorder tabs within a category
   */
  async reorderTabs(tabIds, category) {
    try {
      // Get tabs in the specified category
      const tabsInCategory = Array.from(this.tabs.values())
        .filter(tab => tab.category === category)
        .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

      // Reorder based on provided tabIds
      const orderedTabs = tabIds
        .map(id => tabsInCategory.find(tab => tab.id === id))
        .filter(Boolean);

      if (orderedTabs.length === 0) return;

      // Update lastAccessed to reflect new order
      const baseTime = Date.now();
      orderedTabs.forEach((tab, index) => {
        tab.lastAccessed = baseTime - index;
        this.tabs.set(tab.id, tab);
      });

      await this.saveTabData();
      debugUtils.info(`Reordered ${orderedTabs.length} tabs in ${category}`, 'TabManager');
    } catch (error) {
      debugUtils.error('Failed to reorder tabs', 'TabManager', error);
      throw error;
    }
  }

  /**
   * Get tabs by category
   */
  getTabsByCategory(category) {
    return Array.from(this.tabs.values())
      .filter(tab => tab.category === category);
  }

  /**
   * Get tabs by window
   */
  getTabsByWindow(windowId) {
    return Array.from(this.tabs.values())
      .filter(tab => tab.windowId === windowId);
  }

  /**
   * Search tabs by title or URL
   */
  searchTabs(query) {
    if (!query) return Array.from(this.tabs.values());
    
    const lowerQuery = query.toLowerCase();
    return Array.from(this.tabs.values())
      .filter(tab => 
        tab.title.toLowerCase().includes(lowerQuery) ||
        tab.url.toLowerCase().includes(lowerQuery)
      );
  }

  /**
   * Get recently accessed tabs
   */
  getRecentTabs(limit = 10) {
    return Array.from(this.tabs.values())
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))
      .slice(0, limit);
  }

  /**
   * Get most accessed tabs
   */
  getMostAccessedTabs(limit = 10) {
    return Array.from(this.tabs.values())
      .sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0))
      .slice(0, limit);
  }

  /**
   * Clean up stale tabs (tabs that no longer exist in browser)
   */
  async cleanupStaleTabs() {
    try {
      const currentTabs = await chrome.tabs.query({});
      const currentTabIds = new Set(currentTabs.map(tab => tab.id));
      
      let removedCount = 0;
      for (const [tabId] of this.tabs) {
        if (!currentTabIds.has(tabId)) {
          this.tabs.delete(tabId);
          removedCount++;
        }
      }
      
      if (removedCount > 0) {
        await this.saveTabData();
        debugUtils.info(`Cleaned up ${removedCount} stale tabs`, 'TabManager');
      }
      
      return removedCount;
    } catch (error) {
      debugUtils.error('Failed to cleanup stale tabs', 'TabManager', error);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      totalTabs: this.tabs.size,
      categorizedTabs: Array.from(this.tabs.values())
        .filter(tab => tab.category && tab.category !== 'other').length,
      averageAccessCount: this.calculateAverageAccessCount(),
      oldestTab: this.getOldestTab(),
      newestTab: this.getNewestTab()
    };
  }

  /**
   * Calculate average access count
   */
  calculateAverageAccessCount() {
    const tabs = Array.from(this.tabs.values());
    if (tabs.length === 0) return 0;
    
    const totalAccess = tabs.reduce((sum, tab) => sum + (tab.accessCount || 0), 0);
    return Math.round(totalAccess / tabs.length * 100) / 100;
  }

  /**
   * Get oldest tab
   */
  getOldestTab() {
    const tabs = Array.from(this.tabs.values());
    return tabs.reduce((oldest, tab) => 
      (!oldest || (tab.createdAt < oldest.createdAt)) ? tab : oldest, null
    );
  }

  /**
   * Get newest tab
   */
  getNewestTab() {
    const tabs = Array.from(this.tabs.values());
    return tabs.reduce((newest, tab) => 
      (!newest || (tab.createdAt > newest.createdAt)) ? tab : newest, null
    );
  }

  /**
   * Export tabs data
   */
  exportTabs() {
    return {
      tabs: Array.from(this.tabs.values()),
      exportDate: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  /**
   * Get tab by ID
   */
  getTabById(tabId) {
    return this.tabs.get(tabId);
  }

  /**
   * Check if manager is ready
   */
  isReady() {
    return this.initialized && !this.isRefreshing;
  }

  /**
   * Cleanup method
   */
  async cleanup() {
    try {
      await StorageManager.flushPendingSaves();
      debugUtils.info('TabManager cleanup completed', 'TabManager');
    } catch (error) {
      debugUtils.error('TabManager cleanup failed', 'TabManager', error);
    }
  }
}

// Create singleton instance
export default new TabManager();