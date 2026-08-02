/**
 * Data Management Module
 * Handles loading, caching, and processing of application data
 */

import { fetchWithRetry, withErrorBoundary, logError } from './errorHandling.js';
import { PerformanceMonitor } from './performance.js';
import { state, updateState } from './state.js';

/**
 * Data cache for improved performance
 */
const DataCache = {
  cache: new Map(),
  maxAge: 5 * 60 * 1000, // 5 minutes
  
  /**
   * Get cached data
   * @param {string} key - Cache key
   * @returns {*} Cached data or null
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  },
  
  /**
   * Set cached data
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   */
  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  },
  
  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
  },
  
  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;
    
    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > this.maxAge) {
        expired++;
      } else {
        valid++;
      }
    }
    
    return {
      total: this.cache.size,
      valid,
      expired,
      hitRate: this.cache.size > 0 ? (valid / this.cache.size * 100).toFixed(2) + '%' : '0%'
    };
  }
};

/**
 * Load all content items and widgets from data sources
 * @returns {Promise<void>}
 */
export async function loadItems() {
  PerformanceMonitor.start('load-items');
  
  try {
    // Reset state
    updateState('items', []);
    updateState('types', ['Home', 'homebrew', 'flanking', 'constellation']);
    
    // Load homepage widgets first
    await loadWidgets();
    
    // Load content items from all configured files
    await Promise.all(state.files.map(file => loadContentFile(file.url)));

  } catch (error) {
    logError(error, 'Data loading');
    throw error;
  } finally {
    PerformanceMonitor.end('load-items');
  }
}

/**
 * Load widgets from homepage configuration
 * @returns {Promise<void>}
 */
async function loadWidgets() {
  try {
    const cacheKey = 'homepage-widgets';
    let widgets = DataCache.get(cacheKey);
    
    if (!widgets) {
      const response = await fetchWithRetry('content/homepage.json');
      widgets = await response.json();
      DataCache.set(cacheKey, widgets);
    }
    
    updateState('widgets', widgets);
    updateState('filteredWidgets', [...widgets]);
    
    // Extract unique widget categories
    const categories = ['All'];
    widgets.forEach(widget => {
      if (widget.category && !categories.includes(widget.category)) {
        categories.push(widget.category);
      }
    });
    updateState('widgetCategories', categories);
    
  } catch (error) {
    console.error('Error loading widgets:', error);
    updateState('widgets', []);
    updateState('filteredWidgets', []);
  }
}

/**
 * Load content from a specific file
 * @param {string} url - File URL to load
 * @returns {Promise<void>}
 */
async function loadContentFile(url) {
  try {
    const cacheKey = `content-${url}`;
    let data = DataCache.get(cacheKey);
    
    if (!data) {
      const response = await fetchWithRetry(url);
      data = await response.json();
      DataCache.set(cacheKey, data);
    }
    
    // Process data based on structure
    const items = [];
    const types = [...state.types];
    
    if (Array.isArray(data)) {
      // Legacy flat array format
      for (const item of data) {
        items.push(item);
        if (item.type && !types.includes(item.type)) {
          types.push(item.type);
        }
      }
    } else {
      // New nested format with type as parent key
      for (const type in data) {
        if (!types.includes(type)) {
          types.push(type);
        }
        
        for (const item of data[type]) {
          items.push({
            ...item,
            type // Add type from parent key
          });
        }
      }
    }
    
    // Update state
    updateState('items', [...state.items, ...items]);
    updateState('types', types);
    
  } catch (error) {
    console.error(`Error loading content file ${url}:`, error);
  }
}

// Export data cache for external access
export { DataCache };
