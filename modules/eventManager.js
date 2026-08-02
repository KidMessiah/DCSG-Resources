/**
 * Event Management Module
 * Centralized event listener management with automatic cleanup
 */

import { logError } from './errorHandling.js';
import { state } from './state.js';
import { renderContent } from './renderManager.js';

/**
 * Enhanced Event Listener Management
 * Provides centralized event listener management with automatic cleanup
 */
export const EventManager = {
  listeners: new Map(),
  
  /**
   * Add an event listener with automatic tracking
   * @param {Element} element - Element to attach listener to
   * @param {string} event - Event type
   * @param {Function} handler - Event handler function
   * @param {object} options - Event listener options
   * @param {string} group - Optional group name for bulk removal
   * @returns {string} Unique key for this listener
   */
  add(element, event, handler, options = {}, group = 'default') {
    const key = `${group}_${event}_${Date.now()}_${Math.random()}`;
    
    // Wrap handler with error boundary
    const wrappedHandler = (e) => {
      try {
        handler(e);
      } catch (error) {
        logError(error, `Event handler: ${event}`, { 
          elementTag: element.tagName,
          elementId: element.id,
          group
        });
      }
    };
    
    element.addEventListener(event, wrappedHandler, options);
    
    this.listeners.set(key, {
      element,
      event,
      handler: wrappedHandler,
      originalHandler: handler,
      options,
      group,
      timestamp: Date.now()
    });
    
    return key;
  },
  
  /**
   * Remove a specific event listener
   * @param {string} key - Listener key returned by add()
   */
  remove(key) {
    const listener = this.listeners.get(key);
    if (listener) {
      listener.element.removeEventListener(listener.event, listener.handler, listener.options);
      this.listeners.delete(key);
    }
  },
  
  /**
   * Remove all listeners in a group
   * @param {string} group - Group name
   */
  removeGroup(group) {
    const toRemove = [];
    for (const [key, listener] of this.listeners) {
      if (listener.group === group) {
        toRemove.push(key);
      }
    }
    toRemove.forEach(key => this.remove(key));
  },
  
  /**
   * Remove all listeners for a specific element
   * @param {Element} element - Element to remove listeners from
   */
  removeElement(element) {
    const toRemove = [];
    for (const [key, listener] of this.listeners) {
      if (listener.element === element) {
        toRemove.push(key);
      }
    }
    toRemove.forEach(key => this.remove(key));
  },
  
  /**
   * Clean up all event listeners
   */
  cleanup() {
    for (const key of this.listeners.keys()) {
      this.remove(key);
    }
  },
  
  /**
   * Get statistics about managed event listeners
   * @returns {object} Event listener statistics
   */
  getStats() {
    const groups = {};
    const events = {};
    
    for (const listener of this.listeners.values()) {
      // Group statistics
      groups[listener.group] = (groups[listener.group] || 0) + 1;
      
      // Event type statistics
      events[listener.event] = (events[listener.event] || 0) + 1;
    }
    
    return {
      total: this.listeners.size,
      groups,
      events,
      oldestTimestamp: Math.min(...Array.from(this.listeners.values()).map(l => l.timestamp))
    };
  }
};

/**
 * Keyboard shortcut manager
 */
export const KeyboardManager = {
  shortcuts: new Map(),
  
  /**
   * Initialize keyboard shortcuts
   */
  init() {
    EventManager.add(document, 'keydown', (e) => {
      this.handleKeydown(e);
    }, {}, 'keyboard');
    
    // Register default shortcuts
    this.register('ctrl+f', (e) => {
      const searchInput = document.getElementById('search');
      if (searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });

    this.register('escape', () => {
      const searchInput = document.getElementById('search');
      if (searchInput) searchInput.value = '';
      state.search = '';
      renderContent();
    });
    
    this.register('ctrl+r', (e) => {
      e.preventDefault();
      window.location.reload();
    });
  },
  
  /**
   * Register a keyboard shortcut
   * @param {string} combination - Key combination (e.g., 'ctrl+f', 'alt+shift+s')
   * @param {Function} handler - Handler function
   */
  register(combination, handler) {
    this.shortcuts.set(combination.toLowerCase(), handler);
  },
  
  /**
   * Unregister a keyboard shortcut
   * @param {string} combination - Key combination
   */
  unregister(combination) {
    this.shortcuts.delete(combination.toLowerCase());
  },
  
  /**
   * Handle keydown events
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeydown(e) {
    const combination = this.getKeyCombination(e);
    const handler = this.shortcuts.get(combination);
    
    if (handler) {
      try {
        handler(e);
      } catch (error) {
        logError(error, `Keyboard shortcut: ${combination}`);
      }
    }
  },
  
  /**
   * Get key combination string from event
   * @param {KeyboardEvent} e - Keyboard event
   * @returns {string} Key combination
   */
  getKeyCombination(e) {
    const parts = [];
    
    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    if (e.metaKey) parts.push('meta');
    
    const key = e.key.toLowerCase();
    if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
      parts.push(key);
    }
    
    return parts.join('+');
  }
};

/**
 * Form validation and handling
 */
export const FormManager = {
  validators: new Map(),
  
  /**
   * Initialize form management
   */
  init() {
    // Add global form submission handler
    EventManager.add(document, 'submit', (e) => {
      const form = e.target;
      if (form.tagName === 'FORM') {
        this.handleFormSubmit(e);
      }
    }, {}, 'forms');
  },
  
  /**
   * Register form validator
   * @param {string} formId - Form ID
   * @param {Function} validator - Validation function
   */
  registerValidator(formId, validator) {
    this.validators.set(formId, validator);
  },
  
  /**
   * Handle form submission
   * @param {Event} e - Submit event
   */
  handleFormSubmit(e) {
    const form = e.target;
    const validator = this.validators.get(form.id);
    
    if (validator) {
      try {
        const isValid = validator(form);
        if (!isValid) {
          e.preventDefault();
        }
      } catch (error) {
        logError(error, `Form validation: ${form.id}`);
        e.preventDefault();
      }
    }
  },
  
  /**
   * Validate individual field
   * @param {HTMLElement} field - Form field element
   * @returns {boolean} True if valid
   */
  validateField(field) {
    // Basic validation rules
    if (field.required && !field.value.trim()) {
      this.showFieldError(field, 'This field is required');
      return false;
    }
    
    if (field.type === 'email' && field.value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(field.value)) {
        this.showFieldError(field, 'Please enter a valid email address');
        return false;
      }
    }
    
    this.clearFieldError(field);
    return true;
  },
  
  /**
   * Show field error
   * @param {HTMLElement} field - Form field
   * @param {string} message - Error message
   */
  showFieldError(field, message) {
    field.classList.add('field-error');
    
    let errorElement = field.parentElement.querySelector('.field-error-message');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'field-error-message';
      field.parentElement.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
  },
  
  /**
   * Clear field error
   * @param {HTMLElement} field - Form field
   */
  clearFieldError(field) {
    field.classList.remove('field-error');
    
    const errorElement = field.parentElement.querySelector('.field-error-message');
    if (errorElement) {
      errorElement.remove();
    }
  }
};
