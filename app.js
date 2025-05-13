/**
 * AwkwardDM Resources App
 * A centralized hub for D&D resources including PDFs, videos, images, websites, and custom widgets.
 * Provides a sidebar navigation and content area for displaying different types of media.
 */

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/**
 * Central application state object that stores all data needed across the application
 * Includes content data, UI state, filter settings, and widget management
 */
const state = {
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
  widgets: [],                            // Available widgets for homepage
  filteredWidgets: [],                    // Widgets filtered by search/category
  widgetCategories: ['All'],              // Available widget categories
  currentWidgetCategory: 'All',           // Current widget category filter
  cachedWidgetInstances: {},              // Cached widget instances to preserve state
  widgetContainers: {}                    // References to widget container elements
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Escapes HTML special characters to prevent XSS vulnerabilities
 * @param {string} str - The string to sanitize
 * @return {string} Sanitized string with HTML entities replaced
 */
const escapeHtml = str => String(str).replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));

/**
 * Truncates text to a specified length and adds ellipsis
 * Used for previews in sidebar and cards
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @return {string} Truncated text with ellipsis if needed
 */
function truncateText(text, maxLength = 30) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Generates a favicon URL for a website
 * @param {string} websiteUrl - The website URL to get favicon for
 * @return {string|null} Favicon URL or null if invalid
 */
function getFaviconUrl(websiteUrl) {
  try {
    const url = new URL(websiteUrl);
    return `https://${url.hostname}/favicon.ico`;
  } catch (e) {
    console.error("Invalid URL for favicon:", websiteUrl);
    return null;
  }
}

/**
 * Generates a website thumbnail URL using screenshotmachine.com API
 * @param {string} websiteUrl - The website URL to generate thumbnail for
 * @return {string|null} Thumbnail URL or null if invalid
 */
function getWebsiteThumbnailUrl(websiteUrl) {
  try {
    const cleanUrl = websiteUrl.replace(/\/$/, '');
    const encodedUrl = encodeURIComponent(cleanUrl);
    return `https://api.screenshotmachine.com?key=478d1a&url=${encodedUrl}&dimension=1024x768&delay=200`;
  } catch (e) {
    console.error("Invalid URL for thumbnail:", websiteUrl);
    return null;
  }
}

/**
 * Capitalizes a string with special handling for certain abbreviations
 * @param {string} str - String to capitalize
 * @return {string} Capitalized string
 */
