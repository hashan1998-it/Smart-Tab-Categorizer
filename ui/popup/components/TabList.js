/**
 * Tab List Component
 * Renders and manages the list of tabs organized by categories
 */

import { CATEGORIES, CATEGORY_ICONS, CATEGORY_ORDER } from '../../shared/constants/AppConstants.js';
import debugUtils from '../../shared/utils/DebugUtils.js';
import DOMUtils from '../../shared/utils/DOMUtils.js';
import ValidationUtils from '../../shared/utils/ValidationUtils.js';
import UIStateManager from '../managers/UIStateManager.js';

class TabList {
  constructor(container) {
    this.container = container;
    this.tabElements = new Map();
    this.categoryElements = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the tab list component
   */
  async init() {
    try {
      if (!this.container) {
        throw new Error('Container element is required');
      }

      debugUtils.info('Initializing TabList component', 'TabList');
      
      this.setupEventListeners();
      this.initialized = true;
      
      debugUtils.info('TabList component initialized successfully', 'TabList');
    } catch (error) {
      debugUtils.error('Failed to initialize TabList component', 'TabList', error);
      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Subscribe to UI state changes
    UIStateManager.subscribe((updates) => {
      if ('collapsedCategories' in updates) {
        this.updateCategoryCollapse();
      }
    }, ['collapsedCategories']);
  }

  /**
   * Render tabs organized by categories
   */
  render(tabs, categories) {
    if (!this.initialized) {
      console.warn('TabList not initialized, skipping render');
      return;
    }

    try {
      console.log(`Rendering ${tabs.length} tabs with categories:`, categories);
      
      // Clear existing content
      this.container.innerHTML = '';
      this.tabElements.clear();
      this.categoryElements.clear();

      // Handle empty state
      if (!tabs || tabs.length === 0) {
        this.renderEmptyState();
        return;
      }

      // Group tabs by category
      const groupedTabs = this.groupTabsByCategory(tabs);
      console.log('Grouped tabs:', groupedTabs);
      
      // Render each category that has tabs
      CATEGORY_ORDER.forEach(category => {
        const categoryTabs = groupedTabs[category];
        if (categoryTabs && categoryTabs.length > 0) {
          console.log(`Rendering category: ${category} with ${categoryTabs.length} tabs`);
          this.renderCategory(category, categoryTabs, categoryTabs.length);
        }
      });

      // If no categories were rendered, show a message
      if (this.categoryElements.size === 0) {
        this.renderNoCategories();
      }

    } catch (error) {
      console.error('Failed to render tab list:', error);
      this.renderError('Failed to display tabs');
    }
  }

  /**
   * Render empty state when no tabs
   */
  renderEmptyState() {
    this.container.innerHTML = `
      <div class="tab-list-empty">
        <div class="empty-icon">📂</div>
        <div class="empty-message">No tabs found</div>
        <div class="empty-description">Open some tabs to get started!</div>
      </div>
    `;
  }

  /**
   * Render message when no categories found
   */
  renderNoCategories() {
    this.container.innerHTML = `
      <div class="tab-list-empty">
        <div class="empty-icon">🔍</div>
        <div class="empty-message">No categorized tabs</div>
        <div class="empty-description">Tabs are being organized...</div>
      </div>
    `;
  }

  /**
   * Group tabs by category
   */
  groupTabsByCategory(tabs) {
    const grouped = {};
    
    console.log('Grouping tabs by category:', tabs);
    
    tabs.forEach(tab => {
      const category = tab.category || CATEGORIES.OTHER;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(tab);
      console.log(`Tab "${tab.title}" assigned to category: ${category}`);
    });

    // Sort tabs within each category by lastAccessed
    Object.values(grouped).forEach(categoryTabs => {
      categoryTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
    });

    console.log('Final grouped tabs:', grouped);
    return grouped;
  }

  /**
   * Render a category section
   */
  renderCategory(category, tabs, count) {
    try {
      const categoryElement = this.createCategoryElement(category, tabs, count);
      this.container.appendChild(categoryElement);
      this.categoryElements.set(category, categoryElement);
    } catch (error) {
      debugUtils.error(`Failed to render category: ${category}`, 'TabList', error);
    }
  }

  /**
   * Create category element
   */
  createCategoryElement(category, tabs, count) {
    const isCollapsed = UIStateManager.isCategoryCollapsed(category);
    
    const categoryElement = DOMUtils.createElement('div', {
      classes: ['category-section'],
      attributes: {
        'data-category': category
      }
    });

    // Create header
    const header = this.createCategoryHeader(category, count, isCollapsed);
    categoryElement.appendChild(header);

    // Create tab list
    const tabList = this.createTabListElement(tabs, isCollapsed);
    categoryElement.appendChild(tabList);

    return categoryElement;
  }

  /**
   * Create category header
   */
  createCategoryHeader(category, count, isCollapsed) {
    const capitalizedCategory = category.charAt(0).toUpperCase() + category.slice(1);
    const icon = CATEGORY_ICONS[category] || '📁';

    const header = DOMUtils.createElement('div', {
      classes: ['category-header', isCollapsed ? 'collapsed' : ''],
      innerHTML: `
        <div class="category-info">
          <span class="category-icon category-${category}">${icon}</span>
          <span class="category-name">${capitalizedCategory}</span>
          <span class="category-count">${count}</span>
        </div>
        <svg class="category-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      `
    });

    // Add click handler for collapse/expand
    header.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleCategoryCollapse(category);
    });

    return header;
  }

