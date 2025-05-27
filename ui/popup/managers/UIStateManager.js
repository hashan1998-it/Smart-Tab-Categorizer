/**
 * UI State Management - FIXED VERSION
 * Centralized state management for the popup/sidebar interface
 */

import { DEBOUNCE_DELAYS, ANIMATION_DURATIONS } from '../../shared/constants/AppConstants.js';
import debugUtils from '../../shared/utils/DebugUtils.js';

class UIStateManager {
  constructor() {
    this.state = {
      // Data state
      tabs: [],
      categories: {},
      totalCount: 0,
      
      // UI state
      isLoading: false,
      isInitialized: false,
      currentView: 'categories', // categories, settings, search
      searchQuery: '',
      collapsedCategories: new Set(),
      
      // Settings state
      settings: {
        autoOrganize: true,
        showNotifications: true,
        theme: 'light'
      },
      
      // Error state
      error: null,
      lastError: null,
      
      // Performance state
      lastUpdate: null,
      refreshCount: 0
    };
    
    this.listeners = new Set();
    this.updateQueue = new Map();
    this.initialized = false;
  }

  /**
   * Initialize state manager with better error handling
   */
  async init() {
    try {
      debugUtils.info('Initializing UIStateManager', 'UIStateManager');
      
      // Load persisted UI state with error handling
      try {
        await this.loadPersistedState();
      } catch (error) {
        debugUtils.warn('Failed to load persisted state, using defaults', 'UIStateManager', error);
      }
      
      this.initialized = true;
      this.setState({ isInitialized: true }, { silent: true });
      
      debugUtils.info('UIStateManager initialized successfully', 'UIStateManager');
    } catch (error) {
      debugUtils.error('Failed to initialize UIStateManager', 'UIStateManager', error);
      // Don't throw - continue with defaults
      this.initialized = true;
      this.setState({ 
        isInitialized: true, 
        error: 'State manager initialization failed' 
      }, { silent: true });
    }
  }

  /**
   * Load persisted UI state from storage with better error handling
   */
  async loadPersistedState() {
    try {
      // Check if localStorage is available (not in service worker)
      if (typeof localStorage === 'undefined') {
        debugUtils.debug('localStorage not available, skipping state persistence', 'UIStateManager');
        return;
      }

      const stored = localStorage.getItem('ui_state');
      if (stored) {
        try {
          const persistedState = JSON.parse(stored);
          
          // Validate and safely restore state
          if (persistedState && typeof persistedState === 'object') {
            // Only restore certain UI preferences
            if (Array.isArray(persistedState.collapsedCategories)) {
              this.state.collapsedCategories = new Set(persistedState.collapsedCategories);
            }
            
            if (persistedState.settings && typeof persistedState.settings === 'object') {
              this.state.settings = { ...this.state.settings, ...persistedState.settings };
            }
            
            debugUtils.debug('Loaded persisted UI state', 'UIStateManager', persistedState);
          }
        } catch (parseError) {
          debugUtils.warn('Failed to parse persisted state, clearing corrupted data', 'UIStateManager', parseError);
          // Clear corrupted data
          localStorage.removeItem('ui_state');
        }
      }
    } catch (error) {
      debugUtils.warn('Failed to load persisted state', 'UIStateManager', error);
    }
  }

  /**
   * Persist UI state to storage with error handling
   */
  async persistState() {
    try {
      // Check if localStorage is available (not in service worker)
      if (typeof localStorage === 'undefined') {
        return;
      }

      const stateToPersist = {
        collapsedCategories: Array.from(this.state.collapsedCategories || []),
        settings: this.state.settings || {},
        theme: this.state.settings?.theme || 'light'
      };
      
      localStorage.setItem('ui_state', JSON.stringify(stateToPersist));
      debugUtils.debug('Persisted UI state', 'UIStateManager');
    } catch (error) {
      debugUtils.warn('Failed to persist state', 'UIStateManager', error);
    }
  }

