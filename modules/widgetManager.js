/**
 * Widget Management Module
 * Handles widget loading, error boundaries, and lifecycle management
 */

import { showToast, withErrorBoundary, logError } from './errorHandling.js';
import { escapeHtml } from './utils.js';
import { PerformanceMonitor, LoadingManager } from './performance.js';
import { state, updateState } from './state.js';

/**
 * Widget error boundary to handle widget loading failures
 * @param {HTMLElement} container - Widget container element
 * @param {object} widget - Widget configuration
 * @param {Function} loadFunction - Function to load the widget
 */
export async function loadWidgetWithErrorBoundary(container, widget, loadFunction) {
  const widgetId = widget.src.replace(/[^a-z0-9]/gi, '_');
  
  try {
    // Show loading state
    container.innerHTML = `
      <div class="widget-loading">
        <div class="loading-spinner"></div>
        <p>Loading ${escapeHtml(widget.name)}...</p>
      </div>
    `;

    // Load the widget
    await loadFunction();
    
    // After successful loading, clean up any remaining loading indicators
    setTimeout(() => {
      const loadingElements = container.querySelectorAll('.widget-loading, .loading-spinner');
      loadingElements.forEach(el => el.remove());
      LoadingManager.hide(`widget-${widgetId}`);
    }, 100);
    
  } catch (error) {
    logError(error, `Widget loading: ${widget.name}`, { widgetSrc: widget.src });
    
    // Show error state with retry option
    container.innerHTML = `
      <div class="widget-error">
        <div class="error-icon">⚠️</div>
        <h4>Failed to load ${escapeHtml(widget.name)}</h4>
        <p class="error-message">${escapeHtml(error.message || 'Unknown error occurred')}</p>
        <div class="error-actions">
          <button class="retry-btn" onclick="retryWidgetLoad('${widgetId}', '${widget.src}')">
            🔄 Retry
          </button>
          <button class="skip-btn" onclick="this.closest('.widget-error').style.display='none'">
            Skip
          </button>
        </div>
      </div>
    `;
    
    // Store error state for retry
    const cachedInstances = state.cachedWidgetInstances;
    cachedInstances[widgetId] = { error: true, widget, container };
    updateState('cachedWidgetInstances', cachedInstances);
  }
}

/**
 * Retry loading a failed widget
 * @param {string} widgetId - Widget identifier
 * @param {string} widgetSrc - Widget source path
 */
export async function retryWidgetLoad(widgetId, widgetSrc) {
  const cached = state.cachedWidgetInstances[widgetId];
  if (!cached || !cached.error) return;
  
  const { widget, container } = cached;
  
  // Clear error state
  const cachedInstances = { ...state.cachedWidgetInstances };
  delete cachedInstances[widgetId];
  updateState('cachedWidgetInstances', cachedInstances);
  
  // Reload the widget
  await loadWidgetWithErrorBoundary(container, widget, async () => {
    await loadWidgetScript(widget, container);
  });
}

/**
 * Enhanced widget script loading with error handling and caching
 * @param {object} widget - Widget configuration object
 * @param {HTMLElement} container - Container element for the widget
 */
export async function loadWidgetScript(widget, container) {
  const scriptId = widget.src.replace(/[^a-z0-9]/gi, '_');
  
  if (document.getElementById(scriptId)) {
    return;
  }

  PerformanceMonitor.start(`load-widget-${widget.name}`);
  LoadingManager.show(`widget-${scriptId}`, `Loading ${widget.name}...`);

  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = widget.src;
      
      // Set timeout for script loading
      const timeout = setTimeout(() => {
        reject(new Error(`Script loading timeout: ${widget.src}`));
      }, 10000); // 10 second timeout
      
      script.onload = () => {
        clearTimeout(timeout);
        PerformanceMonitor.end(`load-widget-${widget.name}`);
        LoadingManager.hide(`widget-${scriptId}`);
        resolve();
      };
      
      script.onerror = () => {
        clearTimeout(timeout);
        const error = new Error(`Failed to load script: ${widget.src}`);
        console.error(`Failed to load script for ${widget.name}:`, error);
        LoadingManager.hide(`widget-${scriptId}`);
        reject(error);
      };
      
      document.head.appendChild(script);
    });
    
    // Additional validation - check if widget function exists
    if (typeof window.renderWidget !== 'function') {
      throw new Error(`Widget render function not found after loading script: ${widget.src}`);
    }
      // Execute the widget render function
    try {
      const widgetInstance = window.renderWidget(container);
      
      // Store in cache
      const widgetId = widget.src.replace(/[^a-z0-9]/gi, '_');
      const cachedInstances = { ...state.cachedWidgetInstances };
      cachedInstances[widgetId] = {
        instance: widgetInstance,
        container: container
      };
      updateState('cachedWidgetInstances', cachedInstances);

      // Hide widget-specific loading indicators after successful render
      LoadingManager.hide(`widget-${scriptId}`);
      
      // Additional cleanup - remove any loading content from container
      const loadingElements = container.querySelectorAll('.widget-loading, .loading-spinner');
      loadingElements.forEach(el => el.remove());
      
    } catch (e) {
      LoadingManager.hide(`widget-${scriptId}`);
      throw new Error(`Widget render function failed: ${e.message}`);
    } finally {
      // Clean up global render function
      delete window.renderWidget;
    }
    
  } catch (error) {
    PerformanceMonitor.end(`load-widget-${widget.name}`);
    LoadingManager.hide(`widget-${scriptId}`);
    throw error;
  }
}

