/**
 * Debug and logging utilities
 */

import { LOG_LEVELS, EXTENSION_NAME } from '../constants/AppConstants.js';

class DebugUtils {
  constructor() {
    this.logLevel = this.getLogLevel();
    this.isDevelopment = this.checkDevelopmentMode();
  }

  /**
   * Get current log level from storage or default to INFO
   */
  getLogLevel() {
    try {
      // Service workers don't have localStorage, use a fallback
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('debug_log_level') || LOG_LEVELS.INFO;
      } else {
        // In service worker context, use a simple fallback
        return LOG_LEVELS.INFO;
      }
    } catch {
      return LOG_LEVELS.INFO;
    }
  }

  /**
   * Check if extension is in development mode
   */
  checkDevelopmentMode() {
    try {
      // Check if we're in development mode using Chrome extension APIs
      const manifest = chrome?.runtime?.getManifest?.();
      return (
        // Check if version includes 'dev' 
        manifest?.version?.includes('dev') ||
        // Check if we're in unpacked extension mode
        chrome?.runtime?.id?.length === 32 || // Unpacked extensions have 32-char IDs
        // Check if manifest has development indicators
        manifest?.name?.toLowerCase()?.includes('dev') ||
        // Default to false for production
        false
      );
    } catch (error) {
      // If we can't determine, assume production
      return false;
    }
  }

  /**
   * Create formatted log message
   */
  formatMessage(level, message, context = '') {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` [${context}]` : '';
    return `[${timestamp}] ${EXTENSION_NAME}${contextStr} ${level}: ${message}`;
  }

  /**
   * Log error messages
   */
  error(message, context = '', data = null) {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      console.error(this.formatMessage(LOG_LEVELS.ERROR, message, context));
      if (data) console.error('Data:', data);
    }
  }

  /**
   * Log warning messages
   */
  warn(message, context = '', data = null) {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      console.warn(this.formatMessage(LOG_LEVELS.WARN, message, context));
      if (data) console.warn('Data:', data);
    }
  }

  /**
   * Log info messages
   */
  info(message, context = '', data = null) {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      console.info(this.formatMessage(LOG_LEVELS.INFO, message, context));
      if (data) console.info('Data:', data);
    }
  }

  /**
   * Log debug messages
   */
  debug(message, context = '', data = null) {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      console.debug(this.formatMessage(LOG_LEVELS.DEBUG, message, context));
      if (data) console.debug('Data:', data);
    }
  }

  /**
   * Check if message should be logged based on current log level
   */
  shouldLog(level) {
    const levels = Object.values(LOG_LEVELS);
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  /**
   * Performance timing utilities
   */
  startTimer(label) {
    if (this.isDevelopment) {
      console.time(`${EXTENSION_NAME} - ${label}`);
    }
    return performance.now();
  }

  endTimer(label, startTime = null) {
    if (this.isDevelopment) {
      if (startTime) {
        const duration = performance.now() - startTime;
        this.debug(`Timer "${label}" completed in ${duration.toFixed(2)}ms`);
      } else {
        console.timeEnd(`${EXTENSION_NAME} - ${label}`);
      }
    }
  }

  /**
   * Memory usage tracking
   */
  logMemoryUsage(context = '') {
    if (this.isDevelopment && performance.memory) {
      const memory = performance.memory;
      this.debug(`Memory usage${context ? ` (${context})` : ''}:`, '', {
        used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
        total: `${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`,
        limit: `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`
      });
    }
  }

  /**
   * Object deep inspection
   */
  inspect(obj, label = 'Object', maxDepth = 3) {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      this.debug(`${label} inspection:`, '', this.deepClone(obj, maxDepth));
    }
  }

  /**
   * Deep clone object for safe logging (prevents circular references)
   */
  deepClone(obj, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth || obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) return new Date(obj);
    if (obj instanceof Array) return obj.map(item => this.deepClone(item, maxDepth, currentDepth + 1));

    const cloned = {};
    for (const [key, value] of Object.entries(obj)) {
      try {
        cloned[key] = this.deepClone(value, maxDepth, currentDepth + 1);
      } catch (error) {
        cloned[key] = `[Error cloning: ${error.message}]`;
      }
    }
    return cloned;
  }

  /**
   * Stack trace utilities
   */
  getStackTrace() {
    try {
      throw new Error();
    } catch (error) {
      return error.stack;
    }
  }

  logStackTrace(message = 'Stack trace', context = '') {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      this.debug(message, context);
      console.trace();
    }
  }

  /**
   * Function call tracking
   */
  trackFunctionCall(fn, name) {
    if (!this.isDevelopment) return fn;
    
    return (...args) => {
      const startTime = this.startTimer(`Function: ${name}`);
      try {
        const result = fn.apply(this, args);
        this.endTimer(`Function: ${name}`, startTime);
        return result;
      } catch (error) {
        this.error(`Function "${name}" threw error: ${error.message}`, 'FunctionTracker');
        throw error;
      }
    };
  }

  /**
   * Async function call tracking
   */
  trackAsyncFunctionCall(fn, name) {
    if (!this.isDevelopment) return fn;
    
    return async (...args) => {
      const startTime = this.startTimer(`Async Function: ${name}`);
      try {
        const result = await fn.apply(this, args);
        this.endTimer(`Async Function: ${name}`, startTime);
        return result;
      } catch (error) {
        this.error(`Async function "${name}" threw error: ${error.message}`, 'AsyncFunctionTracker');
        throw error;
      }
    };
  }

  /**
   * Set log level dynamically
   */
  setLogLevel(level) {
    if (Object.values(LOG_LEVELS).includes(level)) {
      this.logLevel = level;
      try {
        // Only use localStorage if available (not in service workers)
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('debug_log_level', level);
        }
      } catch {
        // Ignore storage errors in service worker context
      }
      this.info(`Log level set to ${level}`);
    } else {
      this.warn(`Invalid log level: ${level}`);
    }
  }

  /**
   * Clear debug data
   */
  clearDebugData() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('debug_log_level');
        this.info('Debug data cleared');
      }
    } catch (error) {
      this.error('Failed to clear debug data', '', error);
    }
  }
}

// Create singleton instance
const debugUtils = new DebugUtils();

// Export both the class and singleton for flexibility
export { DebugUtils };
export default debugUtils;