  /**
   * Set state with improved error handling
   */
  setState(updates, options = {}) {
    const { 
      persist = false, 
      silent = false, 
      debounce = false,
      immediate = false 
    } = options;

    try {
      // Validate updates
      if (!updates || typeof updates !== 'object') {
        debugUtils.warn('Invalid state updates provided', 'UIStateManager', updates);
        return;
      }

      // Apply updates to state
      const previousState = { ...this.state };
      
      // Safely merge updates
      Object.entries(updates).forEach(([key, value]) => {
        try {
          this.state[key] = value;
        } catch (error) {
          debugUtils.warn(`Failed to set state key: ${key}`, 'UIStateManager', error);
        }
      });
      
      // Update timestamp
      this.state.lastUpdate = Date.now();
      
      if (!silent) {
        debugUtils.debug('State updated', 'UIStateManager', updates);
      }
      
      // Notify listeners with error handling
      if (!silent) {
        try {
          this.notifyListeners(updates, previousState);
        } catch (error) {
          debugUtils.error('Failed to notify listeners', 'UIStateManager', error);
        }
      }
      
      // Handle persistence with error handling
      if (persist) {
        try {
          if (debounce) {
            this.debouncedPersist();
          } else {
            this.persistState();
          }
        } catch (error) {
          debugUtils.warn('Failed to persist state', 'UIStateManager', error);
        }
      }
      
    } catch (error) {
      debugUtils.error('Failed to set state', 'UIStateManager', error);
    }
  }

  /**
   * Get current state (immutable copy) with error handling
   */
  getState() {
    try {
      return {
        ...this.state,
        collapsedCategories: new Set(this.state.collapsedCategories || [])
      };
    } catch (error) {
      debugUtils.error('Failed to get state', 'UIStateManager', error);
      // Return safe default state
      return {
        tabs: [],
        categories: {},
        totalCount: 0,
        isLoading: false,
        isInitialized: false,
        currentView: 'categories',
        searchQuery: '',
        collapsedCategories: new Set(),
        settings: {
          autoOrganize: true,
          showNotifications: true,
          theme: 'light'
        },
        error: 'Failed to get state',
        lastError: null,
        lastUpdate: Date.now(),
        refreshCount: 0
      };
    }
  }

  /**
   * Get specific state property with fallback
   */
  get(key) {
    try {
      return this.state[key];
    } catch (error) {
      debugUtils.warn(`Failed to get state property: ${key}`, 'UIStateManager', error);
      return null;
    }
  }

  /**
   * Subscribe to state changes with better error handling
   */
  subscribe(listener, filter = null) {
    try {
      if (typeof listener !== 'function') {
        throw new Error('Listener must be a function');
      }

      const subscription = {
        callback: listener,
        filter: filter,
        id: Date.now() + Math.random()
      };

      this.listeners.add(subscription);
      
      debugUtils.debug('Added state listener', 'UIStateManager', { 
        listenerId: subscription.id,
        hasFilter: !!filter 
      });

      // Return unsubscribe function
      return () => {
        try {
          this.listeners.delete(subscription);
          debugUtils.debug('Removed state listener', 'UIStateManager', { 
            listenerId: subscription.id 
          });
        } catch (error) {
          debugUtils.warn('Failed to unsubscribe listener', 'UIStateManager', error);
        }
      };
    } catch (error) {
      debugUtils.error('Failed to subscribe to state changes', 'UIStateManager', error);
      // Return dummy unsubscribe function
      return () => {};
    }
  }

  /**
   * Notify all listeners of state changes with individual error handling
   */
  notifyListeners(updates, previousState) {
    if (!this.listeners || this.listeners.size === 0) {
      return;
    }

    this.listeners.forEach(subscription => {
      try {
        // Apply filter if present
        let filteredUpdates = updates;
        if (subscription.filter && Array.isArray(subscription.filter)) {
          const relevantUpdates = {};
          const hasRelevantChanges = Object.keys(updates).some(key => {
            if (subscription.filter.includes(key)) {
              relevantUpdates[key] = updates[key];
              return true;
            }
            return false;
          });
          
          if (!hasRelevantChanges) return;
          filteredUpdates = relevantUpdates;
        }
        
        subscription.callback(filteredUpdates, previousState, this.state);
      } catch (error) {
        debugUtils.error('Listener callback error', 'UIStateManager', error);
        // Don't remove the listener, just log the error
      }
    });
  }

