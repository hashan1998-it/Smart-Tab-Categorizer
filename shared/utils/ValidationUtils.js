/**
 * Input validation utilities
 * Provides comprehensive validation functions for user inputs and data integrity
 */

import { CATEGORIES, LIMITS } from '../constants/AppConstants.js';
import debugUtils from './DebugUtils.js';

class ValidationUtils {
  constructor() {
    this.emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.urlRegex = /^https?:\/\/.+/i;
    this.domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  }

  /**
   * Validate tab data structure
   */
  validateTabData(tab) {
    const errors = [];

    if (!tab || typeof tab !== 'object') {
      return { valid: false, errors: ['Tab must be an object'] };
    }

    // Required fields
    if (typeof tab.id !== 'number' || tab.id <= 0) {
      errors.push('Tab ID must be a positive number');
    }

    if (!tab.title || typeof tab.title !== 'string') {
      errors.push('Tab title is required and must be a string');
    } else if (tab.title.length > 500) {
      errors.push('Tab title is too long (max 500 characters)');
    }

    if (!tab.url || typeof tab.url !== 'string') {
      errors.push('Tab URL is required and must be a string');
    } else if (!this.isValidUrl(tab.url)) {
      errors.push('Tab URL is not valid');
    }

    // Optional fields validation
    if (tab.favIconUrl && !this.isValidUrl(tab.favIconUrl)) {
      errors.push('Favicon URL is not valid');
    }

    if (tab.category && !Object.values(CATEGORIES).includes(tab.category)) {
      errors.push(`Invalid category: ${tab.category}`);
    }

    if (tab.windowId && (typeof tab.windowId !== 'number' || tab.windowId <= 0)) {
      errors.push('Window ID must be a positive number');
    }

    if (tab.createdAt && (typeof tab.createdAt !== 'number' || tab.createdAt <= 0)) {
      errors.push('Created timestamp must be a positive number');
    }

    if (tab.lastAccessed && (typeof tab.lastAccessed !== 'number' || tab.lastAccessed <= 0)) {
      errors.push('Last accessed timestamp must be a positive number');
    }

    if (tab.accessCount && (typeof tab.accessCount !== 'number' || tab.accessCount < 0)) {
      errors.push('Access count must be a non-negative number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate URL format
   */
  isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      new URL(url);
      return this.urlRegex.test(url);
    } catch {
      return false;
    }
  }

  /**
   * Validate domain format
   */
  isValidDomain(domain) {
    if (!domain || typeof domain !== 'string') return false;
    
    // Remove protocol if present
    const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0];
    return this.domainRegex.test(cleanDomain);
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return this.emailRegex.test(email);
  }

  /**
   * Validate search query
   */
  validateSearchQuery(query) {
    const errors = [];

    if (typeof query !== 'string') {
      return { valid: false, errors: ['Search query must be a string'] };
    }

    if (query.length > 200) {
      errors.push('Search query is too long (max 200 characters)');
    }

    // Check for potentially harmful patterns
    const harmfulPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i
    ];

