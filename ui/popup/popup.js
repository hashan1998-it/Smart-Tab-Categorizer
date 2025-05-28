/**
 * Standalone Popup Controller - FIXED Search Functionality
 * Self-contained popup functionality for Smart Tab Organizer
 */

// Constants
const MESSAGE_TYPES = {
  PING: 'ping',
  GET_ALL_TABS: 'getAllTabs',
  REFRESH_TABS: 'refreshTabs',
  FOCUS_TAB: 'focusTab',
  CLOSE_TAB: 'closeTab',
  MOVE_TABS: 'moveTabs'
};

const CATEGORIES = {
  DEVELOPMENT: 'development',
  SOCIAL: 'social',
  PRODUCTIVITY: 'productivity',
  ENTERTAINMENT: 'entertainment',
  SHOPPING: 'shopping',
  NEWS: 'news',
  REFERENCE: 'reference',
  OTHER: 'other'
};

const CATEGORY_ICONS = {
  development: '💻',
  social: '🌐',
  productivity: '📋',
  entertainment: '🎥',
  shopping: '🛒',
  news: '📰',
  reference: '📚',
  other: '📁'
};

class PopupController {
  constructor() {
    this.initialized = false;
    this.isLoading = false;
    this.tabs = [];
    this.filteredTabs = []; // FIXED: Track filtered tabs separately
    this.categories = {};
    this.elements = {};
    this.retryCount = 0;
    this.maxRetries = 3;
    this.currentSearchQuery = ''; // FIXED: Track current search query
    
    console.log('PopupController: Starting initialization');
  }

  /**
   * Initialize the popup controller
   */
  async init() {
    try {
      console.log('Initializing PopupController');
      
      // Wait for DOM to be ready
      await this.waitForDOM();
      
      // Setup DOM elements
      this.setupDOMElements();
      
      // Show loading state
      this.showLoadingState();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Load initial data
      await this.loadInitialData();
      
      this.initialized = true;
      console.log('PopupController initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize PopupController:', error);
      this.handleInitializationError(error);
    } finally {
      this.hideLoadingState();
    }
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
      container: document.querySelector('.container'),
      categoriesContainer: document.querySelector('#categoriesContainer'),
      tabCount: document.querySelector('#tabCount'),
      refreshBtn: document.querySelector('#refreshBtn'),
      settingsBtn: document.querySelector('#settingsBtn'),
      searchInput: document.querySelector('#searchInput'),
      searchClear: document.querySelector('#searchClear'),
      loadingState: document.querySelector('#loadingState'),
      emptyState: document.querySelector('#emptyState'),
      errorState: document.querySelector('#errorState'),
      errorMessage: document.querySelector('#errorMessage'),
      newTabBtn: document.querySelector('#newTabBtn'),
      retryBtn: document.querySelector('#retryBtn'),
      settingsPanel: document.querySelector('#settingsPanel'),
      closeSettingsBtn: document.querySelector('#closeSettingsBtn')
    };