function capitalize(str) {
  if (!str) return '';
  
  const uppercaseTerms = ['pdf', 'dm', 'gm', 'npc', 'pc'];
  if (uppercaseTerms.includes(str.toLowerCase())) {
    return str.toUpperCase();
  }
  
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Debounce function to limit how often a function is called
 * Used for search and resize handlers
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @return {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Checks if current page is the homepage
 * @return {boolean} True if homepage
 */
function isHomepage() {
  return location.pathname.endswith('/') || location.pathname.endswith('index.html');
}

// =============================================================================
// DATA LOADING
// =============================================================================

/**
 * Loads all content items and widgets from data sources
 * Initializes type lists, categories, and widget data
 */
async function loadItems() {
  state.items = [];
  state.types = ['Home'];
  
  // Load homepage widgets
  try {
    const res = await fetch('content/homepage.json');
    if (res.ok) {
      state.widgets = await res.json();
      state.filteredWidgets = [...state.widgets];
      
      // Extract unique widget categories
      state.widgetCategories = ['All'];
      state.widgets.forEach(widget => {
        if (widget.category && !state.widgetCategories.includes(widget.category)) {
          state.widgetCategories.push(widget.category);
        }
      });
    }
  } catch (e) {
    console.error("Error loading widgets:", e);
  }
  
  // Load content items
  for (const file of state.files) {
    try {
      const res = await fetch(file.url);
      if (!res.ok) continue;
      const data = await res.json();
      
      // Handle both nested and flat data structures
      if (Array.isArray(data)) {
        // Legacy flat array format
        for (const item of data) {
          state.items.push(item);
          if (item.type && !state.types.includes(item.type)) state.types.push(item.type);
        }
      } else {
        // New nested format with type as parent key
        for (const type in data) {
          if (!state.types.includes(type)) state.types.push(type);
          
          for (const item of data[type]) {
            state.items.push({
              ...item,
              type // Add type from parent key
            });
          }
        }
      }
    } catch (e) {
      console.error("Error loading items:", e);
    }
  }
}

// =============================================================================
// DOM MANIPULATION
// =============================================================================

/**
 * Caches DOM elements for improved performance
 * Prevents repeated DOM queries
 */
function cacheDom() {
  state.dom.sidebar = document.getElementById('sidebar');
  state.dom.content = document.getElementById('content');
}

// =============================================================================
// WIDGET MANAGEMENT
// =============================================================================

/**
 * Applies filters to widgets based on search and category
 * Updates the filteredWidgets array and rerenders widget sidebar
 */
function applyWidgetFilters() {
  const searchTerm = state.search.toLowerCase();
  const category = state.currentWidgetCategory;
  
  state.filteredWidgets = state.widgets.filter(widget => {
    // Category filter
    const categoryMatch = category === 'All' || widget.category === category;
    
    // Search filter
    const searchMatch = searchTerm === '' || 
      widget.name.toLowerCase().includes(searchTerm) ||
      (widget.category && widget.category.toLowerCase().includes(searchTerm));
    
    return categoryMatch && searchMatch;
  });
  
  renderWidgetsSidebar();
}

/**
 * Renders widgets in the sidebar for the homepage view
 * Displays filtered widgets with category filter control
 */
function renderWidgetsSidebar() {
  const listDiv = document.getElementById('sidebar-list');
  listDiv.innerHTML = '';
  
  // Add widget category filter dropdown
  if (state.widgetCategories.length > 1) {
    const categoryFilter = document.createElement('div');
    categoryFilter.className = 'widget-category-filter';
    
    const categoryLabel = document.createElement('h3');
    categoryLabel.textContent = 'Rule Impact';
    categoryFilter.appendChild(categoryLabel);
    
    const categorySelect = document.createElement('select');
    categorySelect.id = 'widget-category-select';
    
    state.widgetCategories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      if (category === state.currentWidgetCategory) {
        option.selected = true;
      }
      categorySelect.appendChild(option);
    });
    
    categorySelect.addEventListener('change', (e) => {
      state.currentWidgetCategory = e.target.value;
      applyWidgetFilters();
    });
    
    categoryFilter.appendChild(categorySelect);
    listDiv.appendChild(categoryFilter);
  }
  
  // Create widget navigation list
  const widgetNav = document.createElement('nav');
  widgetNav.id = 'homepage-widget-nav';
  widgetNav.className = 'widget-sidebar-list';
  
  // Handle empty results
  if (state.filteredWidgets.length === 0) {
    const noWidgets = document.createElement('p');
    noWidgets.textContent = 'No widgets match your filters';
    noWidgets.className = 'no-results';
    widgetNav.appendChild(noWidgets);
  } else {
    // Create navigation buttons for each widget
    state.filteredWidgets.forEach((widget, idx) => {
      const originalIndex = state.widgets.findIndex(w => w.src === widget.src);
      const btn = document.createElement('button');
      
      // Main button text is the widget name
      btn.textContent = widget.name || `Widget ${originalIndex + 1}`;
      
      // Add category and description inline
      if (widget.category || widget.description) {
        const infoLine = document.createElement('div');
        infoLine.className = 'sidebar-item-info';
        
        let infoText = '';
        if (widget.category) {
          infoText = widget.category;
        }
        
        if (widget.description) {
          if (infoText) infoText += ': ';
          infoText += truncateText(widget.description, 25);
        }
        
        infoLine.textContent = infoText;
        btn.appendChild(infoLine);
      }
      
      // Button hover and click events
      btn.onmouseover = () => {};
      btn.onmouseout = () => {};
      btn.onclick = () => {
        const el = document.getElementById(`homepage-widget-${originalIndex}`);
        if (el) {
          // Center the widget in the viewport
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Also use window.scrollTo for more precise centering
          const rect = el.getBoundingClientRect();
          const targetMiddle = rect.top + (rect.height / 2);
          const viewportMiddle = window.innerHeight / 2;
          window.scrollTo({
            top: window.pageYOffset + targetMiddle - viewportMiddle,
            behavior: 'smooth'
          });
          // Add yellow highlight
          el.classList.add('highlight');
          if (!el.style.transition) {
            el.style.transition = 'background-color 0.3s';
          }
          const originalBg = el.style.backgroundColor;
          el.style.backgroundColor = '#ffff99';
          setTimeout(() => {
            el.style.backgroundColor = originalBg;
            el.classList.remove('highlight');
          }, 1500);
        }
      };
      widgetNav.appendChild(btn);
    });
  }
  
  listDiv.appendChild(widgetNav);
}