  /**
   * Set loading state with safety checks
   */
  setLoading(loading, message = null) {
    try {
      const updates = { 
        isLoading: !!loading
      };
      
      if (message) {
        updates.loadingMessage = String(message);
      }
      
      this.setState(updates);
    } catch (error) {
      debugUtils.error('Failed to set loading state', 'UIStateManager', error);
    }
  }

  /**
   * Set error state with better handling
   */
  setError(error, context = null) {
    try {
      const errorMessage = error?.message || error || 'Unknown error';
      const errorData = {
        error: String(errorMessage),
        lastError: {
          message: String(errorMessage),
          context: context || 'Unknown',
          timestamp: Date.now()
        }
      };
      
      this.setState(errorData);
      debugUtils.error('UI Error set', 'UIStateManager', errorData);
    } catch (err) {
      debugUtils.error('Failed to set error state', 'UIStateManager', err);
    }
  }

  /**
   * Clear error state safely
   */
  clearError() {
    try {
      this.setState({ error: null });
    } catch (error) {
      debugUtils.error('Failed to clear error state', 'UIStateManager', error);
    }
  }

  /**
   * Update tabs data with validation
   */
  setTabsData(data) {
    try {
      // Validate data structure
      if (!data || typeof data !== 'object') {
        debugUtils.warn('Invalid tabs data provided', 'UIStateManager', data);
        return;
      }

      const updates = {
        tabs: Array.isArray(data.tabs) ? data.tabs : [],
        categories: (data.categories && typeof data.categories === 'object') ? data.categories : {},
        totalCount: typeof data.totalCount === 'number' ? data.totalCount : 0,
        refreshCount: (this.state.refreshCount || 0) + 1
      };
      
      this.setState(updates);
    } catch (error) {
      debugUtils.error('Failed to set tabs data', 'UIStateManager', error);
    }
  }

  /**
   * Set search query with validation
   */
  setSearchQuery(query, immediate = false) {
    try {
      const sanitizedQuery = typeof query === 'string' ? query : '';
      
      if (immediate) {
        this.setState({ searchQuery: sanitizedQuery });
      } else {
        // Debounce search updates
        this.debounceUpdate('searchQuery', sanitizedQuery, DEBOUNCE_DELAYS.SEARCH);
      }
    } catch (error) {
      debugUtils.error('Failed to set search query', 'UIStateManager', error);
    }
  }

  /**
   * Toggle category collapse state safely
   */
  toggleCategoryCollapse(category) {
    try {
      if (!category || typeof category !== 'string') {
        debugUtils.warn('Invalid category for collapse toggle', 'UIStateManager', category);
        return;
      }

      const newCollapsed = new Set(this.state.collapsedCategories || []);
      
      if (newCollapsed.has(category)) {
        newCollapsed.delete(category);
      } else {
        newCollapsed.add(category);
      }
      
      this.setState({ 
        collapsedCategories: newCollapsed 
      }, { 
        persist: true, 
        debounce: true 
      });
    } catch (error) {
      debugUtils.error('Failed to toggle category collapse', 'UIStateManager', error);
    }
  }

  /**
   * Set current view with validation
   */
  setView(view) {
    try {
      const validViews = ['categories', 'settings', 'search'];
      const sanitizedView = validViews.includes(view) ? view : 'categories';
      this.setState({ currentView: sanitizedView });
    } catch (error) {
      debugUtils.error('Failed to set view', 'UIStateManager', error);
    }
  }

  /**
   * Update settings with validation
   */
  updateSettings(settings) {
    try {
      if (!settings || typeof settings !== 'object') {
        debugUtils.warn('Invalid settings provided', 'UIStateManager', settings);
        return;
      }

      const currentSettings = this.state.settings || {};
      const updatedSettings = { ...currentSettings };
      
      // Safely merge settings
      Object.entries(settings).forEach(([key, value]) => {
        try {
          updatedSettings[key] = value;
        } catch (error) {
          debugUtils.warn(`Failed to update setting: ${key}`, 'UIStateManager', error);
        }
      });

      this.setState({
        settings: updatedSettings
      }, { persist: true });
    } catch (error) {
      debugUtils.error('Failed to update settings', 'UIStateManager', error);
    }
  }

