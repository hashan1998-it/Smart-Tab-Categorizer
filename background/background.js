/**
 * Main background service worker entry point
 * Orchestrates all background services and managers
 */

// Static imports (required for service workers)
import debugUtils from '../shared/utils/DebugUtils.js';
import TabManager from './managers/TabManager.js';
import CategoryManager from './managers/CategoryManager.js';
import StorageManager from './managers/StorageManager.js';
import MessageService from './services/MessageService.js';
import EventService from './services/EventService.js';
import { EXTENSION_NAME, VERSION } from '../shared/constants/AppConstants.js';

class BackgroundController {
  constructor() {
    this.initialized = false;
    this.services = new Map();
    this.startTime = Date.now();
    this.initPromise = null;
    
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
        services: {
          storage: !!this.services.get('storage'),
          category: !!this.services.get('category'),
          tab: !!this.services.get('tab'),
          message: !!this.services.get('message'),
          event: !!this.services.get('event')
        },
        servicesCount: this.services.size
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
      timestamp: Date.now()
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

      // Overall status
      const unhealthyServices = Object.values(health.checks).filter(status => 
        status === 'unhealthy' || status === 'error'
      );
      
      if (unhealthyServices.length > 0) {
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

console.log('🎯 Smart Tab Organizer background script loaded');