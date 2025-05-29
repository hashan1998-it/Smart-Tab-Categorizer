/**
 * Notification Manager
 * Handles in-app notifications and user feedback
 */

export class NotificationManager {
    constructor() {
      this.container = null;
      this.notifications = new Map();
      this.defaultDuration = 4000;
      this.maxNotifications = 5;
      this.initialized = false;
    }
  
    /**
     * Initialize notification manager
     */
    init() {
      try {
        this.setupContainer();
        this.initialized = true;
        console.log('NotificationManager initialized');
      } catch (error) {
        console.error('Failed to initialize NotificationManager:', error);
      }
    }
  
    /**
     * Setup notification container
     */
    setupContainer() {
      this.container = document.querySelector('#notificationContainer');
      
      if (!this.container) {
        // Create container if it doesn't exist
        this.container = document.createElement('div');
        this.container.id = 'notificationContainer';
        this.container.style.cssText = `
          position: fixed;
          top: 80px;
          left: 16px;
          right: 16px;
          z-index: 1000;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          gap: 8px;
        `;
        document.body.appendChild(this.container);
      }
    }
  
    /**
     * Show notification
     */
    show(message, type = 'info', duration = null) {
      if (!this.initialized) {
        console.warn('NotificationManager not initialized');
        return null;
      }
  
      const id = this.generateId();
      const notificationDuration = duration || this.defaultDuration;
  
      // Remove oldest notification if at max capacity
      if (this.notifications.size >= this.maxNotifications) {
        const oldestId = this.notifications.keys().next().value;
        this.hide(oldestId);
      }
  
      const notification = this.createNotificationElement(id, message, type);
      this.container.appendChild(notification);
  
      // Store notification reference
      this.notifications.set(id, {
        element: notification,
        type,
        message,
        createdAt: Date.now()
      });
  
      // Animate in
      requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
      });
  
      // Auto-hide after duration
      if (notificationDuration > 0) {
        setTimeout(() => {
          this.hide(id);
        }, notificationDuration);
      }
  
      console.log(`Notification shown: ${type} - ${message}`);
      return id;
    }
  
    /**
     * Create notification element
     */
    createNotificationElement(id, message, type) {
      const notification = document.createElement('div');
      notification.className = `notification notification-${type}`;
      notification.dataset.id = id;
      notification.style.cssText = `
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
        pointer-events: auto;
      `;
  
      const icon = this.getIcon(type);
      
      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">${icon}</span>
          <span class="notification-message">${this.escapeHtml(message)}</span>
        </div>
        <button class="notification-close" onclick="notificationManager.hide('${id}')" title="Close">
          ×
        </button>
      `;
  
      return notification;
    }
  
    /**
     * Get icon for notification type
     */
    getIcon(type) {
      const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
      };
      return icons[type] || icons.info;
    }
  
    /**
     * Hide notification
     */
    hide(id) {
      const notification = this.notifications.get(id);
      if (!notification) return;
  
      const element = notification.element;
      
      // Animate out
      element.style.opacity = '0';
      element.style.transform = 'translateY(-20px)';
      
      // Remove after animation
      setTimeout(() => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
        this.notifications.delete(id);
      }, 300);
    }
  
    /**
     * Hide all notifications
     */
    hideAll() {
      Array.from(this.notifications.keys()).forEach(id => {
        this.hide(id);
      });
    }
  
    /**
     * Show success notification
     */
    success(message, duration = null) {
      return this.show(message, 'success', duration);
    }
  
    /**
     * Show error notification
     */
    error(message, duration = null) {
      return this.show(message, 'error', duration || 6000); // Errors stay longer
    }
  
    /**
     * Show warning notification
     */
    warning(message, duration = null) {
      return this.show(message, 'warning', duration);
    }
  
    /**
     * Show info notification
     */
    info(message, duration = null) {
      return this.show(message, 'info', duration);
    }
  
    /**
     * Generate unique ID
     */
    generateId() {
      return 'notification_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  
    /**
     * Escape HTML to prevent XSS
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
     * Get notification count
     */
    getCount() {
      return this.notifications.size;
    }
  
    /**
     * Get all active notifications
     */
    getAll() {
      return Array.from(this.notifications.values());
    }
  
    /**
     * Clear expired notifications
     */
    cleanup() {
      const now = Date.now();
      const maxAge = 30000; // 30 seconds
  
      for (const [id, notification] of this.notifications.entries()) {
        if (now - notification.createdAt > maxAge) {
          this.hide(id);
        }
      }
    }
  
    /**
     * Destroy notification manager
     */
    destroy() {
      this.hideAll();
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.notifications.clear();
      this.initialized = false;
      console.log('NotificationManager destroyed');
    }
  }
  
  export default NotificationManager;