  /**
   * Get filtered tabs based on current search query with error handling
   */
  getFilteredTabs() {
    try {
      const { tabs = [], searchQuery = '' } = this.state;
      
      if (!Array.isArray(tabs)) {
        debugUtils.warn('Invalid tabs array in state', 'UIStateManager');
        return [];
      }
      
      if (!searchQuery.trim()) {
        return tabs;
      }
      
      const query = searchQuery.toLowerCase();
      return tabs.filter(tab => {
        try {
          if (!tab || typeof tab !== 'object') return false;
          
          const title = (tab.title || '').toLowerCase();
          const url = (tab.url || '').toLowerCase();
          
          return title.includes(query) || url.includes(query);
        } catch (error) {
          debugUtils.warn('Error filtering tab', 'UIStateManager', error);
          return false;
        }
      });
    } catch (error) {
      debugUtils.error('Failed to get filtered tabs', 'UIStateManager', error);
      return [];
    }
  }

  /**
   * Check if category is collapsed with fallback
   */
  isCategoryCollapsed(category) {
    try {
      if (!category || typeof category !== 'string') {
        return false;
      }
      
      const collapsedCategories = this.state.collapsedCategories;
      if (!collapsedCategories || typeof collapsedCategories.has !== 'function') {
        return false;
      }
      
      return collapsedCategories.has(category);
    } catch (error) {
      debugUtils.warn(`Failed to check category collapse state: ${category}`, 'UIStateManager', error);
      return false;
    }
  }

  /**
   * Debounced update for specific keys with error handling
   */
  debounceUpdate(key, value, delay) {
    try {
      // Clear existing timeout for this key
      if (this.updateQueue.has(key)) {
        clearTimeout(this.updateQueue.get(key));
      }
      
      // Set new timeout
      const timeoutId = setTimeout(() => {
        try {
          this.setState({ [key]: value });
          this.updateQueue.delete(key);
        } catch (error) {
          debugUtils.error(`Failed to apply debounced update for ${key}`, 'UIStateManager', error);
        }
      }, delay || DEBOUNCE_DELAYS.SEARCH);
      
      this.updateQueue.set(key, timeoutId);
    } catch (error) {
      debugUtils.error(`Failed to setup debounced update for ${key}`, 'UIStateManager', error);
    }
  }

  /**
   * Debounced persistence with error handling
   */
  debouncedPersist() {
    try {
      if (this.persistTimeout) {
        clearTimeout(this.persistTimeout);
      }
      
      this.persistTimeout = setTimeout(() => {
        this.persistState();
      }, DEBOUNCE_DELAYS.STORAGE_SAVE);
    } catch (error) {
      debugUtils.error('Failed to setup debounced persistence', 'UIStateManager', error);
    }
  }

  /**
   * Get UI metrics with error handling
   */
  getMetrics() {
    try {
      return {
        totalTabs: (this.state.tabs || []).length,
        categoriesCount: Object.keys(this.state.categories || {}).length,
        collapsedCategoriesCount: (this.state.collapsedCategories || new Set()).size,
        hasSearch: !!(this.state.searchQuery || '').trim(),
        refreshCount: this.state.refreshCount || 0,
        listenersCount: this.listeners ? this.listeners.size : 0,
        lastUpdate: this.state.lastUpdate || 0,
        uptime: this.state.lastUpdate ? Date.now() - this.state.lastUpdate : 0,
        initialized: this.initialized
      };
    } catch (error) {
      debugUtils.error('Failed to get metrics', 'UIStateManager', error);
      return {
        totalTabs: 0,
        categoriesCount: 0,
        collapsedCategoriesCount: 0,
        hasSearch: false,
        refreshCount: 0,
        listenersCount: 0,
        lastUpdate: 0,
        uptime: 0,
        initialized: false,
        error: error.message
      };
    }
  }

