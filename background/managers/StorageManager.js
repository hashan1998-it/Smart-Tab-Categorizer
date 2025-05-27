/**
 * Storage operations manager
 * Handles all chrome.storage operations with error handling and caching
 */

import { STORAGE_KEYS, DEFAULT_SETTINGS, DEBOUNCE_DELAYS } from '../../shared/constants/AppConstants.js';
import debugUtils from '../../shared/utils/DebugUtils.js';

class StorageManager {
  constructor() {
    this.cache = new Map();
    this.saveQueue = new Map();
    this.initialized = false;
    this.isOnline = true;
    this.syncRetryCount = new Map();
    this.maxRetries = 3;
    
    this.init();
  }

  /**
   * Initialize storage manager
   */
  async init() {
    try {
      debugUtils.info('Initializing StorageManager', 'StorageManager');
      
      // Check storage availability
      await this.checkStorageAvailability();
      
      // Pre-load critical data
      await this.preloadCriticalData();
      
      // Setup storage event listeners
      this.setupStorageListeners();
      
      this.initialized = true;
      debugUtils.info('StorageManager initialized successfully', 'StorageManager');
    } catch (error) {
      debugUtils.error('Failed to initialize StorageManager', 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Check if storage is available
   */
  async checkStorageAvailability() {
    try {
      // Test basic storage operations
      await chrome.storage.local.set({ __test__: true });
      await chrome.storage.local.get(['__test__']);
      await chrome.storage.local.remove(['__test__']);
      
      debugUtils.debug('Storage availability check passed', 'StorageManager');
    } catch (error) {
      debugUtils.error('Storage not available', 'StorageManager', error);
      throw new Error('Chrome storage is not available');
    }
  }

  /**
   * Setup storage event listeners
   */
  setupStorageListeners() {
    try {
      // Listen for storage changes
      chrome.storage.onChanged.addListener((changes, namespace) => {
        this.handleStorageChanged(changes, namespace);
      });

      // Listen for network status changes
      if (typeof window !== 'undefined' && window.navigator) {
        window.addEventListener('online', () => {
          this.isOnline = true;
          this.retryFailedOperations();
        });

        window.addEventListener('offline', () => {
          this.isOnline = false;
        });
      }

      debugUtils.debug('Storage event listeners setup completed', 'StorageManager');
    } catch (error) {
      debugUtils.warn('Failed to setup storage listeners', 'StorageManager', error);
    }
  }

  /**
   * Handle storage changes from other contexts
   */
  handleStorageChanged(changes, namespace) {
    try {
      if (namespace !== 'local') return;

      Object.keys(changes).forEach(key => {
        const change = changes[key];
        
        // Update cache with new value
        if (change.newValue !== undefined) {
          this.cache.set(key, change.newValue);
        } else {
          this.cache.delete(key);
        }

        debugUtils.debug(`Storage changed: ${key}`, 'StorageManager', {
          oldValue: change.oldValue,
          newValue: change.newValue
        });
      });
    } catch (error) {
      debugUtils.error('Failed to handle storage changes', 'StorageManager', error);
    }
  }

  /**
   * Pre-load frequently accessed data
   */
  async preloadCriticalData() {
    const keys = [STORAGE_KEYS.SETTINGS, STORAGE_KEYS.CATEGORY_RULES];
    
    try {
      const data = await chrome.storage.local.get(keys);
      
      // Cache the data
      keys.forEach(key => {
        if (data[key]) {
          this.cache.set(key, data[key]);
        }
      });
      
      // Set defaults if not present
      if (!data[STORAGE_KEYS.SETTINGS]) {
        await this.setSettings(DEFAULT_SETTINGS);
      }
      
      debugUtils.debug('Critical data preloaded', 'StorageManager', { keys, data });
    } catch (error) {
      debugUtils.error('Failed to preload critical data', 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Get data from storage with caching
   */
  async get(key, useCache = true) {
    try {
      // Return from cache if available and requested
      if (useCache && this.cache.has(key)) {
        debugUtils.debug(`Retrieved ${key} from cache`, 'StorageManager');
        return this.cache.get(key);
      }

      const result = await chrome.storage.local.get([key]);
      const value = result[key];

      // Update cache
      if (value !== undefined) {
        this.cache.set(key, value);
      }

      debugUtils.debug(`Retrieved ${key} from storage`, 'StorageManager', value);
      return value;
    } catch (error) {
      debugUtils.error(`Failed to get ${key} from storage`, 'StorageManager', error);
      
      // Return cached value as fallback
      if (this.cache.has(key)) {
        debugUtils.warn(`Returning cached value for ${key} due to storage error`, 'StorageManager');
        return this.cache.get(key);
      }
      
      throw error;
    }
  }

  /**
   * Set data to storage with caching and debouncing
   */
  async set(key, value, immediate = false) {
    try {
      // Validate input
      if (key === null || key === undefined) {
        throw new Error('Storage key cannot be null or undefined');
      }

      // Update cache immediately
      this.cache.set(key, value);

      if (immediate) {
        await this.saveToStorage(key, value);
      } else {
        // Debounce saves to prevent excessive writes
        this.debouncedSave(key, value);
      }

      debugUtils.debug(`Set ${key} in storage`, 'StorageManager', value);
    } catch (error) {
      debugUtils.error(`Failed to set ${key} in storage`, 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Debounced save to prevent excessive storage writes
   */
  debouncedSave(key, value) {
    // Clear existing timeout
    if (this.saveQueue.has(key)) {
      clearTimeout(this.saveQueue.get(key));
    }

    // Set new timeout
    const timeoutId = setTimeout(async () => {
      try {
        await this.saveToStorage(key, value);
        this.saveQueue.delete(key);
      } catch (error) {
        debugUtils.error(`Failed to save ${key} (debounced)`, 'StorageManager', error);
        this.retryOperation(key, value);
      }
    }, DEBOUNCE_DELAYS.STORAGE_SAVE);

    this.saveQueue.set(key, timeoutId);
  }

  /**
   * Actually save to chrome storage
   */
  async saveToStorage(key, value) {
    const maxRetries = 3;
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        await chrome.storage.local.set({ [key]: value });
        debugUtils.debug(`Saved ${key} to storage`, 'StorageManager');
        
        // Reset retry count on success
        this.syncRetryCount.delete(key);
        return;
      } catch (error) {
        attempts++;
        debugUtils.warn(`Storage save attempt ${attempts} failed for ${key}`, 'StorageManager', error);
        
        if (attempts >= maxRetries) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }
  }

  /**
   * Retry failed storage operation
   */
  async retryOperation(key, value) {
    const retryCount = this.syncRetryCount.get(key) || 0;
    
    if (retryCount >= this.maxRetries) {
      debugUtils.error(`Max retries exceeded for ${key}`, 'StorageManager');
      return;
    }

    this.syncRetryCount.set(key, retryCount + 1);
    
    // Retry after delay
    setTimeout(async () => {
      try {
        await this.saveToStorage(key, value);
      } catch (error) {
        debugUtils.error(`Retry failed for ${key}`, 'StorageManager', error);
      }
    }, Math.pow(2, retryCount) * 1000);
  }

  /**
   * Retry all failed operations when back online
   */
  async retryFailedOperations() {
    if (!this.isOnline) return;

    debugUtils.info('Retrying failed storage operations', 'StorageManager');
    
    const promises = [];
    
    for (const [key, value] of this.cache.entries()) {
      if (this.syncRetryCount.has(key)) {
        promises.push(this.saveToStorage(key, value));
      }
    }
    
    try {
      await Promise.allSettled(promises);
      debugUtils.info('Retry operations completed', 'StorageManager');
    } catch (error) {
      debugUtils.error('Failed to retry operations', 'StorageManager', error);
    }
  }

  /**
   * Remove data from storage
   */
  async remove(key) {
    try {
      await chrome.storage.local.remove([key]);
      this.cache.delete(key);
      
      // Clear any pending saves
      if (this.saveQueue.has(key)) {
        clearTimeout(this.saveQueue.get(key));
        this.saveQueue.delete(key);
      }

      // Clear retry count
      this.syncRetryCount.delete(key);

      debugUtils.debug(`Removed ${key} from storage`, 'StorageManager');
    } catch (error) {
      debugUtils.error(`Failed to remove ${key} from storage`, 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Clear all storage data
   */
  async clear() {
    try {
      await chrome.storage.local.clear();
      this.cache.clear();
      
      // Clear all pending saves
      this.saveQueue.forEach(timeoutId => clearTimeout(timeoutId));
      this.saveQueue.clear();
      
      // Clear retry counts
      this.syncRetryCount.clear();

      debugUtils.info('Cleared all storage data', 'StorageManager');
    } catch (error) {
      debugUtils.error('Failed to clear storage', 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Get multiple keys at once
   */
  async getMultiple(keys, useCache = true) {
    try {
      const result = {};
      const keysToFetch = [];

      // Check cache first if requested
      if (useCache) {
        keys.forEach(key => {
          if (this.cache.has(key)) {
            result[key] = this.cache.get(key);
          } else {
            keysToFetch.push(key);
          }
        });
      } else {
        keysToFetch.push(...keys);
      }

      // Fetch remaining keys from storage
      if (keysToFetch.length > 0) {
        const storageResult = await chrome.storage.local.get(keysToFetch);
        
        // Update cache and result
        keysToFetch.forEach(key => {
          if (storageResult[key] !== undefined) {
            this.cache.set(key, storageResult[key]);
            result[key] = storageResult[key];
          }
        });
      }

      debugUtils.debug('Retrieved multiple keys', 'StorageManager', { keys, result });
      return result;
    } catch (error) {
      debugUtils.error('Failed to get multiple keys', 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Set multiple keys at once
   */
  async setMultiple(data, immediate = false) {
    try {
      // Validate input
      if (!data || typeof data !== 'object') {
        throw new Error('Data must be an object');
      }

      // Update cache
      Object.entries(data).forEach(([key, value]) => {
        this.cache.set(key, value);
      });

      if (immediate) {
        await chrome.storage.local.set(data);
        debugUtils.debug('Set multiple keys immediately', 'StorageManager', data);
      } else {
        // Debounce each key individually
        Object.entries(data).forEach(([key, value]) => {
          this.debouncedSave(key, value);
        });
        debugUtils.debug('Queued multiple keys for debounced save', 'StorageManager', Object.keys(data));
      }
    } catch (error) {
      debugUtils.error('Failed to set multiple keys', 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Check if key exists in storage
   */
  async exists(key) {
    try {
      const value = await this.get(key);
      return value !== undefined;
    } catch (error) {
      debugUtils.error(`Failed to check existence of ${key}`, 'StorageManager', error);
      return false;
    }
  }

  /**
   * Get all keys from storage
   */
  async getAllKeys() {
    try {
      const allData = await chrome.storage.local.get();
      return Object.keys(allData);
    } catch (error) {
      debugUtils.error('Failed to get all keys', 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Get all data from storage
   */
  async getAllData() {
    try {
      const allData = await chrome.storage.local.get();
      
      // Update cache with all data
      Object.entries(allData).forEach(([key, value]) => {
        this.cache.set(key, value);
      });
      
      return allData;
    } catch (error) {
      debugUtils.error('Failed to get all data', 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Specialized methods for common operations
   */

  /**
   * Get tabs data
   */
  async getTabs() {
    const tabs = await this.get(STORAGE_KEYS.TABS);
    return tabs ? new Map(Object.entries(tabs)) : new Map();
  }

  /**
   * Set tabs data
   */
  async setTabs(tabsMap, immediate = false) {
    const tabsData = Object.fromEntries(tabsMap);
    await this.setMultiple({
      [STORAGE_KEYS.TABS]: tabsData,
      [STORAGE_KEYS.LAST_UPDATED]: Date.now()
    }, immediate);
  }

  /**
   * Get settings
   */
  async getSettings() {
    const settings = await this.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...settings };
  }

  /**
   * Set settings
   */
  async setSettings(settings, immediate = false) {
    const currentSettings = await this.getSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    await this.set(STORAGE_KEYS.SETTINGS, updatedSettings, immediate);
    return updatedSettings;
  }

  /**
   * Get category rules
   */
  async getCategoryRules() {
    return await this.get(STORAGE_KEYS.CATEGORY_RULES) || {};
  }

  /**
   * Set category rules
   */
  async setCategoryRules(rules, immediate = false) {
    await this.set(STORAGE_KEYS.CATEGORY_RULES, rules, immediate);
  }

  /**
   * Get storage usage statistics
   */
  async getStorageUsage() {
    try {
      const usage = await chrome.storage.local.getBytesInUse();
      const allData = await chrome.storage.local.get();
      
      const stats = {
        totalBytes: usage,
        totalKB: Math.round(usage / 1024 * 100) / 100,
        totalMB: Math.round(usage / 1024 / 1024 * 100) / 100,
        itemCount: Object.keys(allData).length,
        items: {},
        quota: chrome.storage.local.QUOTA_BYTES || 5242880, // 5MB default
        percentageUsed: Math.round((usage / (chrome.storage.local.QUOTA_BYTES || 5242880)) * 100 * 100) / 100
      };

      // Get individual item sizes
      for (const [key, value] of Object.entries(allData)) {
        try {
          const itemBytes = await chrome.storage.local.getBytesInUse([key]);
          stats.items[key] = {
            bytes: itemBytes,
            kb: Math.round(itemBytes / 1024 * 100) / 100,
            percentage: Math.round((itemBytes / usage) * 100 * 100) / 100
          };
        } catch (error) {
          debugUtils.warn(`Failed to get size for ${key}`, 'StorageManager', error);
        }
      }

      debugUtils.debug('Storage usage stats', 'StorageManager', stats);
      return stats;
    } catch (error) {
      debugUtils.error('Failed to get storage usage', 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Check storage quota and warn if approaching limit
   */
  async checkQuota() {
    try {
      const usage = await this.getStorageUsage();
      const warningThreshold = 80; // 80%
      const criticalThreshold = 95; // 95%
      
      const result = {
        usage: usage.percentageUsed,
        warning: usage.percentageUsed > warningThreshold,
        critical: usage.percentageUsed > criticalThreshold,
        stats: usage
      };
      
      if (result.critical) {
        debugUtils.error('Storage quota critical!', 'StorageManager', result);
      } else if (result.warning) {
        debugUtils.warn('Storage quota warning', 'StorageManager', result);
      }
      
      return result;
    } catch (error) {
      debugUtils.error('Failed to check storage quota', 'StorageManager', error);
      return { error: error.message };
    }
  }

  /**
   * Optimize storage by removing old or unnecessary data
   */
  async optimizeStorage() {
    try {
      debugUtils.info('Starting storage optimization', 'StorageManager');
      
      let removedItems = 0;
      let freedBytes = 0;
      
      // Get all data
      const allData = await this.getAllData();
      
      // Remove expired temporary data
      const tempKeys = Object.keys(allData).filter(key => 
        key.startsWith('temp_') || key.startsWith('cache_')
      );
      
      for (const key of tempKeys) {
        try {
          const itemSize = await chrome.storage.local.getBytesInUse([key]);
          await this.remove(key);
          removedItems++;
          freedBytes += itemSize;
        } catch (error) {
          debugUtils.warn(`Failed to remove ${key} during optimization`, 'StorageManager', error);
        }
      }
      
      // Compact tab data (remove stale tabs older than 30 days)
      const tabs = await this.getTabs();
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const staleTabs = [];
      
      for (const [tabId, tabData] of tabs.entries()) {
        if (tabData.lastAccessed && tabData.lastAccessed < thirtyDaysAgo) {
          staleTabs.push(tabId);
        }
      }
      
      if (staleTabs.length > 0) {
        staleTabs.forEach(tabId => tabs.delete(tabId));
        await this.setTabs(tabs, true);
        removedItems += staleTabs.length;
      }
      
      const result = {
        removedItems,
        freedBytes,
        freedKB: Math.round(freedBytes / 1024 * 100) / 100,
        staleTabsRemoved: staleTabs.length
      };
      
      debugUtils.info('Storage optimization completed', 'StorageManager', result);
      return result;
    } catch (error) {
      debugUtils.error('Storage optimization failed', 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Force save all pending operations
   */
  async flushPendingSaves() {
    const promises = [];
    
    for (const [key, timeoutId] of this.saveQueue.entries()) {
      clearTimeout(timeoutId);
      const value = this.cache.get(key);
      if (value !== undefined) {
        promises.push(this.saveToStorage(key, value));
      }
    }
    
    this.saveQueue.clear();
    
    try {
      await Promise.all(promises);
      debugUtils.info(`Flushed ${promises.length} pending saves`, 'StorageManager');
    } catch (error) {
      debugUtils.error('Failed to flush pending saves', 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Export all storage data
   */
  async exportData() {
    try {
      const allData = await this.getAllData();
      const usage = await this.getStorageUsage();
      
      return {
        data: allData,
        metadata: {
          exportDate: new Date().toISOString(),
          version: '1.0.0',
          itemCount: Object.keys(allData).length,
          totalBytes: usage.totalBytes,
          extensionVersion: chrome.runtime.getManifest().version
        }
      };
    } catch (error) {
      debugUtils.error('Failed to export data', 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Import storage data
   */
  async importData(importData, options = {}) {
    try {
      const { 
        clearExisting = false, 
        validateData = true,
        mergeSettings = true 
      } = options;
      
      if (!importData || !importData.data) {
        throw new Error('Invalid import data format');
      }

      // Validate data if requested
      if (validateData) {
        await this.validateImportData(importData);
      }

      // Clear existing data if requested
      if (clearExisting) {
        await this.clear();
      }

      // Import data
      const dataToImport = { ...importData.data };
      
      // Handle settings merging
      if (mergeSettings && dataToImport[STORAGE_KEYS.SETTINGS]) {
        const currentSettings = await this.getSettings();
        dataToImport[STORAGE_KEYS.SETTINGS] = {
          ...currentSettings,
          ...dataToImport[STORAGE_KEYS.SETTINGS]
        };
      }
      
      // Set import timestamp
      dataToImport[STORAGE_KEYS.LAST_UPDATED] = Date.now();
      
      await chrome.storage.local.set(dataToImport);
      
      // Update cache
      Object.entries(dataToImport).forEach(([key, value]) => {
        this.cache.set(key, value);
      });

      debugUtils.info('Data imported successfully', 'StorageManager', {
        itemCount: Object.keys(dataToImport).length,
        importDate: importData.metadata?.exportDate
      });
      
      return {
        success: true,
        itemsImported: Object.keys(dataToImport).length
      };
    } catch (error) {
      debugUtils.error('Failed to import data', 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Validate import data
   */
  async validateImportData(importData) {
    const errors = [];
    
    // Check required structure
    if (!importData.data || typeof importData.data !== 'object') {
      errors.push('Import data must contain a data object');
    }
    
    // Check version compatibility
    if (importData.metadata?.version && importData.metadata.version !== '1.0.0') {
      errors.push(`Unsupported data version: ${importData.metadata.version}`);
    }
    
    // Validate settings if present
    if (importData.data[STORAGE_KEYS.SETTINGS]) {
      const settings = importData.data[STORAGE_KEYS.SETTINGS];
      if (typeof settings !== 'object') {
        errors.push('Settings data must be an object');
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Import validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Create backup of current data
   */
  async createBackup() {
    try {
      const exportData = await this.exportData();
      const backupKey = `backup_${Date.now()}`;
      
      // Store backup with timestamp
      await this.set(backupKey, exportData, true);
      
      debugUtils.info('Backup created', 'StorageManager', { backupKey });
      return backupKey;
    } catch (error) {
      debugUtils.error('Failed to create backup', 'StorageManager', error);
      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups() {
    try {
      const allKeys = await this.getAllKeys();
      const backupKeys = allKeys.filter(key => key.startsWith('backup_'));
      
      const backups = [];
      for (const key of backupKeys) {
        try {
          const backup = await this.get(key);
          backups.push({
            key,
            date: backup.metadata?.exportDate,
            itemCount: backup.metadata?.itemCount,
            size: backup.metadata?.totalBytes
          });
        } catch (error) {
          debugUtils.warn(`Failed to read backup ${key}`, 'StorageManager', error);
        }
      }
      
      // Sort by date (newest first)
      backups.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      return backups;
    } catch (error) {
      debugUtils.error('Failed to list backups', 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupKey) {
    try {
      const backup = await this.get(backupKey);
      if (!backup) {
        throw new Error(`Backup ${backupKey} not found`);
      }
      
      await this.importData(backup, { clearExisting: true });
      
      debugUtils.info('Restored from backup', 'StorageManager', { backupKey });
      return true;
    } catch (error) {
      debugUtils.error('Failed to restore from backup', 'StorageManager', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      pendingSaves: this.saveQueue.size,
      retryQueue: this.syncRetryCount.size,
      isOnline: this.isOnline
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    debugUtils.debug('Cache cleared', 'StorageManager');
  }

  /**
   * Get manager status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      isOnline: this.isOnline,
      cacheSize: this.cache.size,
      pendingSaves: this.saveQueue.size,
      retryOperations: this.syncRetryCount.size,
      uptime: this.initialized ? Date.now() - this.initTime : 0
    };
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async cleanup() {
    try {
      await this.flushPendingSaves();
      this.cache.clear();
      this.syncRetryCount.clear();
      
      // Clear timeouts
      this.saveQueue.forEach(timeoutId => clearTimeout(timeoutId));
      this.saveQueue.clear();
      
      debugUtils.info('StorageManager cleanup completed', 'StorageManager');
    } catch (error) {
      debugUtils.error('StorageManager cleanup failed', 'StorageManager', error);
    }
  }
}

// Create singleton instance
export default new StorageManager();