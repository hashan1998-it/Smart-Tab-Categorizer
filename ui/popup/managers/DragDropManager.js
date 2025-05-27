/**
 * Drag and Drop Manager
 * Handles drag and drop functionality for tab reordering and categorization
 */

import { MESSAGE_TYPES } from '../../shared/constants/AppConstants.js';
import debugUtils from '../../shared/utils/DebugUtils.js';
import DOMUtils from '../../shared/utils/DOMUtils.js';
import ValidationUtils from '../../shared/utils/ValidationUtils.js';

class DragDropManager {
  constructor(container) {
    this.container = container;
    this.draggedElement = null;
    this.draggedTabId = null;
    this.dropTargets = new Set();
    this.initialized = false;
    
    // Drag state
    this.isDragging = false;
    this.dragStartPosition = { x: 0, y: 0 };
    this.dragOffset = { x: 0, y: 0 };
  }

  /**
   * Initialize drag and drop functionality
   */
  async init() {
    try {
      if (!this.container) {
        throw new Error('Container element is required');
      }

      debugUtils.info('Initializing DragDropManager', 'DragDropManager');
      
      this.setupEventListeners();
      this.initialized = true;
      
      debugUtils.info('DragDropManager initialized successfully', 'DragDropManager');
    } catch (error) {
      debugUtils.error('Failed to initialize DragDropManager', 'DragDropManager', error);
      throw error;
    }
  }

  /**
   * Setup drag and drop event listeners
   */
  setupEventListeners() {
    // Drag start
    this.container.addEventListener('dragstart', (e) => {
      this.handleDragStart(e);
    });

    // Drag over
    this.container.addEventListener('dragover', (e) => {
      this.handleDragOver(e);
    });

    // Drag enter
    this.container.addEventListener('dragenter', (e) => {
      this.handleDragEnter(e);
    });

    // Drag leave
    this.container.addEventListener('dragleave', (e) => {
      this.handleDragLeave(e);
    });

    // Drop
    this.container.addEventListener('drop', (e) => {
      this.handleDrop(e);
    });

    // Drag end
    this.container.addEventListener('dragend', (e) => {
      this.handleDragEnd(e);
    });

    // Touch events for mobile support
    this.container.addEventListener('touchstart', (e) => {
      this.handleTouchStart(e);
    }, { passive: false });

    this.container.addEventListener('touchmove', (e) => {
      this.handleTouchMove(e);
    }, { passive: false });

    this.container.addEventListener('touchend', (e) => {
      this.handleTouchEnd(e);
    }, { passive: false });
  }

  /**
   * Handle drag start
   */
  handleDragStart(e) {
    try {
      const tabItem = e.target.closest('.tab-item');
      if (!tabItem) return;

      const tabId = parseInt(tabItem.dataset.tabId);
      if (!tabId) return;

      this.draggedElement = tabItem;
      this.draggedTabId = tabId;
      this.isDragging = true;

      // Store drag start position
      this.dragStartPosition = {
        x: e.clientX,
        y: e.clientY
      };

      // Set drag data
      e.dataTransfer.setData('text/plain', tabId.toString());
      e.dataTransfer.effectAllowed = 'move';

      // Add dragging class with delay to allow drag image to be created
      setTimeout(() => {
        tabItem.classList.add('dragging');
      }, 0);

      // Find and mark drop targets
      this.markDropTargets();

      debugUtils.debug(`Drag started for tab: ${tabId}`, 'DragDropManager');
    } catch (error) {
      debugUtils.error('Failed to handle drag start', 'DragDropManager', error);
    }
  }

  /**
   * Handle drag over
   */
  handleDragOver(e) {
    e.preventDefault(); // Allow drop
    e.dataTransfer.dropEffect = 'move';

    try {
      const dropTarget = this.getDropTarget(e.target);
      if (dropTarget) {
        this.highlightDropTarget(dropTarget, e);
      }
    } catch (error) {
      debugUtils.error('Failed to handle drag over', 'DragDropManager', error);
    }
  }

  /**
   * Handle drag enter
   */
  handleDragEnter(e) {
    e.preventDefault();
    
    try {
      const dropTarget = this.getDropTarget(e.target);
      if (dropTarget) {
        dropTarget.classList.add('drag-over');
      }
    } catch (error) {
      debugUtils.error('Failed to handle drag enter', 'DragDropManager', error);
    }
  }

