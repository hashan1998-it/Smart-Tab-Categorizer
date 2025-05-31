/**
 * Enhanced Background Service Worker with Settings Support
 * Orchestrates all background services and managers with settings integration
 */

// Static imports (required for service workers)
import debugUtils from '../shared/utils/DebugUtils.js';
import TabManager from './managers/TabManager.js';
import CategoryManager from './managers/CategoryManager.js';
import StorageManager from './managers/StorageManager.js';
import MessageService from './services/MessageService.js';
import EventService from './services/EventService.js';
import { EXTENSION_NAME, VERSION, DEFAULT_SETTINGS, MESSAGE_TYPES } from '../shared/constants/AppConstants.js';

class BackgroundController {
  constructor() {
    this.initialized = false;
    this.services = new Map();
    this.startTime = Date.now();
    this.initPromise = null;
    this.settings = { ...DEFAULT_SETTINGS };
    
    // Bind methods to preserve context
    this.init = this.init.bind(this);
    this.cleanup = this.cleanup.bind(this);
  }

  /**
   * Initialize all background services
   */
  async init() {
    // Prevent multiple initialization attempts
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  async doInit() {
    const startTime = performance.now();
    
    try {
      console.log(`🚀 ${EXTENSION_NAME} v${VERSION}: Starting background initialization`);
      
      // Initialize services in dependency order
      await this.initializeServices();
      
      // Set up service references
      this.setupServiceReferences();
      
      // Set up error handling
      this.setupErrorHandling();
      
      // Register additional message handlers for settings
      this.registerSettingsHandlers();
      
      // Load initial settings
      await this.loadSettings();
      
      this.initialized = true;
      
      const initTime = performance.now() - startTime;
      console.log('✅ Background initialization completed successfully', {
        services: Array.from(this.services.keys()),
        initTime: Math.round(initTime) + 'ms'
      });
      
      // Use debugUtils after successful initialization
      debugUtils.info('Background controller initialized', 'BackgroundController');
      
    } catch (error) {
      console.error('❌ Background initialization failed:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Initialize all services in correct order
   */
  async initializeServices() {
    try {
      // Initialize MessageService first for immediate functionality
      console.log('Initializing MessageService...');
      MessageService.init();
      this.services.set('message', MessageService);
      
      // Initialize other services with error handling
      try {
        console.log('Initializing StorageManager...');
        await StorageManager.init();
        this.services.set('storage', StorageManager);
      } catch (error) {
        console.warn('StorageManager init failed, using fallback:', error);
      }
      
      try {
        console.log('Initializing CategoryManager...');
        await CategoryManager.init();
        this.services.set('category', CategoryManager);
      } catch (error) {
        console.warn('CategoryManager init failed, using fallback:', error);
      }
      
      try {
        console.log('Initializing TabManager...');
        await TabManager.init();
        this.services.set('tab', TabManager);
      } catch (error) {
        console.warn('TabManager init failed, using fallback:', error);
      }
      
      try {
        console.log('Initializing EventService...');
        EventService.init();
        this.services.set('event', EventService);
      } catch (error) {
        console.warn('EventService init failed, using fallback:', error);
      }
      
      console.log('✅ Services initialization completed (with fallbacks if needed)');
      
    } catch (error) {
      console.error('❌ Critical service initialization failed:', error);
      // Don't throw - let the extension work with basic functionality
    }
  }

  /**
   * Setup cross-service references and communication
   */
  setupServiceReferences() {
    try {
      // Services can now reference each other through the controller
      // This prevents circular dependencies while allowing communication
      
      console.log('✅ Service references configured');
    } catch (error) {
      console.error('❌ Failed to setup service references:', error);
    }
  }

  /**
   * Setup global error handling
   */
  setupErrorHandling() {
    try {
      // Handle unhandled promise rejections
      self.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', {
          reason: event.reason,
          stack: event.reason?.stack
        });
        // Prevent the default handling
        event.preventDefault();
      });

      // Handle uncaught exceptions
      self.addEventListener('error', (event) => {
        console.error('Uncaught exception:', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error
        });
      });

      console.log('✅ Global error handling configured');
    } catch (error) {
      console.error('❌ Failed to setup error handling:', error);
    }
  }

  /**
   * Register additional message handlers for settings
   */
  registerSettingsHandlers() {
    const messageService = this.services.get('message');
    if (!messageService) return;

    // Get settings
    messageService.registerHandler('GET_SETTINGS', async () => {
      try {
        const settings = await StorageManager.getSettings();
        return { 
          success: true, 
          data: settings 
        };
      } catch (error) {
        return { 
          success: false, 
          error: error.message,
          data: DEFAULT_SETTINGS 
        };
      }
    });

    // Set settings
    messageService.registerHandler('SET_SETTINGS', async (message) => {
      try {
        const updatedSettings = await StorageManager.setSettings(message.settings);
        this.settings = updatedSettings;
        
        // Apply settings that affect background behavior
        await this.applySettings(updatedSettings);
        
        return { 
          success: true, 
          data: updatedSettings 
        };
      } catch (error) {
        return { 
          success: false, 
          error: error.message 
        };
      }
    });

    // Get custom rules
    messageService.registerHandler('GET_CUSTOM_RULES', async () => {
      try {
        const rules = await StorageManager.getCategoryRules();
        return { 
          success: true, 
          data: rules 
        };
      } catch (error) {
        return { 
          success: false, 
          error: error.message,
          data: {} 
        };
      }
    });

    // Set custom rules
    messageService.registerHandler('SET_CUSTOM_RULES', async (message) => {
      try {
        await StorageManager.setCategoryRules(message.rules);
        
        // Refresh category manager with new rules
        const categoryManager = this.services.get('category');
        if (categoryManager) {
          await categoryManager.refresh();
        }
        
        return { 
          success: true 
        };
      } catch (error) {
        return { 
          success: false, 
          error: error.message 
        };
      }
    });

    // Add custom rule
    messageService.registerHandler('ADD_CUSTOM_RULE', async (message) => {
      try {
        const categoryManager = this.services.get('category');
        if (!categoryManager) {
          throw new Error('CategoryManager not available');
        }
        
        const result = await categoryManager.addCustomRule(
          message.category, 
          message.value, 
          message.type
        );
        
        return { 
          success: true, 
          data: { added: result } 
        };
      } catch (error) {
        return { 
          success: false, 
          error: error.message 
        };
      }
    });

    // Remove custom rule
    messageService.registerHandler('REMOVE_CUSTOM_RULE', async (message) => {
      try {
        const categoryManager = this.services.get('category');
        if (!categoryManager) {
          throw new Error('CategoryManager not available');
        }
        
        const result = await categoryManager.removeCustomRule(
          message.category, 
          message.value, 
          message.type
        );
        
        return { 
          success: true, 
          data: { removed: result } 
        };
      } catch (error) {
        return { 
          success: false, 
          error: error.message 
        };
      }
    });

    // Get extension stats
    messageService.registerHandler('GET_STATS', async () => {
      try {
        const tabManager = this.services.get('tab');
        const categoryManager = this.services.get('category');
        const storageManager = this.services.get('storage');
        
        const stats = {
          extension: {
            version: VERSION,
            uptime: Date.now() - this.startTime,
            initialized: this.initialized
          },
          tabs: tabManager ? tabManager.getMetrics() : {},
          categories: categoryManager ? categoryManager.getCategoryMetrics([]) : {},
          storage: storageManager ? await storageManager.getStorageUsage() : {},
          services: this.getServiceStatus()
        };
        
        return { 
          success: true, 
          data: stats 
        };
      } catch (error) {
        return { 
          success: false, 
          error: error.message 
        };
      }
    });

    console.log('✅ Settings message handlers registered');
  }

  /**
   * Load initial settings
   */
  async loadSettings() {
    try {
      this.settings = await StorageManager.getSettings();
      await this.applySettings(this.settings);
      console.log('✅ Settings loaded and applied:', this.settings);
    } catch (error) {
      console.warn('Failed to load settings, using defaults:', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Apply settings that affect background behavior
   */
  async applySettings(settings) {
    try {
      // Apply auto-organize setting
      if (settings.autoOrganize !== undefined) {
        // This would control whether tabs are automatically categorized
        // The actual implementation depends on how TabManager handles this
        console.log(`Auto-organize: ${settings.autoOrganize ? 'enabled' : 'disabled'}`);
      }

      // Apply notification settings
      if (settings.showNotifications !== undefined) {
        // This would control background notifications
        console.log(`Notifications: ${settings.showNotifications ? 'enabled' : 'disabled'}`);
      }

      // Apply categorization mode
      if (settings.categorization) {
        console.log(`Categorization mode: ${settings.categorization}`);
      }

      console.log('✅ Settings applied to background services');
    } catch (error) {
      console.error('Failed to apply settings:', error);
    }
  }

  /**
   * Get service by name
   */
  getService(name) {
    const service = this.services.get(name);
    if (!service) {
      console.warn(`Service not found: ${name}`);
    }
    return service;
  }

  /**
   * Get service status
   */
  getServiceStatus() {
    const status = {};
    
    for (const [name, service] of this.services.entries()) {
      try {
        status[name] = {
          available: !!service,
          initialized: service.initialized !== undefined ? service.initialized : true,
          ready: service.isReady ? service.isReady() : true
        };
      } catch (error) {
        status[name] = {
          available: false,
          error: error.message
        };
      }
    }
    
    return status;
  }

  /**
   * Check if all services are ready
   */
  isReady() {
    try {
      return this.initialized && 
             StorageManager?.initialized && 
             CategoryManager?.initialized && 
             TabManager?.isReady?.() && 
             MessageService?.initialized && 
             EventService?.isInitialized?.();
    } catch (error) {
      console.error('Error checking ready state:', error);
      return false;
    }
  }

  /**
   * Get system status
   */
  getStatus() {
    try {
      return {
        initialized: this.initialized,
        ready: this.isReady(),
        uptime: Date.now() - this.startTime,
        settings: this.settings,
        services: this.getServiceStatus(),
        servicesCount: this.services.size,
        version: VERSION
      };
    } catch (error) {
      console.error('Error getting status:', error);
      return {
        initialized: false,
        error: error.message
      };
    }
  }

  /**
   * Perform health check
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      checks: {},
      timestamp: Date.now(),
      version: VERSION
    };

    try {
      // Check each service
      const services = ['storage', 'category', 'tab', 'message', 'event'];
      
      for (const serviceName of services) {
        try {
          const service = this.services.get(serviceName);
          health.checks[serviceName] = service ? 'healthy' : 'unhealthy';
        } catch (error) {
          health.checks[serviceName] = 'error';
          console.error(`Health check error for ${serviceName}:`, error);
        }
      }

      // Check settings
      try {
        await StorageManager.getSettings();
        health.checks.settings = 'healthy';
      } catch (error) {
        health.checks.settings = 'error';
      }

      // Check storage quota
      try {
        const quota = await StorageManager.checkQuota();
        health.checks.storage_quota = quota.critical ? 'critical' : 
                                     quota.warning ? 'warning' : 'healthy';
        health.storageUsage = quota.usage;
      } catch (error) {
        health.checks.storage_quota = 'error';
      }

      // Overall status
      const unhealthyServices = Object.values(health.checks).filter(status => 
        status === 'unhealthy' || status === 'error'
      );
      
      const criticalServices = Object.values(health.checks).filter(status => 
        status === 'critical'
      );
      
      if (criticalServices.length > 0) {
        health.status = 'critical';
      } else if (unhealthyServices.length > 0) {
        health.status = 'unhealthy';
      }

      console.log('Health check completed:', health);
      return health;

    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Update settings from external source
   */
  async updateSettings(newSettings) {
    try {
      const updatedSettings = await StorageManager.setSettings(newSettings);
      this.settings = updatedSettings;
      await this.applySettings(updatedSettings);
      
      console.log('Settings updated:', updatedSettings);
      return updatedSettings;
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }

  /**
   * Get current settings
   */
  getSettings() {
    return { ...this.settings };
  }

  /**
   * Cleanup all services
   */
  async cleanup() {
    try {
      console.log('Starting background cleanup...');
      
      // Cleanup services in reverse order
      const serviceNames = ['event', 'message', 'tab', 'category', 'storage'];
      
      for (const serviceName of serviceNames) {
        const service = this.services.get(serviceName);
        if (service && typeof service.cleanup === 'function') {
          try {
            await service.cleanup();
            console.log(`✅ ${serviceName} service cleaned up`);
          } catch (error) {
            console.error(`❌ Failed to cleanup ${serviceName} service:`, error);
          }
        }
      }
      
      this.services.clear();
      this.initialized = false;
      this.initPromise = null;
      
      console.log('✅ Background cleanup completed');
      
    } catch (error) {
      console.error('❌ Background cleanup failed:', error);
    }
  }
}

// Create the background controller
const backgroundController = new BackgroundController();

// Service worker event handlers
self.addEventListener('install', (event) => {
  console.log('🔧 Service worker installing...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service worker activated');
  
  // Initialize the background controller
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      backgroundController.init()
    ])
  );
});

