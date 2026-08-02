/**
 * Render Manager Module
 * Handles all rendering logic for sidebar and content areas
 */

import { state, updateState, getState, subscribeToState } from './state.js';
import { showToast } from './errorHandling.js';
import { loadWidgetWithErrorBoundary, loadWidgetScript } from './widgetManager.js';
import { LoadingManager } from './performance.js';
import { capitalize, debounce, escapeHtml } from './utils.js';
import { initThemeToggle } from './theme.js';

// Cache DOM elements for performance
let domCache = {};

/**
 * Initialize DOM cache
 */
export function initializeRenderCache() {
  domCache = {
    sidebar: document.getElementById('sidebar'),
    content: document.getElementById('content')
  };
}

/**
 * Renders the sidebar navigation structure
 * Includes type selector, search, categories, and content list
 */
export function renderSidebar() {
  const sb = domCache.sidebar || document.getElementById('sidebar');
  
  if (!sb) {
    console.error('Sidebar element not found');
    return;
  }
  
  // Only rebuild basic structure if needed
  if (!document.getElementById('section-slideout')) {
    sb.innerHTML = `
      <div class="sidebar-header">
        <h1>AwkwardDM Resources</h1>
        <button type="button" id="theme-toggle" class="theme-toggle-btn"></button>
      </div>
      <div class="cat-search-wrapper" id="cat-search-wrapper"></div>
      <div class="section-slideout" id="section-slideout"></div>
    `;
    initThemeToggle(document.getElementById('theme-toggle'));
  }

  renderSectionSlideout();
  renderCategoryAndSearch();
}

/**
 * One-line descriptor shown under each nav entry
 */
const SECTION_DESCRIPTORS = {
  Home: 'House rules',
  homebrew: 'Approved catalogue by type',
  flanking: 'Interactive positioning simulator',
  constellation: 'The night sky and its constellations',
  video: 'Tutorials & clips',
  pdf: 'Classes, compendia, Patreon drops',
  website: '3rd-party tools & references',
  image: 'Cheatsheets & maps'
};

/**
 * Renders the flat content-type nav list in the sidebar
 * Allows switching between different content types
 */
function renderSectionSlideout() {
  const slideout = document.getElementById('section-slideout');

  if (!slideout) return;

  slideout.innerHTML = state.types.map(type => `
    <button class="nav-item${type === state.currentType ? ' active' : ''}" data-type="${escapeHtml(type)}">
      <span class="n-title"><span class="n-car">&gt;</span>${capitalize(type)}</span>
      <span class="n-desc">${SECTION_DESCRIPTORS[type] || ''}</span>
    </button>
  `).join('');

  slideout.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => {
      const type = btn.dataset.type;
      if (type === state.currentType) return;

      // Mutate these directly (skipping updateState's notifications) so
      // switching sections triggers exactly one re-render, from the
      // currentType change below. Triggering renderContent() more than
      // once per click let an earlier, still-loading widget script finish
      // against a container that had already been replaced by the second
      // render, throwing on a null lookup (e.g. the Homebrew widget).
      state.selected = null;
      state.search = '';

      updateState('currentType', type);
    };
  });
}

/**
 * Renders the search input in the sidebar
 */
function renderCategoryAndSearch() {
  const wrapper = document.getElementById('cat-search-wrapper');
  
  if (!wrapper) return;
  
  wrapper.innerHTML = `
    <svg class="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.3"/>
      <line x1="9.6" y1="9.6" x2="13" y2="13" stroke="currentColor" stroke-width="1.3"/>
    </svg>
  `;

  // Create search input
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'search';
  searchInput.placeholder = 'Search...';
  searchInput.value = state.search || '';
  
  let debounceTimer = null;
  searchInput.oninput = e => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.search = e.target.value.trim().toLowerCase();
      renderContent();
    }, 180);
  };
  
  wrapper.appendChild(searchInput);
}

/**
 * Loads a widget script into a container, restoring a cached instance
 * (moving its already-rendered DOM back in) instead of re-running the
 * script when one exists.
 * @param {object} widget - Widget configuration object
 * @param {HTMLElement} widgetContent - Container to mount the widget into
 */