// =============================================================================
// SIDEBAR RENDERING
// =============================================================================

/**
 * Renders the complete sidebar including type selector, filters, and content list
 * Determines which components to render based on current content type
 */
function renderSidebar() {
  const sb = state.dom.sidebar;
  
  // Only rebuild basic structure if needed
  if (!document.getElementById('section-slideout')) {
    sb.innerHTML = `
      <h1>AwkwardDM Resources</h1>
      <div class="section-slideout" id="section-slideout"></div>
      <div class="cat-search-wrapper" id="cat-search-wrapper"></div>
      <div id="sidebar-list"></div>
    `;
  }
  
  renderSectionSlideout();
  renderCategoryAndSearch();
  
  // Render appropriate sidebar list based on content type
  if (state.currentType === 'Home' || state.currentType === 'All') {
    renderWidgetsSidebar();
  } else {
    renderSidebarList();
  }
}

/**
 * Renders the content type selector dropdown in the sidebar
 * Allows switching between different content types
 */
function renderSectionSlideout() {
  const slideout = document.getElementById('section-slideout');
  slideout.innerHTML = `
    <button class="section-slideout-base" tabindex="0">${capitalize(state.currentType)}</button>
    <div class="section-slideout-options" style="display:none;"></div>
  `;
  const optionsDiv = slideout.querySelector('.section-slideout-options');
  
  // Add buttons for each content type
  for (const type of state.types) {
    if (type === state.currentType) continue;
    const btn = document.createElement('button');
    btn.textContent = capitalize(type);
    btn.onclick = () => {
      state.selected = null;
      state.currentType = type;
      if (!state.categories.includes(state.currentCategory)) {
        state.currentCategory = 'All';
      }
      state.search = '';
      renderSidebar();
      renderContent();
    };
    optionsDiv.appendChild(btn);
  }
  
  // Toggle slideout display
  slideout.querySelector('.section-slideout-base').onclick = e => {
    e.stopPropagation();
    optionsDiv.style.display = optionsDiv.style.display === 'block' ? 'none' : 'block';
  };
  document.addEventListener('click', () => { optionsDiv.style.display = 'none'; }, { once: true });
}

/**
 * Renders the search input and category selector in the sidebar
 * Handles different category options based on content type
 */
function renderCategoryAndSearch() {
  const wrapper = document.getElementById('cat-search-wrapper');
  wrapper.innerHTML = '';
  
  // Create search input
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'search';
  searchInput.placeholder = 'Search...';
  searchInput.value = state.search;
  
  searchInput.oninput = e => {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      state.search = e.target.value.trim().toLowerCase();
      
      if (state.currentType === 'Home' || state.currentType === 'All') {
        applyWidgetFilters();
      } else {
        // Update the sidebar list for all content types
        renderSidebarList();
        
        // For images and websites, also update the content area without requiring a selection
        if (state.currentType === 'image' || state.currentType === 'website' || !state.selected) {
          renderContent();
        }
      }
    }, 180);
  };
  
  wrapper.appendChild(searchInput);
  
  // Add category selector for content types that support it
  if (['pdf', 'video', 'image', 'website'].includes(state.currentType) || (state.currentType !== 'Home' && state.currentType !== 'All')) {
    // Build category list for current content type
    state.categories = ['All'];
    for (const item of state.items) {
      if (item.type === state.currentType && item.category && !state.categories.includes(item.category)) {
        state.categories.push(item.category);
      }
    }
    
    const categoryLabel = document.createElement('h3');
    categoryLabel.textContent = 'Categories';
    categoryLabel.className = 'category-label';
    wrapper.appendChild(categoryLabel);
    
    const catSelect = document.createElement('select');
    catSelect.className = 'cat-dropdown';
    
    // Add options for each category
    for (const cat of state.categories) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === state.currentCategory) opt.selected = true;
      catSelect.appendChild(opt);
    }
    
    catSelect.onchange = e => {
      state.currentCategory = e.target.value;
      
      // Preserve selection for gallery views
      if (state.currentType !== 'image' && state.currentType !== 'website') {
        state.selected = null;
      }
      
      renderSidebarList();
      renderContent();
    };
    
    wrapper.appendChild(catSelect);
  }
}

