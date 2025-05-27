/**
 * Main popup controller - FIXED VERSION
 * Orchestrates all popup functionality and UI components
 */

import { MESSAGE_TYPES, ERROR_MESSAGES, DEBOUNCE_DELAYS } from '../shared/constants/AppConstants.js';
import debugUtils from '../shared/utils/DebugUtils.js';
import DOMUtils from '../shared/utils/DOMUtils.js';
import ValidationUtils from '../shared/utils/ValidationUtils.js';
import UIStateManager from './managers/UIStateManager.js';
import TabList from './components/TabList.js';
import SearchBar from './components/SearchBar.js';
import SettingsPanel from './components/SettingsPanel.js';
import DragDropManager from './managers/DragDropManager.js';

class PopupController {
  constructor() {
    this.components = new Map();
    this.initialized = false;
    this.isLoading = false;
    this.initializationTimeout = null;
    
    // DOM elements will be set after initialization
    this.elements = {};
    
    debugUtils.info('PopupController: Starting initialization', 'PopupController');
  }

  /**
   * Initialize the popup controller
   */
  async init() {
    try {
      debugUtils.info('Initializing PopupController', 'PopupController');
      
      // Set timeout to prevent infinite loading
      this.initializationTimeout = setTimeout(() => {
        if (!this.initialized) {
          debugUtils.warn('Initialization timeout reached', 'PopupController');
          this.handleInitializationTimeout();
        }
      }, 10000); // 10 second timeout
      
      // Wait for DOM to be ready
      await this.waitForDOM();
      
      // Setup DOM elements
      this.setupDOMElements();
      
      // Show loading state immediately
      this.showLoadingState();
      
      // Initialize UI state manager
      await UIStateManager.init();
      
      // Initialize components
      await this.initializeComponents();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Load initial data
      await this.loadInitialData();
      
      // Clear timeout
      if (this.initializationTimeout) {
        clearTimeout(this.initializationTimeout);
        this.initializationTimeout = null;
      }
      
      this.initialized = true;
      debugUtils.info('PopupController initialized successfully', 'PopupController');
      
    } catch (error) {
      debugUtils.error('Failed to initialize PopupController', 'PopupController', error);
      
      // Clear timeout on error
      if (this.initializationTimeout) {
        clearTimeout(this.initializationTimeout);
        this.initializationTimeout = null;
      }
      
      this.showErrorState(error.message || ERROR_MESSAGES.INIT_FAILED);
    }
  }

  /**
   * Handle initialization timeout
   */
  handleInitializationTimeout() {
    debugUtils.warn('Initialization timed out, attempting recovery', 'PopupController');
    
    // Try to load tabs directly as fallback
    this.loadTabsDirectly().then(() => {
      this.initialized = true;
      UIStateManager.setLoading(false);
    }).catch(error => {
      debugUtils.error('Recovery failed', 'PopupController', error);
      this.showErrorState('Extension took too long to load. Please try refreshing.');
    });
  }