    // Validate required elements
    const required = ['container', 'categoriesContainer', 'loadingState'];
    const missing = required.filter(key => !this.elements[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required DOM elements: ${missing.join(', ')}`);
    }

    console.log('DOM elements setup completed');
  }

  /**
   * Setup event listeners - FIXED
   */
  setupEventListeners() {
    // Refresh button
    if (this.elements.refreshBtn) {
      this.elements.refreshBtn.addEventListener('click', () => this.handleRefresh());
    }

    // Settings button
    if (this.elements.settingsBtn) {
      this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
    }

    // Close settings button
    if (this.elements.closeSettingsBtn) {
      this.elements.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
    }

    // New tab button
    if (this.elements.newTabBtn) {
      this.elements.newTabBtn.addEventListener('click', () => this.handleNewTab());
    }

    // Retry button
    if (this.elements.retryBtn) {
      this.elements.retryBtn.addEventListener('click', () => this.handleRetry());
    }

    // FIXED: Search input with proper debouncing
    if (this.elements.searchInput) {
      let searchTimeout;
      
      this.elements.searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        // Update search clear button visibility immediately
        this.updateSearchClearButton(query);
        
        // Debounce the actual search
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.handleSearch(query);
        }, 300);
      });

      // FIXED: Handle Enter key for immediate search
      this.elements.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(searchTimeout);
          const query = e.target.value.trim();
          this.handleSearch(query);
        }
      });
    }

    // FIXED: Search clear button
    if (this.elements.searchClear) {
      this.elements.searchClear.addEventListener('click', () => {
        if (this.elements.searchInput) {
          this.elements.searchInput.value = '';
          this.currentSearchQuery = '';
          this.updateSearchClearButton('');
          this.handleSearch('');
          this.elements.searchInput.focus(); // Keep focus for better UX
        }
      });
    }

    console.log('Event listeners setup completed');
  }

  /**
   * FIXED: Update search clear button visibility
   */
  updateSearchClearButton(query) {
    if (this.elements.searchClear) {
      this.elements.searchClear.style.display = query ? 'block' : 'none';
    }
  }

  /**
   * Load initial data with fallback strategies
   */
  async loadInitialData() {
    try {
      // Strategy 1: Try background script
      await this.loadFromBackground();
      console.log('Data loaded from background successfully');
      return;
    } catch (error) {
      console.warn('Background loading failed:', error);
    }

    try {
      // Strategy 2: Direct Chrome API
      await this.loadTabsDirectly();
      console.log('Data loaded directly successfully');
      return;
    } catch (error) {
      console.warn('Direct loading failed:', error);
    }

    // Strategy 3: Mock data
    this.loadMockData();
    console.log('Using mock data');
  }

  /**
   * Load data from background script
   */
  async loadFromBackground() {
    // Check if background is ready
    try {
      const pingResponse = await Promise.race([
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.PING }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Ping timeout')), 1000)
        )
      ]);
      
      if (!pingResponse || !pingResponse.success) {
        throw new Error('Background not ready');
      }
    } catch (error) {
      throw new Error('Background script not responding');
    }

    // Get tabs data
    const response = await Promise.race([
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_ALL_TABS }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 3000)
      )
    ]);
    
    if (!response || !response.success || !response.data) {
      throw new Error('Invalid response from background');
    }
    
    this.tabs = response.data.tabs || [];
    this.filteredTabs = [...this.tabs]; // FIXED: Initialize filtered tabs
    this.categories = response.data.categories || {};
    this.updateTabCount(response.data.totalCount || 0);
  }

  /**
   * Load tabs directly from Chrome API
   */
  async loadTabsDirectly() {
    const chromeTabs = await chrome.tabs.query({});
    
    this.tabs = chromeTabs.map(tab => ({
      id: tab.id,
      title: tab.title || 'Loading...',
      url: tab.url || '',
      favIconUrl: tab.favIconUrl || '',
      active: tab.active || false,
      pinned: tab.pinned || false,
      windowId: tab.windowId,
      category: this.categorizeTab(tab)
    }));

    this.filteredTabs = [...this.tabs]; // FIXED: Initialize filtered tabs

    // Calculate categories
    this.categories = {};
    this.tabs.forEach(tab => {
      const category = tab.category || 'other';
      this.categories[category] = (this.categories[category] || 0) + 1;
    });

    this.updateTabCount(this.tabs.length);
  }

  /**
   * Load mock data for testing
   */
  loadMockData() {
    this.tabs = [
      {
        id: 1,
        title: 'GitHub - Your repositories',
        url: 'https://github.com',
        favIconUrl: 'https://github.com/favicon.ico',
        active: false,
        pinned: false,
        windowId: 1,
        category: 'development'
      },
      {
        id: 2,
        title: 'YouTube',
        url: 'https://youtube.com',
        favIconUrl: 'https://youtube.com/favicon.ico',
        active: true,
        pinned: false,
        windowId: 1,
        category: 'entertainment'
      },
      {
        id: 3,
        title: 'Google Docs',
        url: 'https://docs.google.com',
        favIconUrl: 'https://docs.google.com/favicon.ico',
        active: false,
        pinned: true,
        windowId: 1,
        category: 'productivity'
      },
      {
        id: 4,
        title: 'Twitter',
        url: 'https://twitter.com',
        favIconUrl: 'https://twitter.com/favicon.ico',
        active: false,
        pinned: false,
        windowId: 1,
        category: 'social'
      },
      {
        id: 5,
        title: 'Amazon',
        url: 'https://amazon.com',
        favIconUrl: 'https://amazon.com/favicon.ico',
        active: false,
        pinned: false,
        windowId: 1,
        category: 'shopping'
      }
    ];

    this.filteredTabs = [...this.tabs]; // FIXED: Initialize filtered tabs

    this.categories = {
      development: 1,
      entertainment: 1,
      productivity: 1,
      social: 1,
      shopping: 1
    };

    this.updateTabCount(this.tabs.length);
  }

  /**
   * Simple tab categorization
   */
  categorizeTab(tab) {
    if (!tab.url) return 'other';
    
    const url = tab.url.toLowerCase();
    const title = (tab.title || '').toLowerCase();
    
    if (url.includes('github.com') || url.includes('stackoverflow.com') || title.includes('code')) {
      return 'development';
    }
    if (url.includes('youtube.com') || url.includes('netflix.com') || url.includes('spotify.com')) {
      return 'entertainment';
    }
    if (url.includes('twitter.com') || url.includes('facebook.com') || url.includes('linkedin.com')) {
      return 'social';
    }
    if (url.includes('docs.google.com') || url.includes('notion.so') || url.includes('trello.com')) {
      return 'productivity';
    }
    if (url.includes('amazon.com') || url.includes('ebay.com') || title.includes('shop')) {
      return 'shopping';
    }
    if (url.includes('news') || url.includes('cnn.com') || url.includes('bbc.com')) {
      return 'news';
    }
    if (url.includes('wikipedia.org') || title.includes('tutorial')) {
      return 'reference';
    }
    
    return 'other';
  }

  /**
   * Update tab count display
   */
  updateTabCount(count) {
    if (this.elements.tabCount) {
      this.elements.tabCount.textContent = count;
    }
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    this.showState('loading');
    this.isLoading = true;
  }

  /**
   * Hide loading state
   */
  hideLoadingState() {
    this.isLoading = false;
    if (this.filteredTabs.length === 0 && this.tabs.length === 0) {
      this.showEmptyState();
    } else {
      this.showCategories();
      this.renderTabs();
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
        element.classList.remove('show');
      }
    });

    // Show requested state
    const targetElement = states[state];
    if (targetElement) {
      targetElement.style.display = state === 'categories' ? 'block' : 'flex';
      setTimeout(() => targetElement.classList.add('show'), 10);
    }
  }

  /**
   * FIXED: Handle search functionality
   */
  handleSearch(query) {
    console.log('Searching for:', query);
    
    this.currentSearchQuery = query;
    
    if (!query || query.trim() === '') {
      // Reset to show all tabs
      this.filteredTabs = [...this.tabs];
      console.log('Search cleared, showing all tabs');
    } else {
      // Filter tabs based on search query
      const searchTerm = query.toLowerCase().trim();
      
      this.filteredTabs = this.tabs.filter(tab => {
        const title = (tab.title || '').toLowerCase();
        const url = (tab.url || '').toLowerCase();
        
        // Search in title and URL
        return title.includes(searchTerm) || 
               url.includes(searchTerm) ||
               this.getDomainFromUrl(url).includes(searchTerm);
      });
      
      console.log(`Found ${this.filteredTabs.length} tabs matching "${query}"`);
    }

    // Update the display
    this.renderTabs();
    
    // Update tab count to reflect filtered results
    this.updateTabCount(this.filteredTabs.length);
    
    // Show appropriate state based on results
    if (this.filteredTabs.length === 0 && query) {
      this.showNoResultsState(query);
    } else if (this.filteredTabs.length === 0) {
      this.showEmptyState();
    } else {
      this.showCategories();
    }
  }

  /**
   * FIXED: Extract domain from URL for better search
   */
  getDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '';
    }
  }

  /**
   * FIXED: Show no search results state
   */
  showNoResultsState(query) {
    if (!this.elements.categoriesContainer) return;
    
    this.elements.categoriesContainer.innerHTML = `
      <div class="empty-state show" style="display: flex; position: relative; background: transparent;">
        <span class="empty-icon" aria-hidden="true">🔍</span>
        <h3>No Results Found</h3>
        <p>No tabs match "${this.escapeHtml(query)}"</p>
        <button class="btn btn-secondary" onclick="popupController.clearSearch()">Clear Search</button>
      </div>
    `;
  }

  /**
   * FIXED: Clear search helper method
   */
  clearSearch() {
    if (this.elements.searchInput) {
      this.elements.searchInput.value = '';
    }
    this.handleSearch('');
    this.updateSearchClearButton('');
  }

  /**
   * FIXED: Render tabs using filtered tabs
   */
  renderTabs() {
    if (!this.elements.categoriesContainer) return;

    console.log(`Rendering ${this.filteredTabs.length} tabs (filtered from ${this.tabs.length})`);
    
    this.elements.categoriesContainer.innerHTML = '';

    if (this.filteredTabs.length === 0) {
      if (this.currentSearchQuery) {
        this.showNoResultsState(this.currentSearchQuery);
      } else {
        this.showEmptyState();
      }
      return;
    }

    // Group filtered tabs by category
    const grouped = {};
    this.filteredTabs.forEach(tab => {
      const category = tab.category || 'other';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(tab);
    });

    // Sort categories by tab count (descending)
    const sortedCategories = Object.entries(grouped)
      .sort(([,a], [,b]) => b.length - a.length);

    // Render each category
    sortedCategories.forEach(([category, categoryTabs]) => {
      this.renderCategory(category, categoryTabs);
    });

    // Add search results summary if searching
    if (this.currentSearchQuery) {
      this.addSearchSummary();
    }
  }

  /**
   * FIXED: Add search results summary
   */
  addSearchSummary() {
    if (!this.elements.categoriesContainer || !this.currentSearchQuery) return;
    
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'search-summary';
    summaryDiv.innerHTML = `
      <div style="padding: 12px 16px; background: var(--surface); border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--border);">
        <div style="font-size: 13px; color: var(--text-secondary);">
          Found <strong>${this.filteredTabs.length}</strong> tab${this.filteredTabs.length === 1 ? '' : 's'} 
          matching "<strong>${this.escapeHtml(this.currentSearchQuery)}</strong>"
        </div>
      </div>
    `;
    
    this.elements.categoriesContainer.insertBefore(summaryDiv, this.elements.categoriesContainer.firstChild);
  }

  /**
   * Render a category section
   */
  renderCategory(category, tabs) {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'category-section';
    categoryDiv.dataset.category = category;

    const icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.other;
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);

    categoryDiv.innerHTML = `
      <div class="category-header" onclick="this.parentElement.querySelector('.tab-list').classList.toggle('collapsed'); this.classList.toggle('collapsed');">
        <div class="category-info">
          <span class="category-icon category-${category}">${icon}</span>
          <span class="category-name">${categoryName}</span>
          <span class="category-count">${tabs.length}</span>
        </div>
        <svg class="category-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      <div class="tab-list">
        ${tabs.map(tab => this.renderTab(tab)).join('')}
      </div>
    `;

    this.elements.categoriesContainer.appendChild(categoryDiv);
  }

  /**
   * FIXED: Render a single tab with improved search highlighting
   */
  renderTab(tab) {
    const faviconUrl = tab.favIconUrl || this.getFallbackFavicon(tab.url);
    let title = this.escapeHtml(tab.title || 'Loading...');
    let url = this.escapeHtml(this.formatUrl(tab.url));

    // FIXED: Highlight search terms
    if (this.currentSearchQuery) {
      const query = this.currentSearchQuery.toLowerCase();
      const titleLower = title.toLowerCase();
      const urlLower = url.toLowerCase();
      
      // Highlight in title
      if (titleLower.includes(query)) {
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        title = title.replace(regex, '<mark style="background: #fef08a; padding: 0 2px; border-radius: 2px;">$1</mark>');
      }
      
      // Highlight in URL
      if (urlLower.includes(query)) {
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        url = url.replace(regex, '<mark style="background: #fef08a; padding: 0 2px; border-radius: 2px;">$1</mark>');
      }
    }

    return `
      <div class="tab-item" data-tab-id="${tab.id}">
        <img class="tab-favicon" src="${faviconUrl}" alt="" 
             onerror="this.src='data:image/svg+xml,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;16&quot; height=&quot;16&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;%2364748b&quot; stroke-width=&quot;2&quot;><circle cx=&quot;12&quot; cy=&quot;12&quot; r=&quot;3&quot;/></svg>'">
        <div class="tab-info">
          <div class="tab-title">${title}</div>
          <div class="tab-url">${url}</div>
        </div>
        <div class="tab-actions">
          <button class="tab-action" onclick="popupController.focusTab(${tab.id})" title="Focus Tab">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <circle cx="12" cy="12" r="10"/>
            </svg>
          </button>
          <button class="tab-action" onclick="popupController.closeTab(${tab.id})" title="Close Tab">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * FIXED: Escape regex special characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get fallback favicon
   */
  getFallbackFavicon(url) {
    if (!url) return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%2364748b" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>';
    
    try {
      const hostname = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;
    } catch {
      return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%2364748b" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>';
    }
  }

  /**
   * Format URL for display
   */
  formatUrl(url) {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
    } catch {
      return url;
    }
  }

  /**
   * Escape HTML
   */
  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * FIXED: Handle refresh - preserve search state
   */
  async handleRefresh() {
    if (this.isLoading) return;

    console.log('Refreshing tabs...');
    
    const currentQuery = this.currentSearchQuery; // Preserve search query
    this.showLoadingState();
    
    try {
      await this.loadInitialData();
      
      // Reapply search if there was one
      if (currentQuery) {
        this.currentSearchQuery = currentQuery;
        if (this.elements.searchInput) {
          this.elements.searchInput.value = currentQuery;
        }
        this.handleSearch(currentQuery);
      } else {
        this.renderTabs();
      }
    } catch (error) {
      console.error('Refresh failed:', error);
      this.showErrorState('Failed to refresh tabs');
    } finally {
      this.hideLoadingState();
    }
  }

  /**
   * Handle new tab
   */
  async handleNewTab() {
    try {
      await chrome.tabs.create({});
      window.close();
    } catch (error) {
      console.error('Failed to create new tab:', error);
    }
  }

  /**
   * Handle retry
   */
  async handleRetry() {
    this.retryCount = 0;
    await this.loadInitialData();
    this.renderTabs();
  }

  /**
   * Focus a tab
   */
  async focusTab(tabId) {
    try {
      await chrome.tabs.update(tabId, { active: true });
      const tab = await chrome.tabs.get(tabId);
      await chrome.windows.update(tab.windowId, { focused: true });
      window.close();
    } catch (error) {
      console.error(`Failed to focus tab ${tabId}:`, error);
    }
  }

  /**
   * FIXED: Close a tab - update both original and filtered arrays
   */
  async closeTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
      
      // Remove from both arrays
      this.tabs = this.tabs.filter(tab => tab.id !== tabId);
      this.filteredTabs = this.filteredTabs.filter(tab => tab.id !== tabId);
      
      this.updateTabCount(this.filteredTabs.length);
      this.renderTabs();
    } catch (error) {
      console.error(`Failed to close tab ${tabId}:`, error);
    }
  }

  /**
   * Open settings
   */
  openSettings() {
    if (this.elements.settingsPanel) {
      this.elements.settingsPanel.style.display = 'flex';
      setTimeout(() => this.elements.settingsPanel.classList.add('show'), 10);
    }
  }

  /**
   * Close settings
   */
  closeSettings() {
    if (this.elements.settingsPanel) {
      this.elements.settingsPanel.classList.remove('show');
      setTimeout(() => {
        this.elements.settingsPanel.style.display = 'none';
      }, 300);
    }
  }

  /**
   * Handle initialization error
   */
  handleInitializationError(error) {
    console.error('Initialization error:', error);
    
    this.retryCount++;
    if (this.retryCount < this.maxRetries) {
      console.log(`Retrying initialization (${this.retryCount}/${this.maxRetries})`);
      setTimeout(() => this.init(), 1000 * this.retryCount);
      return;
    }
    
    this.showErrorState('Failed to initialize extension. Please refresh the page.');
  }
}

// Initialize when DOM is ready
let popupController;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded, initializing popup controller');
  
  popupController = new PopupController();
  
  try {
    await popupController.init();
    console.log('Popup controller initialized successfully');
  } catch (error) {
    console.error('Failed to initialize popup controller:', error);
    
    // Show basic error state
    const errorState = document.querySelector('#errorState');
    const errorMessage = document.querySelector('#errorMessage');
    const loadingState = document.querySelector('#loadingState');
    
    if (loadingState) {
      loadingState.style.display = 'none';
      loadingState.classList.remove('show');
    }
    
    if (errorState) {
      errorState.style.display = 'flex';
      errorState.classList.add('show');
      if (errorMessage) {
        errorMessage.textContent = 'Failed to initialize extension. Please refresh the page.';
      }
    }
  }
  
  // Make available globally
  window.popupController = popupController;
});

// Fallback if DOM already loaded
if (document.readyState !== 'loading') {
  const event = new Event('DOMContentLoaded');
  document.dispatchEvent(event);
}