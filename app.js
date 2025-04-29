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
  debounceTimer: null
};

// --- Utility ---
const escapeHtml = str => String(str).replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));

// --- Data Loading ---
async function loadItems() {
  state.items = [];
  state.types = ['Home'];
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
  sb.innerHTML = `
    <h1>HHG Resources</h1>
    <div class="section-slideout" id="section-slideout"></div>
    <div class="cat-search-wrapper" id="cat-search-wrapper"></div>
    <div id="sidebar-list"></div>
  `;
  renderSectionSlideout();
  renderCategoryAndSearch();
  renderSidebarList();
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
  // Category dropdown
  if (['pdf', 'video'].includes(state.currentType) || (state.currentType !== 'Home' && state.currentType !== 'All')) {
    state.categories = ['All'];
    for (const item of state.items) {
      if (item.type === state.currentType && item.category && !state.categories.includes(item.category)) {
        state.categories.push(item.category);
      }
    }
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
      state.selected = null;
      renderSidebar();
      renderContent();
    };
    wrapper.appendChild(catSelect);
  }
  // Search input (debounced)
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'search';
  searchInput.placeholder = 'Search...';
  searchInput.value = state.search;
  searchInput.oninput = e => {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      state.search = e.target.value.trim().toLowerCase();
      state.selected = null;
      renderSidebar();
      renderContent();
    }, 180);
  };
  wrapper.appendChild(searchInput);
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
      listDiv.innerHTML = `<div style="color:#bbb;padding:8px 0;">No ${state.currentType}s found.</div>`;
      return;
    }
    const ul = document.createElement('div');
    ul.className = `${state.currentType}-list video-list`;
    for (const item of items) {
      const btn = document.createElement('button');
      btn.textContent = item.title;
      btn.title = item.description || '';
      btn.className = (state.selected && state.selected.item && state.selected.item.path === item.path) ? 'active' : '';
      btn.onclick = () => {
        state.selected = { type: state.currentType, item };
        renderContent();
        // Keep sidebar selection highlight
        renderSidebarList();
      };
      ul.appendChild(btn);
      if (item.description) {
        const desc = document.createElement('div');
        desc.textContent = item.description;
        ul.appendChild(desc);
      }
    }
    listDiv.appendChild(ul);
  }
}

// --- Content Rendering ---
function renderContent() {
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
  // Home Page
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
        <div id="homepage-js-list"></div>
      </div>
    `;
    renderHomepageJsList();
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

// --- Homepage JS Loader ---
async function renderHomepageJsList() {
  try {
    const res = await fetch('content/homepage.json');
    if (!res.ok) return;
    const jsList = await res.json();
    if (!Array.isArray(jsList)) return;
    const container = document.getElementById('homepage-js-list');
    if (container) {
      container.innerHTML = `<div id="homepage-js-widgets"></div>`;
    }
    const widgetsDiv = document.getElementById('homepage-js-widgets');
    for (const jsFile of jsList) {
      // Create a container for each widget
      const widgetContainer = document.createElement('div');
      widgetContainer.className = 'homepage-js-widget';
      widgetsDiv && widgetsDiv.appendChild(widgetContainer);

      // Dynamically load the JS file
      await new Promise((resolve, reject) => {
        if ([...document.scripts].some(s => s.src && s.src.endsWith(jsFile))) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = jsFile;
        script.async = false;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });

      // If the JS file exposes a renderHomepageWidget function, call it
      if (typeof window.renderHomepageWidget === 'function') {
        try {
          window.renderHomepageWidget(widgetContainer);
        } catch (e) {
          widgetContainer.innerHTML = `<div style="color:red;">Error running widget: ${escapeHtml(e.message)}</div>`;
        }
        // Remove the global to avoid conflicts
        delete window.renderHomepageWidget;
      }
    }
  } catch {}
}

// --- Helpers ---
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  cacheDom();
  await loadItems();
  renderSidebar();
  renderContent();
});
