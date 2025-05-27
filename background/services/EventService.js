/**
 * Browser event management service
 * Handles all Chrome extension events with proper lifecycle management
 */

import { MESSAGE_TYPES } from '../../shared/constants/AppConstants.js';
import debugUtils from '../../shared/utils/DebugUtils.js';
import TabManager from '../managers/TabManager.js';
import MessageService from './MessageService.js';

class EventService {
  constructor() {
    this.listeners = new Map();
    this.initialized = false;
    this.eventStats = {
      tabsCreated: 0,
      tabsUpdated: 0,
      tabsRemoved: 0,
      tabsActivated: 0,
      windowsFocused: 0,
      actionClicks: 0
    };
  }

  /**
   * Initialize event service
   */
  init() {
    try {
      debugUtils.info('Initializing EventService', 'EventService');
      
      this.setupTabEventListeners();
      this.setupWindowEventListeners();
      this.setupActionEventListeners();
      this.setupInstallEventListeners();
      
      this.initialized = true;
      debugUtils.info('EventService initialized successfully', 'EventService');
    } catch (error) {
      debugUtils.error('Failed to initialize EventService', 'EventService', error);
      throw error;
    }
  }

  /**
   * Setup tab-related event listeners
   */
  setupTabEventListeners() {
    // Tab created
    const onTabCreated = async (tab) => {
      try {
        debugUtils.debug(`Tab created: ${tab.url}`, 'EventService');
        this.eventStats.tabsCreated++;
        
        const tabData = await TabManager.handleTabCreated(tab);
        await MessageService.notifyUI(MESSAGE_TYPES.TAB_CREATED, { tab: tabData });
      } catch (error) {
        debugUtils.error('Error handling tab created event', 'EventService', error);
      }
    };

    // Tab updated
    const onTabUpdated = async (tabId, changeInfo, tab) => {
      try {
        // Only process when tab is completely loaded
        if (changeInfo.status === 'complete') {
          debugUtils.debug(`Tab updated: ${tab.url}`, 'EventService');
          this.eventStats.tabsUpdated++;
          
          const tabData = await TabManager.handleTabUpdated(tabId, tab);
          await MessageService.notifyUI(MESSAGE_TYPES.TAB_UPDATED, { tab: tabData });
        }
      } catch (error) {
        debugUtils.error('Error handling tab updated event', 'EventService', error);
      }
    };

    // Tab removed
    const onTabRemoved = async (tabId, removeInfo) => {
      try {
        debugUtils.debug(`Tab removed: ${tabId}`, 'EventService');
        this.eventStats.tabsRemoved++;
        
        const tabData = await TabManager.handleTabRemoved(tabId);
        if (tabData) {
          await MessageService.notifyUI(MESSAGE_TYPES.TAB_REMOVED, { 
            tabId, 
            tab: tabData,
            removeInfo 
          });
        }
      } catch (error) {
        debugUtils.error('Error handling tab removed event', 'EventService', error);
      }
    };

    // Tab activated (switched to)
    const onTabActivated = async (activeInfo) => {
      try {
        debugUtils.debug(`Tab activated: ${activeInfo.tabId}`, 'EventService');
        this.eventStats.tabsActivated++;
        
        await TabManager.handleTabActivated(activeInfo.tabId);
      } catch (error) {
        debugUtils.error('Error handling tab activated event', 'EventService', error);
      }
    };

    // Register listeners and store references for cleanup
    chrome.tabs.onCreated.addListener(onTabCreated);
    chrome.tabs.onUpdated.addListener(onTabUpdated);
    chrome.tabs.onRemoved.addListener(onTabRemoved);
    chrome.tabs.onActivated.addListener(onTabActivated);

    this.listeners.set('tabCreated', onTabCreated);
    this.listeners.set('tabUpdated', onTabUpdated);
    this.listeners.set('tabRemoved', onTabRemoved);
    this.listeners.set('tabActivated', onTabActivated);

    debugUtils.debug('Tab event listeners registered', 'EventService');
  }

  /**
   * Setup window-related event listeners
   */
  setupWindowEventListeners() {
    // Window focus changed
    const onWindowFocusChanged = async (windowId) => {
      try {
        if (windowId !== chrome.windows.WINDOW_ID_NONE) {
          debugUtils.debug(`Window focused: ${windowId}`, 'EventService');
          this.eventStats.windowsFocused++;
          
          // Could be used for future window-based organization
          // For now, just track the event
        }
      } catch (error) {
        debugUtils.error('Error handling window focus event', 'EventService', error);
      }
    };

    chrome.windows.onFocusChanged.addListener(onWindowFocusChanged);
    this.listeners.set('windowFocusChanged', onWindowFocusChanged);

    debugUtils.debug('Window event listeners registered', 'EventService');
  }

  /**
   * Setup action (toolbar button) event listeners
   */
  setupActionEventListeners() {
    // Action button clicked
    const onActionClicked = async (tab) => {
      try {
        debugUtils.debug('Extension action clicked', 'EventService');
        this.eventStats.actionClicks++;
        
        // Open side panel for the current window
        await chrome.sidePanel.open({ windowId: tab.windowId });
      } catch (error) {
        debugUtils.error('Error opening side panel', 'EventService', error);
        
        // Fallback: try to open popup
        try {
          await chrome.action.openPopup();
        } catch (popupError) {
          debugUtils.error('Failed to open popup as fallback', 'EventService', popupError);
        }
      }
    };

    chrome.action.onClicked.addListener(onActionClicked);
    this.listeners.set('actionClicked', onActionClicked);

    debugUtils.debug('Action event listeners registered', 'EventService');
  }

