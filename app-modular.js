/**
 * Main Application Module
 * Entry point that initializes all modules and manages the application lifecycle
 */

import { setupGlobalErrorHandlers, showToast } from './modules/errorHandling.js';
import { PerformanceMonitor, DOMCache, LoadingManager, LazyLoadManager } from './modules/performance.js';
import { EventManager, KeyboardManager, FormManager } from './modules/eventManager.js';
import { WidgetManager, WidgetPreloader } from './modules/widgetManager.js';
import { loadItems, DataCache } from './modules/dataManager.js';
import { state, updateState, saveStateToStorage, loadStateFromStorage } from './modules/state.js';
import { initializeRenderCache, renderSidebar, renderContent } from './modules/renderManager.js';
import { ServiceWorkerManager, NetworkManager } from './modules/serviceWorker.js';

// Make state available globally for easy access across modules
window.state = state;

/**
 * Application class that manages the entire application lifecycle
 */
class App {
  constructor() {
    this.isInitialized = false;
    this.modules = new Map();
  }
    /**
   * Initialize the application
   */
  async init() {
    if (this.isInitialized) {
      console.warn('Application already initialized');
      return;
    }
    
    PerformanceMonitor.start('app-initialization');

    try {
      // Setup error handling first
      setupGlobalErrorHandlers();
      this.setupErrorBoundary();
        // Initialize core systems
      this.cacheDom();
      initializeRenderCache();

      // Initialize managers and start the app
      await this.onDOMReady();
      
    } catch (error) {
      console.error('Failed to initialize application:', error);
      showToast('Failed to start application. Please refresh the page.', 'error');
    } finally {
      PerformanceMonitor.end('app-initialization');
    }
  }
  
  /**
   * Handle DOM ready event
   */
  async onDOMReady() {
    try {
      // Initialize all managers
      KeyboardManager.init();
      FormManager.init();
      LazyLoadManager.init();
      ServiceWorkerManager.init();
      NetworkManager.init();
      await loadItems();

      // Restore saved state if available
      this.restoreState();

      // Initialize UI
      this.initializeUI();

      // Start widget preloader after data is loaded
      this.preloadWidgets();

      // Setup cleanup handlers
      this.setupCleanup();

      this.isInitialized = true;

    } catch (error) {
      console.error('Error during DOM ready:', error);
      this.showErrorPage(error);
    }
  }
  
  /**
   * Cache frequently used DOM elements
   */
  cacheDom() {
    const elements = {
      sidebar: '#sidebar',
      content: '#content'
    };

    const dom = {};
    for (const [key, selector] of Object.entries(elements)) {
      dom[key] = DOMCache.get(selector);
    }
    
    updateState('dom', dom);
  }
    /**
   * Initialize UI components
   */
  initializeUI() {
    // Clear any lingering loading states
    LoadingManager.hideAll();

    this.renderSidebar();
    this.renderContent();
    
    // Clear loading state from body and ensure clean UI state
    document.body.classList.remove('loading');
    document.body.style.cursor = '';
  }
    /**
   * Restore application state from storage
   */
  restoreState() {
    try {
      loadStateFromStorage();
    } catch (error) {
      console.warn("Failed to restore state:", error);
    }
  }
    /**
   * Preload widgets for better performance
   */
  preloadWidgets() {
    // Check if widgets are available
    if (!state.widgets || !Array.isArray(state.widgets)) {
      return;
    }

    // Add frequently used widgets to preload queue
    const priorityWidgets = state.widgets.filter(widget =>
      widget.priority === 'high' || widget.preload === true
    );

    if (priorityWidgets.length === 0) {
      return;
    }
    
    priorityWidgets.forEach(widget => {
      WidgetPreloader.add(widget);
    });
    
    // Start preloading in the background
    setTimeout(() => {
      WidgetPreloader.start();
    }, 2000);
  }
  
