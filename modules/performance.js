/**
 * Performance Monitoring Module
 * Utilities for monitoring and optimizing application performance
 */

/**
 * Performance monitoring utility
 */
export const PerformanceMonitor = {
  timers: new Map(),
  metrics: new Map(),
  
  /**
   * Start timing an operation
   * @param {string} name - Operation name
   */
  start(name) {
    this.timers.set(name, performance.now());
  },
  
  /**
   * End timing an operation and log result
   * @param {string} name - Operation name
   * @returns {number} Duration in milliseconds
   */
  end(name) {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`No timer found for operation: ${name}`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.timers.delete(name);
    
    // Store metric
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push(duration);

    return duration;
  },
  
  /**
   * Get average performance for an operation
   * @param {string} name - Operation name
   * @returns {number} Average duration in milliseconds
   */
  getAverage(name) {
    const measurements = this.metrics.get(name);
    if (!measurements || measurements.length === 0) return 0;
    
    const sum = measurements.reduce((a, b) => a + b, 0);
    return sum / measurements.length;
  },
  
  /**
   * Get all performance metrics
   * @returns {object} Performance metrics summary
   */
  getMetrics() {
    const summary = {};
    
    for (const [name, measurements] of this.metrics) {
      if (measurements.length > 0) {
        const sum = measurements.reduce((a, b) => a + b, 0);
        summary[name] = {
          count: measurements.length,
          total: sum,
          average: sum / measurements.length,
          min: Math.min(...measurements),
          max: Math.max(...measurements)
        };
      }
    }
    
    return summary;
  },
  
  /**
   * Monitor memory usage
   * @returns {object} Memory usage information
   */
  getMemoryUsage() {
    if ('memory' in performance) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        usedMB: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
        totalMB: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)
      };
    }
    return { error: 'Memory API not available' };
  },
  
  /**
   * Log performance summary
   */
  logSummary() {
    console.group('📊 Performance Summary');
    console.table(this.getMetrics());
    console.log('💾 Memory Usage:', this.getMemoryUsage());
    console.groupEnd();
  }
};

/**
 * Enhanced DOM element caching system
 */
export const DOMCache = {
  cache: new Map(),
  
  /**
   * Get cached DOM element or query and cache it
   * @param {string} selector - CSS selector
   * @param {Element} context - Context element (default: document)
   * @returns {Element|null} Found element
   */
  get(selector, context = document) {
    const key = `${selector}_${context === document ? 'document' : context.id || 'context'}`;
    
    if (this.cache.has(key)) {
      const element = this.cache.get(key);
      // Verify element is still in DOM
      if (element && element.isConnected) {
        return element;
      } else {
        this.cache.delete(key);
      }
    }
    
    const element = context.querySelector(selector);
    if (element) {
      this.cache.set(key, element);
    }
    
    return element;
  },
  
  /**
   * Get all matching elements (not cached due to NodeList nature)
   * @param {string} selector - CSS selector
   * @param {Element} context - Context element (default: document)
   * @returns {NodeList} Found elements
   */
  getAll(selector, context = document) {
    return context.querySelectorAll(selector);
  },
  
  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
  },
  
  /**
   * Remove specific cached element
   * @param {string} selector - CSS selector
   * @param {Element} context - Context element
   */
  remove(selector, context = document) {
    const key = `${selector}_${context === document ? 'document' : context.id || 'context'}`;
    this.cache.delete(key);
  },
  
  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getStats() {
    let valid = 0;
    let invalid = 0;
    
    for (const [key, element] of this.cache) {
      if (element && element.isConnected) {
        valid++;
      } else {
        invalid++;
      }
    }
    
    return {
      total: this.cache.size,
      valid,
      invalid,
      hitRate: this.cache.size > 0 ? (valid / this.cache.size * 100).toFixed(2) + '%' : '0%'
    };
  }
};

// Note: debounce and throttle utilities have been moved to utils.js for better organization

/**
 * Enhanced loading state management
 */
