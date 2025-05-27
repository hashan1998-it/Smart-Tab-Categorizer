/**
 * Search Bar Component
 * Handles search functionality with debouncing and validation
 */

import { DEBOUNCE_DELAYS } from '../../shared/constants/AppConstants.js';
import debugUtils from '../../shared/utils/DebugUtils.js';
import ValidationUtils from '../../shared/utils/ValidationUtils.js';
import UIStateManager from '../managers/UIStateManager.js';

class SearchBar {
  constructor(searchInput) {
    this.searchInput = searchInput;
    this.searchTimeout = null;
    this.initialized = false;
    this.previousQuery = '';
  }

  /**
   * Initialize the search bar component
   */
  async init() {
    try {
      if (!this.searchInput) {
        throw new Error('Search input element is required');
      }

      debugUtils.info('Initializing SearchBar component', 'SearchBar');
      
      this.setupEventListeners();
      this.setupStateSubscriptions();
      this.initialized = true;
      
      debugUtils.info('SearchBar component initialized successfully', 'SearchBar');
    } catch (error) {
      debugUtils.error('Failed to initialize SearchBar component', 'SearchBar', error);
      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Input event with debouncing
    this.searchInput.addEventListener('input', (e) => {
      this.handleSearchInput(e.target.value);
    });

    // Focus and blur events
    this.searchInput.addEventListener('focus', () => {
      this.handleFocus();
    });

    this.searchInput.addEventListener('blur', () => {
      this.handleBlur();
    });

    // Keyboard events
    this.searchInput.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    // Paste event
    this.searchInput.addEventListener('paste', (e) => {
      // Delay to allow paste to complete
      setTimeout(() => {
        this.handleSearchInput(e.target.value);
      }, 0);
    });
  }

  /**
   * Setup state subscriptions
   */
  setupStateSubscriptions() {
    // Subscribe to search query changes from other sources
    UIStateManager.subscribe((updates) => {
      if ('searchQuery' in updates && updates.searchQuery !== this.searchInput.value) {
        this.searchInput.value = updates.searchQuery;
        this.updateSearchUI(updates.searchQuery);
      }
    }, ['searchQuery']);
  }

  /**
   * Handle search input with debouncing
   */
  handleSearchInput(query) {
    // Clear existing timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Validate input
    const validation = ValidationUtils.validateSearchQuery(query);
    if (!validation.valid) {
      debugUtils.warn('Invalid search query', 'SearchBar', validation.errors);
      this.showValidationError(validation.errors[0]);
      return;
    }

    // Clear any validation errors
    this.clearValidationError();

    // Set immediate UI update for responsive feeling
    this.updateSearchUI(validation.sanitized);

    // Debounce the actual search
    this.searchTimeout = setTimeout(() => {
      this.performSearch(validation.sanitized);
    }, DEBOUNCE_DELAYS.SEARCH);
  }

  /**
   * Perform the actual search
   */
  performSearch(query) {
    try {
      debugUtils.debug(`Performing search: "${query}"`, 'SearchBar');
      
      // Update state manager
      UIStateManager.setSearchQuery(query, true);
      
      // Track search metrics
      this.trackSearchMetrics(query);
      
      this.previousQuery = query;
    } catch (error) {
      debugUtils.error('Failed to perform search', 'SearchBar', error);
    }
  }

  /**
   * Handle focus event
   */
  handleFocus() {
    this.searchInput.parentElement?.classList.add('focused');
    
    // Select all text on focus for easy replacement
    if (this.searchInput.value) {
      this.searchInput.select();
    }
  }

  /**
   * Handle blur event
   */
  handleBlur() {
    this.searchInput.parentElement?.classList.remove('focused');
  }

  /**
   * Handle keyboard events
   */
  handleKeyDown(e) {
    switch (e.key) {
      case 'Escape':
        this.clearSearch();
        this.searchInput.blur();
        break;
        
      case 'Enter':
        // Force immediate search
        if (this.searchTimeout) {
          clearTimeout(this.searchTimeout);
        }
        this.performSearch(this.searchInput.value);
        break;
        
      case 'ArrowDown':
        // Could be used for search suggestions in the future
        e.preventDefault();
        this.handleArrowNavigation('down');
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.handleArrowNavigation('up');
        break;
    }
  }

  /**
   * Handle arrow key navigation (for future search suggestions)
   */
  handleArrowNavigation(direction) {
    // Placeholder for future search suggestions feature
    debugUtils.debug(`Arrow navigation: ${direction}`, 'SearchBar');
  }

  /**
   * Clear search
   */
  clearSearch() {
    this.searchInput.value = '';
    this.updateSearchUI('');
    this.performSearch('');
    this.clearValidationError();
  }

  /**
   * Update search UI
   */
  updateSearchUI(query) {
    const container = this.searchInput.parentElement;
    if (!container) return;

    // Update clear button visibility
    const clearButton = container.querySelector('.search-clear');
    if (clearButton) {
      clearButton.style.display = query ? 'block' : 'none';
    }

    // Update search icon state
    const searchIcon = container.querySelector('.search-icon');
    if (searchIcon) {
      searchIcon.classList.toggle('active', !!query);
    }

    // Update placeholder text based on state
    if (query) {
      this.searchInput.setAttribute('data-searching', 'true');
    } else {
      this.searchInput.removeAttribute('data-searching');
    }
  }

  /**
   * Show validation error
   */
  showValidationError(errorMessage) {
    const container = this.searchInput.parentElement;
    if (!container) return;

    // Remove existing error
    this.clearValidationError();

    // Add error class
    container.classList.add('error');

    // Create error tooltip
    const errorTooltip = document.createElement('div');
    errorTooltip.className = 'search-error-tooltip';
    errorTooltip.textContent = errorMessage;
    container.appendChild(errorTooltip);

    // Auto-hide error after 3 seconds
    setTimeout(() => {
      this.clearValidationError();
    }, 3000);
  }

  /**
   * Clear validation error
   */
  clearValidationError() {
    const container = this.searchInput.parentElement;
    if (!container) return;

    container.classList.remove('error');
    
    const errorTooltip = container.querySelector('.search-error-tooltip');
    if (errorTooltip) {
      errorTooltip.remove();
    }
  }

  /**
   * Track search metrics
   */
  trackSearchMetrics(query) {
    try {
      const metrics = {
        queryLength: query.length,
        hasQuery: !!query,
        timestamp: Date.now(),
        previousQuery: this.previousQuery
      };

      debugUtils.debug('Search metrics', 'SearchBar', metrics);
      
      // Could send to analytics in the future
    } catch (error) {
      debugUtils.error('Failed to track search metrics', 'SearchBar', error);
    }
  }

  /**
   * Set search query programmatically
   */
  setQuery(query, performSearch = true) {
    try {
      const validation = ValidationUtils.validateSearchQuery(query || '');
      if (!validation.valid) {
        debugUtils.warn('Invalid search query provided', 'SearchBar', validation.errors);
        return false;
      }

      this.searchInput.value = validation.sanitized;
      this.updateSearchUI(validation.sanitized);
      
      if (performSearch) {
        this.performSearch(validation.sanitized);
      }
      
      return true;
    } catch (error) {
      debugUtils.error('Failed to set search query', 'SearchBar', error);
      return false;
    }
  }

  /**
   * Get current search query
   */
  getQuery() {
    return this.searchInput.value;
  }

  /**
   * Focus the search input
   */
  focus() {
    try {
      this.searchInput.focus();
    } catch (error) {
      debugUtils.error('Failed to focus search input', 'SearchBar', error);
    }
  }

  /**
   * Blur the search input
   */
  blur() {
    try {
      this.searchInput.blur();
    } catch (error) {
      debugUtils.error('Failed to blur search input', 'SearchBar', error);
    }
  }

  /**
   * Enable/disable search input
   */
  setEnabled(enabled) {
    try {
      this.searchInput.disabled = !enabled;
      
      const container = this.searchInput.parentElement;
      if (container) {
        container.classList.toggle('disabled', !enabled);
      }
    } catch (error) {
      debugUtils.error('Failed to set search enabled state', 'SearchBar', error);
    }
  }

  /**
   * Set placeholder text
   */
  setPlaceholder(placeholder) {
    try {
      this.searchInput.placeholder = ValidationUtils.sanitizeString(placeholder);
    } catch (error) {
      debugUtils.error('Failed to set search placeholder', 'SearchBar', error);
    }
  }

  /**
   * Add search suggestion (for future feature)
   */
  addSuggestion(suggestion) {
    // Placeholder for future search suggestions feature
    debugUtils.debug(`Adding search suggestion: ${suggestion}`, 'SearchBar');
  }

  /**
   * Clear search suggestions (for future feature)
   */
  clearSuggestions() {
    // Placeholder for future search suggestions feature
    debugUtils.debug('Clearing search suggestions', 'SearchBar');
  }

  /**
   * Get search statistics
   */
  getSearchStats() {
    return {
      initialized: this.initialized,
      currentQuery: this.getQuery(),
      previousQuery: this.previousQuery,
      hasActiveSearch: !!this.searchTimeout,
      isEnabled: !this.searchInput.disabled,
      isFocused: document.activeElement === this.searchInput
    };
  }

  /**
   * Reset search state
   */
  reset() {
    try {
      this.clearSearch();
      this.clearValidationError();
      this.previousQuery = '';
      
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = null;
      }
      
      debugUtils.debug('SearchBar reset completed', 'SearchBar');
    } catch (error) {
      debugUtils.error('Failed to reset SearchBar', 'SearchBar', error);
    }
  }

  /**
   * Cleanup method
   */
  cleanup() {
    try {
      // Clear any pending timeouts
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = null;
      }

      // Clear validation errors
      this.clearValidationError();

      // Reset input
      if (this.searchInput) {
        this.searchInput.value = '';
        this.updateSearchUI('');
      }

      debugUtils.info('SearchBar component cleanup completed', 'SearchBar');
    } catch (error) {
      debugUtils.error('SearchBar component cleanup failed', 'SearchBar', error);
    }
  }
}

export default SearchBar;