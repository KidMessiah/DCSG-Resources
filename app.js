const listFiles = [
  { url: 'content/list.json' }
];
let allItems = [];
let currentType = 'All';
let currentCategory = 'All';
let searchTerm = '';
let sectionTypes = ['All'];
let categories = ['All'];
let selectedPdf = null;
let selectedVideo = null;

document.addEventListener('DOMContentLoaded', async () => {
  allItems = [];
  sectionTypes = ['All'];
  categories = ['All'];
  // Load unified list file
  for (const file of listFiles) {
    try {
      const res = await fetch(file.url);
      const data = await res.json();
      data.forEach(item => {
        allItems.push(item);
        // Collect unique types
        if (item.type && !sectionTypes.includes(item.type)) sectionTypes.push(item.type);
      });
    } catch (e) {
      // Ignore missing files
    }
  }
  renderSections();
  renderCategoriesAndSearch();
  renderContent();
});

function renderSections() {
  // Remove old slideout if present
  const sidebar = document.getElementById('sidebar');
  let oldSlideout = sidebar.querySelector('.section-slideout');
  if (oldSlideout) oldSlideout.remove();

  // Remove old wrapper if present (move from renderCategoriesAndSearch)
  let oldWrapper = sidebar.querySelector('.cat-search-wrapper');
  if (oldWrapper) oldWrapper.remove();

  // Create slideout container
  const slideout = document.createElement('div');
  slideout.className = 'section-slideout';

  // Base button (current type)
  const baseBtn = document.createElement('button');
  baseBtn.className = 'section-slideout-base';
  baseBtn.textContent = currentType.charAt(0).toUpperCase() + currentType.slice(1);
  baseBtn.tabIndex = 0;
  slideout.appendChild(baseBtn);

  // Options (all types except current)
  const options = document.createElement('div');
  options.className = 'section-slideout-options';
  sectionTypes.forEach(type => {
    if (type === currentType) return;
    const btn = document.createElement('button');
    btn.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    btn.className = (type === currentType) ? 'active' : '';
    btn.onclick = () => {
      // Close PDF viewer if leaving PDF section
      if (currentType === 'pdf' && type !== 'pdf') {
        selectedPdf = null;
      }
      currentType = type;
      currentCategory = 'All';
      searchTerm = '';
      renderSections();
      renderCategoriesAndSearch();
      renderContent();
    };
    options.appendChild(btn);
  });
  slideout.appendChild(options);

  // Insert after h1, before categories/search
  const h1 = sidebar.querySelector('h1');
  if (h1) {
    h1.after(slideout);
  } else {
    sidebar.prepend(slideout);
  }

  // --- Insert search/categories above content lists ---
  const wrapper = document.createElement('div');
  wrapper.className = 'cat-search-wrapper';

  // Only show categories dropdown if a specific section/type is selected
  if (currentType === 'pdf') {
    categories = ['All'];
    allItems.forEach(item => {
      if (item.type === 'pdf' && item.category && !categories.includes(item.category)) {
        categories.push(item.category);
      }
    });
    const catSelect = document.createElement('select');
    catSelect.className = 'cat-dropdown';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === currentCategory) opt.selected = true;
      catSelect.appendChild(opt);
    });
    catSelect.onchange = (e) => {
      currentCategory = e.target.value;
      renderSections();
    };
    wrapper.appendChild(catSelect);
  } else if (currentType === 'video') {
    categories = ['All'];
    allItems.forEach(item => {
      if (item.type === 'video' && item.category && !categories.includes(item.category)) {
        categories.push(item.category);
      }
    });
    const catSelect = document.createElement('select');
    catSelect.className = 'cat-dropdown';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === currentCategory) opt.selected = true;
      catSelect.appendChild(opt);
    });
    catSelect.onchange = (e) => {
      currentCategory = e.target.value;
      renderSections();
    };
    wrapper.appendChild(catSelect);
  } else if (currentType !== 'All' && currentType !== 'pdf') {
    categories = ['All'];
    allItems.forEach(item => {
      if (item.type === currentType && item.category && !categories.includes(item.category)) {
        categories.push(item.category);
      }
    });
    const catSelect = document.createElement('select');
    catSelect.className = 'cat-dropdown';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === currentCategory) opt.selected = true;
      catSelect.appendChild(opt);
    });
    catSelect.onchange = (e) => {
      currentCategory = e.target.value;
      searchTerm = '';
      renderSections();
      renderContent();
    };
    wrapper.appendChild(catSelect);
  }

  // Always add search input below categories (or at top if no categories)
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'search';
  searchInput.placeholder = 'Search...';
  searchInput.value = searchTerm;
  searchInput.addEventListener('input', e => {
    searchTerm = e.target.value.toLowerCase();
    if (currentType === 'pdf' || currentType === 'video') {
      renderSections();
    } else {
      renderContent();
    }
  });
  wrapper.appendChild(searchInput);

  // Insert wrapper after the section buttons (categories nav)
  slideout.after(wrapper);

  // --- PDF List Below cat-search-wrapper ---
  let oldPdfList = sidebar.querySelector('.pdf-list');
  if (oldPdfList) oldPdfList.remove();

  if (currentType === 'pdf') {
    // Filter PDFs by sidebar search/category (case-insensitive)
    let pdfs = allItems.filter(item => item.type === 'pdf');
    if (currentCategory !== 'All') {
      pdfs = pdfs.filter(pdf => pdf.category === currentCategory);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      pdfs = pdfs.filter(pdf =>
        (pdf.title && pdf.title.toLowerCase().includes(term)) ||
        (pdf.description && pdf.description.toLowerCase().includes(term))
      );
    }
    if (pdfs.length > 0) {
      const pdfList = document.createElement('div');
      pdfList.className = 'pdf-list';
      pdfList.style.margin = '0'; // Remove extra margin
      // No heading/title
      pdfs.forEach(pdf => {
        const btn = document.createElement('button');
        btn.textContent = pdf.title;
        btn.title = pdf.description;
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.background = (selectedPdf && selectedPdf.path === pdf.path) ? '#33415c' : 'none';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.textAlign = 'left';
        btn.style.padding = '8px 0 2px 0';
        btn.style.cursor = 'pointer';
        btn.style.borderRadius = '4px';
        btn.style.marginBottom = '2px';
        btn.onmouseover = () => btn.style.background = '#33415c';
        btn.onmouseout = () => btn.style.background = (selectedPdf && selectedPdf.path === pdf.path) ? '#33415c' : 'none';
        btn.onclick = () => {
          selectedPdf = pdf;
          renderContent();
        };
        // Description below title
        const desc = document.createElement('div');
        desc.textContent = pdf.description;
        desc.style.fontSize = '0.95em';
        desc.style.color = '#bbb';
        desc.style.marginLeft = '8px';
        desc.style.marginBottom = '6px';
        pdfList.appendChild(btn);
        pdfList.appendChild(desc);
      });
      // Place list directly after search input
      searchInput.after(pdfList);
    }
  }

  // --- Video List Below cat-search-wrapper ---
  let oldVideoList = sidebar.querySelector('.video-list');
  if (oldVideoList) oldVideoList.remove();

  if (currentType === 'video') {
    // Filter videos by sidebar search/category (case-insensitive)
    let videos = allItems.filter(item => item.type === 'video');
    if (currentCategory !== 'All') {
      videos = videos.filter(video => video.category === currentCategory);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      videos = videos.filter(video =>
        (video.title && video.title.toLowerCase().includes(term)) ||
        (video.description && video.description.toLowerCase().includes(term))
      );
    }
    if (videos.length > 0) {
      const videoList = document.createElement('div');
      videoList.className = 'video-list';
      videoList.style.margin = '0'; // Remove extra margin
      // No heading/title
      videos.forEach(video => {
        const btn = document.createElement('button');
        btn.textContent = video.title;
        btn.title = video.description;
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.background = (selectedVideo && selectedVideo.path === video.path) ? '#33415c' : 'none';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.textAlign = 'left';
        btn.style.padding = '8px 0 2px 0';
        btn.style.cursor = 'pointer';
        btn.style.borderRadius = '4px';
        btn.style.marginBottom = '2px';
        btn.onmouseover = () => btn.style.background = '#33415c';
        btn.onmouseout = () => btn.style.background = (selectedVideo && selectedVideo.path === video.path) ? '#33415c' : 'none';
        btn.onclick = () => {
          selectedVideo = video;
          renderContent();
        };
        // Description below title
        const desc = document.createElement('div');
        desc.textContent = video.description;
        desc.style.fontSize = '0.95em';
        desc.style.color = '#bbb';
        desc.style.marginLeft = '8px';
        desc.style.marginBottom = '6px';
        videoList.appendChild(btn);
        videoList.appendChild(desc);
      });
      // Place list directly after search input
      searchInput.after(videoList);
    }
  }
}