export const LoadingManager = {
  activeLoaders: new Set(),
  
  /**
   * Show loading indicator
   * @param {string} id - Unique identifier for this loading operation
   * @param {string} message - Loading message
   */
  show(id, message = 'Loading...') {
    this.activeLoaders.add(id);
    this.updateGlobalLoadingState();
    
    // Update specific loader if it exists
    const loader = DOMCache.get(`[data-loader-id="${id}"]`);
    if (loader) {
      loader.textContent = message;
      loader.style.display = 'block';
    }
  },
  
  /**
   * Hide loading indicator
   * @param {string} id - Unique identifier for this loading operation
   */
  hide(id) {
    this.activeLoaders.delete(id);
    this.updateGlobalLoadingState();
    
    // Hide specific loader if it exists
    const loader = DOMCache.get(`[data-loader-id="${id}"]`);
    if (loader) {
      loader.style.display = 'none';
    }
  },
  
  /**
   * Show the main loading overlay
   */
  showOverlay() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.remove('hidden');
      loadingOverlay.style.display = 'flex';
      document.body.classList.add('loading');
    }
  },
  
  /**
   * Hide the main loading overlay
   */
  hideOverlay() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      loadingOverlay.style.display = 'none';
      document.body.classList.remove('loading');
    }
  },
  
  /**
   * Update global loading state in UI
   */
  updateGlobalLoadingState() {
    const hasActiveLoaders = this.activeLoaders.size > 0;
    document.body.classList.toggle('loading', hasActiveLoaders);
    
    // Update cursor for the entire page
    if (hasActiveLoaders) {
      document.body.style.cursor = 'wait';
    } else {
      document.body.style.cursor = '';
    }
  },
  
  /**
   * Check if any loaders are active
   * @returns {boolean} True if any loaders are active
   */
  hasActiveLoaders() {
    return this.activeLoaders.size > 0;
  },
    /**
   * Get list of active loader IDs
   * @returns {Array<string>} Active loader IDs
   */
  getActiveLoaders() {
    return Array.from(this.activeLoaders);
  },  /**
   * Hide all active loading indicators
   */
  hideAll() {
    // Clear all active loaders
    this.activeLoaders.clear();
    this.updateGlobalLoadingState();
    
    // Hide the main loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
      loadingOverlay.style.display = 'none';
    }
    
    // Hide all loader elements in the DOM
    const loaders = document.querySelectorAll('[data-loader-id]');
    loaders.forEach(loader => {
      loader.style.display = 'none';
      loader.classList.add('hidden');
    });
    
    // Also hide common loading indicators
    const commonLoaders = document.querySelectorAll('.loading-indicator, .spinner, .loader, .loading-spinner');
    commonLoaders.forEach(loader => {
      loader.style.display = 'none';
      loader.classList.add('hidden');
    });
    
    // Hide widget-specific loading indicators
    const widgetLoaders = document.querySelectorAll('[id*="loading"], [class*="loading"]');
    widgetLoaders.forEach(loader => {
      if (loader.textContent && loader.textContent.toLowerCase().includes('loading')) {
        loader.style.display = 'none';
        loader.classList.add('hidden');
      }
    });
    
    // Remove any loading classes from the body and main containers
    document.body.classList.remove('loading', 'app-loading');
    const mainContainers = document.querySelectorAll('#app, #content, #sidebar, .container, #container');
    mainContainers.forEach(container => {
      container.classList.remove('loading');
    });
  }
};

/**
 * Intersection Observer for lazy loading
 */
export const LazyLoadManager = {
  observer: null,
  
  /**
   * Initialize intersection observer for lazy loading
   */
  init() {
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported, skipping lazy loading');
      return;
    }
    
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target;
            
            // Load the actual image
            if (element.dataset.src) {
              element.src = element.dataset.src;
              element.removeAttribute('data-src');
              this.observer.unobserve(element);
            }
            
            // Trigger widget loading if needed
            if (element.dataset.widget) {
              this.loadWidgetOnDemand(element.dataset.widget);
            }
          }
        });
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.1
      }
    );
  },
  
  /**
   * Observe an element for lazy loading
   * @param {Element} element - Element to observe
   */
  observe(element) {
    if (this.observer && element) {
      this.observer.observe(element);
    }
  },
  
  /**
   * Load widget on demand
   * @param {string} widgetId - Widget identifier
   */
  loadWidgetOnDemand(widgetId) {
    // Implementation for on-demand widget loading
  },
  
  /**
   * Cleanup observer
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
};