  /**
   * Wait for DOM to be ready
   */
  waitForDOM() {
    return new Promise((resolve) => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
  }

  /**
   * Setup DOM element references
   */
  setupDOMElements() {
    this.elements = {
      // Main containers
      container: DOMUtils.querySelector('.container'),
      categoriesContainer: DOMUtils.querySelector('#categoriesContainer'),
      
      // Header elements
      tabCount: DOMUtils.querySelector('#tabCount'),
      refreshBtn: DOMUtils.querySelector('#refreshBtn'),
      settingsBtn: DOMUtils.querySelector('#settingsBtn'),
      
      // Search elements
      searchInput: DOMUtils.querySelector('#searchInput'),
      searchClear: DOMUtils.querySelector('#searchClear'),
      
      // State elements
      loadingState: DOMUtils.querySelector('#loadingState'),
      emptyState: DOMUtils.querySelector('#emptyState'),
      errorState: DOMUtils.querySelector('#errorState'),
      errorMessage: DOMUtils.querySelector('#errorMessage'),
      
      // Action buttons
      newTabBtn: DOMUtils.querySelector('#newTabBtn'),
      retryBtn: DOMUtils.querySelector('#retryBtn'),
      
      // Settings panel
      settingsPanel: DOMUtils.querySelector('#settingsPanel'),
      closeSettingsBtn: DOMUtils.querySelector('#closeSettingsBtn')
    };

    // Validate required elements
    const requiredElements = [
      'container', 'categoriesContainer', 'tabCount', 
      'loadingState', 'errorState', 'searchInput'
    ];

    const missingElements = requiredElements.filter(key => !this.elements[key]);
    if (missingElements.length > 0) {
      throw new Error(`Missing required DOM elements: ${missingElements.join(', ')}`);
    }

    debugUtils.debug('DOM elements setup completed', 'PopupController');
  }

  /**
   * Initialize all components
   */
  async initializeComponents() {
    try {
      // Initialize search bar
      if (this.elements.searchInput) {
        const searchBar = new SearchBar(this.elements.searchInput);
        await searchBar.init();
        this.components.set('searchBar', searchBar);
        
        // Setup search clear button
        if (this.elements.searchClear) {
          this.elements.searchClear.addEventListener('click', () => {
            searchBar.clearSearch();
          });
        }
      }

      // Initialize tab list
      const tabList = new TabList(this.elements.categoriesContainer);
      await tabList.init();
      this.components.set('tabList', tabList);

      // Initialize settings panel
      if (this.elements.settingsPanel) {
        const settingsPanel = new SettingsPanel(this.elements.settingsPanel);
        await settingsPanel.init();
        this.components.set('settingsPanel', settingsPanel);
      }

      // Initialize drag and drop manager
      const dragDropManager = new DragDropManager(this.elements.categoriesContainer);
      await dragDropManager.init();
      this.components.set('dragDropManager', dragDropManager);

      debugUtils.debug('All components initialized', 'PopupController');
    } catch (error) {
      debugUtils.error('Failed to initialize components', 'PopupController', error);
      // Don't throw error - continue with basic functionality
      debugUtils.warn('Continuing with basic functionality', 'PopupController');
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    try {
      // Refresh button
      if (this.elements.refreshBtn) {
        this.elements.refreshBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleRefresh();
        });
      }

      // Settings button
      if (this.elements.settingsBtn) {
        this.elements.settingsBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.openSettings();
        });
      }

