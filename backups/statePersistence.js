// State Persistence Module
(function() {
  // Save current state to localStorage
  window.saveStateToStorage = function() {
    const stateToSave = {
      currentType: state.currentType,
      currentCategory: state.currentCategory,
      search: state.search,
      selected: state.selected,
      currentWidgetCategory: state.currentWidgetCategory
    };
    
    // Save with timestamp to help debug
    stateToSave.lastSaved = new Date().toISOString();
    localStorage.setItem('ADMResourcesState', JSON.stringify(stateToSave));
    console.log('State saved:', stateToSave.currentType, stateToSave.currentCategory);
  };

  // Apply the loaded state to the UI
  window.applyStateToUI = function() {
    console.log('Applying state to UI:', state.currentType, state.currentCategory);

    // Update sidebar selection based on currentType
    if (state.currentType && state.currentType !== 'Home') {
      // Find the dropdown for section types and click it
      const sectionBtn = document.querySelector('.section-slideout-base');
      if (sectionBtn && sectionBtn.textContent.trim() !== state.currentType) {
        // Open dropdown and find the button
        sectionBtn.click();
        
        // Find the button matching current type
        const typeButtons = document.querySelectorAll('.section-slideout-options button');
        for (const btn of typeButtons) {
          if (btn.textContent.trim() === capitalize(state.currentType)) {
            btn.click();
            console.log('Clicked type button:', btn.textContent);
            break;
          }
        }
      }
    }
    
    // Apply category filter if not 'All'
    if (state.currentCategory && state.currentCategory !== 'All') {
      setTimeout(() => {
        const catSelect = document.querySelector('.cat-dropdown');
        if (catSelect) {
          catSelect.value = state.currentCategory;
          // Trigger change event
          const event = new Event('change');
          catSelect.dispatchEvent(event);
          console.log('Applied category filter:', state.currentCategory);
        }
      }, 100);
    }
    
    // Apply search if exists
    if (state.search) {
      const searchInput = document.getElementById('search');
      if (searchInput) {
        searchInput.value = state.search;
        // Trigger input event
        const event = new Event('input');
        searchInput.dispatchEvent(event);
        console.log('Applied search:', state.search);
      }
    }
    
    // Apply widget category if exists
    if (state.currentWidgetCategory && state.currentWidgetCategory !== 'All') {
      setTimeout(() => {
        const widgetCategorySelect = document.getElementById('widget-category-select');
        if (widgetCategorySelect) {
          widgetCategorySelect.value = state.currentWidgetCategory;
          // Trigger change event
          const event = new Event('change');
          widgetCategorySelect.dispatchEvent(event);
          console.log('Applied widget category:', state.currentWidgetCategory);
        }
      }, 100);
    }
    
    // If there's a selected item, try to select it
    if (state.selected && state.selected.item) {
      // This needs to wait for the content to be rendered
      setTimeout(() => {
        // Find buttons in sidebar that match the selected item
        const sidebarButtons = document.querySelectorAll('#sidebar-list button');
        
        for (const btn of sidebarButtons) {
          const titleSpan = btn.querySelector('span');
          if (titleSpan && 
              titleSpan.textContent === state.selected.item.title) {
            btn.click();
            console.log('Selected item:', state.selected.item.title);
            break;
          }
        }
      }, 300);
    }
  };

  // Load state from localStorage
  window.loadStateFromStorage = function() {
    try {
      const savedState = localStorage.getItem('ADMResourcesState');
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        console.log('Loading saved state:', parsedState.currentType, parsedState.currentCategory);
        
        // Apply saved state to current state
        state.currentType = parsedState.currentType || 'Home';
        state.currentCategory = parsedState.currentCategory || 'All';
        state.search = parsedState.search || '';
        state.currentWidgetCategory = parsedState.currentWidgetCategory || 'All';
        
        // Only restore selection if the item still exists
        if (parsedState.selected) {
          // We'll need to find the actual item object by path
          const selectedItem = state.items.find(
            item => item.type === parsedState.selected.type && 
                   (item.path === parsedState.selected.item.path || 
                    item.title === parsedState.selected.item.title)
          );
          
          if (selectedItem) {
            state.selected = {
              type: parsedState.selected.type,
              item: selectedItem
            };
            console.log('Restored selected item:', selectedItem.title);
          }
        }
      }
    } catch (e) {
      console.error('Error loading saved state:', e);
      // If there's an error, continue with default state
    }
  };

  // Direct state change handler to ensure updates are saved
  window.handleStateChange = function() {
    console.log('State changed, saving...');
    saveStateToStorage();
  };

  // Attach state change listeners to the main elements that change state
  window.attachStateChangeListeners = function() {
    // Override section slideout click handler to save state AFTER navigation
    const originalRenderSectionSlideout = window.renderSectionSlideout;
    window.renderSectionSlideout = function() {
      originalRenderSectionSlideout();
      
      const options = document.querySelectorAll('.section-slideout-options button');
      options.forEach(btn => {
        const originalClick = btn.onclick;
        btn.onclick = function(e) {
          originalClick.call(this, e);
          // Use timeout to ensure state is updated before saving
          setTimeout(saveStateToStorage, 50);
        };
      });
    };

    // Override sidebar list item click handler
    const originalRenderSidebarList = window.renderSidebarList;
    window.renderSidebarList = function() {
      originalRenderSidebarList();
      
      const buttons = document.querySelectorAll('#sidebar-list button');
      buttons.forEach(btn => {
        const originalClick = btn.onclick;
        if (originalClick) {
          btn.onclick = function(e) {
            originalClick.call(this, e);
            // Use timeout to ensure state is updated before saving
            setTimeout(saveStateToStorage, 50);
          };
        }
      });
    };

    // Override category select change handler
    const originalRenderCategoryAndSearch = window.renderCategoryAndSearch;
    window.renderCategoryAndSearch = function() {
      originalRenderCategoryAndSearch();
      
      const catSelect = document.querySelector('.cat-dropdown');
      if (catSelect) {
        const originalChange = catSelect.onchange;
        if (originalChange) {
          catSelect.onchange = function(e) {
            originalChange.call(this, e);
            setTimeout(saveStateToStorage, 50);
          };
        }
      }
      
      const searchInput = document.getElementById('search');
      if (searchInput) {
        const originalInput = searchInput.oninput;
        if (originalInput) {
          searchInput.oninput = function(e) {
            originalInput.call(this, e);
            // We need to save after the debounce timeout
            const originalDebounce = state.debounceTimer;
            state.debounceTimer = setTimeout(() => {
              if (originalDebounce) clearTimeout(originalDebounce);
              saveStateToStorage();
            }, 300);
          };
        }
      }
    };

    // Override widget category select change handler
    const originalRenderWidgetsSidebar = window.renderWidgetsSidebar;
    window.renderWidgetsSidebar = function() {
      originalRenderWidgetsSidebar();
      
      const categorySelect = document.getElementById('widget-category-select');
      if (categorySelect) {
        categorySelect.addEventListener('change', function() {
          setTimeout(saveStateToStorage, 50);
        });
      }
    };
    
    // Helper function to ensure proper capitalization (same as in app.js)
    function capitalize(str) {
      return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    }
  };
  
  // Ensure state is loaded at the right time
  window.addEventListener('DOMContentLoaded', function() {
    // Load state right after the page structure is ready but before UI rendering
    const originalInit = window.initializeApp || function(){};
    window.initializeApp = function() {
      // First load the state
      loadStateFromStorage();
      // Then run the original initialization
      originalInit();
    };
  });
})();

console.log('State persistence module loaded');