async function mountWidget(widget, widgetContent) {
  const widgetId = widget.src.replace(/[^a-z0-9]/gi, '_');
  updateState('widgetContainers', {
    ...state.widgetContainers,
    [widgetId]: widgetContent
  });

  const cached = state.cachedWidgetInstances && state.cachedWidgetInstances[widgetId];
  if (cached && cached.container && cached.container.children.length > 0) {
    // Move children from cached container to new container
    while (cached.container.firstChild) {
      widgetContent.appendChild(cached.container.firstChild);
    }

    // Update cached container reference
    const updatedInstances = { ...state.cachedWidgetInstances };
    updatedInstances[widgetId].container = widgetContent;
    updateState('cachedWidgetInstances', updatedInstances);

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

    return;
  }

  // Load widget with error boundary
  await loadWidgetWithErrorBoundary(widgetContent, widget, async () => {
    await loadWidgetScript(widget, widgetContent);
  });
}

/**
 * Renders the main content area based on current selection and content type
 * Handles different content types: PDF, video, image gallery, website gallery, and homepage
 */
export async function renderContent() {
  const c = domCache.content || document.getElementById('content');
  
  if (!c) {
    console.error('Content element not found');
    return;
  }
  
  try {
    // Clear any global loading states first
    LoadingManager.hideAll();
    
    // PDF Viewer
    if (state.selected && state.selected.type === 'pdf') {
      c.innerHTML = `
        <div class="pdf-viewer-container">
          <button class="back-link" id="back-to-list">&lsaquo; Back to PDFs</button>
          <embed src="${escapeHtml(state.selected.item.path)}" type="application/pdf" class="pdf-embed">
        </div>
      `;
      document.getElementById('back-to-list').onclick = () => updateState('selected', null);
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
          <button class="back-link" id="back-to-list">&lsaquo; Back to Videos</button>
          <div class="video-content">
            ${videoEmbed}
          </div>
        </div>
      `;
      document.getElementById('back-to-list').onclick = () => updateState('selected', null);
      return;
    }
    
    // Home Page with widgets
    if (state.currentType === 'Home' || state.currentType === 'All') {
      c.innerHTML = `
        <div class="home-page">
          <p class="eyebrow">Field Compendium // House Rules</p>
          <h2>Welcome to AwkwardDM Resources</h2>
          <p>This is my hub for all the resources you should need to play in my DnD games!<br>Use the sidebar for navigation, there you'll find video tutorials, PDFs (that include my patreon content) and 3rd party sites that can be helpful for DMs and players alike!</p>
          <div>
            <h3>THE HOMEPAGE</h3>
            <p>The homepage is a reference for all my homebrew rules for my players, and anyone who might want to use my homebrew. Below you will find a set of home rules, and a list of homebrew I like and allow my players to use at the table.<br><b>Additionally!</b> Each of the rules below include a small tag next to them that represent their impact on the game. Some of the changes I like at my table are very high impact, and as such I suggest reading over them carefully before dropping them into your game. You can filter by this impact in the side bar, as well as search for a particular rule you might be looking for!</p>
          </div>
          <div id="homepage-js-widgets"></div>
        </div>
      `;
      
      const widgetsDiv = document.getElementById('homepage-js-widgets');
      
      if (!widgetsDiv || !state.widgets) {
        console.warn('Widgets container or widgets array not found');
        return;
      }

      // Load and render all widgets sequentially. Ordinary rules collapse
      // into an accordion row so the homepage isn't one long wall of text;
      // IMPORTANT gets its own always-visible callout instead. Homebrew, the
      // Flanking Tool, and the Constellation Map each have their own nav
      // section (see below) so they're skipped here.
      const homeWidgets = state.widgets.filter(w =>
        !w.src.includes('homebrew.js') && !w.src.includes('flanking.js') &&
        !w.src.includes('constellation.js'));
      for (const widget of homeWidgets) {
        // Use the widget's index in the full list (not the filtered one) so
        // sidebar links and cache lookups keyed by this id stay stable.
        const idx = state.widgets.indexOf(widget);
        const tag = (widget.category || '').toLowerCase();
        const isImportant = tag === 'important';

        // IMPORTANT always shows; other rows are filtered by search
        if (!isImportant && state.search) {
          const haystack = `${widget.name} ${widget.category || ''}`.toLowerCase();
          if (!haystack.includes(state.search)) continue;
        }

        const div = document.createElement(isImportant ? 'div' : 'details');
        div.id = `homepage-widget-${idx}`;
        div.className = isImportant ? 'home-page-widget callout' : 'home-page-widget';

        if (isImportant) {
          // Same title-bar layout as the collapsible rows (name + tag),
          // just not wrapped in a <summary> since this one never collapses.
          const titleContainer = document.createElement('div');
          titleContainer.className = 'widget-title-container';

          const nameHeading = document.createElement('span');
          nameHeading.textContent = `${widget.name} // READ BEFORE CHARACTER CREATION`;
          nameHeading.className = 'widget-name';
          titleContainer.appendChild(nameHeading);

          div.appendChild(titleContainer);
        } else {
          // Create summary (title bar) with heading and category
          const titleContainer = document.createElement('summary');
          titleContainer.className = 'widget-title-container';

          const car = document.createElement('span');
          car.className = 'widget-car';
          car.textContent = '›';
          titleContainer.appendChild(car);

          // Add name heading
          const nameHeading = document.createElement('span');
          nameHeading.textContent = widget.name;
          nameHeading.className = 'widget-name';
          titleContainer.appendChild(nameHeading);

          // Add category label
          if (widget.category) {
            const categoryLabel = document.createElement('span');
            categoryLabel.className = `widget-category-label tag-${escapeHtml(tag)}`;
            categoryLabel.textContent = widget.category;
            titleContainer.appendChild(categoryLabel);
          }

          div.appendChild(titleContainer);
        }

        // Container for widget content
        const widgetContent = document.createElement('div');
        widgetContent.className = 'widget-content-container';
        div.appendChild(widgetContent);

        widgetsDiv.appendChild(div);

        await mountWidget(widget, widgetContent);
      }
      return;
    }

    // Homebrew Catalogue (its own nav section, not part of the Home accordion)
    if (state.currentType === 'homebrew') {
      const homebrewWidget = (state.widgets || []).find(w => w.src.includes('homebrew.js'));

      if (!homebrewWidget) {
        c.innerHTML = '<p class="no-results-message">Homebrew catalogue not found.</p>';
        return;
      }

      c.innerHTML = '<div class="widget-content-container" id="homebrew-standalone"></div>';
      const widgetContent = document.getElementById('homebrew-standalone');

      await mountWidget(homebrewWidget, widgetContent);
      return;
    }

    // Flanking Tool (its own nav section, not part of the Home accordion)
    if (state.currentType === 'flanking') {
      const flankingWidget = (state.widgets || []).find(w => w.src.includes('flanking.js'));

      if (!flankingWidget) {
        c.innerHTML = '<p class="no-results-message">Flanking tool not found.</p>';
        return;
      }

      c.innerHTML = `
        <div class="home-page">
          <p class="eyebrow">Field Compendium // Flanking Tool</p>
          <h2>Flanking Tool</h2>
          <div class="widget-content-container" id="flanking-standalone"></div>
        </div>
      `;
      const widgetContent = document.getElementById('flanking-standalone');

      await mountWidget(flankingWidget, widgetContent);
      return;
    }

    // Constellation Map (its own nav section, not part of the Home accordion)
    if (state.currentType === 'constellation') {
      const constellationWidget = (state.widgets || []).find(w => w.src.includes('constellation.js'));

      if (!constellationWidget) {
        c.innerHTML = '<p class="no-results-message">Constellation map not found.</p>';
        return;
      }

      c.innerHTML = `
        <div class="home-page">
          <p class="eyebrow">Field Compendium // Constellation Map</p>
          <div class="widget-content-container" id="constellation-standalone"></div>
        </div>
      `;
      const widgetContent = document.getElementById('constellation-standalone');

      await mountWidget(constellationWidget, widgetContent);
      return;
    }

    // Image Gallery
    if (state.currentType === 'image') {
      await renderImageGallery();
      return;
    }
    
    // Website Gallery
    if (state.currentType === 'website') {
      await renderWebsiteGallery();
      return;
    }
    
    // PDF / Video manifest (flat list; pick one to open it)
    if (['pdf', 'video'].includes(state.currentType)) {
      renderManifestList(state.currentType);
      return;
    }
    
  } catch (error) {
    console.error('Error rendering content:', error);
    showToast('Error rendering content. Please try again.', 'error');
    c.innerHTML = '<div class="error-message">Error loading content. Please try refreshing the page.</div>';
  }
}