  /**
   * Create tab list element
   */
  createTabListElement(tabs, isCollapsed) {
    const tabList = DOMUtils.createElement('div', {
      classes: ['tab-list', isCollapsed ? 'collapsed' : '']
    });

    tabs.forEach(tab => {
      const tabElement = this.createTabElement(tab);
      tabList.appendChild(tabElement);
      this.tabElements.set(tab.id, tabElement);
    });

    return tabList;
  }

  /**
   * Create individual tab element
   */
  createTabElement(tab) {
    const validation = ValidationUtils.validateTabData(tab);
    if (!validation.valid) {
      debugUtils.warn('Invalid tab data', 'TabList', validation.errors);
    }

    const faviconUrl = tab.favIconUrl || this.getFallbackFavicon(tab.url);
    const title = ValidationUtils.sanitizeHtml(tab.title || 'Loading...');
    const url = this.formatUrl(tab.url);

    const tabElement = DOMUtils.createElement('div', {
      classes: ['tab-item'],
      attributes: {
        'data-tab-id': tab.id,
        'draggable': 'true'
      },
      innerHTML: `
        <img class="tab-favicon" src="${faviconUrl}" alt="" loading="lazy">
        <div class="tab-info">
          <div class="tab-title">${title}</div>
          <div class="tab-url">${ValidationUtils.sanitizeHtml(url)}</div>
        </div>
        <div class="tab-actions">
          <select class="tab-category-select" title="Change Category" aria-label="Change category for ${title}">
            <option value="">Move to...</option>
            ${this.generateCategoryOptions(tab.category)}
          </select>
          <button class="tab-action" title="Focus Tab" data-action="focus" aria-label="Focus ${title}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <circle cx="12" cy="12" r="10"/>
            </svg>
          </button>
          <button class="tab-action" title="Close Tab" data-action="close" aria-label="Close ${title}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `
    });

    this.setupTabEventListeners(tabElement, tab);
    return tabElement;
  }

