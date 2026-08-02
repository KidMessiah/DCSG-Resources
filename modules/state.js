/**
 * State Management Module
 * Centralized state management for the AwkwardDM Resources application
 */

/**
 * Central application state object that stores all data needed across the application
 * Includes content data, UI state, filter settings, and widget management
 */
export const state = {
  files: [{ url: 'content/list.json' }],  // Data sources to load
  items: [],                              // All content items from data sources
  types: [],                              // Available content type categories
  categories: [],                         // Available subcategories for current type
  currentType: 'Home',                    // Currently active content type
  currentCategory: 'All',                 // Currently selected category filter
  search: '',                             // Current search filter text
  selected: null,                         // Currently selected item {type, item}
  dom: {},                                // Cached DOM element references
  debounceTimer: null,                    // Timer for search input debouncing
  saveTimer: null,                        // Timer for state persistence debouncing
  widgets: [],                            // Available widgets for homepage
  filteredWidgets: [],                    // Widgets filtered by search/category
  widgetCategories: ['All'],              // Available widget categories
  currentWidgetCategory: 'All',           // Current widget category filter
  cachedWidgetInstances: {},              // Cached widget instances to preserve state
  widgetContainers: {}                    // References to widget container elements
};

/**
 * State change observers
 */
const stateObservers = new Map();

/**
 * Subscribe to state changes
 * @param {string} key - State key to watch
 * @param {Function} callback - Callback function when state changes
 * @returns {Function} Unsubscribe function
 */
export function subscribeToState(key, callback) {
  if (!stateObservers.has(key)) {
    stateObservers.set(key, new Set());
  }
  stateObservers.get(key).add(callback);
  
  // Return unsubscribe function
  return () => {
    const observers = stateObservers.get(key);
    if (observers) {
      observers.delete(callback);
    }
  };
}

/**
 * Update state and notify observers
 * @param {string} key - State key to update
 * @param {*} value - New value
 */
export function updateState(key, value) {
  const oldValue = state[key];
  state[key] = value;
  
  // Notify observers
  const observers = stateObservers.get(key);
  if (observers) {
    observers.forEach(callback => {
      try {
        callback(value, oldValue);
      } catch (error) {
        console.error(`Error in state observer for ${key}:`, error);
      }
    });
  }
  
  // Auto-save important state changes
  const persistentKeys = ['currentType', 'currentCategory', 'search', 'selected', 'currentWidgetCategory'];
  if (persistentKeys.includes(key)) {
    // Debounce save operations to avoid excessive localStorage writes
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => {
      saveStateToStorage();
    }, 500);
  }
}

/**
 * Get current state value
 * @param {string} key - State key
 * @returns {*} Current state value
 */
export function getState(key) {
  return state[key];
}

/**
 * State persistence functions
 */

/**
 * Save current state to localStorage
 */
export function saveStateToStorage() {
  try {
    const stateToSave = {
      currentType: state.currentType,
      currentCategory: state.currentCategory,
      search: state.search,
      selected: state.selected,
      currentWidgetCategory: state.currentWidgetCategory,
      lastSaved: new Date().toISOString()
    };
    
    localStorage.setItem('ADMResourcesState', JSON.stringify(stateToSave));
  } catch (error) {
    console.warn('Failed to save state:', error);
  }
}

/**
 * Load state from localStorage
 */
export function loadStateFromStorage() {
  try {
    const savedState = localStorage.getItem('ADMResourcesState');
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      
      // Apply saved state values
      if (parsedState.currentType) state.currentType = parsedState.currentType;
      if (parsedState.currentCategory) state.currentCategory = parsedState.currentCategory;
      if (parsedState.search) state.search = parsedState.search;
      if (parsedState.selected) state.selected = parsedState.selected;
      if (parsedState.currentWidgetCategory) state.currentWidgetCategory = parsedState.currentWidgetCategory;

      return true;
    }
  } catch (error) {
    console.warn('Failed to load state:', error);
  }
  return false;
}