      // Close settings button
      if (this.elements.closeSettingsBtn) {
        this.elements.closeSettingsBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.closeSettings();
        });
      }

      // New tab button
      if (this.elements.newTabBtn) {
        this.elements.newTabBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleNewTab();
        });
      }

      // Retry button
      if (this.elements.retryBtn) {
        this.elements.retryBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleRetry();
        });
      }

      // State manager subscriptions
      this.setupStateSubscriptions();

      // Background message listener
      this.setupMessageListener();

      debugUtils.debug('Event listeners setup completed', 'PopupController');
    } catch (error) {
      debugUtils.error('Failed to setup event listeners', 'PopupController', error);
    }
  }

  /**
   * Setup state manager subscriptions
   */
  setupStateSubscriptions() {
    // Subscribe to loading state changes
    UIStateManager.subscribe((updates) => {
      if ('isLoading' in updates) {
        this.updateLoadingState(updates.isLoading);
      }
    }, ['isLoading']);

    // Subscribe to error state changes
    UIStateManager.subscribe((updates) => {
      if ('error' in updates) {
        if (updates.error) {
          this.showErrorState(updates.error);
        } else {
          this.hideErrorState();
        }
      }
    }, ['error']);

    // Subscribe to tabs data changes
    UIStateManager.subscribe((updates) => {
      if ('tabs' in updates || 'categories' in updates || 'totalCount' in updates) {
        this.updateUI();
      }
    }, ['tabs', 'categories', 'totalCount']);

    // Subscribe to search query changes
    UIStateManager.subscribe((updates) => {
      if ('searchQuery' in updates) {
        this.updateSearchResults();
      }
    }, ['searchQuery']);
  }

  /**
   * Setup background message listener
   */
  setupMessageListener() {
    try {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === MESSAGE_TYPES.BACKGROUND_EVENT) {
          this.handleBackgroundEvent(message.eventType, message.data);
        }
      });
    } catch (error) {
      debugUtils.warn('Failed to setup message listener', 'PopupController', error);
    }
  }

  /**
   * Handle background events
   */
  handleBackgroundEvent(eventType, data) {
    debugUtils.debug(`Received background event: ${eventType}`, 'PopupController', data);

    switch (eventType) {
      case MESSAGE_TYPES.TAB_CREATED:
      case MESSAGE_TYPES.TAB_UPDATED:
      case MESSAGE_TYPES.TAB_REMOVED:
      case MESSAGE_TYPES.TABS_MOVED:
      case MESSAGE_TYPES.TABS_REORDERED:
        // Refresh data when tabs change
        this.loadTabsData();
        break;
    }
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      // Set loading state
      UIStateManager.setLoading(true);
      
      // Try to connect to background script first
      await this.waitForBackground();
      
      // Load tabs data
      await this.loadTabsData();
      
    } catch (error) {
      debugUtils.error('Failed to load initial data', 'PopupController', error);
      // Try direct loading as fallback
      await this.loadTabsDirectly();
    } finally {
      // Always clear loading state
      UIStateManager.setLoading(false);
    }
  }

  /**
   * Wait for background script to be ready
   */
  async waitForBackground(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`Checking background script (attempt ${i + 1}/${maxRetries})`);
        
        const response = await Promise.race([
          chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PING }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);
        
        if (response && response.success) {
          console.log('✅ Background script is ready');
          return;
        }
      } catch (error) {
        console.log(`Background not ready yet (attempt ${i + 1}):`, error.message);
      }
      
      // Wait before retrying
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Don't throw error - proceed with direct tab loading
    console.warn('Background script not ready, will use direct tab loading');
  }

  /**
   * Load tabs data from background
   */
  async loadTabsData() {
    if (this.isLoading) {
      console.log('Already loading tabs, skipping...');
      return;
    }

    this.isLoading = true;

    try {
      console.log('Loading tabs from background...');
      
      const response = await Promise.race([
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_ALL_TABS }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 5000))
      ]);
      
      console.log('Response received:', response);

      if (response && response.success && response.data) {
        UIStateManager.setTabsData(response.data);
        console.log(`✅ Loaded ${response.data.tabs?.length || 0} tabs from background`);
      } else {
        throw new Error(response?.error || 'Invalid response from background');
      }
    } catch (error) {
      console.error('Failed to load tabs from background:', error);
      // Fallback: get tabs directly
      await this.loadTabsDirectly();
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Fallback method to load tabs directly
   */
  async loadTabsDirectly() {
    try {
      console.log('Loading tabs directly from Chrome API...');
      
      const chromeTabs = await chrome.tabs.query({});
      
      const tabs = chromeTabs.map(tab => ({
        id: tab.id,
        title: tab.title || 'Loading...',
        url: tab.url || '',
        favIconUrl: tab.favIconUrl || '',
        active: tab.active || false,
        pinned: tab.pinned || false,
        windowId: tab.windowId,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        category: this.simpleCategorizeTab(tab)
      }));

      const categories = {};
      tabs.forEach(tab => {
        const category = tab.category || 'other';
        categories[category] = (categories[category] || 0) + 1;
      });

      UIStateManager.setTabsData({
        tabs,
        categories,
        totalCount: tabs.length
      });

      console.log(`✅ Loaded ${tabs.length} tabs directly`);
    } catch (error) {
      console.error('Failed to load tabs directly:', error);
      UIStateManager.setError('Failed to load tabs');
      throw error;
    }
  }

  /**
   * Simple tab categorization fallback
   */
  simpleCategorizeTab(tab) {
    if (!tab.url) return 'other';
    
    const url = tab.url.toLowerCase();
    const title = (tab.title || '').toLowerCase();
    
    if (url.includes('github.com') || url.includes('stackoverflow.com')) return 'development';
    if (url.includes('youtube.com') || url.includes('netflix.com')) return 'entertainment';
    if (url.includes('twitter.com') || url.includes('facebook.com')) return 'social';
    if (url.includes('docs.google.com') || url.includes('notion.so')) return 'productivity';
    if (url.includes('amazon.com') || url.includes('shop')) return 'shopping';
    if (url.includes('news') || url.includes('cnn.com')) return 'news';
    if (url.includes('wikipedia.org') || title.includes('tutorial')) return 'reference';
    
    return 'other';
  }

  /**
   * Update UI based on current state
   */
  updateUI() {
    const state = UIStateManager.getState();
    
    // Update tab count
    if (this.elements.tabCount) {
      this.elements.tabCount.textContent = state.totalCount || 0;
    }

    // Handle empty state
    if (state.tabs.length === 0 && !state.isLoading) {
      this.showEmptyState();
      return;
    }

    // Update components
    const tabList = this.components.get('tabList');
    if (tabList) {
      tabList.render(state.tabs, state.categories);
    }
    
    // Show categories if we have data
    if (state.tabs.length > 0) {
      this.showCategories();
    }
  }

  /**
   * Update search results
   */
  updateSearchResults() {
    const filteredTabs = UIStateManager.getFilteredTabs();
    const state = UIStateManager.getState();
    
    if (filteredTabs.length === 0 && state.searchQuery) {
      this.showEmptyState();
    } else {
      const tabList = this.components.get('tabList');
      if (tabList) {
        tabList.render(filteredTabs, state.categories);
      }
      this.showCategories();
    }
  }

  /**
   * Update loading state
   */
  updateLoadingState(isLoading) {
    if (isLoading) {
      this.showLoadingState();
    } else {
      this.hideLoadingState();
    }
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    this.showState('loading');
  }

  /**
   * Hide loading state
   */
  hideLoadingState() {
    // Only hide loading if we're not currently loading
    if (!this.isLoading && !UIStateManager.get('isLoading')) {
      this.updateUI();
    }
  }

  /**
   * Show categories
   */
  showCategories() {
    this.showState('categories');
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    this.showState('empty');
  }

  /**
   * Show error state
   */
  showErrorState(message) {
    if (this.elements.errorMessage) {
      this.elements.errorMessage.textContent = message;
    }
    this.showState('error');
  }

  /**
   * Hide error state
   */
  hideErrorState() {
    this.updateUI();
  }

  /**
   * Show specific state
   */
  showState(state) {
    const states = {
      loading: this.elements.loadingState,
      empty: this.elements.emptyState,
      error: this.elements.errorState,
      categories: this.elements.categoriesContainer
    };

    // Hide all states
    Object.values(states).forEach(element => {
      if (element) {
        element.style.display = 'none';
      }
    });

    // Show requested state
    const targetElement = states[state];
    if (targetElement) {
      targetElement.style.display = state === 'categories' ? 'block' : 'flex';
    }
  }

  /**
   * Handle refresh button click
   */
  async handleRefresh() {
    debugUtils.info('Refresh button clicked', 'PopupController');
    
    try {
      // Disable refresh button to prevent multiple clicks
      if (this.elements.refreshBtn) {
        this.elements.refreshBtn.disabled = true;
      }
      
      UIStateManager.setLoading(true);
      UIStateManager.clearError();
      
      // Try background first, then fallback to direct
      try {
        const response = await Promise.race([
          chrome.runtime.sendMessage({ type: MESSAGE_TYPES.REFRESH_TABS }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        
        if (response && response.success) {
          UIStateManager.setTabsData(response.data);
        } else {
          throw new Error(response?.error || 'Refresh failed');
        }
      } catch (error) {
        console.warn('Background refresh failed, trying direct:', error);
        await this.loadTabsDirectly();
      }
      
    } catch (error) {
      debugUtils.error('Failed to refresh', 'PopupController', error);
      UIStateManager.setError(error.message);
    } finally {
      UIStateManager.setLoading(false);
      
      // Re-enable refresh button
      if (this.elements.refreshBtn) {
        this.elements.refreshBtn.disabled = false;
      }
    }
  }

  /**
   * Handle new tab button click
   */
  async handleNewTab() {
    try {
      await chrome.tabs.create({});
      // Close popup after creating new tab
      window.close();
    } catch (error) {
      debugUtils.error('Failed to create new tab', 'PopupController', error);
    }
  }

  /**
   * Handle retry button click
   */
  async handleRetry() {
    UIStateManager.clearError();
    await this.loadInitialData();
  }

  /**
   * Open settings panel
   */
  openSettings() {
    debugUtils.info('Opening settings panel', 'PopupController');
    
    try {
      UIStateManager.setView('settings');
      const settingsPanel = this.components.get('settingsPanel');
      
      if (settingsPanel) {
        settingsPanel.show();
      } else {
        // Fallback: manually show settings panel
        if (this.elements.settingsPanel) {
          this.elements.settingsPanel.style.display = 'flex';
          this.elements.settingsPanel.classList.add('show');
        }
      }
    } catch (error) {
      debugUtils.error('Failed to open settings', 'PopupController', error);
    }
  }

  /**
   * Close settings panel
   */
  closeSettings() {
    debugUtils.info('Closing settings panel', 'PopupController');
    
    try {
      UIStateManager.setView('categories');
      const settingsPanel = this.components.get('settingsPanel');
      
      if (settingsPanel) {
        settingsPanel.hide();
      } else {
        // Fallback: manually hide settings panel
        if (this.elements.settingsPanel) {
          this.elements.settingsPanel.classList.remove('show');
          setTimeout(() => {
            this.elements.settingsPanel.style.display = 'none';
          }, 300);
        }
      }
    } catch (error) {
      debugUtils.error('Failed to close settings', 'PopupController', error);
    }
  }

  /**
   * Focus a specific tab
   */
  async focusTab(tabId) {
    try {
      const validation = ValidationUtils.validateNumberRange(tabId, 1, Number.MAX_SAFE_INTEGER, 'Tab ID');
      if (!validation.valid) {
        throw new Error(validation.errors[0]);
      }

      await chrome.runtime.sendMessage({ 
        type: MESSAGE_TYPES.FOCUS_TAB, 
        tabId 
      });
      
      // Close popup after focusing tab
      window.close();
    } catch (error) {
      debugUtils.error(`Failed to focus tab ${tabId}`, 'PopupController', error);
      UIStateManager.setError(ERROR_MESSAGES.FOCUS_TAB_FAILED);
    }
  }

  /**
   * Close a specific tab
   */
  async closeTab(tabId) {
    try {
      const validation = ValidationUtils.validateNumberRange(tabId, 1, Number.MAX_SAFE_INTEGER, 'Tab ID');
      if (!validation.valid) {
        throw new Error(validation.errors[0]);
      }

      await chrome.runtime.sendMessage({ 
        type: MESSAGE_TYPES.CLOSE_TAB, 
        tabId 
      });
      
      // Refresh data after closing tab
      await this.loadTabsData();
    } catch (error) {
      debugUtils.error(`Failed to close tab ${tabId}`, 'PopupController', error);
      UIStateManager.setError(ERROR_MESSAGES.CLOSE_TAB_FAILED);
    }
  }

  /**
   * Move tabs to a different category
   */
  async moveTabs(tabIds, category) {
    try {
      const tabIdsValidation = ValidationUtils.validateTabIds(tabIds);
      const categoryValidation = ValidationUtils.validateCategory(category);
      
      if (!tabIdsValidation.valid) {
        throw new Error(tabIdsValidation.errors[0]);
      }
      
      if (!categoryValidation.valid) {
        throw new Error(categoryValidation.errors[0]);
      }

      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.MOVE_TABS,
        tabIds: tabIdsValidation.sanitized,
        category
      });
      
      // Refresh data after moving tabs
      await this.loadTabsData();
    } catch (error) {
      debugUtils.error('Failed to move tabs', 'PopupController', error);
      UIStateManager.setError('Failed to move tabs');
    }
  }

  /**
   * Get popup metrics for debugging
   */
  getMetrics() {
    return {
      initialized: this.initialized,
      isLoading: this.isLoading,
      componentsCount: this.components.size,
      components: Array.from(this.components.keys()),
      uiState: UIStateManager.getMetrics(),
      elements: Object.keys(this.elements).length
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    try {
      // Clear timeout
      if (this.initializationTimeout) {
        clearTimeout(this.initializationTimeout);
        this.initializationTimeout = null;
      }
      
      // Cleanup components
      this.components.forEach(component => {
        if (typeof component.cleanup === 'function') {
          component.cleanup();
        }
      });
      this.components.clear();

      // Cleanup UI state manager
      UIStateManager.cleanup();

      debugUtils.info('PopupController cleanup completed', 'PopupController');
    } catch (error) {
      debugUtils.error('PopupController cleanup failed', 'PopupController', error);
    }
  }
}

// Initialize the popup when DOM is ready
const popupController = new PopupController();

// Add error handling for initialization
popupController.init().catch(error => {
  console.error('Failed to initialize popup controller:', error);
  
  // Show basic error message if possible
  const errorState = document.querySelector('#errorState');
  const errorMessage = document.querySelector('#errorMessage');
  const loadingState = document.querySelector('#loadingState');
  
  if (loadingState) loadingState.style.display = 'none';
  if (errorState) {
    errorState.style.display = 'flex';
    if (errorMessage) {
      errorMessage.textContent = 'Failed to initialize extension. Please refresh the page.';
    }
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  popupController.cleanup();
});

// Export for debugging
window.popupController = popupController;