/**
 * Renders the list of content items in the sidebar for non-homepage views
 * Filters items based on current type, category, and search
 */
function renderSidebarList() {
  const listDiv = document.getElementById('sidebar-list');
  listDiv.innerHTML = '';
  
  // Handle PDF, Video, Image, and Website types
  if (['pdf', 'video', 'image', 'website'].includes(state.currentType)) {
    // Filter items by current type, category, and search term
    let items = state.items.filter(i => i.type === state.currentType);
    if (state.currentCategory !== 'All') items = items.filter(i => i.category === state.currentCategory);
    if (state.search) {
      const term = state.search;
      items = items.filter(i =>
        (i.title && i.title.toLowerCase().includes(term)) ||
        (i.description && i.description.toLowerCase().includes(term))
      );
    }
    
    // Show message if no items match filters
    if (items.length === 0) {
      const noItems = document.createElement('p');
      noItems.textContent = `No ${state.currentType}s found.`;
      noItems.className = 'no-results';
      listDiv.appendChild(noItems);
      return;
    }
    
    // Create content navigation list
    const contentNav = document.createElement('div');
    contentNav.className = 'widget-sidebar-list';
    
    // Create list items for each content item
    for (const item of items) {
      const btn = document.createElement('button');
      
      // Create a container for title and close button
      const titleContainer = document.createElement('div');
      titleContainer.className = 'title-container';
      
      // Add icon based on content type (for websites)
      if (state.currentType === 'website') {
        const icon = document.createElement('span');
        icon.className = 'sidebar-item-icon';
        icon.innerHTML = '🌐';
        titleContainer.appendChild(icon);
      }
      
      // Title text
      const titleText = document.createElement('span');
      titleText.textContent = item.title || 'Untitled';
      titleContainer.appendChild(titleText);
      
      // Add close button for selected items
      if (state.selected && state.selected.item && state.selected.item.path === item.path) {
        const closeBtn = document.createElement('span');
        closeBtn.textContent = '❌';
        closeBtn.className = 'close-btn';
        closeBtn.title = `Close ${state.currentType.toUpperCase()}`;
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          state.selected = null;
          renderContent();
          renderSidebarList();
        };
        titleContainer.appendChild(closeBtn);
      }
      
      btn.appendChild(titleContainer);
      btn.title = item.description || '';
      btn.className = state.selected && state.selected.item && state.selected.item.path === item.path ? 'active' : '';
      
      // Add category and description info
      let infoText = '';
      if (item.category) {
        infoText = item.category;
      }
      
      if (item.description) {
        if (infoText) infoText += ': ';
        infoText += truncateText(item.description, 25);
      }
      
      if (infoText) {
        const infoLine = document.createElement('div');
        infoLine.className = 'sidebar-item-info';
        infoLine.textContent = infoText;
        btn.appendChild(infoLine);
      }
      
      // Add hover and click event handlers
      btn.onmouseover = () => {};
      btn.onmouseout = () => {};
      
      btn.onclick = () => {
        if (state.currentType === 'image') {
          // For images, show full-size view
          createFullSizeImageView(item);
        } else if (state.currentType === 'website') {
          // For websites, scroll to and highlight the card
          state.selected = { type: state.currentType, item };
          const websiteCards = document.querySelectorAll('.website-card');
          for (let i = 0; i < websiteCards.length; i++) {
            if (websiteCards[i].dataset.path === item.path) {
              websiteCards[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
              websiteCards[i].classList.add('highlight');
              setTimeout(() => websiteCards[i].classList.remove('highlight'), 1500);
              break;
            }
          }
        } else {
          // For other content types, update selection and render content
          state.selected = { type: state.currentType, item };
          renderContent();
        }
        renderSidebarList(); // Update selection highlighting
      };
      
      contentNav.appendChild(btn);
    }
    
    listDiv.appendChild(contentNav);
  }
}

// =============================================================================
// CONTENT RENDERING
// =============================================================================

/**
 * Renders the main content area based on current selection and content type
 * Handles different content types: PDF, video, image gallery, website gallery, and homepage
 */