  /**
   * Setup installation and startup event listeners
   */
  setupInstallEventListeners() {
    // Extension installed/updated
    const onInstalled = async (details) => {
      try {
        debugUtils.info(`Extension ${details.reason}`, 'EventService', details);
        
        if (details.reason === 'install') {
          await this.handleFirstInstall();
        } else if (details.reason === 'update') {
          await this.handleUpdate(details.previousVersion);
        }
      } catch (error) {
        debugUtils.error('Error handling install event', 'EventService', error);
      }
    };

    // Browser startup
    const onStartup = async () => {
      try {
        debugUtils.info('Browser started, reinitializing extension', 'EventService');
        
        // Reinitialize managers
        await TabManager.init();
        
        // Clean up any stale data
        await TabManager.cleanupStaleTabs();
      } catch (error) {
        debugUtils.error('Error handling startup event', 'EventService', error);
      }
    };

    chrome.runtime.onInstalled.addListener(onInstalled);
    chrome.runtime.onStartup.addListener(onStartup);

    this.listeners.set('installed', onInstalled);
    this.listeners.set('startup', onStartup);

    debugUtils.debug('Install/startup event listeners registered', 'EventService');
  }

  /**
   * Handle first installation
   */
  async handleFirstInstall() {
    try {
      debugUtils.info('Handling first install', 'EventService');
      
      // Set default settings (handled by StorageManager initialization)
      
      // Enable side panel for all windows
      try {
        await chrome.sidePanel.setPanelBehavior({ 
          openPanelOnActionClick: true 
        });
        debugUtils.info('Side panel behavior configured', 'EventService');
      } catch (error) {
        debugUtils.warn('Failed to configure side panel behavior', 'EventService', error);
      }
      
      // Optional: Show welcome notification
      if (chrome.notifications) {
        try {
          await chrome.notifications.create({
            type: 'basic',
            iconUrl: '/icons/icon-48.png',
            title: 'Smart Tab Organizer Installed!',
            message: 'Click the extension icon to start organizing your tabs.'
          });
        } catch (error) {
          debugUtils.debug('Failed to show welcome notification', 'EventService', error);
        }
      }
      
    } catch (error) {
      debugUtils.error('Failed to handle first install', 'EventService', error);
    }
  }

  /**
   * Handle extension update
   */
  async handleUpdate(previousVersion) {
    try {
      debugUtils.info(`Handling update from ${previousVersion}`, 'EventService');
      
      // Perform any necessary data migrations
      await this.performDataMigration(previousVersion);
      
      // Refresh tab data to ensure consistency
      await TabManager.refreshAllTabs();
      
    } catch (error) {
      debugUtils.error('Failed to handle update', 'EventService', error);
    }
  }

  /**
   * Perform data migration between versions
   */
  async performDataMigration(fromVersion) {
    try {
      debugUtils.info(`Performing data migration from ${fromVersion}`, 'EventService');
      
      // Add migration logic here as needed for future versions
      // For now, just ensure data consistency
      
      debugUtils.info('Data migration completed', 'EventService');
    } catch (error) {
      debugUtils.error('Data migration failed', 'EventService', error);
    }
  }

  /**
   * Add custom event listener
   */
  addEventListener(eventName, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }

    const listeners = this.listeners.get(eventName);
    if (Array.isArray(listeners)) {
      listeners.push(callback);
    } else {
      // Convert single listener to array
      this.listeners.set(eventName, [listeners, callback]);
    }

    debugUtils.debug(`Added custom event listener: ${eventName}`, 'EventService');

    // Return unsubscribe function
    return () => {
      this.removeEventListener(eventName, callback);
    };
  }

  /**
   * Remove custom event listener
   */
  removeEventListener(eventName, callback) {
    const listeners = this.listeners.get(eventName);
    if (!listeners) return false;

    if (Array.isArray(listeners)) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
        if (listeners.length === 0) {
          this.listeners.delete(eventName);
        }
        return true;
      }
    } else if (listeners === callback) {
      this.listeners.delete(eventName);
      return true;
    }

    return false;
  }

  /**
   * Trigger custom event
   */
  async triggerEvent(eventName, data = {}) {
    const listeners = this.listeners.get(eventName);
    if (!listeners) return;

    try {
      const listenersArray = Array.isArray(listeners) ? listeners : [listeners];
      
      await Promise.allSettled(
        listenersArray.map(listener => {
          try {
            return listener(data);
          } catch (error) {
            debugUtils.error(`Event listener error: ${eventName}`, 'EventService', error);
          }
        })
      );

      debugUtils.debug(`Triggered event: ${eventName}`, 'EventService', data);
    } catch (error) {
      debugUtils.error(`Failed to trigger event: ${eventName}`, 'EventService', error);
    }
  }

  /**
   * Get event statistics
   */
  getEventStats() {
    return {
      ...this.eventStats,
      totalEvents: Object.values(this.eventStats).reduce((sum, count) => sum + count, 0),
      listenersCount: this.listeners.size
    };
  }

  /**
   * Reset event statistics
   */
  resetEventStats() {
    Object.keys(this.eventStats).forEach(key => {
      this.eventStats[key] = 0;
    });
    debugUtils.info('Event statistics reset', 'EventService');
  }

  /**
   * Check if service is initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Cleanup method
   */
  cleanup() {
    try {
      // Note: Chrome extension event listeners are automatically cleaned up
      // when the service worker terminates, but we can clear our references
      this.listeners.clear();
      this.resetEventStats();
      
      debugUtils.info('EventService cleanup completed', 'EventService');
    } catch (error) {
      debugUtils.error('EventService cleanup failed', 'EventService', error);
    }
  }
}

// Create singleton instance
export default new EventService();