/**
 * UI State Management
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
   * Initialize state manager
   */
  async init() {
    try {
      debugUtils.info('Initializing UIStateManager', 'UIStateManager');
      
      // Load persisted UI state
      await this.loadPersistedState();
      
      this.initialized = true;
      this.setState({ isInitialized: true });
      
      debugUtils.info('UIStateManager initialized successfully', 'UIStateManager');
    } catch (error) {
      debugUtils.error('Failed to initialize UIStateManager', 'UIStateManager', error);
      this.setState({ error: error.message });
      throw error;
    }
  }

  /**
   * Load persisted UI state from storage
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
        const persistedState = JSON.parse(stored);
        
        // Only restore certain UI preferences
        this.state.collapsedCategories = new Set(persistedState.collapsedCategories || []);
        this.state.settings = { ...this.state.settings, ...persistedState.settings };
        
        debugUtils.debug('Loaded persisted UI state', 'UIStateManager', persistedState);
      }
    } catch (error) {
      debugUtils.warn('Failed to load persisted state', 'UIStateManager', error);
    }
  }

  /**
   * Persist UI state to storage
   */
  async persistState() {
    try {
      // Check if localStorage is available (not in service worker)
      if (typeof localStorage === 'undefined') {
        return;
      }

      const stateToPersist = {
        collapsedCategories: Array.from(this.state.collapsedCategories),
        settings: this.state.settings,
        theme: this.state.settings.theme
      };
      
      localStorage.setItem('ui_state', JSON.stringify(stateToPersist));
      debugUtils.debug('Persisted UI state', 'UIStateManager');
    } catch (error) {
      debugUtils.warn('Failed to persist state', 'UIStateManager', error);
    }
  }

  /**
   * Set state with optional batching and persistence
   */
  setState(updates, options = {}) {
    const { 
      persist = false, 
      silent = false, 
      debounce = false,
      immediate = false 
    } = options;

    try {
      // Apply updates to state
      const previousState = { ...this.state };
      Object.assign(this.state, updates);
      
      // Update timestamp
      this.state.lastUpdate = Date.now();
      
      if (!silent) {
        debugUtils.debug('State updated', 'UIStateManager', updates);
      }
      
      // Notify listeners
      if (!silent) {
        this.notifyListeners(updates, previousState);
      }
      
      // Handle persistence
      if (persist) {
        if (debounce) {
          this.debouncedPersist();
        } else {
          this.persistState();
        }
      }
      
    } catch (error) {
      debugUtils.error('Failed to set state', 'UIStateManager', error);
    }
  }

  /**
   * Get current state (immutable copy)
   */
  getState() {
    return {
      ...this.state,
      collapsedCategories: new Set(this.state.collapsedCategories)
    };
  }

  /**
   * Get specific state property
   */
  get(key) {
    return this.state[key];
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener, filter = null) {
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
      this.listeners.delete(subscription);
      debugUtils.debug('Removed state listener', 'UIStateManager', { 
        listenerId: subscription.id 
      });
    };
  }

  /**
   * Notify all listeners of state changes
   */
  notifyListeners(updates, previousState) {
    try {
      this.listeners.forEach(subscription => {
        try {
          // Apply filter if present
          if (subscription.filter) {
            const filteredUpdates = {};
            const hasRelevantChanges = Object.keys(updates).some(key => {
              if (subscription.filter.includes(key)) {
                filteredUpdates[key] = updates[key];
                return true;
              }
              return false;
            });
            
            if (!hasRelevantChanges) return;
            updates = filteredUpdates;
          }
          
          subscription.callback(updates, previousState, this.state);
        } catch (error) {
          debugUtils.error('Listener callback error', 'UIStateManager', error);
        }
      });
    } catch (error) {
      debugUtils.error('Failed to notify listeners', 'UIStateManager', error);
    }
  }

  /**
   * Debounced persistence
   */
  debouncedPersist() {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
    }
    
    this.persistTimeout = setTimeout(() => {
      this.persistState();
    }, DEBOUNCE_DELAYS.STORAGE_SAVE);
  }

  /**
   * Batch multiple state updates
   */
  batchUpdate(updateFn) {
    const updates = {};
    const originalSetState = this.setState.bind(this);
    
    // Temporarily override setState to collect updates
    this.setState = (newUpdates, options = {}) => {
      Object.assign(updates, newUpdates);
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
  }

  /**
   * State management helpers for common UI operations
   */

  /**
   * Set loading state
   */
  setLoading(loading, message = null) {
    this.setState({ 
      isLoading: loading,
      loadingMessage: message 
    });
  }

  /**
   * Set error state
   */
  setError(error, context = null) {
    const errorData = {
      error: error?.message || error,
      lastError: {
        message: error?.message || error,
        context,
        timestamp: Date.now()
      }
    };
    
    this.setState(errorData);
    debugUtils.error('UI Error set', 'UIStateManager', errorData);
  }

  /**
   * Clear error state
   */
  clearError() {
    this.setState({ error: null });
  }

  /**
   * Update tabs data
   */
  setTabsData(data) {
    this.setState({
      tabs: data.tabs || [],
      categories: data.categories || {},
      totalCount: data.totalCount || 0,
      refreshCount: this.state.refreshCount + 1
    });
  }

  /**
   * Set search query
   */
  setSearchQuery(query, immediate = false) {
    if (immediate) {
      this.setState({ searchQuery: query });
    } else {
      // Debounce search updates
      this.debounceUpdate('searchQuery', query, DEBOUNCE_DELAYS.SEARCH);
    }
  }

  /**
   * Toggle category collapse state
   */
  toggleCategoryCollapse(category) {
    const newCollapsed = new Set(this.state.collapsedCategories);
    
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
  }

  /**
   * Set current view
   */
  setView(view) {
    this.setState({ currentView: view });
  }

  /**
   * Update settings
   */
  updateSettings(settings) {
    this.setState({
      settings: { ...this.state.settings, ...settings }
    }, { persist: true });
  }

  /**
   * Debounced update for specific keys
   */
  debounceUpdate(key, value, delay) {
    // Clear existing timeout for this key
    if (this.updateQueue.has(key)) {
      clearTimeout(this.updateQueue.get(key));
    }
    
    // Set new timeout
    const timeoutId = setTimeout(() => {
      this.setState({ [key]: value });
      this.updateQueue.delete(key);
    }, delay);
    
    this.updateQueue.set(key, timeoutId);
  }

  /**
   * Get filtered tabs based on current search query
   */
  getFilteredTabs() {
    const { tabs, searchQuery } = this.state;
    
    if (!searchQuery.trim()) {
      return tabs;
    }
    
    const query = searchQuery.toLowerCase();
    return tabs.filter(tab =>
      tab.title.toLowerCase().includes(query) ||
      tab.url.toLowerCase().includes(query)
    );
  }

  /**
   * Get tabs grouped by category
   */
  getTabsByCategory() {
    const tabs = this.getFilteredTabs();
    const grouped = {};
    
    tabs.forEach(tab => {
      const category = tab.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(tab);
    });
    
    // Sort tabs within each category by lastAccessed
    Object.values(grouped).forEach(categoryTabs => {
      categoryTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    });
    
    return grouped;
  }

  /**
   * Check if category is collapsed
   */
  isCategoryCollapsed(category) {
    return this.state.collapsedCategories.has(category);
  }

  /**
   * Get UI metrics
   */
  getMetrics() {
    return {
      totalTabs: this.state.tabs.length,
      categoriesCount: Object.keys(this.state.categories).length,
      collapsedCategoriesCount: this.state.collapsedCategories.size,
      hasSearch: !!this.state.searchQuery,
      refreshCount: this.state.refreshCount,
      listenersCount: this.listeners.size,
      lastUpdate: this.state.lastUpdate,
      uptime: this.state.lastUpdate ? Date.now() - this.state.lastUpdate : 0
    };
  }

  /**
   * Reset state to initial values
   */
  reset() {
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
  }

  /**
   * Export current state for debugging
   */
  exportState() {
    return {
      ...this.getState(),
      metrics: this.getMetrics(),
      exportTime: Date.now()
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    try {
      // Clear any pending timeouts
      this.updateQueue.forEach(timeoutId => clearTimeout(timeoutId));
      this.updateQueue.clear();
      
      if (this.persistTimeout) {
        clearTimeout(this.persistTimeout);
      }
      
      // Clear listeners
      this.listeners.clear();
      
      // Final state persistence
      this.persistState();
      
      debugUtils.info('UIStateManager cleanup completed', 'UIStateManager');
    } catch (error) {
      debugUtils.error('UIStateManager cleanup failed', 'UIStateManager', error);
    }
  }
}

// Create singleton instance
export default new UIStateManager();