  /**
   * Reset state to initial values
   */
  reset() {
    try {
      const initialState = {
        tabs: [],
        categories: {},
        totalCount: 0,
        isLoading: false,
        searchQuery: '',
        error: null,
        currentView: 'categories'
      };
      
      this.setState(initialState);
      debugUtils.info('UI state reset', 'UIStateManager');
    } catch (error) {
      debugUtils.error('Failed to reset UI state', 'UIStateManager', error);
    }
  }

  /**
   * Cleanup method with comprehensive error handling
   */
  cleanup() {
    try {
      // Clear any pending timeouts
      if (this.updateQueue) {
        this.updateQueue.forEach(timeoutId => {
          try {
            clearTimeout(timeoutId);
          } catch (error) {
            debugUtils.warn('Failed to clear timeout', 'UIStateManager', error);
          }
        });
        this.updateQueue.clear();
      }
      
      if (this.persistTimeout) {
        try {
          clearTimeout(this.persistTimeout);
        } catch (error) {
          debugUtils.warn('Failed to clear persist timeout', 'UIStateManager', error);
        }
      }
      
      // Clear listeners
      if (this.listeners) {
        this.listeners.clear();
      }
      
      // Final state persistence
      try {
        this.persistState();
      } catch (error) {
        debugUtils.warn('Failed to persist state during cleanup', 'UIStateManager', error);
      }
      
      debugUtils.info('UIStateManager cleanup completed', 'UIStateManager');
    } catch (error) {
      debugUtils.error('UIStateManager cleanup failed', 'UIStateManager', error);
    }
  }

  /**
   * Get tabs grouped by category with error handling
   */
  getTabsByCategory() {
    try {
      const tabs = this.getFilteredTabs();
      const grouped = {};
      
      tabs.forEach(tab => {
        try {
          const category = (tab && tab.category) || 'other';
          if (!grouped[category]) {
            grouped[category] = [];
          }
          grouped[category].push(tab);
        } catch (error) {
          debugUtils.warn('Error grouping tab', 'UIStateManager', error);
        }
      });
      
      // Sort tabs within each category by lastAccessed
      Object.values(grouped).forEach(categoryTabs => {
        try {
          if (Array.isArray(categoryTabs)) {
            categoryTabs.sort((a, b) => {
              const aTime = (a && a.lastAccessed) || 0;
              const bTime = (b && b.lastAccessed) || 0;
              return bTime - aTime;
            });
          }
        } catch (error) {
          debugUtils.warn('Error sorting category tabs', 'UIStateManager', error);
        }
      });
      
      return grouped;
    } catch (error) {
      debugUtils.error('Failed to get tabs by category', 'UIStateManager', error);
      return {};
    }
  }

  /**
   * Batch update with error handling
   */
  batchUpdate(updateFn) {
    if (typeof updateFn !== 'function') {
      debugUtils.warn('Batch update function must be a function', 'UIStateManager');
      return;
    }

    try {
      const updates = {};
      const originalSetState = this.setState.bind(this);
      
      // Temporarily override setState to collect updates
      this.setState = (newUpdates, options = {}) => {
        if (newUpdates && typeof newUpdates === 'object') {
          Object.assign(updates, newUpdates);
        }
      };
      
      try {
        updateFn();
        
        // Apply all updates at once
        if (Object.keys(updates).length > 0) {
          originalSetState(updates);
        }
      } finally {
        // Restore original setState
        this.setState = originalSetState;
      }
    } catch (error) {
      debugUtils.error('Failed to perform batch update', 'UIStateManager', error);
    }
  }

  /**
   * Export current state for debugging
   */
  exportState() {
    try {
      return {
        ...this.getState(),
        metrics: this.getMetrics(),
        exportTime: Date.now()
      };
    } catch (error) {
      debugUtils.error('Failed to export state', 'UIStateManager', error);
      return {
        error: error.message,
        exportTime: Date.now()
      };
    }
  }
}

// Create singleton instance
export default new UIStateManager();