/**
 * Render the image gallery view
 */
async function renderImageGallery() {
  const c = domCache.content || document.getElementById('content');
  
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
}

/**
 * Render the website gallery view
 */
async function renderWebsiteGallery() {
  const c = domCache.content || document.getElementById('content');
  
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
}

const MANIFEST_GLYPHS = {
  video: '<svg viewBox="0 0 22 22" fill="none"><rect x="1.5" y="4" width="19" height="14" stroke="currentColor" stroke-width="1.2"/><path d="M9 8l5 3-5 3V8z" fill="currentColor"/></svg>',
  pdf: '<svg viewBox="0 0 22 22" fill="none"><path d="M5 1.5h8l4 4V20.5H5V1.5z" stroke="currentColor" stroke-width="1.2"/><path d="M13 1.5V5.5h4" stroke="currentColor" stroke-width="1.2"/><line x1="7.5" y1="11" x2="14.5" y2="11" stroke="currentColor" stroke-width="1"/><line x1="7.5" y1="14" x2="14.5" y2="14" stroke="currentColor" stroke-width="1"/></svg>'
};

/**
 * Render a flat manifest list (PDFs or videos) in the content area.
 * Picking a row opens it via the existing selected-item viewer.
 */
function renderManifestList(type) {
  const c = domCache.content || document.getElementById('content');
  const label = type === 'pdf' ? 'PDFs' : 'Videos';

  let items = state.items.filter(i => i.type === type);
  if (state.search) {
    const term = state.search;
    items = items.filter(i =>
      (i.title && i.title.toLowerCase().includes(term)) ||
      (i.description && i.description.toLowerCase().includes(term))
    );
  }

  c.innerHTML = `
    <div class="home-page">
      <p class="eyebrow">Field Compendium // ${escapeHtml(label)}</p>
      <h2>${escapeHtml(label)}</h2>
      <div class="manifest-list" id="manifest-list"></div>
    </div>
  `;

  const listDiv = document.getElementById('manifest-list');

  if (!items.length) {
    listDiv.innerHTML = `<p class="no-results-message">No ${escapeHtml(label.toLowerCase())} found.</p>`;
    return;
  }

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'manifest-row';
    row.innerHTML = `
      <span class="mr-glyph">${MANIFEST_GLYPHS[type]}</span>
      <div class="mr-main">
        <div class="mr-title">${escapeHtml(item.title || 'Untitled')}</div>
        <div class="mr-desc">${escapeHtml(item.description || '')}</div>
      </div>
      <div class="mr-right">
        ${item.category ? `<span class="mr-cat">${escapeHtml(item.category)}</span>` : ''}
        <span class="mr-open">Open &rarr;</span>
      </div>
    `;
    row.onclick = () => updateState('selected', { type, item });
    listDiv.appendChild(row);
  }
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
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      lightbox.remove();
      document.removeEventListener('keydown', escHandler);
    }
  });
}

/**
 * Utility functions for website thumbnails and favicons
 */
function getWebsiteThumbnailUrl(url) {
  // This would typically use a service like thum.io or similar
  // For now, return null to use fallback
  return null;
}

function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
  } catch (e) {
    return null;
  }
}

/**
 * Adjust masonry layout (placeholder for actual masonry implementation)
 */
function adjustMasonryLayout() {
  // This would implement masonry layout adjustments
  // For now, just a placeholder
}

// Subscribe to state changes to automatically re-render when needed
subscribeToState('currentType', (newValue, oldValue) => {
  if (newValue !== oldValue) {
    renderSidebar();
    renderContent();
  }
});

subscribeToState('currentCategory', (newValue, oldValue) => {
  if (newValue !== oldValue) {
    renderSidebar();
  }
});

subscribeToState('search', (newValue, oldValue) => {
  if (newValue !== oldValue) {
    renderSidebar();
  }
});

subscribeToState('items', (newValue, oldValue) => {
  if (newValue !== oldValue) {
    renderSidebar();
  }
});

subscribeToState('selected', (newValue, oldValue) => {
  if (newValue !== oldValue) {
    renderContent();
  }
});
