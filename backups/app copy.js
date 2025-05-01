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
      for (const item of data) {
        state.items.push(item);
        if (item.type && !state.types.includes(item.type)) state.types.push(item.type);
      }
    } catch (e) {
      // Optionally log error
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
      <h1>HHG Resources</h1>
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
  
  // Set scrollable container styles
  widgetNav.style.maxHeight = '50vh'; // Limit height to 50% of viewport height
  widgetNav.style.overflowY = 'auto';
  widgetNav.style.paddingRight = '8px'; // Add some padding for the scrollbar
  
  // Remove the scrollbar style creation - now in style.css
  
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
      
      // Button styling
      btn.style.display = 'block';
      btn.style.width = '100%';
      btn.style.background = 'none';
      btn.style.border = 'none';
      btn.style.color = '#fff';
      btn.style.textAlign = 'left';
      btn.style.padding = '8px 10px'; // Updated padding for consistency
      btn.style.cursor = 'pointer';
      btn.style.borderRadius = '4px';
      
      // REMOVE the old category indicator code - we now use the infoLine above
      
      // Button events
      btn.onmouseover = () => btn.style.background = '#33415c';
      btn.onmouseout = () => btn.style.background = 'none';
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
      state.currentCategory = 'All';
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
  
  // Remove inline styles - will use CSS for consistent styling
  
  searchInput.oninput = e => {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      state.search = e.target.value.trim().toLowerCase();
      
      if (state.currentType === 'Home' || state.currentType === 'All') {
        applyWidgetFilters();
      } else {
        state.selected = null;
        renderSidebar();
        renderContent();
      }
    }, 180);
  };
  
  wrapper.appendChild(searchInput);
  
  // CATEGORY SECOND: Category dropdown
  if (['pdf', 'video'].includes(state.currentType) || (state.currentType !== 'Home' && state.currentType !== 'All')) {
    state.categories = ['All'];
    for (const item of state.items) {
      if (item.type === state.currentType && item.category && !state.categories.includes(item.category)) {
        state.categories.push(item.category);
      }
    }
    
    const categoryLabel = document.createElement('h3');
    categoryLabel.textContent = 'Categories';
    categoryLabel.style.marginTop = '16px'; // Space between search and categories
    wrapper.appendChild(categoryLabel);
    
    const catSelect = document.createElement('select');
    catSelect.className = 'cat-dropdown';
    
    // Remove inline styles - will use CSS for consistent styling
    
    for (const cat of state.categories) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === state.currentCategory) opt.selected = true;
      catSelect.appendChild(opt);
    }
    
    catSelect.onchange = e => {
      state.currentCategory = e.target.value;
      state.selected = null;
      renderSidebar();
      renderContent();
    };
    
    wrapper.appendChild(catSelect);
  }
}

function renderSidebarList() {
  const listDiv = document.getElementById('sidebar-list');
  listDiv.innerHTML = '';
  
  if (['pdf', 'video'].includes(state.currentType)) {
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
    contentNav.style.maxHeight = '50vh';
    contentNav.style.overflowY = 'auto';
    contentNav.style.paddingRight = '8px';
    
    for (const item of items) {
      const btn = document.createElement('button');
      btn.textContent = item.title;
      btn.title = item.description || '';
      
      // Add styling consistent with widget sidebar buttons
      btn.style.display = 'block';
      btn.style.width = '100%';
      btn.style.background = 'none';
      btn.style.border = 'none';
      btn.style.color = '#fff';
      btn.style.textAlign = 'left';
      btn.style.padding = '8px 10px'; // Updated padding for consistency
      btn.style.cursor = 'pointer';
      btn.style.borderRadius = '4px';
      
      // Add active class for selected item
      if (state.selected && state.selected.item && state.selected.item.path === item.path) {
        btn.className = 'active';
        btn.style.background = '#33415c';
      }
      
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
      btn.onmouseover = () => btn.style.background = '#33415c';
      btn.onmouseout = () => {
        if (!(state.selected && state.selected.item && state.selected.item.path === item.path)) {
          btn.style.background = 'none';
        }
      };
      
      btn.onclick = () => {
        state.selected = { type: state.currentType, item };
        renderContent();
        renderSidebarList(); // Update sidebar selection highlight
      };
      
      contentNav.appendChild(btn);
      
      // REMOVE the old description below button - we now use the inline infoLine above
    }
    
    listDiv.appendChild(contentNav);
  }
}

