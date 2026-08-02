/**
 * Service Worker Registration Module
 * Handles service worker registration and communication
 */

import { showToast } from './errorHandling.js';

/**
 * Service Worker Manager
 * Handles registration, updates, and communication with service worker
 */
export const ServiceWorkerManager = {
  registration: null,
  isSupported: false,
  
  /**
   * Initialize service worker
   */
  async init() {
    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported in this browser');
      this.isSupported = false;
      return;
    }
    
    this.isSupported = true;

    // The dismiss button on #sw-notification just hides whatever message is
    // currently showing there - wired once here rather than re-attached
    // every time showUpdateNotification() runs.
    const dismissBtn = document.getElementById('sw-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        const banner = document.getElementById('sw-notification');
        if (banner) banner.classList.add('hidden');
      });
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      // Handle registration events
      this.setupEventListeners();

      // Check for updates
      this.checkForUpdates();

      // Only toast on a genuinely fresh install, not every repeat visit -
      // registration succeeds silently on every page load once the worker
      // is already active, and an "offline support enabled" toast on every
      // single visit would just be noise.
      if (this.registration.installing && !navigator.serviceWorker.controller) {
        showToast('Offline support enabled', 'success', 3000);
      }

    } catch (error) {
      console.error('Service Worker registration failed:', error);
      showToast('Failed to enable offline support', 'warning');
    }
  },
  
  /**
   * Setup event listeners for service worker events
   */
  setupEventListeners() {
    if (!this.registration) return;
    
    // Handle service worker updates
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration.installing;
      
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New service worker available
              this.showUpdateNotification();
            }
            // else: installed for the first time, nothing to announce
          }
        });
      }
    });
    
    // Handle service worker messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      this.handleServiceWorkerMessage(event);
    });
    
    // Handle controller change (new service worker took control)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  },
  
  /**
   * Show update notification to user - reuses the #sw-notification markup
   * already in index.html rather than injecting a new element, and makes
   * the message itself the "apply" action (there's no dedicated button in
   * that markup, just a message span and a dismiss button).
   */
  showUpdateNotification() {
    const banner = document.getElementById('sw-notification');
    const message = document.getElementById('sw-message');
    if (!banner || !message) return;

    message.textContent = 'A new version is available - click to update.';
    message.style.cursor = 'pointer';
    message.onclick = () => this.applyUpdate();
    banner.classList.remove('hidden');
  },
  
  /**
   * Apply service worker update
   */
  async applyUpdate() {
    if (this.registration && this.registration.waiting) {
      // Tell the waiting service worker to skip waiting and become active
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  },
  
  /**
   * Check for service worker updates
   */
  async checkForUpdates() {
    if (this.registration) {
      try {
        await this.registration.update();
      } catch (error) {
        console.warn('Failed to check for service worker updates:', error);
      }
    }
  },
  
  /**
   * Handle messages from service worker
   * @param {MessageEvent} event - Message event
   */
  handleServiceWorkerMessage(event) {
    const { type, data } = event.data;
    
    switch (type) {
      case 'CACHE_INFO':
      case 'PRELOAD_COMPLETE':
        // Handled by the requesting call's own MessageChannel listener
        // (getCacheInfo/preloadResources) - reaching here means it arrived
        // as a broadcast instead, which is a no-op either way.
        break;

      case 'CACHE_CLEARED':
        showToast('Cache cleared successfully', 'success');
        break;

      default:
        console.warn('Unknown service worker message:', type, data);
    }
  },
  
  /**
   * Get cache information from service worker
   * @returns {Promise<object>} Cache information
   */
  async getCacheInfo() {
    if (!this.registration || !this.registration.active) {
      return null;
    }
    
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_INFO') {
          resolve(event.data.data);
        }
      };
      
      this.registration.active.postMessage(
        { type: 'GET_CACHE_INFO' },
        [messageChannel.port2]
      );
    });
  },
  
  /**
   * Clear all caches
   * @returns {Promise<void>}
   */
  async clearCache() {
    if (!this.registration || !this.registration.active) {
      throw new Error('Service worker not available');
    }
    
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_CLEARED') {
          resolve();
        }
      };
      
      this.registration.active.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );
    });
  },
  
  /**
   * Preload specific resources
   * @param {Array<string>} urls - URLs to preload
   * @returns {Promise<void>}
   */
  async preloadResources(urls) {
    if (!this.registration || !this.registration.active) {
      throw new Error('Service worker not available');
    }
    
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'PRELOAD_COMPLETE') {
          resolve();
        }
      };
      
      this.registration.active.postMessage(
        { type: 'PRELOAD_RESOURCES', data: { urls } },
        [messageChannel.port2]
      );
    });
  },
  
  /**
   * Check if the app is running offline
   * @returns {boolean} True if offline
   */
  isOffline() {
    return !navigator.onLine;
  },
  
  /**
   * Get service worker status
   * @returns {object} Status information
   */
  getStatus() {
    return {
      supported: this.isSupported,
      registered: !!this.registration,
      active: !!(this.registration && this.registration.active),
      scope: this.registration ? this.registration.scope : null,
      offline: this.isOffline()
    };
  }
};

/**
 * Network status manager
 */
export const NetworkManager = {
  isOnline: navigator.onLine,
  listeners: new Set(),
  
  /**
   * Initialize network monitoring
   */
  init() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.handleOnline();
    });
    
    window.addEventListener('offline', () => {
      this.handleOffline();
    });
    
    // Initial status
    this.updateStatus();
  },
  
  /**
   * Handle coming online
   */
  handleOnline() {
    this.isOnline = true;
    this.updateStatus();
    this.notifyListeners(true);
    
    showToast('Connection restored', 'success', 2000);

    // Sync any pending operations
    this.syncPendingOperations();
  },
  
  /**
   * Handle going offline
   */
  handleOffline() {
    this.isOnline = false;
    this.updateStatus();
    this.notifyListeners(false);
    
    showToast('You are now offline. Some features may be limited.', 'warning', 4000);
  },
  
  /**
   * Update UI status indicator
   */
  updateStatus() {
    document.body.classList.toggle('offline', !this.isOnline);
    document.body.classList.toggle('online', this.isOnline);

    // Only surface the indicator when offline; stay hidden while online
    const statusIndicators = document.querySelectorAll('.network-status');
    statusIndicators.forEach(indicator => {
      indicator.classList.toggle('hidden', this.isOnline);
      indicator.classList.toggle('offline', !this.isOnline);
    });
  },
  
  /**
   * Add network status listener
   * @param {Function} callback - Callback function (receives boolean)
   * @returns {Function} Unsubscribe function
   */
  addListener(callback) {
    this.listeners.add(callback);
    
    return () => {
      this.listeners.delete(callback);
    };
  },
  
  /**
   * Notify all listeners of network status change
   * @param {boolean} isOnline - Current online status
   */
  notifyListeners(isOnline) {
    this.listeners.forEach(callback => {
      try {
        callback(isOnline);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    });
  },
  
  /**
   * Sync pending operations when coming back online
   */
  async syncPendingOperations() {
    // Implementation for syncing any operations that were queued while offline
    // This could include:
    // - Retrying failed API calls
    // - Uploading queued data
    // - Refreshing cached content
    
    try {
      // Check for service worker updates
      if (ServiceWorkerManager.registration) {
        await ServiceWorkerManager.checkForUpdates();
      }
    } catch (error) {
      console.warn('Error during sync:', error);
    }
  }
};

// Make service worker manager globally available
window.serviceWorkerManager = ServiceWorkerManager;
