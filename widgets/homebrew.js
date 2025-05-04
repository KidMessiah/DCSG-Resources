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
            category: "explanation",
            name: "About Spells",
            description: "This section contains approved homebrew spell sources. These can be used to select spells for your character based on the category restrictions."
          },
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
          // More spell items...
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
            name: "Humblewood Campaign Setting",
            author: "Hit Point Press",
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
            description: "This section contains approved homebrew classes. Note that choosing a class has a significant impact on your character, so read the descriptions carefully."
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
            category: "explanation",
            name: "About Subclasses",
            description: "This section contains approved homebrew subclasses that can be used with official classes. Make sure the subclass is compatible with your chosen class."
          },
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
            category: "explanation",
            name: "About Species",
            description: "This section contains approved homebrew species (races) that you can choose for your character."
          },
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
            description: "This section contains approved homebrew feats. Note that all feat sources are restricted and require DM approval before use."
          },
          {
            category: "restricted",
            name: "Arkadia",
            author: "Arcana Games",
            description: "All feats will be under the Restricted tag, I have yet to find a source book that doesn't contain something that is incredibly strong, so for now everything is approval only."
          },
          {
            category: "restricted",
            name: "Tal'Dorei Campaign Setting",
            author: "Darrington Press",
            description: "All feats will be under the Restricted tag, I have yet to find a source book that doesn't contain something that is incredibly strong, so for now everything is approval only."
          },
          {
            category: "restricted",
            name: "The Elements and Beyond",
            author: "Benevolent Evil",
            description: "All feats will be under the Restricted tag, I have yet to find a source book that doesn't contain something that is incredibly strong, so for now everything is approval only."
          },
          {
            category: "restricted",
            name: "Yorviing's Arcane Grimoire",
            author: "Yorviing",
            description: "All feats will be under the Restricted tag, I have yet to find a source book that doesn't contain something that is incredibly strong, so for now everything is approval only."
          }
        ]
      }
    ]
  };

  // Create the widget UI
  container.innerHTML = `
    <div id="homebrew-widget">
      <div class="hw-header">
        <h1>Approved Homebrew Catalogue</h1>
        <div class="hw-search-container">
          <input type="text" id="hw-search" placeholder="Search homebrew...">
        </div>
      </div>
      
      <div class="hw-category-info">
        <div class="hw-info-toggle">About Categories <span>▼</span></div>
        <div class="hw-info-content">
          <div class="hw-category-description" data-category="free">
            <h3>Free</h3>
            <p>Can be used without approval and are treated as core rulebooks for players at my table.</p>
          </div>
          <div class="hw-category-description" data-category="restricted">
            <h3>Restricted</h3>
            <p>Almost the same as Free, except I expect a player to run it by me just in case there's something in the source I don't like.</p>
          </div>
          <div class="hw-category-description" data-category="signature">
            <h3>Signature Only</h3>
            <p>Applies specifically to spells, and refers to sources that can only be used to choose a Signature Spell from.</p>
          </div>
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
              ${section.items.map(item => `
                <div class="hw-item" data-category="${item.category}">
                  <div class="hw-item-header">
                    <h3>${item.name}</h3>
                    <span class="hw-category-badge ${item.category}">${item.category.charAt(0).toUpperCase() + item.category.slice(1)}</span>
                  </div>
                  <div class="hw-item-author">By ${item.author}</div>
                  ${item.description ? `<div class="hw-item-description">${item.description}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    
    <style>
      #homebrew-widget {
        font-family: var(--font-primary);
        margin: 0 auto;
        padding: 20px;
        background:rgb(255, 255, 255);
        border-radius: 8px;
        color: #333;
      }
      
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
      
      .hw-category-info {
        margin-bottom: 20px;
        border: 1px solid #ddd;
        border-radius: 4px;
        overflow: hidden;
      }
      
      .hw-info-toggle {
        background: #f0f0f0;
        padding: 10px 15px;
        cursor: pointer;
        font-weight: var(--font-semibold);
      }
      
      .hw-info-content {
        padding: 15px;
        display: none;
      }
      
      .hw-category-description {
        margin-bottom: 15px;
      }
      
      .hw-category-description h3 {
        margin-top: 0;
        margin-bottom: 5px;
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
      }
    </style>
  `;

  // Initialize the widget functionality
  const widget = document.getElementById('homebrew-widget');
  const tabButtons = widget.querySelectorAll('.hw-tab-btn');
  const sections = widget.querySelectorAll('.hw-section');
  const filterButtons = widget.querySelectorAll('.hw-filter-btn');
  const searchInput = widget.querySelector('#hw-search');
  const infoToggle = widget.querySelector('.hw-info-toggle');
  const infoContent = widget.querySelector('.hw-info-content');

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

  // Category info toggle
  infoToggle.addEventListener('click', () => {
    const isVisible = infoContent.style.display === 'block';
    infoContent.style.display = isVisible ? 'none' : 'block';
    infoToggle.querySelector('span').textContent = isVisible ? '▼' : '▲';
  });
};