async function renderContent() {
  const c = state.dom.content;
  
  // PDF Viewer
  if (state.selected && state.selected.type === 'pdf') {
    c.innerHTML = `
      <div class="pdf-viewer-container">
        <embed src="${escapeHtml(state.selected.item.path)}" type="application/pdf" class="pdf-embed">
      </div>
    `;
    return;
  }
  
  // Video Viewer
  if (state.selected && state.selected.type === 'video') {
    let videoEmbed = '';
    const path = state.selected.item.path;
    if (/youtube\.com|youtu\.be/.test(path)) {
      videoEmbed = `<iframe src="${escapeHtml(path)}" frameborder="0" allowfullscreen class="video-embed"></iframe>`;
    } else {
      videoEmbed = `<video controls src="${escapeHtml(path)}" class="video-embed"></video>`;
    }
    c.innerHTML = `
      <div class="video-viewer-container">
        <div class="video-content">
          ${videoEmbed}
        </div>
      </div>
    `;
    return;
  }
  
  // Home Page with widgets
  if (state.currentType === 'Home' || state.currentType === 'All') {
    c.innerHTML = `
      <div class="home-page">
        <h2>Welcome to AwkwardDM Resources</h2>
        <p>This is my hub for all the resources you should need to play in my DnD games!<br>Use the sidebar for navigation, there you'll find video tutorials, PDFs (that include my patreon content) and 3rd  party sites that can be helpful for DMs and players alike!</p>
        <div>
          <h3>THE HOMEPAGE</h3>
          <p>The homepage is a reference for all my homebrew rules for my players, and anyone who might want to use my homebrew. Below you will find a set of home rules, and a list of homebrew I like and allow my players to use at the table.<br><b>Additionally!</b> Each of the rules below include a small tag next to them that represent their impact on the game. Some of the changes I like at my table are very high impact, and as such I suggest reading over them carefully before dropping them into your game. You can filter by this impact in the side bar, as well as search for a particular rule you might be looking for!</p>
        </div>
        <div id="homepage-js-widgets"></div>
      </div>
    `;
    const widgetsDiv = document.getElementById('homepage-js-widgets');

    // Load and render all widgets sequentially
    for (let idx = 0; idx < state.widgets.length; idx++) {
      const widget = state.widgets[idx];
      const div = document.createElement('div');
      div.id = `homepage-widget-${idx}`;
      div.className = 'home-page-widget';
      
      // Create title container with heading and category
      const titleContainer = document.createElement('div');
      titleContainer.className = 'widget-title-container';
      
      // Add name heading
      const nameHeading = document.createElement('h4');
      nameHeading.textContent = widget.name;
      nameHeading.className = 'widget-name';
      titleContainer.appendChild(nameHeading);
      
      // Add category label
      if (widget.category) {
        const categoryLabel = document.createElement('span');
        categoryLabel.className = 'widget-category-label';
        categoryLabel.textContent = widget.category;
        titleContainer.appendChild(categoryLabel);
      }
      
      div.appendChild(titleContainer);
      
      // Container for widget content
      const widgetContent = document.createElement('div');
      widgetContent.className = 'widget-content-container';
      div.appendChild(widgetContent);
      
      widgetsDiv.appendChild(div);
      
      // Store reference to widget container
      const widgetId = widget.src.replace(/[^a-z0-9]/gi, '_');
      state.widgetContainers[widgetId] = widgetContent;

      // Check for cached widget instance
      if (state.cachedWidgetInstances[widgetId]) {
        console.log(`Restoring cached widget: ${widget.name}`);
        
        // If widget is already loaded, reuse it
        if (state.cachedWidgetInstances[widgetId].container && 
            state.cachedWidgetInstances[widgetId].container.children.length > 0) {
          
          // Move children from cached container to new container
          while (state.cachedWidgetInstances[widgetId].container.firstChild) {
            widgetContent.appendChild(state.cachedWidgetInstances[widgetId].container.firstChild);
          }
          
          // Update cached container reference
          state.cachedWidgetInstances[widgetId].container = widgetContent;
          
          // Reset special widgets if needed
          if (widget.src.includes('flanking.js') && window.resetFlankingWidget) {
            setTimeout(() => {
              try {
                window.resetFlankingWidget();
              } catch (e) {
                console.error("Error resetting flanking widget:", e);
              }
            }, 100);
          }
          
          continue; // Skip loading script again
        }
      }

      // Dynamically load widget script
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = widget.src;
        script.onload = () => {
          if (typeof window.renderWidget === 'function') {
            try {
              // Create and cache widget instance
              const widgetInstance = window.renderWidget(widgetContent);
              
              // Store in cache
              const widgetId = widget.src.replace(/[^a-z0-9]/gi, '_');
              state.cachedWidgetInstances[widgetId] = {
                instance: widgetInstance,
                container: widgetContent
              };
              
            } catch (e) {
              widgetContent.innerHTML = `<div class="widget-error">Widget error: ${escapeHtml(e.message)}</div>`;
            }
            delete window.renderWidget;
          }
          resolve();
        };
        script.onerror = () => {
          widgetContent.innerHTML = `<div class="widget-error">Failed to load widget: ${widget.src}</div>`;
          resolve();
        };
        document.body.appendChild(script);
      });
    }
    return;
  }
  
  // Image Gallery
  if (state.currentType === 'image') {
    // Filter images
    let images = state.items.filter(i => i.type === 'image');
    if (state.currentCategory !== 'All') {
      images = images.filter(i => i.category === state.currentCategory);
    }
    if (state.search) {
      const term = state.search;
      images = images.filter(i =>
        (i.title && i.title.toLowerCase().includes(term)) ||
        (i.description && i.description.toLowerCase().includes(term))
      );
    }
    
    if (!images.length) {
      c.innerHTML = '<p class="no-results-message">No images found.</p>';
      return;
    }
    
    // Create masonry container
    c.innerHTML = '<div class="masonry-container"></div>';
    const masonryContainer = document.querySelector('.masonry-container');
    
    // Add images to masonry layout
    for (const image of images) {
      const imageItem = document.createElement('div');
      imageItem.className = 'masonry-item';
      
      // Image wrapper with overlay
      const imageWrapper = document.createElement('div');
      imageWrapper.className = 'image-wrapper';
      
      // Create image element
      const img = document.createElement('img');
      img.src = image.path;
      img.alt = image.title || 'Image';
      img.loading = 'lazy';
      
      // Create overlay with title and description
      const overlay = document.createElement('div');
      overlay.className = 'image-overlay';
      
      const title = document.createElement('h3');
      title.className = 'image-title';
      title.textContent = image.title || 'Untitled';
      
      const description = document.createElement('p');
      description.className = 'image-description';
      description.textContent = image.description || '';
      
      // Assemble components
      overlay.appendChild(title);
      overlay.appendChild(description);
      imageWrapper.appendChild(img);
      imageWrapper.appendChild(overlay);
      imageItem.appendChild(imageWrapper);
      
      // Add click handler for full-size view
      imageWrapper.addEventListener('click', () => {
        createFullSizeImageView(image);
      });
      
      masonryContainer.appendChild(imageItem);
    }
    
    // Initialize masonry layout after loading
    let loadedImages = 0;
    const totalImages = images.length;
    
    masonryContainer.querySelectorAll('img').forEach(img => {
      // For completed images, update layout immediately
      if (img.complete) {
        loadedImages++;
        if (loadedImages === totalImages) {
          setTimeout(adjustMasonryLayout, 50);
        }
      } else {
        // For images still loading, add event handlers
        img.addEventListener('load', () => {
          loadedImages++;
          if (loadedImages === totalImages) {
            setTimeout(() => {
              // Final adjustments after all images load
            }, 50);
          }
        });
        
        img.addEventListener('error', () => {
          loadedImages++;
          if (loadedImages === totalImages) {
            setTimeout(adjustMasonryLayout, 50);
          }
        });
      }
    });
    
    // Handle window resize for responsive layout
    window.addEventListener('resize', debounce(adjustMasonryLayout, 250));
    
    return;
  }
  
  // Website Gallery
  if (state.currentType === 'website') {
    // Filter websites
    let websites = state.items.filter(i => i.type === 'website');
    if (state.currentCategory !== 'All') {
      websites = websites.filter(i => i.category === state.currentCategory);
    }
    if (state.search) {
      const term = state.search;
      websites = websites.filter(i =>
        (i.title && i.title.toLowerCase().includes(term)) ||
        (i.description && i.description.toLowerCase().includes(term))
      );
    }
    
    if (!websites.length) {
      c.innerHTML = '<p class="no-results-message">No websites found.</p>';
      return;
    }
    
    // Create website gallery container
    c.innerHTML = '<div class="website-gallery"></div>';
    const galleryContainer = document.querySelector('.website-gallery');
    
    // Create website cards
    for (const website of websites) {
      const websiteCard = document.createElement('div');
      websiteCard.className = 'website-card';
      websiteCard.dataset.path = website.path;
      
      // Create website preview section
      const previewSection = document.createElement('div');
      previewSection.className = 'website-preview';
      
      // Try to get website thumbnail
      if (website.path) {
        const thumbnailUrl = getWebsiteThumbnailUrl(website.path);
        if (thumbnailUrl) {
          const thumbnail = document.createElement('img');
          thumbnail.className = 'website-thumbnail';
          thumbnail.src = thumbnailUrl;
          thumbnail.alt = website.title || 'Website preview';
          thumbnail.loading = 'lazy';
          previewSection.appendChild(thumbnail);
        } else {
          // Default icon fallback
          previewSection.innerHTML = '<span class="default-website-icon">🌐</span>';
        }
      } else {
        // Default icon for websites with no path
        previewSection.innerHTML = '<span class="default-website-icon">🌐</span>';
      }
      
      websiteCard.appendChild(previewSection);
      
      // Website information section
      const infoSection = document.createElement('div');
      infoSection.className = 'website-info';
      
      // Title container with favicon
      const titleContainer = document.createElement('div');
      titleContainer.className = 'website-title-container';
      
      // Try to get website favicon
      if (website.path) {
        const faviconUrl = getFaviconUrl(website.path);
        if (faviconUrl) {
          const favicon = document.createElement('img');
          favicon.className = 'website-favicon';
          favicon.src = faviconUrl;
          favicon.alt = '';
          favicon.width = 16;
          favicon.height = 16;
          favicon.onerror = function() {
            // Fallback to Google's favicon service
            this.onerror = null;
            try {
              const url = new URL(website.path);
              this.src = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`;
            } catch (e) {
              // Hide favicon if all fallbacks fail
              this.style.display = 'none';
            }
          };
          titleContainer.appendChild(favicon);
        }
      }
      
      // Website title
      const title = document.createElement('h3');
      title.className = 'website-title';
      title.textContent = website.title || 'Untitled';
      
      // Add category tag
      if (website.category) {
        const categoryTag = document.createElement('span');
        categoryTag.className = 'website-category-tag';
        categoryTag.textContent = website.category;
        title.appendChild(document.createTextNode(' '));
        title.appendChild(categoryTag);
      }
      
      titleContainer.appendChild(title);
      infoSection.appendChild(titleContainer);
      
      // Add description
      if (website.description) {
        const description = document.createElement('p');
        description.className = 'website-description';
        description.textContent = website.description;
        infoSection.appendChild(description);
      }
      
      // Add visit button
      const visitButton = document.createElement('a');
      visitButton.className = 'visit-website-button';
      visitButton.href = website.path;
      visitButton.target = '_blank';
      visitButton.rel = 'noopener noreferrer';
      visitButton.textContent = 'Visit Website';
      
      infoSection.appendChild(visitButton);
      websiteCard.appendChild(infoSection);
      
      // Add click handler for card
      websiteCard.addEventListener('click', (e) => {
        // Don't override button click
        if (e.target !== visitButton && !visitButton.contains(e.target)) {
          window.open(website.path, '_blank', 'noopener,noreferrer');
        }
      });
      
      galleryContainer.appendChild(websiteCard);
    }
    
    return;
  }
  
  // Empty content for PDF/Video with no selection
  if (['pdf', 'video'].includes(state.currentType)) {
    c.innerHTML = '';
    return;
  }
  
  // Card List for other content types
  let items = state.items;
  if (state.currentType !== 'Home') {
    items = items.filter(i => i.type === state.currentType);
    if (state.currentType !== 'pdf' && state.currentCategory !== 'All') {
      items = items.filter(i => i.category === state.currentCategory);
    }
  }
  if (state.currentType !== 'pdf' && state.search) {
    const term = state.search;
    items = items.filter(i =>
      (i.title && i.title.toLowerCase().includes(term)) ||
      (i.description && i.description.toLowerCase().includes(term))
    );
  }
  if (!items.length) {
    c.innerHTML = '<p>No content found.</p>';
    return;
  }
  
  // Render list of cards
  c.innerHTML = '';
  for (const item of items) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.description || '')}</p>
      ${renderMedia(item)}
    `;
    c.appendChild(card);
  }
}

/**
 * Renders media content for different item types
 * @param {Object} item - The content item to render
 * @return {string} HTML for the media element
 */
function renderMedia(item) {
  if (item.type === 'video') return '';
  if (item.type === 'pdf' || item.type === 'rule') {
    return `<embed src="${escapeHtml(item.path)}" type="application/pdf" height="220px">`;
  }
  if (item.type === 'website') {
    return `
      <div class="website-link-container">
        <span class="website-icon">🌐</span>
        <a class="button website-button" href="${escapeHtml(item.path)}" target="_blank">Visit Website</a>
      </div>
    `;
  }
  return '';
}

/**
 * Creates a full-screen lightbox view for an image
 * @param {Object} image - The image object to display
 */
function createFullSizeImageView(image) {
  // Remove any existing lightbox
  const existingLightbox = document.getElementById('image-lightbox');
  if (existingLightbox) {
    existingLightbox.remove();
  }
  
  // Create lightbox container
  const lightbox = document.createElement('div');
  lightbox.id = 'image-lightbox';
  lightbox.className = 'image-lightbox';
  
  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'lightbox-close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => lightbox.remove();
  
  // Create image container
  const imgContainer = document.createElement('div');
  imgContainer.className = 'lightbox-image-container';
  
  // Create the image
  const img = document.createElement('img');
  img.src = image.path;
  img.alt = image.title || 'Image';
  
  // Create the caption
  const caption = document.createElement('div');
  caption.className = 'lightbox-caption';
  
  const title = document.createElement('h3');
  title.textContent = image.title || 'Untitled';
  
  const description = document.createElement('p');
  description.textContent = image.description || '';
  
  // Assemble the lightbox
  caption.appendChild(title);
  caption.appendChild(description);
  imgContainer.appendChild(img);
  lightbox.appendChild(closeBtn);
  lightbox.appendChild(imgContainer);
  lightbox.appendChild(caption);
  
  // Add the lightbox to the document
  document.body.appendChild(lightbox);
  
  // Close on click outside the image
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      lightbox.remove();
    }
  });
  
  // Close on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('image-lightbox')) {
      lightbox.remove();
    }
  }, { once: true });
}