// Remove all category/search rendering from renderCategoriesAndSearch
function renderCategoriesAndSearch() {
  // No-op: handled in renderSections now
}

function renderContent() {
  const container = document.getElementById('content');
  // --- Show selected PDF if any ---
  if (selectedPdf) {
    // Make the content container fill its parent
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.margin = '0';
    container.style.padding = '0';
    container.innerHTML = `
      <div style="position:absolute;top:0;left:0;width:100%;height:100%;margin:0;padding:0;">
        <button style="position:absolute;top:18px;right:32px;z-index:2;padding:8px 18px;border:none;border-radius:6px;background:#222e3c;color:#fff;cursor:pointer;font-size:1.1em;" id="closePdfBtn">&times; Close</button>
        <embed src="${selectedPdf.path}" type="application/pdf" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;margin:0;padding:0;display:block;">
      </div>
    `;
    document.getElementById('closePdfBtn').onclick = () => {
      selectedPdf = null;
      // Optionally reset container style when closing PDF
      container.style = '';
      renderContent();
    };
    return;
  }
  // --- Show selected Video if any ---
  if (selectedVideo) {
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.margin = '0';
    container.style.padding = '0';
    let videoEmbed = '';
    if (selectedVideo.path.includes('youtube.com') || selectedVideo.path.includes('youtu.be')) {
      videoEmbed = `<iframe src="${selectedVideo.path}" frameborder="0" allowfullscreen style="width:100%;height:70vh;min-height:320px;border-radius:8px;background:#000;"></iframe>`;
    } else {
      videoEmbed = `<video controls src="${selectedVideo.path}" style="width:100%;height:70vh;min-height:320px;border-radius:8px;background:#000;"></video>`;
    }
    container.innerHTML = `
      <div style="position:absolute;top:0;left:0;width:100%;height:100%;margin:0;padding:0;">
        <button style="position:absolute;top:18px;right:32px;z-index:2;padding:8px 18px;border:none;border-radius:6px;background:#222e3c;color:#fff;cursor:pointer;font-size:1.1em;" id="closeVideoBtn">&times; Close</button>
        <div style="padding:48px 0 0 0;max-width:900px;margin:auto;">
          <h2 style="margin-bottom:12px;">${selectedVideo.title}</h2>
          <p style="margin-bottom:18px;color:#555;">${selectedVideo.description}</p>
          ${videoEmbed}
        </div>
      </div>
    `;
    document.getElementById('closeVideoBtn').onclick = () => {
      selectedVideo = null;
      container.style = '';
      renderContent();
    };
    return;
  } else {
    // Reset container style if not viewing PDF or video
    container.style = '';
  }
  // Show static home page if "All" is selected for type
  if (currentType === 'All') {
    container.innerHTML = `
      <div class="home-page">
        <h2>Welcome to HHG Resources</h2>
        <p>This is your resource hub. Use the navigation to browse videos, PDFs, rules, and more.</p>
        <img src="images/home-banner.jpg" alt="Banner" style="max-width:100%;border-radius:8px;margin:24px 0;">
        <div>
          <h3>About</h3>
          <p>Put your custom text here. You can add more images, links, or any HTML you want.</p>
        </div>
      </div>
    `;
    return;
  }
  // If PDF section is selected but no PDF is selected, show nothing
  if (currentType === 'pdf') {
    container.innerHTML = '';
    return;
  }
  // If video section is selected but no video is selected, show nothing
  if (currentType === 'video') {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = '';
  let items = allItems;
  // Filter by section/type
  if (currentType !== 'All') {
    items = items.filter(item => item.type === currentType);
    // Filter by category if not All (but NOT for PDF section)
    if (currentType !== 'pdf' && currentCategory !== 'All') {
      items = items.filter(item => item.category === currentCategory);
    }
  }
  // Filter by search (but NOT for PDF section)
  if (currentType !== 'pdf' && searchTerm) {
    items = items.filter(item =>
      item.title.toLowerCase().includes(searchTerm) ||
      item.description.toLowerCase().includes(searchTerm)
    );
  }
  if (items.length === 0) {
    container.innerHTML = '<p>No content found.</p>';
    return;
  }
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h2>${item.title}</h2>
      <p>${item.description}</p>
      ${renderMedia(item)}
    `;
    container.appendChild(card);
  });
}

function renderMedia(item) {
  if (item.type === 'video') {
    // Do not render video in card view anymore
    return '';
  }
  if (item.type === 'pdf' || item.type === 'rule') {
    return `<embed src="${item.path}" type="application/pdf" height="220px">`;
  }
  if (item.type === 'website') {
    return `<a class="button" href="${item.path}" target="_blank">Visit Website</a>`;
  }
  return '';
}