/**
 * Widget lifecycle manager
 */
export const WidgetManager = {
  loadedWidgets: new Map(),
  
  /**
   * Register a widget instance
   * @param {string} id - Widget ID
   * @param {object} instance - Widget instance
   */
  register(id, instance) {
    this.loadedWidgets.set(id, {
      instance,
      loadTime: Date.now(),
      isActive: true
    });
  },
  
  /**
   * Unregister a widget instance
   * @param {string} id - Widget ID
   */
  unregister(id) {
    const widget = this.loadedWidgets.get(id);
    if (widget && widget.instance && typeof widget.instance.destroy === 'function') {
      try {
        widget.instance.destroy();
      } catch (error) {
        logError(error, `Widget destruction: ${id}`);
      }
    }
    this.loadedWidgets.delete(id);
  },
  
  /**
   * Get widget instance
   * @param {string} id - Widget ID
   * @returns {object|null} Widget instance or null
   */
  get(id) {
    const widget = this.loadedWidgets.get(id);
    return widget ? widget.instance : null;
  },
  
  /**
   * Check if widget is loaded
   * @param {string} id - Widget ID
   * @returns {boolean} True if widget is loaded
   */
  isLoaded(id) {
    return this.loadedWidgets.has(id);
  },
  
  /**
   * Pause all widgets (for performance)
   */
  pauseAll() {
    for (const [id, widget] of this.loadedWidgets) {
      if (widget.instance && typeof widget.instance.pause === 'function') {
        try {
          widget.instance.pause();
          widget.isActive = false;
        } catch (error) {
          logError(error, `Widget pause: ${id}`);
        }
      }
    }
  },
  
  /**
   * Resume all widgets
   */
  resumeAll() {
    for (const [id, widget] of this.loadedWidgets) {
      if (widget.instance && typeof widget.instance.resume === 'function') {
        try {
          widget.instance.resume();
          widget.isActive = true;
        } catch (error) {
          logError(error, `Widget resume: ${id}`);
        }
      }
    }
  },
  
  /**
   * Get widget statistics
   * @returns {object} Widget statistics
   */
  getStats() {
    const active = Array.from(this.loadedWidgets.values()).filter(w => w.isActive).length;
    return {
      total: this.loadedWidgets.size,
      active,
      inactive: this.loadedWidgets.size - active
    };
  },
  
  /**
   * Cleanup all widgets
   */
  cleanup() {
    for (const id of this.loadedWidgets.keys()) {
      this.unregister(id);
    }
  }
};

/**
 * Widget preloader for performance optimization
 */
export const WidgetPreloader = {
  preloadQueue: [],
  isPreloading: false,
  
  /**
   * Add widget to preload queue
   * @param {object} widget - Widget configuration
   */
  add(widget) {
    if (!this.preloadQueue.find(w => w.src === widget.src)) {
      this.preloadQueue.push(widget);
    }
  },
  
  /**
   * Start preloading widgets
   */
  async start() {
    if (this.isPreloading) return;
    
    this.isPreloading = true;

    for (const widget of this.preloadQueue) {
      try {
        await withErrorBoundary(async () => {
          // Create temporary hidden container for preloading
          const tempContainer = document.createElement('div');
          tempContainer.style.display = 'none';
          document.body.appendChild(tempContainer);
          
          await loadWidgetScript(widget, tempContainer);
          
          // Clean up temporary container
          document.body.removeChild(tempContainer);
        }, `preload widget ${widget.name}`);
      } catch (error) {
        console.warn(`Failed to preload widget ${widget.name}:`, error.message);
      }
      
      // Small delay to prevent blocking the main thread
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isPreloading = false;
  },
  
  /**
   * Clear preload queue
   */
  clear() {
    this.preloadQueue = [];
  }
};

// Make retry function globally available for onclick handlers
window.retryWidgetLoad = retryWidgetLoad;