  /**
   * Handle drag leave
   */
  handleDragLeave(e) {
    try {
      // Only remove highlight if we're actually leaving the element
      if (!e.currentTarget.contains(e.relatedTarget)) {
        const dropTarget = this.getDropTarget(e.target);
        if (dropTarget) {
          dropTarget.classList.remove('drag-over');
        }
      }
    } catch (error) {
      debugUtils.error('Failed to handle drag leave', 'DragDropManager', error);
    }
  }

  /**
   * Handle drop
   */
  async handleDrop(e) {
    e.preventDefault();

    try {
      const tabId = parseInt(e.dataTransfer.getData('text/plain'));
      if (!tabId || tabId !== this.draggedTabId) return;

      const dropTarget = this.getDropTarget(e.target);
      if (!dropTarget) return;

      await this.processDropAction(tabId, dropTarget, e);
      
      debugUtils.debug(`Drop completed for tab: ${tabId}`, 'DragDropManager');
    } catch (error) {
      debugUtils.error('Failed to handle drop', 'DragDropManager', error);
    }
  }

  /**
   * Handle drag end
   */
  handleDragEnd(e) {
    try {
      // Clean up drag state
      this.cleanupDragState();
      
      debugUtils.debug('Drag ended', 'DragDropManager');
    } catch (error) {
      debugUtils.error('Failed to handle drag end', 'DragDropManager', error);
    }
  }

  /**
   * Handle touch start (mobile)
   */
  handleTouchStart(e) {
    const tabItem = e.target.closest('.tab-item');
    if (!tabItem) return;

    // Check if this is a long press
    this.touchStartTime = Date.now();
    this.touchTimer = setTimeout(() => {
      this.initiateTouchDrag(e, tabItem);
    }, 500); // 500ms long press
  }

  /**
   * Handle touch move (mobile)
   */
  handleTouchMove(e) {
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }

    if (this.isDragging && this.draggedElement) {
      e.preventDefault();
      this.updateTouchDragPosition(e);
    }
  }

  /**
   * Handle touch end (mobile)
   */
  handleTouchEnd(e) {
    if (this.touchTimer) {
      clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }

    if (this.isDragging) {
      this.completeTouchDrag(e);
    }
  }

  /**
   * Initiate touch drag
   */
  initiateTouchDrag(e, tabItem) {
    try {
      const tabId = parseInt(tabItem.dataset.tabId);
      if (!tabId) return;

      this.draggedElement = tabItem;
      this.draggedTabId = tabId;
      this.isDragging = true;

      const touch = e.touches[0];
      this.dragStartPosition = {
        x: touch.clientX,
        y: touch.clientY
      };

      tabItem.classList.add('dragging', 'touch-dragging');
      this.markDropTargets();

      // Provide haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      debugUtils.debug(`Touch drag started for tab: ${tabId}`, 'DragDropManager');
    } catch (error) {
      debugUtils.error('Failed to initiate touch drag', 'DragDropManager', error);
    }
  }

  /**
   * Update touch drag position
   */
  updateTouchDragPosition(e) {
    if (!this.draggedElement) return;

    try {
      const touch = e.touches[0];
      const deltaX = touch.clientX - this.dragStartPosition.x;
      const deltaY = touch.clientY - this.dragStartPosition.y;

      // Update element position
      this.draggedElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

      // Find drop target under touch point
      const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropTarget = this.getDropTarget(elementBelow);
      
      // Update drop target highlighting
      this.clearDropTargetHighlights();
      if (dropTarget) {
        dropTarget.classList.add('drag-over');
      }
    } catch (error) {
      debugUtils.error('Failed to update touch drag position', 'DragDropManager', error);
    }
  }

  /**
   * Complete touch drag
   */
  async completeTouchDrag(e) {
    try {
      if (!this.draggedElement || !this.draggedTabId) return;

      const touch = e.changedTouches[0];
      const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropTarget = this.getDropTarget(elementBelow);

      if (dropTarget) {
        await this.processDropAction(this.draggedTabId, dropTarget, {
          clientX: touch.clientX,
          clientY: touch.clientY
        });
      }

      this.cleanupDragState();
      
      debugUtils.debug('Touch drag completed', 'DragDropManager');
    } catch (error) {
      debugUtils.error('Failed to complete touch drag', 'DragDropManager', error);
    }
  }

  /**
   * Get drop target from element
   */
  getDropTarget(element) {
    if (!element) return null;

    // Check if element is a tab item (for reordering)
    const tabItem = element.closest('.tab-item');
    if (tabItem && tabItem !== this.draggedElement) {
      return tabItem;
    }

    // Check if element is a category section (for moving between categories)
    const categorySection = element.closest('.category-section');
    if (categorySection) {
      return categorySection;
    }

    // Check if element is a category header (for moving to category)
    const categoryHeader = element.closest('.category-header');
    if (categoryHeader) {
      return categoryHeader.closest('.category-section');
    }

    return null;
  }

  /**
   * Mark valid drop targets
   */
  markDropTargets() {
    this.dropTargets.clear();

    // Mark all tab items as drop targets (for reordering)
    const tabItems = this.container.querySelectorAll('.tab-item');
    tabItems.forEach(item => {
      if (item !== this.draggedElement) {
        item.classList.add('drop-target');
        this.dropTargets.add(item);
      }
    });

    // Mark all category sections as drop targets (for moving between categories)
    const categorySections = this.container.querySelectorAll('.category-section');
    categorySections.forEach(section => {
      section.classList.add('drop-target');
      this.dropTargets.add(section);
    });
  }

  /**
   * Highlight drop target
   */
  highlightDropTarget(dropTarget, e) {
    try {
      // Clear previous highlights
      this.clearDropTargetHighlights();

      // Add highlight to current target
      dropTarget.classList.add('drag-over');

      // Show drop indicator if it's a tab item
      if (dropTarget.classList.contains('tab-item')) {
        this.showDropIndicator(dropTarget, e);
      }
    } catch (error) {
      debugUtils.error('Failed to highlight drop target', 'DragDropManager', error);
    }
  }

  /**
   * Show drop indicator for tab reordering
   */
  showDropIndicator(tabItem, e) {
    try {
      // Remove existing indicators
      this.removeDropIndicators();

      // Calculate drop position
      const rect = tabItem.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const isAbove = e.clientY < midpoint;

      // Create drop indicator
      const indicator = DOMUtils.createElement('div', {
        classes: ['drop-indicator'],
        attributes: {
          'data-position': isAbove ? 'above' : 'below'
        }
      });

      // Insert indicator
      if (isAbove) {
        tabItem.parentNode.insertBefore(indicator, tabItem);
      } else {
        tabItem.parentNode.insertBefore(indicator, tabItem.nextSibling);
      }
    } catch (error) {
      debugUtils.error('Failed to show drop indicator', 'DragDropManager', error);
    }
  }

  /**
   * Remove drop indicators
   */
  removeDropIndicators() {
    const indicators = this.container.querySelectorAll('.drop-indicator');
    indicators.forEach(indicator => {
      DOMUtils.removeElement(indicator);
    });
  }

  /**
   * Clear drop target highlights
   */
  clearDropTargetHighlights() {
    this.dropTargets.forEach(target => {
      target.classList.remove('drag-over');
    });
    this.removeDropIndicators();
  }

  /**
   * Process drop action
   */
  async processDropAction(tabId, dropTarget, event) {
    try {
      const validation = ValidationUtils.validateNumberRange(tabId, 1, Number.MAX_SAFE_INTEGER, 'Tab ID');
      if (!validation.valid) {
        throw new Error(validation.errors[0]);
      }

      if (dropTarget.classList.contains('tab-item')) {
        // Reorder tabs within same category
        await this.handleTabReorder(tabId, dropTarget, event);
      } else if (dropTarget.classList.contains('category-section')) {
        // Move tab to different category
        await this.handleCategoryMove(tabId, dropTarget);
      }
    } catch (error) {
      debugUtils.error('Failed to process drop action', 'DragDropManager', error);
    }
  }

  /**
   * Handle tab reordering
   */
  async handleTabReorder(draggedTabId, targetTabItem, event) {
    try {
      const targetTabId = parseInt(targetTabItem.dataset.tabId);
      if (!targetTabId || targetTabId === draggedTabId) return;

      // Get the category from the target tab
      const categorySection = targetTabItem.closest('.category-section');
      if (!categorySection) return;

      const category = categorySection.dataset.category;
      if (!category) return;

      // Determine insertion order based on drop position
      const rect = targetTabItem.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const insertBefore = event.clientY < midpoint;

      // Get all tabs in this category
      const categoryTabs = Array.from(categorySection.querySelectorAll('.tab-item'))
        .map(item => parseInt(item.dataset.tabId))
        .filter(id => !isNaN(id));

      // Create new order
      const newOrder = [...categoryTabs];
      const draggedIndex = newOrder.indexOf(draggedTabId);
      const targetIndex = newOrder.indexOf(targetTabId);

      if (draggedIndex === -1) return;

      // Remove dragged tab from current position
      newOrder.splice(draggedIndex, 1);

      // Insert at new position
      const insertIndex = insertBefore ? targetIndex : targetIndex + 1;
      newOrder.splice(insertIndex, 0, draggedTabId);

      // Send reorder message to background
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.REORDER_TABS,
        tabIds: newOrder,
        category
      });

      debugUtils.info(`Tabs reordered in category: ${category}`, 'DragDropManager');
    } catch (error) {
      debugUtils.error('Failed to handle tab reorder', 'DragDropManager', error);
    }
  }

  /**
   * Handle category move
   */
  async handleCategoryMove(tabId, categorySection) {
    try {
      const newCategory = categorySection.dataset.category;
      if (!newCategory) return;

      // Send move message to background
      await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.MOVE_TABS,
        tabIds: [tabId],
        category: newCategory
      });

      debugUtils.info(`Tab moved to category: ${newCategory}`, 'DragDropManager');
    } catch (error) {
      debugUtils.error('Failed to handle category move', 'DragDropManager', error);
    }
  }

  /**
   * Clean up drag state
   */
  cleanupDragState() {
    try {
      // Remove dragging classes
      if (this.draggedElement) {
        this.draggedElement.classList.remove('dragging', 'touch-dragging');
        this.draggedElement.style.transform = '';
      }

      // Clear drop target highlights
      this.clearDropTargetHighlights();

      // Remove drop target classes
      this.dropTargets.forEach(target => {
        target.classList.remove('drop-target', 'drag-over');
      });
      this.dropTargets.clear();

      // Reset drag state
      this.draggedElement = null;
      this.draggedTabId = null;
      this.isDragging = false;
      this.dragStartPosition = { x: 0, y: 0 };

      // Clear touch timer
      if (this.touchTimer) {
        clearTimeout(this.touchTimer);
        this.touchTimer = null;
      }
    } catch (error) {
      debugUtils.error('Failed to cleanup drag state', 'DragDropManager', error);
    }
  }

  /**
   * Enable drag and drop
   */
  enable() {
    try {
      const tabItems = this.container.querySelectorAll('.tab-item');
      tabItems.forEach(item => {
        item.draggable = true;
      });
      
      this.container.classList.remove('drag-disabled');
      debugUtils.debug('Drag and drop enabled', 'DragDropManager');
    } catch (error) {
      debugUtils.error('Failed to enable drag and drop', 'DragDropManager', error);
    }
  }

  /**
   * Disable drag and drop
   */
  disable() {
    try {
      const tabItems = this.container.querySelectorAll('.tab-item');
      tabItems.forEach(item => {
        item.draggable = false;
      });
      
      this.container.classList.add('drag-disabled');
      this.cleanupDragState();
      
      debugUtils.debug('Drag and drop disabled', 'DragDropManager');
    } catch (error) {
      debugUtils.error('Failed to disable drag and drop', 'DragDropManager', error);
    }
  }

  /**
   * Check if drag and drop is supported
   */
  isSupported() {
    return 'draggable' in document.createElement('div') && 
           'ondrop' in document.createElement('div');
  }

  /**
   * Check if touch drag is supported
   */
  isTouchSupported() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * Get drag and drop metrics
   */
  getMetrics() {
    return {
      initialized: this.initialized,
      isDragging: this.isDragging,
      dragSupported: this.isSupported(),
      touchSupported: this.isTouchSupported(),
      dropTargetsCount: this.dropTargets.size,
      draggedTabId: this.draggedTabId
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    try {
      // Clean up any active drag state
      this.cleanupDragState();
      
      // Disable drag and drop
      this.disable();
      
      debugUtils.info('DragDropManager cleanup completed', 'DragDropManager');
    } catch (error) {
      debugUtils.error('DragDropManager cleanup failed', 'DragDropManager', error);
    }
  }
}

export default DragDropManager;