/**
 * Adjusts the masonry layout for responsive design
 * Currently handled by CSS grid
 */
function adjustMasonryLayout() {
  // CSS Grid handles the layout automatically
}

// =============================================================================
// APPLICATION INITIALIZATION
// =============================================================================

/**
 * Initializes the application on DOM content loaded
 * Loads data, restores state, and renders UI
 */
document.addEventListener('DOMContentLoaded', async () => {
  cacheDom();
  await loadItems();
  
  // Restore saved state if available
  if (window.loadStateFromStorage) {
    window.loadStateFromStorage();
    console.log("State loaded from storage");
    
    // Attach state change listeners
    if (window.attachStateChangeListeners) {
      window.attachStateChangeListeners();
      console.log("State change listeners attached");
    }
    
    // Apply UI state after DOM is ready
    setTimeout(() => {
      if (window.applyStateToUI) {
        window.applyStateToUI();
        console.log("UI state applied");
      }
    }, 100);
  }
  
  renderSidebar();
  renderContent();
  
  // Save initial state if none exists
  if (window.saveStateToStorage && !localStorage.getItem('ADMResourcesState')) {
    window.saveStateToStorage();
    console.log("Initial state saved");
  }
});

/**
 * Helper function for state persistence module
 * Provides public API to reinitialize the app
 */
window.initializeApp = function() {
  renderSidebar();
  renderContent();
};

/**
 * Override original render functions to hook state change handlers
 * Enables integration with state persistence
 */
const originalRenderSidebar = renderSidebar;
renderSidebar = function() {
  originalRenderSidebar();
  if (window.handleStateChange) {
    window.handleStateChange();
  }
};

const originalRenderContent = renderContent;
renderContent = function() {
  originalRenderContent();
  if (window.handleStateChange) {
    window.handleStateChange();
  }
};

// Example of widget rendering
// const container = document.getElementById('your-flanking-widget-container');
// window.renderWidget(container);