    if (harmfulPatterns.some(pattern => pattern.test(query))) {
      errors.push('Search query contains potentially harmful content');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this.sanitizeString(query)
    };
  }

  /**
   * Validate category name
   */
  validateCategory(category) {
    const errors = [];

    if (!category || typeof category !== 'string') {
      return { valid: false, errors: ['Category must be a non-empty string'] };
    }

    if (!Object.values(CATEGORIES).includes(category)) {
      errors.push(`Invalid category: ${category}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate custom rule input
   */
  validateCustomRule(category, value, type = 'auto') {
    const errors = [];

    // Validate category
    const categoryValidation = this.validateCategory(category);
    if (!categoryValidation.valid) {
      errors.push(...categoryValidation.errors);
    }

    // Validate value
    if (!value || typeof value !== 'string') {
      errors.push('Rule value must be a non-empty string');
    } else {
      const trimmedValue = value.trim();
      
      if (trimmedValue.length === 0) {
        errors.push('Rule value cannot be empty');
      } else if (trimmedValue.length > 100) {
        errors.push('Rule value is too long (max 100 characters)');
      }

      // Determine type if auto
      const actualType = type === 'auto' 
        ? (trimmedValue.includes('.') ? 'domain' : 'keyword')
        : type;

      // Validate based on type
      if (actualType === 'domain') {
        if (!this.isValidDomain(trimmedValue)) {
          errors.push('Invalid domain format');
        }
      } else if (actualType === 'keyword') {
        // Keywords should not contain certain characters
        if (/[<>'"&]/.test(trimmedValue)) {
          errors.push('Keyword contains invalid characters');
        }
      } else {
        errors.push('Rule type must be either "domain" or "keyword"');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: value ? this.sanitizeString(value.trim()) : '',
      type: type === 'auto' 
        ? (value && value.includes('.') ? 'domain' : 'keyword')
        : type
    };
  }

  /**
   * Validate settings object
   */
  validateSettings(settings) {
    const errors = [];

    if (!settings || typeof settings !== 'object') {
      return { valid: false, errors: ['Settings must be an object'] };
    }

    // Validate autoOrganize
    if ('autoOrganize' in settings && typeof settings.autoOrganize !== 'boolean') {
      errors.push('autoOrganize must be a boolean');
    }

    // Validate showNotifications
    if ('showNotifications' in settings && typeof settings.showNotifications !== 'boolean') {
      errors.push('showNotifications must be a boolean');
    }

    // Validate theme
    if ('theme' in settings) {
      const validThemes = ['light', 'dark', 'auto'];
      if (!validThemes.includes(settings.theme)) {
        errors.push(`Invalid theme: ${settings.theme}. Must be one of: ${validThemes.join(', ')}`);
      }
    }

    // Validate categorization
    if ('categorization' in settings) {
      const validModes = ['auto', 'manual', 'hybrid'];
      if (!validModes.includes(settings.categorization)) {
        errors.push(`Invalid categorization mode: ${settings.categorization}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this.sanitizeSettings(settings)
    };
  }

  /**
   * Validate array of tab IDs
   */
  validateTabIds(tabIds) {
    const errors = [];

    if (!Array.isArray(tabIds)) {
      return { valid: false, errors: ['Tab IDs must be an array'] };
    }

    if (tabIds.length === 0) {
      errors.push('Tab IDs array cannot be empty');
    }

    if (tabIds.length > LIMITS.MAX_TABS_PER_CATEGORY) {
      errors.push(`Too many tab IDs (max ${LIMITS.MAX_TABS_PER_CATEGORY})`);
    }

    const invalidIds = tabIds.filter(id => 
      typeof id !== 'number' || id <= 0 || !Number.isInteger(id)
    );

    if (invalidIds.length > 0) {
      errors.push(`Invalid tab IDs: ${invalidIds.join(', ')}`);
    }

    // Check for duplicates
    const uniqueIds = new Set(tabIds);
    if (uniqueIds.size !== tabIds.length) {
      errors.push('Duplicate tab IDs found');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: tabIds.filter(id => typeof id === 'number' && id > 0)
    };
  }

  /**
   * Sanitize string input
   */
  sanitizeString(str) {
    if (typeof str !== 'string') return '';
    
    return str
      .trim()
      .replace(/[<>'"&]/g, '') // Remove potentially harmful characters
      .substring(0, 1000); // Limit length
  }

  /**
   * Sanitize HTML content
   */
  sanitizeHtml(html) {
    if (typeof html !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  /**
   * Sanitize settings object
   */
  sanitizeSettings(settings) {
    const sanitized = {};
    
    if (typeof settings.autoOrganize === 'boolean') {
      sanitized.autoOrganize = settings.autoOrganize;
    }
    
    if (typeof settings.showNotifications === 'boolean') {
      sanitized.showNotifications = settings.showNotifications;
    }
    
    if (typeof settings.theme === 'string') {
      const validThemes = ['light', 'dark', 'auto'];
      if (validThemes.includes(settings.theme)) {
        sanitized.theme = settings.theme;
      }
    }
    
    if (typeof settings.categorization === 'string') {
      const validModes = ['auto', 'manual', 'hybrid'];
      if (validModes.includes(settings.categorization)) {
        sanitized.categorization = settings.categorization;
      }
    }
    
    return sanitized;
  }

  /**
   * Validate number within range
   */
  validateNumberRange(value, min, max, fieldName = 'Value') {
    const errors = [];

    if (typeof value !== 'number') {
      errors.push(`${fieldName} must be a number`);
    } else {
      if (!Number.isFinite(value)) {
        errors.push(`${fieldName} must be a finite number`);
      }
      
      if (value < min) {
        errors.push(`${fieldName} must be at least ${min}`);
      }
      
      if (value > max) {
        errors.push(`${fieldName} must be at most ${max}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate string length
   */
  validateStringLength(str, minLength, maxLength, fieldName = 'String') {
    const errors = [];

    if (typeof str !== 'string') {
      errors.push(`${fieldName} must be a string`);
    } else {
      if (str.length < minLength) {
        errors.push(`${fieldName} must be at least ${minLength} characters long`);
      }
      
      if (str.length > maxLength) {
        errors.push(`${fieldName} must be at most ${maxLength} characters long`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate required fields in an object
   */
  validateRequiredFields(obj, requiredFields) {
    const errors = [];
    const missing = [];

    if (!obj || typeof obj !== 'object') {
      return { valid: false, errors: ['Input must be an object'] };
    }

    requiredFields.forEach(field => {
      if (!(field in obj) || obj[field] === null || obj[field] === undefined) {
        missing.push(field);
      }
    });

    if (missing.length > 0) {
      errors.push(`Missing required fields: ${missing.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      missing
    };
  }

  /**
   * Validate message format for chrome.runtime messaging
   */
  validateMessage(message) {
    const errors = [];

    if (!message || typeof message !== 'object') {
      return { valid: false, errors: ['Message must be an object'] };
    }

    // Check required fields
    const requiredValidation = this.validateRequiredFields(message, ['type']);
    if (!requiredValidation.valid) {
      errors.push(...requiredValidation.errors);
    }

    // Validate message type
    if (message.type && typeof message.type !== 'string') {
      errors.push('Message type must be a string');
    }

    // Check message size (Chrome has limits)
    try {
      const messageSize = JSON.stringify(message).length;
      if (messageSize > 64 * 1024 * 1024) { // 64MB limit
        errors.push('Message is too large');
      }
    } catch (error) {
      errors.push('Message is not serializable');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate and sanitize user input for display
   */
  validateDisplayText(text, maxLength = 500) {
    const errors = [];

    if (typeof text !== 'string') {
      return { valid: false, errors: ['Text must be a string'] };
    }

    if (text.length > maxLength) {
      errors.push(`Text is too long (max ${maxLength} characters)`);
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /style\s*=/i
    ];

    const hasSuspiciousContent = suspiciousPatterns.some(pattern => pattern.test(text));
    if (hasSuspiciousContent) {
      errors.push('Text contains potentially unsafe content');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: this.sanitizeHtml(text),
      truncated: text.length > maxLength ? text.substring(0, maxLength) + '...' : text
    };
  }

  /**
   * Batch validation for multiple items
   */
  validateBatch(items, validatorFn) {
    const results = [];
    let allValid = true;

    items.forEach((item, index) => {
      try {
        const result = validatorFn(item);
        results.push({
          index,
          item,
          ...result
        });
        
        if (!result.valid) {
          allValid = false;
        }
      } catch (error) {
        results.push({
          index,
          item,
          valid: false,
          errors: [`Validation error: ${error.message}`]
        });
        allValid = false;
      }
    });

    return {
      valid: allValid,
      results,
      validCount: results.filter(r => r.valid).length,
      invalidCount: results.filter(r => !r.valid).length
    };
  }

  /**
   * Create a validation schema and validator function
   */
  createValidator(schema) {
    return (data) => {
      const errors = [];
      const sanitized = {};

      Object.entries(schema).forEach(([field, rules]) => {
        const value = data[field];
        
        // Required field check
        if (rules.required && (value === null || value === undefined)) {
          errors.push(`${field} is required`);
          return;
        }

        // Skip validation if field is not present and not required
        if (value === null || value === undefined) {
          return;
        }

        // Type validation
        if (rules.type && typeof value !== rules.type) {
          errors.push(`${field} must be of type ${rules.type}`);
          return;
        }

        // Custom validator
        if (rules.validator) {
          try {
            const result = rules.validator(value);
            if (!result.valid) {
              errors.push(...result.errors.map(err => `${field}: ${err}`));
            } else if (result.sanitized !== undefined) {
              sanitized[field] = result.sanitized;
            }
          } catch (error) {
            errors.push(`${field}: Validation error - ${error.message}`);
          }
        }

        // Length validation for strings
        if (rules.minLength || rules.maxLength) {
          if (typeof value === 'string') {
            if (rules.minLength && value.length < rules.minLength) {
              errors.push(`${field} must be at least ${rules.minLength} characters`);
            }
            if (rules.maxLength && value.length > rules.maxLength) {
              errors.push(`${field} must be at most ${rules.maxLength} characters`);
            }
          }
        }

        // Range validation for numbers
        if (rules.min !== undefined || rules.max !== undefined) {
          if (typeof value === 'number') {
            if (rules.min !== undefined && value < rules.min) {
              errors.push(`${field} must be at least ${rules.min}`);
            }
            if (rules.max !== undefined && value > rules.max) {
              errors.push(`${field} must be at most ${rules.max}`);
            }
          }
        }

        // Set sanitized value if no custom sanitization was applied
        if (!(field in sanitized)) {
          sanitized[field] = value;
        }
      });

      return {
        valid: errors.length === 0,
        errors,
        sanitized
      };
    };
  }

  /**
   * Validate file upload
   */
  validateFileUpload(file, allowedTypes = [], maxSize = 5 * 1024 * 1024) {
    const errors = [];

    if (!file || !(file instanceof File)) {
      return { valid: false, errors: ['Invalid file object'] };
    }

    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size ${Math.round(file.size / 1024)}KB exceeds maximum ${Math.round(maxSize / 1024)}KB`);
    }

    // Check file name
    if (!file.name || file.name.length === 0) {
      errors.push('File must have a name');
    } else if (file.name.length > 255) {
      errors.push('File name is too long (max 255 characters)');
    }

    return {
      valid: errors.length === 0,
      errors,
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified
      }
    };
  }

  /**
   * Validate JSON data
   */
  validateJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      return {
        valid: true,
        errors: [],
        data: parsed
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Invalid JSON: ${error.message}`],
        data: null
      };
    }
  }

  /**
   * Validate color hex code
   */
  validateHexColor(color) {
    const errors = [];

    if (typeof color !== 'string') {
      return { valid: false, errors: ['Color must be a string'] };
    }

    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexRegex.test(color)) {
      errors.push('Color must be a valid hex color (e.g., #ff0000 or #f00)');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: color.toLowerCase()
    };
  }

  /**
   * Log validation errors for debugging
   */
  logValidationError(context, validation) {
    if (!validation.valid) {
      debugUtils.warn(`Validation failed in ${context}`, 'ValidationUtils', {
        errors: validation.errors,
        context
      });
    }
  }

  /**
   * Get validation summary statistics
   */
  getValidationStats() {
    return {
      version: '1.0.0',
      availableValidators: [
        'validateTabData',
        'validateSearchQuery',
        'validateCategory',
        'validateCustomRule',
        'validateSettings',
        'validateTabIds',
        'validateMessage',
        'validateDisplayText',
        'validateFileUpload',
        'validateJSON',
        'validateHexColor'
      ],
      limits: LIMITS,
      patterns: {
        email: this.emailRegex.source,
        url: this.urlRegex.source,
        domain: this.domainRegex.source
      }
    };
  }

  /**
   * Reset validation state (if needed for testing)
   */
  reset() {
    // Clear any cached validation results if implemented in the future
    debugUtils.debug('ValidationUtils reset completed', 'ValidationUtils');
  }
}

// Create singleton instance
export default new ValidationUtils();