  /**
   * Setup cleanup handlers
   */
  setupCleanup() {
    // Cleanup on page unload
    EventManager.add(window, 'beforeunload', () => {
      this.cleanup();
    });
    
    // Cleanup on page visibility change (when tab becomes hidden)
    EventManager.add(document, 'visibilitychange', () => {
      if (document.hidden) {
        WidgetManager.pauseAll();
      } else {
        WidgetManager.resumeAll();
      }
    });
    
    // Periodic cleanup of caches
    setInterval(() => {
      this.performMaintenanceCleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }
  
  /**
   * Perform maintenance cleanup
   */
  performMaintenanceCleanup() {
    // Clean up DOM cache
    const domStats = DOMCache.getStats();
    if (domStats.invalid > domStats.valid / 2) {
      DOMCache.clear();
      this.cacheDom();
    }

    // Clean up data cache
    const dataStats = DataCache.getStats();
    if (dataStats.expired > 0) {
      // DataCache.clear(); // Uncomment if you want to clear expired entries
    }
    
    // Log memory usage
    const memory = PerformanceMonitor.getMemoryUsage();
    if (memory.usedMB > 100) {
      console.warn('⚠️ High memory usage detected:', memory);
    }
  }
  
  /**
   * Render sidebar content
   */
  renderSidebar() {
    renderSidebar();
  }
  
  /**
   * Render main content
   */
  renderContent() {
    renderContent();
  }
  
  /**
   * Wire up the error boundary's retry/reload buttons (once)
   */
  setupErrorBoundary() {
    const retryBtn = document.getElementById('error-retry');
    const reloadBtn = document.getElementById('error-reload');

    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        const boundary = document.getElementById('error-boundary');
        if (boundary) boundary.classList.add('hidden');
        this.isInitialized = false;
        this.init();
      });
    }

    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        window.location.reload();
      });
    }
  }

  /**
   * Show error page
   * @param {Error} error - Error that occurred
   */
  showErrorPage(error) {
    const boundary = document.getElementById('error-boundary');
    const message = document.getElementById('error-message');
    if (!boundary) return;

    if (message) {
      message.textContent = error.message || 'An unexpected error occurred. Please try refreshing the page.';
    }
    boundary.classList.remove('hidden');
  }
  
  /**
   * Show debug information
   */
  showDebugInfo() {
    const debugInfo = {
      error: 'Application initialization failed',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      state: state,
      performance: PerformanceMonitor.getMetrics(),
      memory: PerformanceMonitor.getMemoryUsage(),
      cache: {
        dom: DOMCache.getStats(),
        data: DataCache.getStats()
      }
    };
    
    console.group('🐛 Debug Information');
    console.log(JSON.stringify(debugInfo, null, 2));
    console.groupEnd();
    
    // Copy to clipboard if available
    if (navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))
        .then(() => {
          showToast('Debug info copied to clipboard', 'info');
        })
        .catch(() => {
          showToast('Failed to copy debug info', 'error');
        });
    }
  }
  
  /**
   * Cleanup application resources
   */
  cleanup() {
    // Save state before cleanup
    if (window.saveStateToStorage) {
      try {
        window.saveStateToStorage();
      } catch (error) {
        console.warn('Failed to save state during cleanup:', error);
      }
    }
    
    // Cleanup managers
    EventManager.cleanup();
    WidgetManager.cleanup();
    LazyLoadManager.destroy();
    DOMCache.clear();
    DataCache.clear();
    
    this.isInitialized = false;
  }
  
  /**
   * Get application status
   * @returns {object} Application status information
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      modules: Array.from(this.modules.keys()),
      performance: PerformanceMonitor.getMetrics(),
      memory: PerformanceMonitor.getMemoryUsage(),
      widgets: WidgetManager.getStats(),
      events: EventManager.getStats(),
      cache: {
        dom: DOMCache.getStats(),
        data: DataCache.getStats()
      }
    };
  }
}

// Create and initialize the application
const app = new App();

// Make app globally available for debugging
window.app = app;

// Initialize when DOM is ready (only once)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.init();
  });
} else {
  // DOM is already ready, initialize immediately
  setTimeout(() => {
    app.init();
  }, 0);
}

// Export for module usage
export default app;
