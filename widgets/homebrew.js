window.renderWidget = function(container) {
  // Homebrew data structure
  const homebrewData = {
    categories: [
      { id: "free", name: "Free", description: "Can be used without approval and are treated as core rulebooks" },
      { id: "restricted", name: "Restricted", description: "Almost the same as Free, except run it by the DM first" },
      { id: "signature", name: "Signature Only", description: "Applies specifically to spells, and refers to sources that can only be used to choose a Signature Spell from" }
    ],
    sections: [
      { 
        id: "spells", 
        name: "Spells",
        items: [
          {
            category: "free",
            name: "Evolving Cantrips",
            author: "Craios125",
            description: "These are just a straight buff to a lot of cantrips, please use this in place of your regular cantrips, or you will be missing some significant power."
          },
          {
            category: "free",
            name: "The Elements and Beyond",
            author: "Benevolent Evil",
            description: "The Elements and Beyond Revisions: Benevolent Evil has made balance revisions to some of the base DnD spells and some of the TEB spells, use the revisions for TEB but not for DnD. Whilst I agree with a lot of the changes, familiarity with spells is important to me and I'd prefer established knowledge is upheld for my players sake."
          },
          {
            category: "free",
            name: "Humblewood Campaign Setting",
            author: "Hit Point Press",
            description: ""
          },
          {
            category: "restricted",
            name: "Arcadia",
            author: "MCDM",
            description: ""
          },
          {
            category: "restricted",
            name: "Blazing Dawn PC",
            author: "Jonoman3000",
            description: ""
          },
          {
            category: "restricted",
            name: "Dark Arts PC",
            author: "Jonoman3000",
            description: ""
          },
          {
            category: "restricted",
            name: "Sprouting Chaos PC",
            author: "Jonoman3000",
            description: ""
          },
          {
            category: "restricted",
            name: "The (In)complete Tome of Spells",
            author: "u/Faolyn",
            description: ""
          },
          {
            category: "restricted",
            name: "Grimlore's Grimoire",
            author: "Trevor Armstrong",
            description: ""
          },
          {
            category: "signature",
            name: "Kibble's Casting Compendium",
            author: "Kibbles Tasty",
            description: ""
          },
          {
            category: "signature",
            name: "Book of Lost Spells",
            author: "Frog God Games",
            description: ""
          },
          {
            category: "signature",
            name: "Yorviing's Arcane Grimoire",
            author: "Yorviing",
            description: ""
          }
        ]
      },
      {
        id: "classes",
        name: "Classes",
        items: [
          {
            category: "explanation",
            name: "About Classes",
            description: "Classes are a special case as they have such long term use, the ones in the restricted category are untested in a campaign scenario and have only have read-overs so far. If in actual play they have balance issues they will be adjusted fairly regularly until we find a nice equilibrium."
          },
          {
            category: "free",
            name: "The Alpha Druid",
            author: "u/SwEcky",
            description: "I use this Druid as a replacement for the standard Druid, I have a lot of problems with the 5e Druid and this re-work seems to solve them. Namely moving Wild Shape to a subclass feature allowing each thematic for Druids to be further expanded without the power vacuum of that feature."
          },
          {
            category: "free",
            name: "The Pugilist Class",
            author: "Benjamin Huffman",
            description: "I love this class for its thematic and ability to fill a niche that monks don't always deliver on. With the Haymaker feature changed to: Starting at 5th level, before you make an attack roll with an unarmed strike or pugilist melee weapon that does not have disadvantage you can declare you are swinging a wild haymaker. The next attack on your turn critically strikes on a roll of 11-20 and your AC is reduced by 5 until the start of your next turn."
          },
          {
            category: "free",
            name: "The Beastheart",
            author: "MCDM",
            description: ""
          },
          {
            category: "free",
            name: "The Illrigger",
            author: "MCDM",
            description: ""
          },
          {
            category: "free",
            name: "Bloodhunter 2022",
            author: "Matthew Mercer",
            description: ""
          },
          {
            category: "restricted",
            name: "The Psion",
            author: "Badooga",
            description: "Classes are a special case as they have such long term use, the ones in this category are untested in a campaign scenario and have only had read-overs so far. If in actual play they have balance issues they will be adjusted fairly regularly until we find a nice equilibrium."
          },
          {
            category: "restricted",
            name: "The Witch",
            author: "Walrock Homebrew",
            description: "Classes are a special case as they have such long term use, the ones in this category are untested in a campaign scenario and have only had read-overs so far. If in actual play they have balance issues they will be adjusted fairly regularly until we find a nice equilibrium."
          },
          {
            category: "restricted",
            name: "The Inventor",
            author: "Kibbles Tasty",
            description: "Whilst I have extensively play-tested *some* of this class it is so extensive and far reaching in its mechanics, I'd like to take a glance over each player's concept with this class to ensure it fits in the setting and doesn't feel out of line with game balance."
          }
        ]
      },
      {
        id: "subclasses",
        name: "Subclasses",
        items: [
          {
            category: "free",
            name: "Arcadia",
            author: "MCDM",
            description: ""
          },
          {
            category: "free",
            name: "Arkadia",
            author: "Arcana Games",
            description: ""
          },
          {
            category: "free",
            name: "Blazing Dawn PC",
            author: "Jonoman3000",
            description: ""
          },
          {
            category: "free",
            name: "Tal'Dorei Campaign Setting Reborn",
            author: "Darrington Press",
            description: ""
          },
          {
            category: "free",
            name: "Dark Tides of Bilegewater",
            author: "MonkeyDM Version",
            description: ""
          },
          {
            category: "restricted",
            name: "Gunslinger",
            author: "Matthew Mercer",
            description: "I usually allow this without a second question, but I prefer to go over the backstory and thematic for a character of this subclass more carefully than I normally would due to guns being not so common within my setting."
          },
          {
            category: "restricted",
            name: "Yorviing's Arcane Grimoire",
            author: "Yorviing",
            description: ""
          },
          {
            category: "restricted",
            name: "Sentinels of the Multiverse",
            author: "Middle Finger of Vecna",
            description: ""
          }
        ]
      },
      {
        id: "species",
        name: "Species",
        items: [
          {
            category: "free",
            name: "Arcadia",
            author: "MCDM",
            description: ""
          },
          {
            category: "free",
            name: "Arkadia",
            author: "Arcana Games",
            description: ""
          },
          {
            category: "free",
            name: "Blazing Dawn PC",
            author: "Jonoman3000",
            description: ""
          },
          {
            category: "free",
            name: "Dark Arts PC",
            author: "Jonoman3000",
            description: ""
          },
          {
            category: "free",
            name: "Sprouting Chaos PC",
            author: "Jonoman3000",
            description: ""
          },
          {
            category: "free",
            name: "Humblewood Campaign Setting",
            author: "Hit Point Press",
            description: ""
          },
          {
            category: "free",
            name: "Strongholds and Followers",
            author: "MCDM",
            description: "This book contains Gemstone Dragonborn that are now available as a 5e species in the core rulebooks, I still prefer to use these ones and will substitute them in place of the core version."
          },
          {
            category: "free",
            name: "Tal'Dorei Campaign Setting Reborn",
            author: "Darrington Press",
            description: ""
          },
          {
            category: "free",
            name: "The Elements and Beyond",
            author: "Benevolent Evil",
            description: ""
          }
        ]
      },
      {
        id: "feats",
        name: "Feats",
        items: [
          {
            category: "explanation",
            name: "About Feats",
            description: "All feats will be under the Restricted tag, I have yet to find a source book that doesn't contain something that is incredibly strong, so for now everything is approval only."
          },
          {
            category: "restricted",
            name: "Arkadia",
            author: "Arcana Games",
            description: ""
          },
          {
            category: "restricted",
            name: "Tal'Dorei Campaign Setting",
            author: "Darrington Press",
            description: ""
          },
          {
            category: "restricted",
            name: "The Elements and Beyond",
            author: "Benevolent Evil",
            description: ""
          },
          {
            category: "restricted",
            name: "Yorviing's Arcane Grimoire",
            author: "Yorviing",
            description: ""
          }
        ]
      }
    ]
  };

  // Create the widget UI
  container.innerHTML = `
  <div id="homebrew-widget">
      <p>
        This tool displays all homebrew content approved for use in the campaign. Browse through different content types using the tabs. The color indicators show approval status: 
        <strong class="free-text">Free</strong> (no approval needed), 
        <strong class="restricted-text">Restricted</strong> (DM approval required), and 
        <strong class="signature-text">Signature Only</strong> (for signature spells only).
      </p>
    <div class="hw-header">
      <h1>Approved Homebrew Catalogue</h1>
      <div class="hw-search-container">
        <input type="text" id="hw-search" placeholder="Search homebrew...">
      </div>
    </div>
    
    <div class="hw-tabs">
      ${homebrewData.sections.map(section => `
        <button class="hw-tab-btn" data-section="${section.id}">${section.name}</button>
      `).join('')}
    </div>
    
    <div class="hw-filters">
      <span>Filter by: </span>
      <button class="hw-filter-btn active" data-filter="all">All</button>
      ${homebrewData.categories.map(category => `
        <button class="hw-filter-btn" data-filter="${category.id}">${category.name}</button>
      `).join('')}
    </div>
    
    <div class="hw-content">
      ${homebrewData.sections.map(section => `
        <div class="hw-section" id="section-${section.id}">
          <div class="hw-items">
            ${section.items.map(item => {
              // Find category description for the tooltip
              const categoryData = homebrewData.categories.find(cat => cat.id === item.category);
              const tooltipText = categoryData ? categoryData.description : '';
              
              return `
              <div class="hw-item" data-category="${item.category}">
                <div class="hw-item-header">
                  <h3>${item.name}</h3>
                  <span class="hw-category-badge ${item.category}" data-tooltip="${tooltipText}">${item.category.charAt(0).toUpperCase() + item.category.slice(1)}</span>
                </div>
                <div class="hw-item-author">By ${item.author}</div>
                ${item.description ? `<div class="hw-item-description">${item.description}</div>` : ''}
              </div>
            `}).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  
  <style>
    #homebrew-widget {
      font-family: var(--font-primary);
      margin: 0 auto;
      width: 50%;
      min-height: 75vh;
      background:rgb(255, 255, 255);
      border-radius: 8px;
      color: #333;
    }
    
    .hw-intro {
      margin-bottom: 25px;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 8px;
      border-left: 4px solid #4a2c82;
    }
    
    .hw-intro h2 {
      color: #4a2c82;
      margin-top: 0;
    }
    
    .hw-guide-section {
      margin: 15px 0;
    }
    
    .hw-guide-section h3 {
      margin-bottom: 8px;
      color: #333;
    }
    
    .hw-guide-section ul {
      padding-left: 20px;
    }
    
    .hw-guide-section li {
      margin-bottom: 5px;
    }
    
    .free-text { color: #2e7d32; }
    .restricted-text { color: #f57f17; }
    .signature-text { color: #1565c0; }
    
    .hw-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .hw-header h1 {
      margin: 0;
      color: #222e3c;
      font-size: var(--text-2xl);
      font-weight: var(--font-semibold);
    }
    
    .hw-search-container {
      width: 200px;
    }
    
    #hw-search {
      width: 85%;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: var(--text-base);
    }
    
    .hw-tabs {
      display: flex;
      overflow-x: auto;
      margin-bottom: 15px;
      border-bottom: 1px solid #ddd;
    }
    
    .hw-tab-btn {
      padding: 10px 20px;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      cursor: pointer;
      font-size: 16px;
      font-weight: 500;
      white-space: nowrap;
    }
    
    .hw-tab-btn.active {
      border-bottom-color: #4a2c82;
      color: #4a2c82;
    }
    
    .hw-filters {
      margin-bottom: 20px;
    }
    
    .hw-filter-btn {
      padding: 6px 12px;
      margin-right: 5px;
      margin-bottom: 5px;
      background: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .hw-filter-btn.active {
      background: #4a2c82;
      color: white;
      border-color: #4a2c82;
    }
    
    .hw-section {
      display: none;
    }
    
    .hw-section.active {
      display: block;
    }
    
    .hw-items {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 15px;
    }
    
    .hw-item {
      background: white;
      border-radius: 6px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      padding: 15px;
      transition: transform 0.2s;
    }
    
    .hw-item:hover {
      transform: translateY(-3px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    
    .hw-item-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    
    .hw-item-header h3 {
      margin: 0;
      font-size: 18px;
    }
    
    .hw-category-badge {
      font-size: 12px;
      padding: 3px 8px;
      border-radius: 12px;
      font-weight: bold;
      position: relative;
      cursor: help;
    }
    
    .hw-category-badge:hover::after {
      content: attr(data-tooltip);
      position: absolute;
      width: 220px;
      background-color: #333;
      color: #fff;
      text-align: center;
      border-radius: 6px;
      padding: 8px;
      z-index: 1;
      bottom: 125%;
      left: 50%;
      transform: translateX(-50%);
      font-weight: normal;
      font-size: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      pointer-events: none;
      white-space: normal;
      line-height: 1.4;
    }
    
    .hw-category-badge:hover::before {
      content: "";
      position: absolute;
      top: -8px;
      left: 50%;
      transform: translateX(-50%);
      border-width: 8px 6px 0;
      border-style: solid;
      border-color: #333 transparent transparent transparent;
      z-index: 1;
    }
    
    .hw-category-badge.free {
      background: #c8e6c9;
      color: #2e7d32;
    }
    
    .hw-category-badge.restricted {
      background: #fff9c4;
      color: #f57f17;
    }
    
    .hw-category-badge.signature {
      background: #bbdefb;
      color: #1565c0;
    }
    
    .hw-item-author {
      font-style: italic;
      color: #666;
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .hw-item-description {
      font-size: 14px;
      line-height: 1.4;
    }
    
    .hw-item.hidden {
      display: none;
    }
    
    .hw-item[data-category="explanation"] {
      background-color: #f8f9fa;
      border-left: 4px solid #4a2c82;
      grid-column: 1 / -1;
    }
    
    .hw-item[data-category="explanation"] h3 {
      color: #4a2c82;
    }
    
    .hw-item[data-category="explanation"] .hw-category-badge {
      display: none;
    }
    
    .hw-item[data-category="explanation"] .hw-item-author {
      display: none;
    }
    
    .hw-item[data-category="explanation"] .hw-item-description {
      font-size: 15px;
    }
    
    /* Ensure explanation cards are still shown when filtering */
    .hw-item[data-category="explanation"].hidden {
      display: block !important;
    }
    
    @media (max-width: 768px) {
      .hw-header {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .hw-search-container {
        width: 100%;
        margin-top: 10px;
      }
      
      .hw-items {
        grid-template-columns: 1fr;
      }
      
      #homebrew-widget {
        width: 90%;
      }
    }
  </style>
  `;

  // Initialize the widget functionality
  const widget = document.getElementById('homebrew-widget');
  const tabButtons = widget.querySelectorAll('.hw-tab-btn');
  const sections = widget.querySelectorAll('.hw-section');
  const filterButtons = widget.querySelectorAll('.hw-filter-btn');
  const searchInput = widget.querySelector('#hw-search');

  // Set the first tab as active initially
  tabButtons[0].classList.add('active');
  sections[0].classList.add('active');

  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const sectionId = button.getAttribute('data-section');
      
      // Remove active class from all tabs and sections
      tabButtons.forEach(btn => btn.classList.remove('active'));
      sections.forEach(section => section.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding section
      button.classList.add('active');
      document.getElementById(`section-${sectionId}`).classList.add('active');
    });
  });

  // Category filtering
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      const filter = button.getAttribute('data-filter');
      
      // Update active filter button
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Filter items
      const items = widget.querySelectorAll('.hw-item');
      items.forEach(item => {
        const category = item.getAttribute('data-category');
        
        if (category === 'explanation' || filter === 'all' || category === filter) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
    });
  });

  // Search functionality
  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase();
    const items = widget.querySelectorAll('.hw-item');
    
    items.forEach(item => {
      if (item.getAttribute('data-category') === 'explanation') {
        item.classList.remove('hidden');
        return;
      }
      
      const itemName = item.querySelector('h3').textContent.toLowerCase();
      const itemAuthor = item.querySelector('.hw-item-author').textContent.toLowerCase();
      const itemDescription = item.querySelector('.hw-item-description')?.textContent.toLowerCase() || '';
      
      if (itemName.includes(searchTerm) || 
          itemAuthor.includes(searchTerm) || 
          itemDescription.includes(searchTerm)) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });
  });
};
