// --- Central State ---
const state = {
  files: [{ url: 'content/list.json' }],
  items: [],
  types: [],
  categories: [],
  currentType: 'Home',
  currentCategory: 'All',
  search: '',
  selected: null, // {type, item}
  dom: {},
  debounceTimer: null,
  widgets: [], // Store widgets for homepage
  filteredWidgets: [], // Store filtered widgets
  widgetCategories: ['All'], // Store widget categories
  currentWidgetCategory: 'All' // Current widget category filter
};

// --- Utility ---
const escapeHtml = str => String(str).replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));

// Helper function to truncate text
function truncateText(text, maxLength = 30) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// --- Data Loading ---
async function loadItems() {
  state.items = [];
  state.types = ['Home'];
  
  // Load homepage widgets
  try {
    const res = await fetch('content/homepage.json');
    if (res.ok) {
      state.widgets = await res.json();
      state.filteredWidgets = [...state.widgets]; // Initialize filtered list
      
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
  
  for (const file of state.files) {
    try {
      const res = await fetch(file.url);
      if (!res.ok) continue;
      const data = await res.json();
      
      // Handle the nested structure
      if (Array.isArray(data)) {
        // Support for legacy flat array format
        for (const item of data) {
          state.items.push(item);
          if (item.type && !state.types.includes(item.type)) state.types.push(item.type);
        }
      } else {
        // New nested format
        for (const type in data) {
          if (!state.types.includes(type)) state.types.push(type);
          
          // Add each item with its type property
          for (const item of data[type]) {
            state.items.push({
              ...item,
              type // Add the type from the parent key
            });
          }
        }
      }
    } catch (e) {
      console.error("Error loading items:", e);
    }
  }
}

// --- DOM Cache ---
function cacheDom() {
  state.dom.sidebar = document.getElementById('sidebar');
  state.dom.content = document.getElementById('content');
}

// --- Sidebar Rendering ---
function renderSidebar() {
  const sb = state.dom.sidebar;
  
  // Only rebuild the basic structure if it doesn't exist
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
  
  // Add widget list in sidebar if on homepage
  if (state.currentType === 'Home' || state.currentType === 'All') {
    renderWidgetsSidebar();
  } else {
    renderSidebarList();
  }
}

// Improved function to render widgets in sidebar
function renderWidgetsSidebar() {
  const listDiv = document.getElementById('sidebar-list');
  listDiv.innerHTML = '';
  
  // Add widget category filter
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
  
  // Create widget navigation
  const widgetNav = document.createElement('nav');
  widgetNav.id = 'homepage-widget-nav';
  widgetNav.className = 'widget-sidebar-list';
  
  // Display filtered widgets
  if (state.filteredWidgets.length === 0) {
    const noWidgets = document.createElement('p');
    noWidgets.textContent = 'No widgets match your filters';
    noWidgets.className = 'no-results';
    widgetNav.appendChild(noWidgets);
  } else {
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
      
      // Button events
      btn.onmouseover = () => {};
      btn.onmouseout = () => {};
      btn.onclick = () => {
        const el = document.getElementById(`homepage-widget-${originalIndex}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };
      widgetNav.appendChild(btn);
    });
  }
  
  listDiv.appendChild(widgetNav);
}

// New function to apply all widget filters (search and category)
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

function renderSectionSlideout() {
  const slideout = document.getElementById('section-slideout');
  slideout.innerHTML = `
    <button class="section-slideout-base" tabindex="0">${capitalize(state.currentType)}</button>
    <div class="section-slideout-options" style="display:none;"></div>
  `;
  const optionsDiv = slideout.querySelector('.section-slideout-options');
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
  // Toggle options
  slideout.querySelector('.section-slideout-base').onclick = e => {
    e.stopPropagation();
    optionsDiv.style.display = optionsDiv.style.display === 'block' ? 'none' : 'block';
  };
  document.addEventListener('click', () => { optionsDiv.style.display = 'none'; }, { once: true });
}

function renderCategoryAndSearch() {
  const wrapper = document.getElementById('cat-search-wrapper');
  wrapper.innerHTML = '';
  
  // SEARCH FIRST: Search input without label
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
        
        // For images, also update the content area without requiring a selection
        if (state.currentType === 'image' || !state.selected) {
          renderContent();
        }
      }
    }, 180);
  };
  
  wrapper.appendChild(searchInput);
  
  // CATEGORY SECOND: Category dropdown
  if (['pdf', 'video', 'image'].includes(state.currentType) || (state.currentType !== 'Home' && state.currentType !== 'All')) {
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
    
    for (const cat of state.categories) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === state.currentCategory) opt.selected = true;
      catSelect.appendChild(opt);
    }
    
    catSelect.onchange = e => {
      state.currentCategory = e.target.value;
      
      // For images, don't clear the selection as we're showing all images anyway
      if (state.currentType !== 'image') {
        state.selected = null;
      }
      
      renderSidebarList();
      renderContent();
    };
    
    wrapper.appendChild(catSelect);
  }
}

function renderSidebarList() {
  const listDiv = document.getElementById('sidebar-list');
  listDiv.innerHTML = '';
  
  // Handle PDF, Video, and now Image types
  if (['pdf', 'video', 'image'].includes(state.currentType)) {
    let items = state.items.filter(i => i.type === state.currentType);
    if (state.currentCategory !== 'All') items = items.filter(i => i.category === state.currentCategory);
    if (state.search) {
      const term = state.search;
      items = items.filter(i =>
        (i.title && i.title.toLowerCase().includes(term)) ||
        (i.description && i.description.toLowerCase().includes(term))
      );
    }
    
    if (items.length === 0) {
      const noItems = document.createElement('p');
      noItems.textContent = `No ${state.currentType}s found.`;
      noItems.className = 'no-results';
      listDiv.appendChild(noItems);
      return;
    }
    
    // Create content navigation with same style as widget navigation
    const contentNav = document.createElement('div');
    contentNav.className = 'widget-sidebar-list';
    
    for (const item of items) {
      const btn = document.createElement('button');
      
      // Create a container for title and close button
      const titleContainer = document.createElement('div');
      titleContainer.className = 'title-container';
      
      // Title text
      const titleText = document.createElement('span');
      titleText.textContent = item.title || 'Untitled';
      titleContainer.appendChild(titleText);
      
      // Add close button for selected items (PDF, Video, or selected Image)
      if (state.selected && state.selected.item && state.selected.item.path === item.path) {
        const closeBtn = document.createElement('span');
        closeBtn.textContent = '❌';
        closeBtn.className = 'close-btn';
        closeBtn.title = `Close ${state.currentType.toUpperCase()}`;
        closeBtn.onclick = (e) => {
          e.stopPropagation(); // Prevent triggering the parent button click
          state.selected = null;
          renderContent();
          renderSidebarList();
        };
        titleContainer.appendChild(closeBtn);
      }
      
      btn.appendChild(titleContainer);
      btn.title = item.description || '';
      btn.className = state.selected && state.selected.item && state.selected.item.path === item.path ? 'active' : '';
      
      // Add category and description inline
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
      
      // Add hover effects
      btn.onmouseover = () => {};
      btn.onmouseout = () => {};
      
      btn.onclick = () => {
        if (state.currentType === 'image') {
          // For images, just scroll to the image in the gallery
          // Or show the full-size view
          createFullSizeImageView(item);
        } else {
          state.selected = { type: state.currentType, item };
          renderContent();
        }
        renderSidebarList(); // Update sidebar selection highlight
      };
      
      contentNav.appendChild(btn);
    }
    
    listDiv.appendChild(contentNav);
  }
}

// --- Content Rendering ---
async function renderContent() {
  const c = state.dom.content;
  // PDF Viewer - remove close button
  if (state.selected && state.selected.type === 'pdf') {
    c.innerHTML = `
      <div class="pdf-viewer-container">
        <embed src="${escapeHtml(state.selected.item.path)}" type="application/pdf" class="pdf-embed">
      </div>
    `;
    return;
  }
  // Video Viewer - removed title and description
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
  // Home Page with widgets (improved)
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

    // --- Sequentially load and render all widgets (unfiltered) ---
    for (let idx = 0; idx < state.widgets.length; idx++) {
      const widget = state.widgets[idx];
      const div = document.createElement('div');
      div.id = `homepage-widget-${idx}`;
      div.className = 'home-page-widget';
      
      // Create title container for heading and category - now centered
      const titleContainer = document.createElement('div');
      titleContainer.className = 'widget-title-container';
      
      // Add name heading
      const nameHeading = document.createElement('h4');
      nameHeading.textContent = widget.name;
      nameHeading.className = 'widget-name';
      titleContainer.appendChild(nameHeading);
      
      // Add category label next to the title
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

      // Dynamically load the JS file and render the widget
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = widget.src;
        script.onload = () => {
          if (typeof window.renderWidget === 'function') {
            try {
              window.renderWidget(widgetContent);
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
  
  // Image Gallery - Pinterest Style
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
    
    // Add images to the masonry layout
    for (const image of images) {
      const imageItem = document.createElement('div');
      imageItem.className = 'masonry-item';
      
      // Image wrapper to contain the image and overlay
      const imageWrapper = document.createElement('div');
      imageWrapper.className = 'image-wrapper';
      
      // Create actual image element
      const img = document.createElement('img');
      img.src = image.path;
      img.alt = image.title || 'Image';
      img.loading = 'lazy'; // Lazy load images
      
      // Create overlay for title and description
      const overlay = document.createElement('div');
      overlay.className = 'image-overlay';
      
      // Add title
      const title = document.createElement('h3');
      title.className = 'image-title';
      title.textContent = image.title || 'Untitled';
      
      // Add description
      const description = document.createElement('p');
      description.className = 'image-description';
      description.textContent = image.description || '';
      
      // Assemble the components
      overlay.appendChild(title);
      overlay.appendChild(description);
      imageWrapper.appendChild(img);
      imageWrapper.appendChild(overlay);
      imageItem.appendChild(imageWrapper);
      
      // Add full-size image view when clicking
      imageWrapper.addEventListener('click', () => {
        createFullSizeImageView(image);
      });
      
      masonryContainer.appendChild(imageItem);
    }
    
    // Initialize masonry layout after images have loaded
    let loadedImages = 0;
    const totalImages = images.length;
    
    masonryContainer.querySelectorAll('img').forEach(img => {
      // For completed images, update layout immediately
      if (img.complete) {
        loadedImages++;
        if (loadedImages === totalImages) {
          setTimeout(adjustMasonryLayout, 50); // Short delay to ensure rendering
        }
      } else {
        // For images still loading, add load and error handlers
        img.addEventListener('load', () => {
          loadedImages++;
          
          // When all images are loaded, remove any placeholders if needed
          if (loadedImages === totalImages) {
            setTimeout(() => {
              // Any final adjustments can go here
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
    
    // Add window resize handler for responsive layout
    window.addEventListener('resize', debounce(adjustMasonryLayout, 250));
    
    return;
  }
  
  // Empty for PDF/Video section with no selection
  if (['pdf', 'video'].includes(state.currentType)) {
    c.innerHTML = '';
    return;
  }
  // Card List
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

// Function to create the full-size image view
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
  
  // Create the close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'lightbox-close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => lightbox.remove();
  
  // Create the image container
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

// Function to adjust masonry layout (simplified for column-based layout)
function adjustMasonryLayout() {
  // No specific adjustments needed for column-based layout
  // This is now handled primarily by CSS
}

// Debounce function to limit how often a function is called
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

function renderMedia(item) {
  if (item.type === 'video') return '';
  if (item.type === 'pdf' || item.type === 'rule') {
    return `<embed src="${escapeHtml(item.path)}" type="application/pdf" height="220px">`;
  }
  if (item.type === 'website') {
    return `<a class="button" href="${escapeHtml(item.path)}" target="_blank">Visit Website</a>`;
  }
  return '';
}

// --- Helpers ---
function capitalize(str) {
  if (!str) return '';
  
  // Handle special abbreviations that should be all uppercase
  const uppercaseTerms = ['pdf', 'dm', 'gm', 'npc', 'pc'];
  if (uppercaseTerms.includes(str.toLowerCase())) {
    return str.toUpperCase();
  }
  
  // Default behavior: capitalize first letter
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function isHomepage() {
  // Adjust this check if you use routing
  return location.pathname.endsWith('/') || location.pathname.endsWith('index.html');
}

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  cacheDom();
  await loadItems();
  
  // Load saved state if available
  if (window.loadStateFromStorage) {
    window.loadStateFromStorage();
    console.log("State loaded from storage");
    
    // Attach state change listeners if available
    if (window.attachStateChangeListeners) {
      window.attachStateChangeListeners();
      console.log("State change listeners attached");
    }
    
    // Apply UI changes after a short delay to ensure DOM is ready
    setTimeout(() => {
      if (window.applyStateToUI) {
        window.applyStateToUI();
        console.log("UI state applied");
      }
    }, 100);
  }
  
  renderSidebar();
  renderContent();
  
  // Save initial state if no prior state exists
  if (window.saveStateToStorage && !localStorage.getItem('ADMResourcesState')) {
    window.saveStateToStorage();
    console.log("Initial state saved");
  }
});

// Add this helper function for the state persistence module
window.initializeApp = function() {
  renderSidebar();
  renderContent();
};

// Add state change handlers to key functions
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

// When rendering the flanking widget, just call renderWidget as usual.
// The widget will use your CSS for layout, headings, and paragraphs.

const container = document.getElementById('your-flanking-widget-container');
window.renderWidget(container);