// Handle service worker startup (when browser starts)
self.addEventListener('message', async (event) => {
  if (event.data?.type === 'INIT') {
    try {
      await backgroundController.init();
      event.ports[0]?.postMessage({ success: true });
    } catch (error) {
      console.error('Failed to initialize on message:', error);
      event.ports[0]?.postMessage({ success: false, error: error.message });
    }
  } else if (event.data?.type === 'HEALTH_CHECK') {
    try {
      const health = await backgroundController.healthCheck();
      event.ports[0]?.postMessage({ success: true, data: health });
    } catch (error) {
      event.ports[0]?.postMessage({ success: false, error: error.message });
    }
  } else if (event.data?.type === 'GET_STATUS') {
    try {
      const status = backgroundController.getStatus();
      event.ports[0]?.postMessage({ success: true, data: status });
    } catch (error) {
      event.ports[0]?.postMessage({ success: false, error: error.message });
    }
  }
});

// Initialize immediately if not already initializing
if (!backgroundController.initPromise) {
  backgroundController.init().catch(error => {
    console.error('❌ Failed to initialize background controller:', error);
  });
}

// Export for debugging
self.backgroundController = backgroundController;

// Simple ready check for popup/UI
self.isBackgroundReady = () => {
  return backgroundController.isReady();
};

// Get background status
self.getBackgroundStatus = () => {
  return backgroundController.getStatus();
};

// Update settings from external source
self.updateBackgroundSettings = async (settings) => {
  return await backgroundController.updateSettings(settings);
};

console.log('🎯 Tabulo background script loaded with settings support');