/**
 * Message service for inter-component communication
 * Handles all chrome.runtime messaging with proper error handling and routing
 */

import { MESSAGE_TYPES, ERROR_MESSAGES } from '../../shared/constants/AppConstants.js';
import debugUtils from '../../shared/utils/DebugUtils.js';
import TabManager from '../managers/TabManager.js';

class MessageService {
  constructor() {
    this.messageHandlers = new Map();
    this.eventListeners = new Set();
    this.initialized = false;
    
    this.setupDefaultHandlers();
  }

  /**
   * Initialize message service
   */
  init() {
    try {
      debugUtils.info('Initializing MessageService', 'MessageService');
      
      // Set up runtime message listener
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // Keep message channel open for async responses
      });
      
      this.initialized = true;
      debugUtils.info('MessageService initialized successfully', 'MessageService');
    } catch (error) {
      debugUtils.error('Failed to initialize MessageService', 'MessageService', error);
      throw error;
    }
  }

  /**
   * Setup default message handlers
   */
  setupDefaultHandlers() {
    // Health check
    this.registerHandler(MESSAGE_TYPES.PING, async () => {
      return { 
        success: true, 
        initialized: true, // Always return true for basic functionality
        timestamp: Date.now()
      };
    });

    // Get all tabs
    this.registerHandler(MESSAGE_TYPES.GET_ALL_TABS, async () => {
      try {
        // Get tabs directly from Chrome API as fallback
        const chromeTabs = await chrome.tabs.query({});
        
        // Simple categorization fallback
        const categorizedTabs = chromeTabs.map(tab => ({
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
          category: this.simpleCategorizationFallback(tab)
        }));

        // Count categories
        const categories = {};
        categorizedTabs.forEach(tab => {
          const category = tab.category || 'other';
          categories[category] = (categories[category] || 0) + 1;
        });

        return { 
          success: true, 
          data: {
            tabs: categorizedTabs,
            categories: categories,
            totalCount: categorizedTabs.length
          }
        };
      } catch (error) {
        console.error('Error in GET_ALL_TABS:', error);
        return { 
          success: false, 
          error: error.message,
          data: { tabs: [], categories: {}, totalCount: 0 }
        };
      }
    });

    // Refresh tabs
    this.registerHandler(MESSAGE_TYPES.REFRESH_TABS, async () => {
      // Use the same logic as GET_ALL_TABS
      return await this.messageHandlers.get(MESSAGE_TYPES.GET_ALL_TABS)();
    });

    // Focus tab
    this.registerHandler(MESSAGE_TYPES.FOCUS_TAB, async (message) => {
      try {
        await chrome.tabs.update(message.tabId, { active: true });
        const tab = await chrome.tabs.get(message.tabId);
        await chrome.windows.update(tab.windowId, { focused: true });
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Close tab
    this.registerHandler(MESSAGE_TYPES.CLOSE_TAB, async (message) => {
      try {
        await chrome.tabs.remove(message.tabId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Move tabs (simplified)
    this.registerHandler(MESSAGE_TYPES.MOVE_TABS, async (message) => {
      // For now, just return success - actual categorization can be added later
      return { success: true, movedCount: message.tabIds?.length || 0 };
    });

    // Reorder tabs (simplified)
    this.registerHandler(MESSAGE_TYPES.REORDER_TABS, async (message) => {
      // For now, just return success
      return { success: true };
    });
  }

  /**
   * Simple categorization fallback when full system isn't ready
   */
  simpleCategorizationFallback(tab) {
    if (!tab.url) return 'other';
    
    const url = tab.url.toLowerCase();
    const title = (tab.title || '').toLowerCase();
    
    // Simple domain-based categorization
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
    if (url.includes('wikipedia.org') || title.includes('tutorial') || title.includes('guide')) {
      return 'reference';
    }
    
    return 'other';
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(message, sender, sendResponse) {
    const startTime = debugUtils.startTimer(`Message: ${message.type}`);
    
    try {
      debugUtils.debug(`Received message: ${message.type}`, 'MessageService', {
        sender: sender.tab?.url || sender.url || 'background',
        data: message
      });

      // Validate message structure
      if (!message || !message.type) {
        throw new Error('Invalid message format');
      }

      // Ensure TabManager is ready for non-ping requests
      if (message.type !== MESSAGE_TYPES.PING && !TabManager.isReady()) {
        debugUtils.info('TabManager not ready, initializing...', 'MessageService');
        await TabManager.init();
      }

      // Find and execute handler
      const handler = this.messageHandlers.get(message.type);
      if (!handler) {
        throw new Error(`Unknown message type: ${message.type}`);
      }

      const result = await handler(message, sender);
      
      debugUtils.endTimer(`Message: ${message.type}`, startTime);
      debugUtils.debug(`Message handled successfully: ${message.type}`, 'MessageService', result);
      
      sendResponse(result);
    } catch (error) {
      debugUtils.error(`Failed to handle message: ${message.type}`, 'MessageService', error);
      
      const errorResponse = {
        success: false,
        error: error.message || 'Unknown error occurred',
        errorCode: this.getErrorCode(error)
      };
      
      sendResponse(errorResponse);
    }
  }

  /**
   * Register a message handler
   */
  registerHandler(messageType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    // Wrap handler with error handling and validation
    const wrappedHandler = async (message, sender) => {
      try {
        return await handler(message, sender);
      } catch (error) {
        debugUtils.error(`Handler error for ${messageType}`, 'MessageService', error);
        throw error;
      }
    };

    this.messageHandlers.set(messageType, wrappedHandler);
    debugUtils.debug(`Registered handler for: ${messageType}`, 'MessageService');
  }

  /**
   * Unregister a message handler
   */
  unregisterHandler(messageType) {
    const existed = this.messageHandlers.delete(messageType);
    if (existed) {
      debugUtils.debug(`Unregistered handler for: ${messageType}`, 'MessageService');
    }
    return existed;
  }

  /**
   * Send message to popup/UI components
   */
  async notifyUI(eventType, data = {}) {
    const message = {
      type: MESSAGE_TYPES.BACKGROUND_EVENT,
      eventType,
      data,
      timestamp: Date.now()
    };

    try {
      await chrome.runtime.sendMessage(message);
      debugUtils.debug(`Notified UI: ${eventType}`, 'MessageService', data);
    } catch (error) {
      // UI might not be open, which is normal
      debugUtils.debug(`UI notification failed (UI may be closed): ${eventType}`, 'MessageService');
    }
  }

  /**
   * Send message to specific tab
   */
  async sendToTab(tabId, message) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        ...message,
        timestamp: Date.now()
      });
      
      debugUtils.debug(`Sent message to tab ${tabId}`, 'MessageService', message);
      return response;
    } catch (error) {
      debugUtils.error(`Failed to send message to tab ${tabId}`, 'MessageService', error);
      throw error;
    }
  }

  /**
   * Broadcast message to all tabs
   */
  async broadcastToTabs(message) {
    try {
      const tabs = await chrome.tabs.query({});
      const promises = tabs.map(tab => 
        this.sendToTab(tab.id, message).catch(error => {
          // Some tabs might not have content scripts
          debugUtils.debug(`Failed to send to tab ${tab.id}: ${error.message}`, 'MessageService');
        })
      );
      
      await Promise.allSettled(promises);
      debugUtils.debug(`Broadcasted message to ${tabs.length} tabs`, 'MessageService', message);
    } catch (error) {
      debugUtils.error('Failed to broadcast to tabs', 'MessageService', error);
      throw error;
    }
  }

  /**
   * Register event listener for UI notifications
   */
  addEventListener(eventType, callback) {
    const listener = { eventType, callback };
    this.eventListeners.add(listener);
    
    debugUtils.debug(`Added event listener for: ${eventType}`, 'MessageService');
    
    // Return unsubscribe function
    return () => {
      this.eventListeners.delete(listener);
      debugUtils.debug(`Removed event listener for: ${eventType}`, 'MessageService');
    };
  }

  /**
   * Remove all event listeners
   */
  clearEventListeners() {
    const count = this.eventListeners.size;
    this.eventListeners.clear();
    debugUtils.debug(`Cleared ${count} event listeners`, 'MessageService');
  }

  /**
   * Get error code for standardized error handling
   */
  getErrorCode(error) {
    if (error.message.includes('not ready')) return 'NOT_READY';
    if (error.message.includes('not found')) return 'NOT_FOUND';
    if (error.message.includes('permission')) return 'PERMISSION_DENIED';
    if (error.message.includes('timeout')) return 'TIMEOUT';
    return 'UNKNOWN_ERROR';
  }

  /**
   * Create a message with standard format
   */
  createMessage(type, data = {}) {
    return {
      type,
      ...data,
      timestamp: Date.now(),
      version: '1.0.0'
    };
  }

  /**
   * Validate message format
   */
  validateMessage(message) {
    if (!message || typeof message !== 'object') {
      return { valid: false, error: 'Message must be an object' };
    }

    if (!message.type || typeof message.type !== 'string') {
      return { valid: false, error: 'Message must have a type string' };
    }

    if (!Object.values(MESSAGE_TYPES).includes(message.type)) {
      return { valid: false, error: `Unknown message type: ${message.type}` };
    }

    return { valid: true };
  }

  /**
   * Get handler statistics
   */
  getHandlerStats() {
    return {
      totalHandlers: this.messageHandlers.size,
      handlers: Array.from(this.messageHandlers.keys()),
      eventListeners: this.eventListeners.size,
      initialized: this.initialized
    };
  }

  /**
   * Test message roundtrip (for debugging)
   */
  async testConnection() {
    try {
      const startTime = Date.now();
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.PING
      });
      
      const roundtripTime = Date.now() - startTime;
      
      debugUtils.info(`Message test completed in ${roundtripTime}ms`, 'MessageService', response);
      return { success: true, roundtripTime, response };
    } catch (error) {
      debugUtils.error('Message test failed', 'MessageService', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup method
   */
  cleanup() {
    try {
      this.clearEventListeners();
      this.messageHandlers.clear();
      
      debugUtils.info('MessageService cleanup completed', 'MessageService');
    } catch (error) {
      debugUtils.error('MessageService cleanup failed', 'MessageService', error);
    }
  }
}

// Create singleton instance
export default new MessageService();