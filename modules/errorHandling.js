/**
 * Error Handling Module
 * Comprehensive error handling and user feedback system
 */

import { escapeHtml } from './utils.js';

/**
 * Toast notification system for user feedback
 * @param {string} message - Message to display
 * @param {string} type - Type of toast: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds (default: 4000)
 */
export function showToast(message, type = 'info', duration = 4000) {
  // Remove existing toasts of the same type
  const existingToasts = document.querySelectorAll(`.toast.toast-${type}`);
  existingToasts.forEach(toast => toast.remove());

  const toast = document.createElement('div');
  toast.className = `toast toast-${type} toast-show`;
  
  const icon = getToastIcon(type);
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  document.body.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

/**
 * Get appropriate icon for toast type
 * @param {string} type - Toast type
 * @returns {string} Icon HTML
 */
function getToastIcon(type) {
  const icons = {
    success: '✅',
    error: '❌', 
    warning: '⚠️',
    info: 'ℹ️'
  };
  return icons[type] || icons.info;
}

/**
 * Enhanced fetch with automatic retry and exponential backoff
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.warn(`Fetch attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`Failed to fetch ${url} after ${maxRetries + 1} attempts: ${lastError.message}`);
}

/**
 * Global error handler setup
 */
export function setupGlobalErrorHandlers() {
  /**
   * Global error handler for uncaught errors
   * Logs errors and shows user-friendly notifications
   */
  window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
    showToast('An unexpected error occurred. Please try refreshing the page.', 'error');
  });

  /**
   * Global handler for unhandled promise rejections
   */
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('A network or loading error occurred. Please check your connection.', 'error');
    event.preventDefault(); // Prevent the default browser handling
  });
}

/**
 * Create an error boundary for async operations
 * @param {Function} operation - Async operation to wrap
 * @param {string} context - Context description for error reporting
 * @returns {Promise} Operation result or handled error
 */
export async function withErrorBoundary(operation, context = 'operation') {
  try {
    return await operation();
  } catch (error) {
    console.error(`Error in ${context}:`, error);
    
    // Determine appropriate user message based on error type
    let userMessage = `An error occurred during ${context}.`;
    
    if (error.name === 'NetworkError' || error.message.includes('fetch')) {
      userMessage = 'Network error. Please check your connection and try again.';
    } else if (error.name === 'TypeError') {
      userMessage = 'A technical error occurred. Please refresh the page.';
    }
    
    showToast(userMessage, 'error');
    throw error; // Re-throw for caller to handle if needed
  }
}

/**
 * Log error with context for debugging
 * @param {Error} error - Error object
 * @param {string} context - Context where error occurred
 * @param {object} additionalInfo - Additional debugging information
 */
export function logError(error, context, additionalInfo = {}) {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    context,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    ...additionalInfo
  };
  
  console.error('Detailed error log:', errorInfo);
  
  // In production, you might want to send this to an error tracking service
  // sendErrorToTrackingService(errorInfo);
}