// --- Content Rendering ---
async function renderContent() {
  const c = state.dom.content;
  // PDF Viewer
  if (state.selected && state.selected.type === 'pdf') {
    c.innerHTML = `
      <div class="pdf-viewer-container">
        <button class="close-btn" id="closePdfBtn">&times; Close</button>
        <embed src="${escapeHtml(state.selected.item.path)}" type="application/pdf" class="pdf-embed">
      </div>
    `;
    document.getElementById('closePdfBtn').onclick = () => {
      state.selected = null;
      renderContent();
    };
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
        <button class="close-btn" id="closeVideoBtn">&times; Close</button>
        <div class="video-content">
          <h2>${escapeHtml(state.selected.item.title)}</h2>
          <p>${escapeHtml(state.selected.item.description || '')}</p>
          ${videoEmbed}
        </div>
      </div>
    `;
    document.getElementById('closeVideoBtn').onclick = () => {
      state.selected = null;
      renderContent();
    };
    return;
  }
  // Home Page with widgets (improved)
  if (state.currentType === 'Home' || state.currentType === 'All') {
    c.innerHTML = `
      <div class="home-page">
        <h2>Welcome to HHG Resources</h2>
        <p>This is your resource hub. Use the navigation to browse videos, PDFs, rules, and more.</p>
        <img src="images/home-banner.jpg" alt="Banner" class="home-banner">
        <div>
          <h3>About</h3>
          <p>Put your custom text here. You can add more images, links, or any HTML you want.</p>
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
      
      // Add category label to widget
      if (widget.category) {
        const categoryLabel = document.createElement('div');
        categoryLabel.className = 'widget-category-label';
        categoryLabel.textContent = widget.category;
        categoryLabel.style.marginBottom = '5px';
        categoryLabel.style.fontWeight = 'bold';
        categoryLabel.style.color = '#666';
        div.appendChild(categoryLabel);
      }
      
      // Add name heading
      const nameHeading = document.createElement('h4');
      nameHeading.textContent = widget.name;
      nameHeading.style.margin = '5px 0';
      div.appendChild(nameHeading);
      
      // Container for widget content
      const widgetContent = document.createElement('div');
      widgetContent.className = 'widget-content-container';
      div.appendChild(widgetContent);
      
      // Styling
      div.style.display = 'block';
      div.style.width = '100%';
      div.style.margin = '32px 0';
      div.style.padding = '15px';
      // Add these explicit overrides to prevent any hover effects or shadows
      div.style.boxShadow = 'none';
      div.style.transition = 'none';
      
      // Add inline styles to ensure no hover effects from CSS
      const styleTag = document.createElement('style');
      styleTag.textContent = `
        .home-page-widget:hover {
          box-shadow: none !important;
          transform: none !important;
          transition: none !important;
        }
      `;
      document.head.appendChild(styleTag);
      
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
              widgetContent.innerHTML = `<div style="color:red;">Widget error: ${e.message}</div>`;
            }
            delete window.renderWidget;
          }
          resolve();
        };
        script.onerror = () => {
          widgetContent.innerHTML = `<div style="color:red;">Failed to load widget: ${widget.src}</div>`;
          resolve();
        };
        document.body.appendChild(script);
      });
    }
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
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function isHomepage() {
  // Adjust this check if you use routing
  return location.pathname.endsWith('/') || location.pathname.endsWith('index.html');
}

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  cacheDom();
  await loadItems();
  renderSidebar();
  renderContent();
});