  /**
   * Setup event listeners for tab element
   */
  setupTabEventListeners(tabElement, tab) {
    // Main click handler (focus tab)
    tabElement.addEventListener('click', (e) => {
      if (!e.target.closest('.tab-action, .tab-category-select')) {
        this.handleTabClick(tab.id);
      }
    });

    // Favicon error handler
    const favicon = tabElement.querySelector('.tab-favicon');
    if (favicon) {
      favicon.addEventListener('error', () => {
        favicon.src = this.getFallbackFavicon();
      });
    }

    // Action buttons
    const focusBtn = tabElement.querySelector('[data-action="focus"]');
    const closeBtn = tabElement.querySelector('[data-action="close"]');
    const categorySelect = tabElement.querySelector('.tab-category-select');

    if (focusBtn) {
      focusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleTabFocus(tab.id);
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleTabClose(tab.id);
      });
    }

    if (categorySelect) {
      categorySelect.addEventListener('change', async (e) => {
        const newCategory = e.target.value;
        if (newCategory) {
          await this.handleCategoryChange(tab.id, newCategory);
          e.target.value = ''; // Reset select
        }
      });
    }

    // Drag handlers
    tabElement.addEventListener('dragstart', (e) => {
      this.handleDragStart(e, tab);
    });

    tabElement.addEventListener('dragend', (e) => {
      this.handleDragEnd(e, tab);
    });
  }

  /**
   * Generate category options for select dropdown
   */
  generateCategoryOptions(currentCategory) {
    return CATEGORY_ORDER.map(category => {
      const capitalizedCategory = category.charAt(0).toUpperCase() + category.slice(1);
      const selected = category === currentCategory ? 'selected' : '';
      return `<option value="${category}" ${selected}>${capitalizedCategory}</option>`;
    }).join('');
  }

  /**
   * Get fallback favicon
   */
  getFallbackFavicon(url = '') {
    if (url) {
      try {
        const hostname = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;
      } catch {
        // Invalid URL, return default icon
      }
    }
    
    return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%2364748b" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>';
  }

  /**
   * Format URL for display
   */
  formatUrl(url) {
    if (!url) return '';
    
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname === '/' ? '' : urlObj.pathname;
      return `${urlObj.hostname}${path}`;
    } catch {
      return url;
    }
  }

  /**
   * Toggle category collapse state
   */
  toggleCategoryCollapse(category) {
    UIStateManager.toggleCategoryCollapse(category);
    this.updateCategoryCollapse();
  }

  /**
   * Update category collapse states
   */
  updateCategoryCollapse() {
    this.categoryElements.forEach((element, category) => {
      const isCollapsed = UIStateManager.isCategoryCollapsed(category);
      const header = element.querySelector('.category-header');
      const tabList = element.querySelector('.tab-list');

      if (header && tabList) {
        header.classList.toggle('collapsed', isCollapsed);
        tabList.classList.toggle('collapsed', isCollapsed);
      }
    });
  }

  /**
   * Handle tab click (focus)
   */
  async handleTabClick(tabId) {
    try {
      await window.popupController?.focusTab(tabId);
    } catch (error) {
      debugUtils.error(`Failed to handle tab click: ${tabId}`, 'TabList', error);
    }
  }

  /**
   * Handle tab focus
   */
  async handleTabFocus(tabId) {
    try {
      await window.popupController?.focusTab(tabId);
    } catch (error) {
      debugUtils.error(`Failed to focus tab: ${tabId}`, 'TabList', error);
    }
  }

  /**
   * Handle tab close
   */
  async handleTabClose(tabId) {
    try {
      // Add closing animation
      const tabElement = this.tabElements.get(tabId);
      if (tabElement) {
        await DOMUtils.fadeOut(tabElement, 200);
      }

      await window.popupController?.closeTab(tabId);
    } catch (error) {
      debugUtils.error(`Failed to close tab: ${tabId}`, 'TabList', error);
    }
  }

  /**
   * Handle category change
   */
  async handleCategoryChange(tabId, newCategory) {
    try {
      await window.popupController?.moveTabs([tabId], newCategory);
    } catch (error) {
      debugUtils.error(`Failed to change category for tab: ${tabId}`, 'TabList', error);
    }
  }

  /**
   * Handle drag start
   */
  handleDragStart(e, tab) {
    e.dataTransfer.setData('text/plain', tab.id.toString());
    e.dataTransfer.effectAllowed = 'move';
    
    const tabElement = e.currentTarget;
    tabElement.classList.add('dragging');
    
    debugUtils.debug(`Drag started for tab: ${tab.id}`, 'TabList');
  }

  /**
   * Handle drag end
   */
  handleDragEnd(e, tab) {
    const tabElement = e.currentTarget;
    tabElement.classList.remove('dragging');
    
    // Remove any drag-over effects
    this.container.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
    
    debugUtils.debug(`Drag ended for tab: ${tab.id}`, 'TabList');
  }

  /**
   * Render error state
   */
  renderError(message) {
    this.container.innerHTML = '';
    
    const errorElement = DOMUtils.createElement('div', {
      classes: ['tab-list-error'],
      innerHTML: `
        <div class="error-icon">⚠️</div>
        <div class="error-message">${ValidationUtils.sanitizeHtml(message)}</div>
      `
    });
    
    this.container.appendChild(errorElement);
  }

  /**
   * Update single tab element
   */
  updateTab(tab) {
    const existingElement = this.tabElements.get(tab.id);
    if (existingElement) {
      const newElement = this.createTabElement(tab);
      existingElement.parentNode?.replaceChild(newElement, existingElement);
      this.tabElements.set(tab.id, newElement);
    }
  }

  /**
   * Remove tab element
   */
  removeTab(tabId) {
    const tabElement = this.tabElements.get(tabId);
    if (tabElement) {
      DOMUtils.fadeOut(tabElement, 200).then(() => {
        DOMUtils.removeElement(tabElement);
        this.tabElements.delete(tabId);
      });
    }
  }

  /**
   * Add tab element
   */
  addTab(tab) {
    try {
      const categoryElement = this.categoryElements.get(tab.category);
      if (categoryElement) {
        const tabList = categoryElement.querySelector('.tab-list');
        if (tabList) {
          const tabElement = this.createTabElement(tab);
          tabList.appendChild(tabElement);
          this.tabElements.set(tab.id, tabElement);
          
          // Animate in
          DOMUtils.fadeIn(tabElement, 200);
        }
      }
    } catch (error) {
      debugUtils.error('Failed to add tab element', 'TabList', error);
    }
  }

  /**
   * Get tab element by ID
   */
  getTabElement(tabId) {
    return this.tabElements.get(tabId);
  }

  /**
   * Get category element by name
   */
  getCategoryElement(category) {
    return this.categoryElements.get(category);
  }

  /**
   * Get component metrics
   */
  getMetrics() {
    return {
      initialized: this.initialized,
      tabElementsCount: this.tabElements.size,
      categoryElementsCount: this.categoryElements.size,
      containerElement: !!this.container
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    try {
      // Clear containers
      if (this.container) {
        this.container.innerHTML = '';
      }
      
      // Clear maps
      this.tabElements.clear();
      this.categoryElements.clear();
      
      debugUtils.info('TabList component cleanup completed', 'TabList');
    } catch (error) {
      debugUtils.error('TabList component cleanup failed', 'TabList', error);
    }
  }
}

export default TabList;