window.renderWidget = function(container) {
  container.innerHTML = `
    <div>
      <p>
        When creating your character, make sure to check for these homebrew changes:<br>
        <br>
        <b class="important-link" data-section="Versatile Heritage">Versatile Heritage:</b> You can swap your racial ability score increases to better fit your character concept.<br>
        <b class="important-link" data-section="Additional Skills">Additional Skills:</b> There are two extra skills—Society (Wisdom) and Occultism (Intelligence)—so consider if your character is proficient in them.<br>
        <b class="important-link" data-section="Intelligence Modifier">Intelligence Modifier:</b> Your Intelligence modifier now increases or decreases your number of skill proficiencies: each point above 0 grants an extra proficiency, and each point below 0 removes one.<br>
        <b class="important-link" data-section="Warlock Expanded Spells">Warlock Expanded Spells:</b> If you're a Warlock, you can learn all subclass-granted spells without them counting against your maximum spells known.<br>
        <b class="important-link" data-section="Signature Spell">Signature Spell:</b> When you gain access to a new spell tier, you may also select a Signature Spell that is always prepared and doesn't count against your limit.<br>
        <br>
        <i>Also check the other homebrew rules in this page they will definitely change how play works at the table!<br>I also HIGHLY recommend that you read the rules above (click them) there's more nuance to how they each work included in their full listing.</i>
      </p>
    </div>
  `;

  // Add click-to-scroll for bolded links
  const links = container.querySelectorAll('.important-link');
  links.forEach(link => {
    link.style.cursor = 'pointer';
    link.title = 'Click to scroll to this rule';
    link.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const sectionName = this.getAttribute('data-section');
      
      console.log(`Trying to find widget for: ${sectionName}`);
      
      // Try direct DOM search for widgets (instead of relying on state)
      const allWidgets = document.querySelectorAll('.home-page-widget');
      console.log(`Found ${allWidgets.length} widgets in DOM`);
      
      // Map section names to keywords to find in widget headings
      const keywordMap = {
        'Versatile Heritage': ['versatile', 'heritage'],
        'Additional Skills': ['additional', 'skills', 'society', 'occultism'],
        'Intelligence Modifier': ['intelligence', 'modifier', 'skill proficiencies'],
        'Warlock Expanded Spells': ['warlock', 'spells'],
        'Signature Spell': ['signature', 'spell']
      };
      
      // Find all widget title elements
      const widgetTitles = document.querySelectorAll('.widget-name, .widget-title-container h4, .home-page-widget h3, .home-page-widget h4');
      console.log(`Found ${widgetTitles.length} widget titles in DOM`);
      
      // Try to find the matching widget by looking for section name in the widget headings
      const keywords = keywordMap[sectionName] || [sectionName.toLowerCase().split(' ')[0]];
      console.log(`Looking for keywords: ${keywords.join(', ')}`);
      
      let targetWidget = null;
      let targetHeading = null;
      
      // First try to find by title
      for (const title of widgetTitles) {
        const titleText = title.textContent.toLowerCase();
        console.log(`Checking title: ${titleText}`);
        
        // Check if any keyword is in the title
        if (keywords.some(keyword => titleText.includes(keyword.toLowerCase()))) {
          targetHeading = title;
          targetWidget = findWidgetContainer(title);
          console.log(`Found matching title: ${titleText}`);
          break;
        }
      }
      
      // If no widget found by title, try to search all widget content
      if (!targetWidget) {
        console.log(`No title match, searching widget contents`);
        for (const widget of allWidgets) {
          const widgetText = widget.textContent.toLowerCase();
          if (keywords.some(keyword => widgetText.includes(keyword.toLowerCase()))) {
            targetWidget = widget;
            console.log(`Found widget containing keyword in content`);
            break;
          }
        }
      }
      
      // If we found a widget, scroll to it
      if (targetWidget) {
        console.log(`Scrolling to widget: ${targetWidget.id || 'unnamed'}`);
        // Ensure the target is not within the current container
        if (!container.contains(targetWidget)) {
          scrollToTarget(targetWidget);
          return;
        } else {
          console.log('Widget is inside container, not scrolling');
        }
      } else {
        console.log('No matching widget found');
        
        // As a final fallback, try to find any heading with these keywords
        const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, b');
        for (const heading of allHeadings) {
          if (container.contains(heading)) continue;
          
          const headingText = heading.textContent.toLowerCase();
          if (keywords.some(keyword => headingText.includes(keyword.toLowerCase()))) {
            console.log(`Found matching heading: ${headingText}`);
            scrollToTarget(heading);
            return;
          }
        }
        
        console.log('No matching headings found either');
      }
      
      // Helper function to find the widget container from a title element
      function findWidgetContainer(titleElement) {
        let el = titleElement;
        // Walk up the DOM to find the widget container
        while (el && !el.classList.contains('home-page-widget') && !el.id?.startsWith('homepage-widget-')) {
          el = el.parentElement;
        }
        return el;
      }
      
      // Helper function to scroll to a target and highlight it
      function scrollToTarget(target) {
        if (!target) return;
        
        // Use multiple scroll techniques for best browser support
        try {
          // Scroll with better positioning (center of viewport)
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Also try window.scrollTo with centered positioning
          const rect = target.getBoundingClientRect();
          const targetMiddle = rect.top + (rect.height / 2);
          const viewportMiddle = window.innerHeight / 2;
          
          window.scrollTo({
            top: window.pageYOffset + targetMiddle - viewportMiddle,
            behavior: 'smooth'
          });
          
          // Visual feedback
          target.classList.add('highlight');
          if (!target.style.transition) {
            target.style.transition = 'background-color 0.3s';
          }
          const originalBg = target.style.backgroundColor;
          target.style.backgroundColor = '#ffff99';
          setTimeout(() => {
            target.style.backgroundColor = originalBg;
            target.classList.remove('highlight');
          }, 1500);
        } catch (e) {
          console.error('Error scrolling:', e);
          // If smooth scrolling fails, try instant scroll
          try {
            target.scrollIntoView({ block: 'center' });
          } catch (e2) {
            console.error('Even basic scrolling failed:', e2);
          }
        }
      }
    });
  });
};