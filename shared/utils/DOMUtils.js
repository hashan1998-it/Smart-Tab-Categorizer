/**
 * DOM manipulation utilities
 * Provides safe and efficient DOM operations with error handling
 */

import debugUtils from './DebugUtils.js';
import ValidationUtils from './ValidationUtils.js';

class DOMUtils {
  constructor() {
    this.observer = null;
    this.resizeObserver = null;
    this.animationFrameId = null;
  }

  /**
   * Safely query selector with error handling
   */
  querySelector(selector, context = document) {
    try {
      if (!selector || typeof selector !== 'string') {
        throw new Error('Selector must be a non-empty string');
      }
      return context.querySelector(selector);
    } catch (error) {
      debugUtils.error(`Failed to query selector: ${selector}`, 'DOMUtils', error);
      return null;
    }
  }

  /**
   * Safely query selector all with error handling
   */
  querySelectorAll(selector, context = document) {
    try {
      if (!selector || typeof selector !== 'string') {
        throw new Error('Selector must be a non-empty string');
      }
      return Array.from(context.querySelectorAll(selector));
    } catch (error) {
      debugUtils.error(`Failed to query selector all: ${selector}`, 'DOMUtils', error);
      return [];
    }
  }

  /**
   * Create element with attributes and properties
   */
  createElement(tagName, options = {}) {
    try {
      const element = document.createElement(tagName);
      
      // Set attributes
      if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
          element.setAttribute(key, value);
        });
      }
      
      // Set properties
      if (options.properties) {
        Object.entries(options.properties).forEach(([key, value]) => {
          element[key] = value;
        });
      }
      
      // Set classes
      if (options.classes) {
        const classes = Array.isArray(options.classes) ? options.classes : [options.classes];
        element.classList.add(...classes);
      }
      
      // Set content
      if (options.textContent) {
        element.textContent = options.textContent;
      } else if (options.innerHTML) {
        // Validate HTML content before setting
        const validation = ValidationUtils.validateDisplayText(options.innerHTML);
        if (validation.valid) {
          element.innerHTML = validation.sanitized;
        } else {
          debugUtils.warn('Invalid HTML content provided', 'DOMUtils', validation.errors);
          element.textContent = options.innerHTML; // Fallback to text
        }
      }
      
      // Add event listeners
      if (options.events) {
        Object.entries(options.events).forEach(([event, handler]) => {
          element.addEventListener(event, handler);
        });
      }
      
      return element;
    } catch (error) {
      debugUtils.error(`Failed to create element: ${tagName}`, 'DOMUtils', error);
      return null;
    }
  }

  /**
   * Safely remove element from DOM
   */
  removeElement(element) {
    try {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
        return true;
      }
      return false;
    } catch (error) {
      debugUtils.error('Failed to remove element', 'DOMUtils', error);
      return false;
    }
  }

  /**
   * Toggle element visibility with animation
   */
  toggleVisibility(element, visible, duration = 300) {
    if (!element) return Promise.resolve();

    return new Promise((resolve) => {
      const isCurrentlyVisible = element.style.display !== 'none';
      
      if (visible === isCurrentlyVisible) {
        resolve();
        return;
      }

      if (visible) {
        element.style.display = '';
        element.style.opacity = '0';
        element.style.transform = 'translateY(-10px)';
        element.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
        
        requestAnimationFrame(() => {
          element.style.opacity = '1';
          element.style.transform = 'translateY(0)';
          setTimeout(resolve, duration);
        });
      } else {
        element.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
        element.style.opacity = '0';
        element.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
          element.style.display = 'none';
          resolve();
        }, duration);
      }
    });
  }

  /**
   * Add CSS class with optional animation
   */
  addClass(element, className, animate = false) {
    if (!element || !className) return;

    try {
      if (animate) {
        element.style.transition = 'all 0.3s ease';
      }
      element.classList.add(className);
    } catch (error) {
      debugUtils.error(`Failed to add class: ${className}`, 'DOMUtils', error);
    }
  }

  /**
   * Remove CSS class with optional animation
   */
  removeClass(element, className, animate = false) {
    if (!element || !className) return;

    try {
      if (animate) {
        element.style.transition = 'all 0.3s ease';
      }
      element.classList.remove(className);
    } catch (error) {
      debugUtils.error(`Failed to remove class: ${className}`, 'DOMUtils', error);
    }
  }

  /**
   * Toggle CSS class
   */
  toggleClass(element, className, force = null) {
    if (!element || !className) return false;

    try {
      if (force !== null) {
        return element.classList.toggle(className, force);
      }
      return element.classList.toggle(className);
    } catch (error) {
      debugUtils.error(`Failed to toggle class: ${className}`, 'DOMUtils', error);
      return false;
    }
  }

  /**
   * Set element attributes safely
   */
  setAttributes(element, attributes) {
    if (!element || !attributes) return;

    try {
      Object.entries(attributes).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          element.removeAttribute(key);
        } else {
          element.setAttribute(key, String(value));
        }
      });
    } catch (error) {
      debugUtils.error('Failed to set attributes', 'DOMUtils', error);
    }
  }

  /**
   * Get element position relative to viewport
   */
  getElementPosition(element) {
    if (!element) return null;

    try {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2
      };
    } catch (error) {
      debugUtils.error('Failed to get element position', 'DOMUtils', error);
      return null;
    }
  }

  /**
   * Check if element is in viewport
   */
  isElementInViewport(element, threshold = 0) {
    if (!element) return false;

    try {
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      const windowWidth = window.innerWidth || document.documentElement.clientWidth;

      return (
        rect.top >= -threshold &&
        rect.left >= -threshold &&
        rect.bottom <= windowHeight + threshold &&
        rect.right <= windowWidth + threshold
      );
    } catch (error) {
      debugUtils.error('Failed to check viewport intersection', 'DOMUtils', error);
      return false;
    }
  }

  /**
   * Scroll element into view smoothly
   */
  scrollIntoView(element, options = {}) {
    if (!element) return;

    try {
      const defaultOptions = {
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      };

      element.scrollIntoView({ ...defaultOptions, ...options });
    } catch (error) {
      debugUtils.error('Failed to scroll element into view', 'DOMUtils', error);
    }
  }

  /**
   * Debounced event listener
   */
  addDebouncedEventListener(element, event, handler, delay = 250) {
    if (!element || !event || !handler) return null;

    let timeoutId = null;
    const debouncedHandler = (e) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => handler(e), delay);
    };

    try {
      element.addEventListener(event, debouncedHandler);
      return () => {
        element.removeEventListener(event, debouncedHandler);
        clearTimeout(timeoutId);
      };
    } catch (error) {
      debugUtils.error(`Failed to add debounced event listener: ${event}`, 'DOMUtils', error);
      return null;
    }
  }

  /**
   * Throttled event listener
   */
  addThrottledEventListener(element, event, handler, delay = 100) {
    if (!element || !event || !handler) return null;

    let lastCall = 0;
    const throttledHandler = (e) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        handler(e);
      }
    };

    try {
      element.addEventListener(event, throttledHandler);
      return () => element.removeEventListener(event, throttledHandler);
    } catch (error) {
      debugUtils.error(`Failed to add throttled event listener: ${event}`, 'DOMUtils', error);
      return null;
    }
  }

  /**
   * Create and manage intersection observer
   */
  createIntersectionObserver(callback, options = {}) {
    if (!callback) return null;

    try {
      const defaultOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
      };

      const observer = new IntersectionObserver(callback, { ...defaultOptions, ...options });
      
      return {
        observer,
        observe: (element) => observer.observe(element),
        unobserve: (element) => observer.unobserve(element),
        disconnect: () => observer.disconnect()
      };
    } catch (error) {
      debugUtils.error('Failed to create intersection observer', 'DOMUtils', error);
      return null;
    }
  }

  /**
   * Create and manage resize observer
   */
  createResizeObserver(callback) {
    if (!callback || !window.ResizeObserver) return null;

    try {
      const observer = new ResizeObserver(callback);
      
      return {
        observer,
        observe: (element) => observer.observe(element),
        unobserve: (element) => observer.unobserve(element),
        disconnect: () => observer.disconnect()
      };
    } catch (error) {
      debugUtils.error('Failed to create resize observer', 'DOMUtils', error);
      return null;
    }
  }

  /**
   * Measure text width
   */
  measureTextWidth(text, font = '14px Arial') {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      context.font = font;
      return context.measureText(text).width;
    } catch (error) {
      debugUtils.error('Failed to measure text width', 'DOMUtils', error);
      return 0;
    }
  }

  /**
   * Create loading spinner element
   */
  createLoadingSpinner(size = 32) {
    return this.createElement('div', {
      classes: ['loading-spinner'],
      attributes: {
        'aria-label': 'Loading'
      },
      properties: {
        style: `
          width: ${size}px;
          height: ${size}px;
          border: 3px solid #e2e8f0;
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        `
      }
    });
  }

  /**
   * Create error message element
   */
  createErrorMessage(message, type = 'error') {
    const iconMap = {
      error: '⚠️',
      warning: '⚠️',
      info: 'ℹ️',
      success: '✅'
    };

    return this.createElement('div', {
      classes: [`message`, `message-${type}`],
      innerHTML: `
        <span class="message-icon">${iconMap[type] || '⚠️'}</span>
        <span class="message-text">${ValidationUtils.sanitizeHtml(message)}</span>
      `
    });
  }

  /**
   * Animate element with CSS keyframes
   */
  animateElement(element, keyframes, duration = 300) {
    if (!element) return Promise.resolve();

    return new Promise((resolve) => {
      try {
        const animation = element.animate(keyframes, {
          duration,
          easing: 'ease-out',
          fill: 'forwards'
        });

        animation.addEventListener('finish', resolve);
        animation.addEventListener('cancel', resolve);
      } catch (error) {
        debugUtils.error('Failed to animate element', 'DOMUtils', error);
        resolve();
      }
    });
  }

  /**
   * Fade in animation
   */
  fadeIn(element, duration = 300) {
    return this.animateElement(element, [
      { opacity: 0, transform: 'translateY(-10px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], duration);
  }

  /**
   * Fade out animation
   */
  fadeOut(element, duration = 300) {
    return this.animateElement(element, [
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: 'translateY(-10px)' }
    ], duration);
  }

  /**
   * Scale in animation
   */
  scaleIn(element, duration = 300) {
    return this.animateElement(element, [
      { transform: 'scale(0.8)', opacity: 0 },
      { transform: 'scale(1)', opacity: 1 }
    ], duration);
  }

  /**
   * Slide down animation
   */
  slideDown(element, duration = 300) {
    if (!element) return Promise.resolve();

    return new Promise((resolve) => {
      try {
        element.style.height = '0';
        element.style.overflow = 'hidden';
        element.style.transition = `height ${duration}ms ease`;

        requestAnimationFrame(() => {
          const targetHeight = element.scrollHeight;
          element.style.height = `${targetHeight}px`;

          setTimeout(() => {
            element.style.height = '';
            element.style.overflow = '';
            element.style.transition = '';
            resolve();
          }, duration);
        });
      } catch (error) {
        debugUtils.error('Failed to slide down element', 'DOMUtils', error);
        resolve();
      }
    });
  }

  /**
   * Slide up animation
   */
  slideUp(element, duration = 300) {
    if (!element) return Promise.resolve();

    return new Promise((resolve) => {
      try {
        const currentHeight = element.offsetHeight;
        element.style.height = `${currentHeight}px`;
        element.style.overflow = 'hidden';
        element.style.transition = `height ${duration}ms ease`;

        requestAnimationFrame(() => {
          element.style.height = '0';

          setTimeout(() => {
            element.style.display = 'none';
            element.style.height = '';
            element.style.overflow = '';
            element.style.transition = '';
            resolve();
          }, duration);
        });
      } catch (error) {
        debugUtils.error('Failed to slide up element', 'DOMUtils', error);
        resolve();
      }
    });
  }

  /**
   * Copy text to clipboard
   */
  async copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      }
    } catch (error) {
      debugUtils.error('Failed to copy to clipboard', 'DOMUtils', error);
      return false;
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Escape HTML entities
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
   * Truncate text with ellipsis
   */
  truncateText(text, maxLength, suffix = '...') {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Get computed style property
   */
  getComputedStyleProperty(element, property) {
    if (!element) return null;

    try {
      const computedStyle = window.getComputedStyle(element);
      return computedStyle.getPropertyValue(property);
    } catch (error) {
      debugUtils.error(`Failed to get computed style: ${property}`, 'DOMUtils', error);
      return null;
    }
  }

  /**
   * Check if element has focus or contains focused element
   */
  hasFocus(element) {
    if (!element) return false;
    return element === document.activeElement || element.contains(document.activeElement);
  }

  /**
   * Get all focusable elements within a container
   */
  getFocusableElements(container = document) {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    return this.querySelectorAll(focusableSelectors, container)
      .filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
  }

  /**
   * Set up keyboard navigation for a container
   */
  setupKeyboardNavigation(container, options = {}) {
    if (!container) return null;

    const {
      loop = true,
      autoFocus = false,
      onNavigate = null
    } = options;

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
        return;
      }

      const focusableElements = this.getFocusableElements(container);
      if (focusableElements.length === 0) return;

      const currentIndex = focusableElements.indexOf(document.activeElement);
      let nextIndex;

      if (e.key === 'Tab') {
        nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;
      } else if (e.key === 'ArrowUp') {
        nextIndex = currentIndex - 1;
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        nextIndex = currentIndex + 1;
        e.preventDefault();
      }

      if (loop) {
        if (nextIndex < 0) nextIndex = focusableElements.length - 1;
        if (nextIndex >= focusableElements.length) nextIndex = 0;
      } else {
        nextIndex = Math.max(0, Math.min(nextIndex, focusableElements.length - 1));
      }

      if (focusableElements[nextIndex]) {
        focusableElements[nextIndex].focus();
        if (onNavigate) {
          onNavigate(focusableElements[nextIndex], nextIndex);
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    if (autoFocus) {
      const firstFocusable = this.getFocusableElements(container)[0];
      if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 0);
      }
    }

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    try {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }

      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      debugUtils.info('DOMUtils cleanup completed', 'DOMUtils');
    } catch (error) {
      debugUtils.error('DOMUtils cleanup failed', 'DOMUtils', error);
    }
  }
}

// Create singleton instance
export default new DOMUtils();